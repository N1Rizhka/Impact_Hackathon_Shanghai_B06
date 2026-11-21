export const runtime = 'nodejs';

import { normalizeUsername, publicUser, verifyPassword } from '@/lib/auth';
import { updateDb } from '@/lib/store';

/** Log in with username + password from any device. */
export async function POST(req) {
  try {
    const body = await req.json();
    const username = normalizeUsername(body.username);
    const password = String(body.password || '');
    const deviceId = String(body.deviceId || '').trim();

    if (!username || !password) {
      return Response.json({ error: 'Username and password required' }, { status: 400 });
    }

    let user;
    await updateDb((db) => {
      const found = Object.values(db.users).find((u) => u.username === username);
      if (!found || !found.passwordHash) throw new Error('Invalid username or password');
      if (!verifyPassword(password, found.passwordHash)) {
        throw new Error('Invalid username or password');
      }
      found.lastSeen = Date.now();
      if (deviceId) found.deviceId = deviceId;
      user = found;
      return db;
    });

    return Response.json({ user: publicUser(user) });
  } catch (e) {
    return Response.json({ error: e.message || 'Login failed' }, { status: 401 });
  }
}
