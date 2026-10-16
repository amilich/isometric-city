import { timingSafeEqual } from 'node:crypto';

let warnedMissingToken = false;

/**
 * Clients authenticate with `Authorization: Bearer <token>`.
 * The expected token is `SCIM_BEARER_TOKEN`. When that variable is unset,
 * every request is rejected so the API cannot be left open by accident.
 */
export function bearerTokenMatches(authorizationHeader: string | null): boolean {
  const expected = process.env.SCIM_BEARER_TOKEN;
  if (!expected) {
    if (!warnedMissingToken) {
      warnedMissingToken = true;
      console.error('SCIM_BEARER_TOKEN is not set; SCIM requests will be rejected');
    }
    return false;
  }

  if (!authorizationHeader) return false;
  const match = /^Bearer\s+(\S+)\s*$/i.exec(authorizationHeader);
  if (!match) return false;

  const provided = Buffer.from(match[1]);
  const wanted = Buffer.from(expected);
  if (provided.length !== wanted.length) {
    timingSafeEqual(wanted, wanted);
    return false;
  }
  return timingSafeEqual(provided, wanted);
}
