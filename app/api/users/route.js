import { getDb, updateDb } from '@/lib/store';

export async function GET(req) {
  const id = new URL(req.url).searchParams.get('id');
  const db = await getDb();
  if (id) {
    return Response.json({ user: db.users[id] || null });
  }
  return Response.json({ users: Object.values(db.users) });
}

export async function POST(req) {
  const body = await req.json();
  const name = String(body.name || '').trim().slice(0, 32);
  const deviceId = String(body.deviceId || '').trim();
  if (!name || !deviceId) {
    return Response.json({ error: 'name and deviceId required' }, { status: 400 });
  }

  let user;
  await updateDb((db) => {
    // One user locked to this browser/device.
    const existing = Object.values(db.users).find((u) => u.deviceId === deviceId);
    if (existing) {
      existing.name = name;
      existing.lastSeen = Date.now();
      user = existing;
      return db;
    }
    const id = `u_${deviceId.slice(0, 12)}`;
    user = {
      id,
      name,
      deviceId,
      color: COLORS[Object.keys(db.users).length % COLORS.length],
      createdAt: Date.now(),
      lastSeen: Date.now(),
      friends: [],
    };
    db.users[id] = user;
    return db;
  });

  return Response.json({ user });
}

const COLORS = ['#00C853', '#FF2D55', '#2D6CFF', '#FFB800', '#9C27FF', '#FF6D00', '#00B8D4'];
