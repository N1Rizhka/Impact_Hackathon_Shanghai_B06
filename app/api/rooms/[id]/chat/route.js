import { getDb, updateDb } from '@/lib/store';

export async function GET(_req, context) {
  const { id } = await context.params;
  const db = await getDb();
  return Response.json({ chat: db.chats[id] || [] });
}

export async function POST(req, context) {
  const { id } = await context.params;
  const { userId, text } = await req.json();
  const msgText = String(text || '').trim().slice(0, 500);
  if (!userId || !msgText) {
    return Response.json({ error: 'userId and text required' }, { status: 400 });
  }

  let message;
  try {
    await updateDb((db) => {
      const room = db.rooms[id];
      if (!room) throw new Error('room not found');
      if (!room.memberIds.includes(userId)) throw new Error('not a member');
      const user = db.users[userId];
      message = {
        id: `m_${Date.now().toString(36)}`,
        userId,
        name: user?.name || 'Someone',
        color: user?.color || '#00C853',
        text: msgText,
        at: Date.now(),
      };
      db.chats[id] = db.chats[id] || [];
      db.chats[id].push(message);
      db.chats[id] = db.chats[id].slice(-200);
      return db;
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 400 });
  }

  return Response.json({ message });
}
