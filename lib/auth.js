import { createHash, randomBytes, timingSafeEqual } from 'crypto';

export function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  const hash = createHash('sha256').update(`${salt}:${password}`).digest('hex');
  return `${salt}$${hash}`;
}

export function verifyPassword(password, stored) {
  if (!stored || !String(stored).includes('$')) return false;
  const [salt, hash] = String(stored).split('$');
  const next = createHash('sha256').update(`${salt}:${password}`).digest('hex');
  try {
    return timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(next, 'hex'));
  } catch {
    return false;
  }
}

export function normalizeUsername(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 24);
}

/** Strip secrets before sending to the client. */
export function publicUser(user) {
  if (!user) return null;
  const { passwordHash, ...rest } = user;
  return rest;
}
