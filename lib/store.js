import { Redis } from '@upstash/redis';
import path from 'path';
import { ensureMockPublicRoom } from '@/lib/seed';

const FILE = path.join(process.cwd(), '.data', 'db.json');
/** Bump to wipe users/rooms for a clean demo slate. */
export const DB_SCHEMA = '4-demo';

function emptyDb() {
  return {
    meta: { schema: DB_SCHEMA, resetAt: Date.now() },
    users: {},
    rooms: {},
    topics: {},
    chats: {},
    nudges: {},
    pairStreaks: {},
  };
}

function migrateOrSeed(db) {
  const incoming = db && typeof db === 'object' ? db : {};
  if (incoming?.meta?.schema !== DB_SCHEMA) {
    const fresh = emptyDb();
    ensureMockPublicRoom(fresh);
    return { db: fresh, wiped: true };
  }
  const next = { ...emptyDb(), ...incoming, meta: { ...(incoming.meta || {}), schema: DB_SCHEMA } };
  ensureMockPublicRoom(next);
  return { db: next, wiped: false };
}

function redis() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  try {
    return new Redis({ url, token });
  } catch {
    return null;
  }
}

/** File persistence only on writable local disk — never on Vercel serverless. */
function canUseFileStore() {
  return !process.env.VERCEL && !process.env.AWS_LAMBDA_FUNCTION_NAME;
}

async function readFileDb() {
  if (!canUseFileStore()) return emptyDb();
  try {
    const fs = await import('fs/promises');
    const raw = await fs.readFile(FILE, 'utf8');
    return { ...emptyDb(), ...JSON.parse(raw) };
  } catch {
    return emptyDb();
  }
}

async function writeFileDb(db) {
  if (!canUseFileStore()) return;
  try {
    const fs = await import('fs/promises');
    await fs.mkdir(path.dirname(FILE), { recursive: true });
    await fs.writeFile(FILE, JSON.stringify(db, null, 2), 'utf8');
  } catch {
    // Ignore read-only filesystem errors.
  }
}

export function multiplayerReady() {
  return Boolean(
    (process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL) &&
      (process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN),
  );
}

export async function getDb() {
  const r = redis();
  if (r) {
    try {
      const raw = await r.get('brain-aid:db');
      const { db, wiped } = migrateOrSeed(raw || emptyDb());
      if (wiped || !raw?.rooms?.r_public_welcome || raw?.meta?.schema !== DB_SCHEMA) {
        try {
          await r.set('brain-aid:db', db);
        } catch {
          /* ignore */
        }
      }
      globalThis.__brainAidDb = db;
      return db;
    } catch {
      // Fall through to memory if Redis misconfigured.
    }
  }
  if (!globalThis.__brainAidDb || globalThis.__brainAidDb?.meta?.schema !== DB_SCHEMA) {
    const fileDb = await readFileDb();
    const { db } = migrateOrSeed(fileDb);
    globalThis.__brainAidDb = db;
    await writeFileDb(db);
  } else {
    ensureMockPublicRoom(globalThis.__brainAidDb);
  }
  return globalThis.__brainAidDb;
}

export async function saveDb(db) {
  const next = { ...db, meta: { ...(db.meta || {}), schema: DB_SCHEMA } };
  const r = redis();
  if (r) {
    try {
      await r.set('brain-aid:db', next);
      globalThis.__brainAidDb = next;
      return;
    } catch {
      // Fall through to memory.
    }
  }
  globalThis.__brainAidDb = next;
  await writeFileDb(next);
}

export async function updateDb(mutator) {
  const db = await getDb();
  const draft = typeof structuredClone === 'function' ? structuredClone(db) : JSON.parse(JSON.stringify(db));
  const next = mutator(draft) || draft;
  await saveDb(next);
  return next;
}
