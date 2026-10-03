import { bearerTokenMatches } from './auth';
import { LIST_SCHEMA, MAX_BODY_BYTES } from './constants';
import { serviceProviderConfig, userResourceType, userSchemaDocument } from './discovery';
import { ScimError, methodNotAllowed, scimError, scimJson, scimNoContent } from './errors';
import { etagOf, insertUser, readUser, readUsers, removeUser, updateUser, versionMatches } from './store';
import {
  applyPatch,
  applyReplace,
  buildNewUser,
  parseListQuery,
  projectRecord,
  queryUsers,
  toPublicUser,
  type ListQuery,
} from './users';

const USER_ALWAYS = ['schemas', 'id', 'meta'] as const;

/**
 * SCIM 2.0 request dispatcher. Next.js routes under /scim/v2 delegate here.
 * Authorize with `Authorization: Bearer <SCIM_BEARER_TOKEN>`.
 */
export async function handleScim(request: Request, segments: string[]): Promise<Response> {
  try {
    if (!bearerTokenMatches(request.headers.get('authorization'))) {
      return scimError(401, 'Authorization failure. The authorization header is invalid or missing.');
    }
    const decoded = segments.map(decodeSegment);
    return await dispatch(request, decoded);
  } catch (err) {
    if (err instanceof ScimError) return scimError(err.status, err.message, err.scimType);
    console.error('SCIM request failed:', err instanceof Error ? err.message : 'unknown error');
    return scimError(500, 'Internal server error');
  }
}

async function dispatch(request: Request, segments: string[]): Promise<Response> {
  if (segments.length === 0 || segments.some((segment) => segment.length === 0)) {
    return scimError(404, 'SCIM resource not found');
  }
  const [resource, ...rest] = segments;
  const base = baseUrl(request);

  if (resource === 'ServiceProviderConfig') {
    if (rest.length > 0) return scimError(404, 'ServiceProviderConfig not found');
    if (request.method !== 'GET') return methodNotAllowed(['GET']);
    return present(request, serviceProviderConfig(base), ['schemas', 'meta']);
  }

  if (resource === 'ResourceTypes') {
    const resources = [userResourceType(base)];
    if (rest.length === 0) {
      if (request.method !== 'GET') return methodNotAllowed(['GET']);
      return listResources(request, resources, ['schemas', 'id', 'meta']);
    }
    if (rest.length === 1 && request.method === 'GET') {
      const found = resources.find((item) => item.id === rest[0]);
      if (!found) return scimError(404, `Resource type '${rest[0]}' not found`);
      return present(request, found, ['schemas', 'id', 'meta']);
    }
    if (rest.length === 1) return methodNotAllowed(['GET']);
    return scimError(404, 'Resource type not found');
  }

  if (resource === 'Schemas') {
    const resources = [userSchemaDocument(base)];
    if (rest.length === 0) {
      if (request.method !== 'GET') return methodNotAllowed(['GET']);
      return listResources(request, resources, ['schemas', 'id', 'meta']);
    }
    if (request.method !== 'GET') return methodNotAllowed(['GET']);
    const schemaId = rest.join('/');
    const found = resources.find((item) => item.id === schemaId);
    if (!found) return scimError(404, `Schema '${schemaId}' not found`);
    return present(request, found, ['schemas', 'id', 'meta']);
  }

  if (resource === 'Users') {
    if (rest.length === 0) {
      if (request.method === 'GET') return listUsers(request, base);
      if (request.method === 'POST') return createUser(request, base);
      return methodNotAllowed(['GET', 'POST']);
    }
    if (rest.length === 1) {
      const id = rest[0];
      if (request.method === 'GET') return getUser(request, id, base);
      if (request.method === 'PUT') return replaceUser(request, id, base);
      if (request.method === 'PATCH') return patchUser(request, id, base);
      if (request.method === 'DELETE') return deleteUser(request, id);
      return methodNotAllowed(['GET', 'PUT', 'PATCH', 'DELETE']);
    }
    return scimError(404, 'User not found');
  }

  if (resource === 'Groups') {
    return scimError(404, 'Groups are not supported by this service provider');
  }

  return scimError(404, `Unknown SCIM resource '${resource}'`);
}

