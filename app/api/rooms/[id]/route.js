export const runtime = 'nodejs';

import { BUILTIN_TOPICS } from '@/lib/builtinTopics';
import { getDb, updateDb } from '@/lib/store';

export async function GET(_req, context) {
  try {
    const { id } = await context.params;
    const db = await getDb();
    const room = db.rooms[id];
    if (!room) return Response.json({ error: 'not found' }, { status: 404 });
    const members = room.memberIds.map((uid) => db.users[uid]).filter(Boolean);
    const chat = db.chats[room.id] || [];
    const nudges = db.nudges[room.id] || [];
    const topic = db.topics[room.topicId] || BUILTIN_TOPICS[room.topicId] || null;
    return Response.json({ room, members, chat, nudges, topic });
  } catch (e) {
    return Response.json({ error: e.message || 'Failed to load room' }, { status: 500 });
  }
}

export async function POST(req, context) {
  const { id } = await context.params;
  const body = await req.json();
  try {
    await updateDb((db) => {
      const room = db.rooms[id];
      if (!room) throw new Error('not found');
      if (body.action === 'completeSession') {
        const { userId, mode } = body;
        if (!room.memberIds.includes(userId)) throw new Error('not a member');
        room.sessionsByUser[userId] = room.sessionsByUser[userId] || [];
        room.sessionsByUser[userId].push({ mode, at: Date.now() });

        const today = new Date().toISOString().slice(0, 10);
        for (const otherId of room.memberIds) {
          if (otherId === userId) continue;
          const otherSessions = room.sessionsByUser[otherId] || [];
          const otherToday = otherSessions.some(
            (s) => new Date(s.at).toISOString().slice(0, 10) === today,
          );
          if (!otherToday) continue;
          const key = [userId, otherId].sort().join('__');
          const streak = db.pairStreaks[key] || {
            count: 0,
            lastDay: null,
            users: [userId, otherId],
          };
          if (streak.lastDay !== today) {
            const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
            streak.count = streak.lastDay === yesterday ? streak.count + 1 : 1;
            streak.lastDay = today;
            db.pairStreaks[key] = streak;
          }
        }
      }
      return db;
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 400 });
  }
  const db = await getDb();
  return Response.json({ room: db.rooms[id], pairStreaks: db.pairStreaks });
}
