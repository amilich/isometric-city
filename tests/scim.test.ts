import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';

import { DELETE, GET, PATCH, POST, PUT } from '../src/app/scim/v2/[[...path]]/route';

const TOKEN = 'scim-test-token';
const USER_SCHEMA = 'urn:ietf:params:scim:schemas:core:2.0:User';
const PATCH_SCHEMA = 'urn:ietf:params:scim:api:messages:2.0:PatchOp';
const dataFile = path.join(os.tmpdir(), `isocity-scim-${process.pid}.json`);

process.env.SCIM_BEARER_TOKEN = TOKEN;
process.env.SCIM_DATA_FILE = dataFile;

const handlers = { GET, POST, PUT, PATCH, DELETE };

function resetStore(): void {
  fs.rmSync(dataFile, { force: true });
  fs.rmSync(`${dataFile}.lock`, { force: true });
  fs.rmSync(`${dataFile}.${process.pid}.tmp`, { force: true });
}

after(() => {
  resetStore();
});

type Method = keyof typeof handlers;

async function call(
  method: Method,
  pathname: string,
  body?: unknown,
  token: string | null = TOKEN,
  extraHeaders?: Record<string, string>,
): Promise<Response> {
  const headers = new Headers(extraHeaders);
  if (token) headers.set('authorization', `Bearer ${token}`);
  let payload: string | undefined;
  if (body !== undefined) {
    headers.set('content-type', 'application/scim+json');
    payload = JSON.stringify(body);
  }
  const request = new Request(`http://127.0.0.1:3000${pathname}`, {
    method,
    headers,
    body: payload,
  });
  const url = new URL(pathname, 'http://127.0.0.1:3000');
  const segments = url.pathname
    .replace(/^\/scim\/v2\/?/, '')
    .split('/')
    .filter(Boolean)
    .map((part) => decodeURIComponent(part));
  return handlers[method](request, { params: Promise.resolve({ path: segments }) });
}

async function bodyOf(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  return text ? (JSON.parse(text) as Record<string, unknown>) : {};
}

test('returns 401 when the bearer token is missing or wrong', async () => {
  resetStore();

  const missing = await call('GET', '/scim/v2/Users', undefined, null);
  assert.equal(missing.status, 401);
  assert.match(missing.headers.get('content-type') ?? '', /application\/scim\+json/);
  assert.equal(missing.headers.get('www-authenticate'), 'Bearer realm="scim"');
  const missingBody = await bodyOf(missing);
  assert.equal(missingBody.status, '401');

  const wrong = await call('GET', '/scim/v2/ServiceProviderConfig', undefined, 'not-the-token');
  assert.equal(wrong.status, 401);

  const unauthenticatedCreate = await call('POST', '/scim/v2/Users', { userName: 'ghost' }, null);
  assert.equal(unauthenticatedCreate.status, 401);

  const list = await call('GET', '/scim/v2/Users');
  const listed = await bodyOf(list);
  assert.equal(list.status, 200);
  assert.equal(listed.totalResults, 0);
});

