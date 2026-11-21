import { Redis } from '@upstash/redis';
import path from 'path';

const FILE = path.join(process.cwd(), '.data', 'db.json');

function emptyDb() {
  return {
    users: {},
    rooms: {},
    topics: {},
    chats: {},
    nudges: {},
    pairStreaks: {},
  };
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
      const db = await r.get('brain-aid:db');
      return db ? { ...emptyDb(), ...db } : emptyDb();
    } catch {
      // Fall through to memory if Redis misconfigured.
    }
  }
  if (!globalThis.__brainAidDb) {
    globalThis.__brainAidDb = await readFileDb();
  }
  return globalThis.__brainAidDb;
}

export async function saveDb(db) {
  const r = redis();
  if (r) {
    try {
      await r.set('brain-aid:db', db);
      globalThis.__brainAidDb = db;
      return;
    } catch {
      // Fall through to memory.
    }
  }
  globalThis.__brainAidDb = db;
  await writeFileDb(db);
}

export async function updateDb(mutator) {
  const db = await getDb();
  const draft = typeof structuredClone === 'function' ? structuredClone(db) : JSON.parse(JSON.stringify(db));
  const next = mutator(draft) || draft;
  await saveDb(next);
  return next;
}
