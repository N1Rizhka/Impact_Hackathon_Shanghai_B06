export const runtime = 'nodejs';

import { hashPassword, normalizeUsername, publicUser } from '@/lib/auth';
import { getDb, updateDb } from '@/lib/store';

export async function GET(req) {
  try {
    const id = new URL(req.url).searchParams.get('id');
    const db = await getDb();
    if (id) {
      return Response.json({ user: publicUser(db.users[id] || null) });
    }
    return Response.json({
      users: Object.values(db.users).map(publicUser),
    });
  } catch (e) {
    return Response.json({ error: e.message || 'Failed to load users' }, { status: 500 });
  }
}

/** Register a new account (works across devices via username + password). */
export async function POST(req) {
  try {
    const body = await req.json();
    const name = String(body.name || '').trim().slice(0, 32);
    const username = normalizeUsername(body.username);
    const password = String(body.password || '');
    const deviceId = String(body.deviceId || '').trim();
    const country = String(body.country || '').trim().slice(0, 56);
    const age = Number(body.age);
    const sex = String(body.sex || '').trim().slice(0, 24);

    if (!name) return Response.json({ error: 'Name is required' }, { status: 400 });
    if (!username || username.length < 3) {
      return Response.json({ error: 'Username must be at least 3 characters (a-z, 0-9, _)' }, { status: 400 });
    }
    if (password.length < 4) {
      return Response.json({ error: 'Password must be at least 4 characters' }, { status: 400 });
    }
    if (!country) return Response.json({ error: 'Country is required' }, { status: 400 });
    if (!Number.isFinite(age) || age < 13 || age > 120) {
      return Response.json({ error: 'Enter a valid age (13+)' }, { status: 400 });
    }
    if (!sex) return Response.json({ error: 'Please select sex / gender' }, { status: 400 });
    if (!deviceId) return Response.json({ error: 'deviceId required' }, { status: 400 });

    let user;
    await updateDb((db) => {
      const taken = Object.values(db.users).find((u) => u.username === username);
      if (taken) throw new Error('Username already taken');

      const id = `u_${username.slice(0, 12)}_${Date.now().toString(36).slice(-4)}`;
      user = {
        id,
        name,
        username,
        passwordHash: hashPassword(password),
        deviceId,
        country,
        age: Math.round(age),
        sex,
        color: COLORS[Object.keys(db.users).length % COLORS.length],
        createdAt: Date.now(),
        lastSeen: Date.now(),
        friends: [],
      };
      db.users[id] = user;
      return db;
    });

    return Response.json({ user: publicUser(user) });
  } catch (e) {
    const msg = e.message || 'Could not create profile';
    const status = msg.includes('taken') ? 409 : 500;
    return Response.json({ error: msg }, { status });
  }
}

const COLORS = ['#00C853', '#FF2D55', '#2D6CFF', '#FFB800', '#9C27FF', '#FF6D00', '#00B8D4'];