test('serves discovery documents and user CRUD', async () => {
  resetStore();

  const configResponse = await call('GET', '/scim/v2/ServiceProviderConfig');
  assert.equal(configResponse.status, 200);
  const config = await bodyOf(configResponse);
  assert.equal((config.patch as { supported: boolean }).supported, true);
  assert.equal((config.filter as { supported: boolean }).supported, true);
  assert.equal((config.etag as { supported: boolean }).supported, true);
  const schemes = config.authenticationSchemes as Array<{ type: string }>;
  assert.equal(schemes[0].type, 'oauthbearertoken');

  const typesResponse = await call('GET', '/scim/v2/ResourceTypes');
  assert.equal(typesResponse.status, 200);
  const types = await bodyOf(typesResponse);
  const typeResources = types.Resources as Array<{ id: string }>;
  assert.deepEqual(typeResources.map((item) => item.id), ['User']);

  const userType = await call('GET', '/scim/v2/ResourceTypes/User');
  assert.equal(userType.status, 200);

  const schemasResponse = await call('GET', '/scim/v2/Schemas');
  assert.equal(schemasResponse.status, 200);
  const schemas = await bodyOf(schemasResponse);
  const schemaResources = schemas.Resources as Array<{ id: string }>;
  assert.equal(schemaResources[0].id, USER_SCHEMA);

  const schema = await call('GET', `/scim/v2/Schemas/${encodeURIComponent(USER_SCHEMA)}`);
  assert.equal(schema.status, 200);

  const groups = await call('GET', '/scim/v2/Groups');
  assert.equal(groups.status, 404);

  const password = 'correct-horse-battery';
  const created = await call('POST', '/scim/v2/Users', {
    schemas: [USER_SCHEMA],
    userName: 'ada',
    displayName: 'Ada',
    password,
    active: true,
    name: { givenName: 'Ada' },
    emails: [{ value: 'ada@example.com', type: 'work', primary: true }],
  });
  assert.equal(created.status, 201);
  assert.match(created.headers.get('content-type') ?? '', /application\/scim\+json/);
  const ada = await bodyOf(created);
  const adaId = ada.id as string;
  assert.equal(typeof adaId, 'string');
  assert.equal(ada.userName, 'ada');
  assert.equal(ada.displayName, 'Ada');
  assert.equal('password' in ada, false);
  assert.equal(created.headers.get('etag'), (ada.meta as { version: string }).version);
  assert.equal(created.headers.get('location'), (ada.meta as { location: string }).location);
  assert.match(created.headers.get('location') ?? '', new RegExp(`/scim/v2/Users/${adaId}$`));

  const stored = fs.readFileSync(dataFile, 'utf8');
  assert.equal(stored.includes(password), false);
  assert.match(stored, /scrypt\$/);

  const duplicate = await call('POST', '/scim/v2/Users', { userName: 'ADA' });
  assert.equal(duplicate.status, 409);
  const duplicateBody = await bodyOf(duplicate);
  assert.equal(duplicateBody.scimType, 'uniqueness');

  const missingName = await call('POST', '/scim/v2/Users', { displayName: 'No Name' });
  assert.equal(missingName.status, 400);

  const grace = await call('POST', '/scim/v2/Users', {
    userName: 'grace',
    displayName: 'Grace',
    emails: [{ value: 'grace@other.test', type: 'work' }],
  });
  assert.equal(grace.status, 201);
  const graceBody = await bodyOf(grace);
  const graceId = graceBody.id as string;

  const list = await call('GET', '/scim/v2/Users?sortBy=userName&sortOrder=ascending');
  assert.equal(list.status, 200);
  const listed = await bodyOf(list);
  assert.equal(listed.totalResults, 2);
  assert.equal(listed.startIndex, 1);
  const listedUsers = listed.Resources as Array<{ userName: string }>;
  assert.deepEqual(listedUsers.map((user) => user.userName), ['ada', 'grace']);

  const filtered = await call('GET', '/scim/v2/Users?filter=' + encodeURIComponent('userName eq "ada"'));
  const filteredBody = await bodyOf(filtered);
  assert.equal(filtered.status, 200);
  assert.equal(filteredBody.totalResults, 1);
  assert.equal((filteredBody.Resources as Array<{ id: string }>)[0].id, adaId);

  const emailFilter = await call(
    'GET',
    '/scim/v2/Users?filter=' + encodeURIComponent('emails.value co "@example.com" and active eq true'),
  );
  const emailFiltered = await bodyOf(emailFilter);
  assert.equal(emailFiltered.totalResults, 1);
  assert.equal((emailFiltered.Resources as Array<{ userName: string }>)[0].userName, 'ada');

  const valuePath = await call(
    'GET',
    '/scim/v2/Users?filter=' + encodeURIComponent('emails[type eq "work"].value eq "ada@example.com"'),
  );
  const valuePathBody = await bodyOf(valuePath);
  assert.equal(valuePath.status, 200);
  assert.equal(valuePathBody.totalResults, 1);

  const schemaPath = await call(
    'GET',
    '/scim/v2/Users?filter=' + encodeURIComponent(`${USER_SCHEMA}:userName eq "ada"`),
  );
  const schemaPathBody = await bodyOf(schemaPath);
  assert.equal(schemaPath.status, 200);
  assert.equal(schemaPathBody.totalResults, 1);

  const page = await call('GET', '/scim/v2/Users?startIndex=2&count=1&sortBy=userName');
  const pageBody = await bodyOf(page);
  assert.equal(pageBody.totalResults, 2);
  assert.equal(pageBody.itemsPerPage, 1);
  assert.equal((pageBody.Resources as Array<{ userName: string }>)[0].userName, 'grace');

  const projected = await call('GET', `/scim/v2/Users/${adaId}?attributes=userName`);
  const projectedBody = await bodyOf(projected);
  assert.equal(projected.status, 200);
  assert.equal(projectedBody.userName, 'ada');
  assert.equal('displayName' in projectedBody, false);
  assert.equal('emails' in projectedBody, false);
  assert.equal(projectedBody.id, adaId);

  const fetched = await call('GET', `/scim/v2/Users/${adaId}`);
  assert.equal(fetched.status, 200);
  const fetchedBody = await bodyOf(fetched);
  assert.equal(fetchedBody.displayName, 'Ada');
  assert.equal((fetchedBody.emails as Array<{ value: string }>)[0].value, 'ada@example.com');
  const etag = fetched.headers.get('etag');
  assert.equal(etag, (fetchedBody.meta as { version: string }).version);

  const stale = await call(
    'PUT',
    `/scim/v2/Users/${adaId}`,
    { userName: 'ada', displayName: 'Stale' },
    TOKEN,
    { 'if-match': 'W/"999"' },
  );
  assert.equal(stale.status, 412);

  const replaced = await call(
    'PUT',
    `/scim/v2/Users/${adaId}`,
    {
      schemas: [USER_SCHEMA],
      id: adaId,
      userName: 'ada',
      displayName: 'Ada Lovelace',
      name: { givenName: 'Ada' },
      active: true,
      meta: fetchedBody.meta,
    },
    TOKEN,
    { 'if-match': etag ?? '' },
  );
  assert.equal(replaced.status, 200);
  const replacedBody = await bodyOf(replaced);
  assert.equal(replacedBody.displayName, 'Ada Lovelace');
  assert.equal('emails' in replacedBody, false);
  assert.equal('password' in replacedBody, false);

  const afterReplace = await call('GET', `/scim/v2/Users/${adaId}`);
  const afterReplaceBody = await bodyOf(afterReplace);
  assert.equal(afterReplaceBody.displayName, 'Ada Lovelace');
  assert.equal('emails' in afterReplaceBody, false);
  assert.match(fs.readFileSync(dataFile, 'utf8'), /scrypt\$/);

  const patched = await call('PATCH', `/scim/v2/Users/${adaId}`, {
    schemas: [PATCH_SCHEMA],
    Operations: [
      { op: 'replace', path: 'active', value: false },
      { op: 'replace', path: 'name.familyName', value: 'Lovelace' },
      { op: 'add', path: 'emails', value: [{ value: 'ada@example.com', type: 'work', primary: true }] },
    ],
  });
  assert.equal(patched.status, 200);
  const patchedBody = await bodyOf(patched);
  assert.equal(patchedBody.active, false);
  assert.equal((patchedBody.name as { givenName: string; familyName: string }).givenName, 'Ada');
  assert.equal((patchedBody.name as { familyName: string }).familyName, 'Lovelace');
  assert.equal((patchedBody.emails as Array<{ value: string }>)[0].value, 'ada@example.com');

  const afterPatch = await call('GET', `/scim/v2/Users/${adaId}`);
  const afterPatchBody = await bodyOf(afterPatch);
  assert.equal(afterPatchBody.active, false);
  assert.equal((afterPatchBody.name as { familyName: string }).familyName, 'Lovelace');
  assert.notEqual(afterPatch.headers.get('etag'), etag);

  const removed = await call('DELETE', `/scim/v2/Users/${adaId}`);
  assert.equal(removed.status, 204);
  assert.equal(await removed.text(), '');

  const missing = await call('GET', `/scim/v2/Users/${adaId}`);
  assert.equal(missing.status, 404);

  const remaining = await call('GET', '/scim/v2/Users');
  const remainingBody = await bodyOf(remaining);
  assert.equal(remainingBody.totalResults, 1);
  assert.equal((remainingBody.Resources as Array<{ id: string }>)[0].id, graceId);

  const badFilter = await call('GET', '/scim/v2/Users?filter=' + encodeURIComponent('userName eq'));
  assert.equal(badFilter.status, 400);
  const badFilterBody = await bodyOf(badFilter);
  assert.equal(badFilterBody.scimType, 'invalidFilter');
});
