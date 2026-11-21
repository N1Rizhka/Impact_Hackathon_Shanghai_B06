export const runtime = 'nodejs';

import { updateDb } from '@/lib/store';

export async function POST(req, context) {
  const { id } = await context.params;
  const { fromUserId, toUserId, note } = await req.json();
  if (!fromUserId || !toUserId) {
    return Response.json({ error: 'fromUserId and toUserId required' }, { status: 400 });
  }

  let nudge;
  try {
    await updateDb((db) => {
      const room = db.rooms[id];
      if (!room) throw new Error('room not found');
      if (!room.memberIds.includes(fromUserId) || !room.memberIds.includes(toUserId)) {
        throw new Error('both users must be in the room');
      }
      const from = db.users[fromUserId];
      nudge = {
        id: `n_${Date.now().toString(36)}`,
        fromUserId,
        toUserId,
        fromName: from?.name || 'Friend',
        note: String(note || 'Hey — time for today’s session!').slice(0, 160),
        at: Date.now(),
        read: false,
      };
      db.nudges[id] = db.nudges[id] || [];
      db.nudges[id].push(nudge);
      return db;
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 400 });
  }

  return Response.json({ nudge });
}
