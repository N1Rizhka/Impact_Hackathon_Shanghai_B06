import { Redis } from '@upstash/redis';
import { promises as fs } from 'fs';
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
  return new Redis({ url, token });
}

async function readFileDb() {
  try {
    const raw = await fs.readFile(FILE, 'utf8');
    return { ...emptyDb(), ...JSON.parse(raw) };
  } catch {
    return emptyDb();
  }
}

async function writeFileDb(db) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(db, null, 2), 'utf8');
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
    const db = await r.get('brain-aid:db');
    return db ? { ...emptyDb(), ...db } : emptyDb();
  }
  if (!globalThis.__brainAidDb) {
    globalThis.__brainAidDb = await readFileDb();
  }
  return globalThis.__brainAidDb;
}

export async function saveDb(db) {
  const r = redis();
  if (r) {
    await r.set('brain-aid:db', db);
    return;
  }
  globalThis.__brainAidDb = db;
  await writeFileDb(db);
}

export async function updateDb(mutator) {
  const db = await getDb();
  const next = mutator(db) || db;
  await saveDb(next);
  return next;
}
