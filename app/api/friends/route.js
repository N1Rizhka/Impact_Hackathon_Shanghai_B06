export const runtime = 'nodejs';

import { getDb, updateDb } from '@/lib/store';

function pairKey(a, b) {
  return [a, b].sort().join('__');
}

export async function GET(req) {
  const userId = new URL(req.url).searchParams.get('userId');
  if (!userId) return Response.json({ error: 'userId required' }, { status: 400 });
  const db = await getDb();
  const me = db.users[userId];
  if (!me) return Response.json({ error: 'user not found' }, { status: 404 });

  const friends = (me.friends || [])
    .map((id) => db.users[id])
    .filter(Boolean)
    .map((f) => ({
      ...f,
      streak: db.pairStreaks[pairKey(userId, f.id)] || { count: 0, lastDay: null },
    }));

  return Response.json({ friends });
}

export async function POST(req) {
  const { userId, friendCodeOrName } = await req.json();
  const q = String(friendCodeOrName || '').trim();
  if (!userId || !q) return Response.json({ error: 'userId and friend required' }, { status: 400 });

  let friend;
  try {
    await updateDb((db) => {
      const me = db.users[userId];
      if (!me) throw new Error('user not found');
      friend =
        db.users[q] ||
        Object.values(db.users).find((u) => u.name.toLowerCase() === q.toLowerCase());
      if (!friend) throw new Error('friend not found — they must open Brain Aid once first');
      if (friend.id === userId) throw new Error('cannot friend yourself');
      me.friends = me.friends || [];
      friend.friends = friend.friends || [];
      if (!me.friends.includes(friend.id)) me.friends.push(friend.id);
      if (!friend.friends.includes(userId)) friend.friends.push(userId);
      return db;
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 400 });
  }

  return Response.json({ friend });
}
