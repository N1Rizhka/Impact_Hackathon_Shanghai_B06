export const runtime = 'nodejs';

import { updateDb } from '@/lib/store';
import { ensureUser } from '@/lib/ensureUser';

export async function POST(req) {
  try {
    const { inviteCode, userId, userName, deviceId, userColor } = await req.json();
    if (!inviteCode || !userId) {
      return Response.json({ error: 'inviteCode and userId required' }, { status: 400 });
    }

    let room;
    await updateDb((db) => {
      const user = ensureUser(db, {
        id: userId,
        name: userName,
        deviceId,
        color: userColor,
      });
      room = Object.values(db.rooms).find(
        (r) => r.inviteCode.toUpperCase() === String(inviteCode).trim().toUpperCase(),
      );
      if (!room) throw new Error('invalid invite code');
      if (!room.memberIds.includes(user.id)) {
        room.memberIds.push(user.id);
      }
      return db;
    });

    return Response.json({ room });
  } catch (e) {
    const msg = e.message || 'Could not join room';
    const status = msg === 'invalid invite code' ? 400 : 500;
    return Response.json({ error: msg }, { status });
  }
}
