import { getDb, updateDb } from '@/lib/store';

function dmKey(a, b) {
  return `dm:${[a, b].sort().join('__')}`;
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const a = searchParams.get('a');
  const b = searchParams.get('b');
  if (!a || !b) return Response.json({ error: 'a and b required' }, { status: 400 });
  const db = await getDb();
  return Response.json({ chat: db.chats[dmKey(a, b)] || [] });
}

export async function POST(req) {
  const { fromUserId, toUserId, text } = await req.json();
  const msgText = String(text || '').trim().slice(0, 500);
  if (!fromUserId || !toUserId || !msgText) {
    return Response.json({ error: 'fromUserId, toUserId, text required' }, { status: 400 });
  }

  let message;
  try {
    await updateDb((db) => {
      if (!db.users[fromUserId] || !db.users[toUserId]) throw new Error('user not found');
      const key = dmKey(fromUserId, toUserId);
      const from = db.users[fromUserId];
      message = {
        id: `m_${Date.now().toString(36)}`,
        userId: fromUserId,
        name: from.name,
        color: from.color,
        text: msgText,
        at: Date.now(),
      };
      db.chats[key] = db.chats[key] || [];
      db.chats[key].push(message);
      db.chats[key] = db.chats[key].slice(-200);
      return db;
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 400 });
  }

  return Response.json({ message });
}
