export const runtime = 'nodejs';

import { updateDb } from '@/lib/store';

export async function POST(req) {
  const { inviteCode, userId } = await req.json();
  if (!inviteCode || !userId) {
    return Response.json({ error: 'inviteCode and userId required' }, { status: 400 });
  }

  let room;
  try {
    await updateDb((db) => {
      if (!db.users[userId]) throw new Error('user not found');
      room = Object.values(db.rooms).find(
        (r) => r.inviteCode.toUpperCase() === String(inviteCode).trim().toUpperCase(),
      );
      if (!room) throw new Error('invalid invite code');
      if (!room.memberIds.includes(userId)) {
        room.memberIds.push(userId);
      }
      return db;
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 400 });
  }

  return Response.json({ room });
}
