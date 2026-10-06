import { createHash, timingSafeEqual } from 'node:crypto';

function digest(value: string) {
  return createHash('sha256').update(value, 'utf8').digest();
}

function equalSecret(actual: string, expected: string) {
  return timingSafeEqual(digest(actual), digest(expected));
}

/** Checks the shared preview passcode without logging it or exposing a timing oracle. */
export function hasPreviewAccess(
  authorization: string | undefined,
  username: string,
  password: string,
) {
  if (!authorization || authorization.length > 512) return false;
  const match = /^Basic ([A-Za-z0-9+/]+={0,2})$/i.exec(authorization);
  if (!match) return false;
  let decoded: string;
  try {
    decoded = Buffer.from(match[1]!, 'base64').toString('utf8');
  } catch {
    return false;
  }
  const separator = decoded.indexOf(':');
  if (separator < 1) return false;
  const suppliedUser = decoded.slice(0, separator);
  const suppliedPassword = decoded.slice(separator + 1);
  return equalSecret(suppliedUser, username) && equalSecret(suppliedPassword, password);
}
