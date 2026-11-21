export const runtime = 'nodejs';

import { updateDb } from '@/lib/store';
import { ensureUser } from '@/lib/ensureUser';

export async function POST(req) {
  try {
    const { inviteCode, roomId, userId, userName, deviceId, userColor } = await req.json();
    if ((!inviteCode && !roomId) || !userId) {
      return Response.json({ error: 'inviteCode or roomId, and userId required' }, { status: 400 });
    }

    let room;
    await updateDb((db) => {
      const user = ensureUser(db, {
        id: userId,
        name: userName,
        deviceId,
        color: userColor,
      });

      if (roomId) {
        room = db.rooms[roomId];
        if (!room) throw new Error('room not found');
        if (room.visibility !== 'public' && !room.memberIds.includes(user.id)) {
          throw new Error('This room is private — ask for an invite code');
        }
      } else {
        room = Object.values(db.rooms).find(
          (r) => r.inviteCode.toUpperCase() === String(inviteCode).trim().toUpperCase(),
        );
        if (!room) throw new Error('invalid invite code');
      }

      if (!room.memberIds.includes(user.id)) {
        room.memberIds.push(user.id);
      }
      return db;
    });

    return Response.json({ room });
  } catch (e) {
    const msg = e.message || 'Could not join room';
    const status =
      msg === 'invalid invite code' || msg.includes('private') || msg === 'room not found' ? 400 : 500;
    return Response.json({ error: msg }, { status });
  }
}