async function createUser(request: Request, base: string): Promise<Response> {
  const body = await readJson(request);
  const user = buildNewUser(body);
  insertUser(user);
  const resource = toPublicUser(user, base);
  const meta = resource.meta as { location: string; version: string };
  return scimJson(201, resource, { etag: meta.version, location: meta.location });
}

function listUsers(request: Request, base: string): Response {
  const query = parseListQuery(new URL(request.url));
  const users = readUsers().map((user) => toPublicUser(user, base));
  return listResources(request, users, [...USER_ALWAYS], query);
}

function getUser(request: Request, id: string, base: string): Response {
  const user = readUser(id);
  if (!user) throw new ScimError(404, `User ${id} not found`);
  const ifNoneMatch = request.headers.get('if-none-match');
  if (ifNoneMatch && versionMatches(ifNoneMatch, user.version)) {
    return scimNoContent(304, { etag: etagOf(user.version) });
  }
  const resource = toPublicUser(user, base);
  return present(request, resource, [...USER_ALWAYS], { etag: etagOf(user.version) });
}

async function replaceUser(request: Request, id: string, base: string): Promise<Response> {
  const body = await readJson(request);
  const updated = updateUser(id, request.headers.get('if-match'), (user) => applyReplace(user, body));
  const resource = toPublicUser(updated, base);
  return present(request, resource, [...USER_ALWAYS], { etag: etagOf(updated.version) });
}

async function patchUser(request: Request, id: string, base: string): Promise<Response> {
  const body = await readJson(request);
  const updated = updateUser(id, request.headers.get('if-match'), (user) => applyPatch(user, body));
  const resource = toPublicUser(updated, base);
  return present(request, resource, [...USER_ALWAYS], { etag: etagOf(updated.version) });
}

function deleteUser(request: Request, id: string): Response {
  removeUser(id, request.headers.get('if-match'));
  return scimNoContent(204);
}

function listResources(
  request: Request,
  items: Record<string, unknown>[],
  always: readonly string[],
  parsed?: ListQuery,
): Response {
  const query = parsed ?? parseListQuery(new URL(request.url));
  const filtered = queryUsers(items, query);
  const startIndex = query.startIndex;
  const page = query.count === 0 ? [] : filtered.slice(startIndex - 1, startIndex - 1 + query.count);
  const resources = page.map((item) => projectRecord(item, query.attributes, query.excludedAttributes, always));
  return scimJson(200, {
    schemas: [LIST_SCHEMA],
    totalResults: filtered.length,
    startIndex,
    itemsPerPage: resources.length,
    Resources: resources,
  });
}

function present(
  request: Request,
  record: Record<string, unknown>,
  always: readonly string[],
  extra?: Record<string, string>,
): Response {
  const query = parseListQuery(new URL(request.url));
  return scimJson(200, projectRecord(record, query.attributes, query.excludedAttributes, always), extra);
}

async function readJson(request: Request): Promise<unknown> {
  const contentType = request.headers.get('content-type');
  if (contentType) {
    const media = contentType.split(';')[0].trim().toLowerCase();
    if (media !== 'application/scim+json' && media !== 'application/json') {
      throw new ScimError(415, `Unsupported media type '${media}'`);
    }
  }
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) throw new ScimError(413, 'Payload too large');
  if (text.trim() === '') throw new ScimError(400, 'Request body is required', 'invalidSyntax');
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ScimError(400, 'Request body is not valid JSON', 'invalidSyntax');
  }
}

function baseUrl(request: Request): string {
  const url = new URL(request.url);
  return `${url.origin}/scim/v2`;
}

function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    throw new ScimError(400, 'Invalid path encoding', 'invalidValue');
  }
}
