import { ERROR_SCHEMA } from './constants';

export class ScimError extends Error {
  readonly status: number;
  readonly scimType?: string;

  constructor(status: number, detail: string, scimType?: string) {
    super(detail);
    this.name = 'ScimError';
    this.status = status;
    this.scimType = scimType;
  }
}

export function scimErrorBody(status: number, detail: string, scimType?: string): Record<string, unknown> {
  const body: Record<string, unknown> = {
    schemas: [ERROR_SCHEMA],
    status: String(status),
    detail,
  };
  if (scimType) body.scimType = scimType;
  return body;
}

export function scimJson(status: number, body: unknown, extra?: Record<string, string>): Response {
  const headers = new Headers({
    'content-type': 'application/scim+json; charset=utf-8',
    'cache-control': 'no-store',
  });
  if (extra) {
    for (const [key, value] of Object.entries(extra)) headers.set(key, value);
  }
  return new Response(JSON.stringify(body), { status, headers });
}

export function scimError(
  status: number,
  detail: string,
  scimType?: string,
  extra?: Record<string, string>,
): Response {
  const headers = { ...extra };
  if (status === 401 && !headers['www-authenticate']) {
    headers['www-authenticate'] = 'Bearer realm="scim"';
  }
  return scimJson(status, scimErrorBody(status, detail, scimType), headers);
}

export function scimNoContent(status: 204 | 304, extra?: Record<string, string>): Response {
  const headers = new Headers({ 'cache-control': 'no-store' });
  if (extra) {
    for (const [key, value] of Object.entries(extra)) headers.set(key, value);
  }
  return new Response(null, { status, headers });
}

export function methodNotAllowed(allow: readonly string[]): Response {
  return scimError(405, 'Method not allowed', undefined, { allow: allow.join(', ') });
}
