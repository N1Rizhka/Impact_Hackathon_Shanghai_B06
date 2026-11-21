export const runtime = 'nodejs';

import { getDb, updateDb } from '@/lib/store';

/** Unread nudges across all rooms for a user. */
export async function GET(req) {
  try {
    const userId = new URL(req.url).searchParams.get('userId');
    if (!userId) return Response.json({ error: 'userId required' }, { status: 400 });
    const db = await getDb();
    const notifications = [];
    for (const room of Object.values(db.rooms)) {
      if (!room.memberIds?.includes(userId)) continue;
      const list = db.nudges[room.id] || [];
      for (const n of list) {
        if (n.toUserId === userId && !n.read) {
          notifications.push({
            ...n,
            roomId: room.id,
            roomName: room.teamName,
          });
        }
      }
    }
    notifications.sort((a, b) => b.at - a.at);
    return Response.json({ notifications: notifications.slice(0, 20) });
  } catch (e) {
    return Response.json({ error: e.message || 'Failed to load notifications' }, { status: 500 });
  }
}

/** Mark nudges as read (by id list, or all in a room for this user). */
export async function POST(req) {
  try {
    const body = await req.json();
    const { userId, nudgeIds, roomId } = body;
    if (!userId) return Response.json({ error: 'userId required' }, { status: 400 });

    await updateDb((db) => {
      const markList = (list) => {
        for (const n of list) {
          if (n.toUserId !== userId) continue;
          if (nudgeIds?.length && !nudgeIds.includes(n.id)) continue;
          n.read = true;
        }
      };

      if (roomId) {
        markList(db.nudges[roomId] || []);
      } else if (nudgeIds?.length) {
        for (const list of Object.values(db.nudges)) markList(list || []);
      } else {
        for (const list of Object.values(db.nudges)) markList(list || []);
      }
      return db;
    });

    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e.message || 'Failed to mark read' }, { status: 500 });
  }
}
