export const runtime = 'nodejs';

import { getDb, updateDb } from '@/lib/store';

function code() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export async function GET(req) {
  const userId = new URL(req.url).searchParams.get('userId');
  const db = await getDb();
  const rooms = Object.values(db.rooms).filter((r) =>
    userId ? r.memberIds.includes(userId) : true,
  );
  return Response.json({ rooms });
}

export async function POST(req) {
  const body = await req.json();
  const {
    teamName,
    topicId,
    period = 14,
    methods = ['flashcards', 'errorHunt', 'quiz'],
    quizEvery = 2,
    hostId,
  } = body;

  if (!teamName?.trim() || !topicId || !hostId) {
    return Response.json({ error: 'teamName, topicId, hostId required' }, { status: 400 });
  }

  let room;
  await updateDb((db) => {
    if (!db.users[hostId]) throw new Error('host not found');
    const inviteCode = code();
    room = {
      id: `r_${Date.now().toString(36)}`,
      teamName: teamName.trim().slice(0, 48),
      topicId,
      period: Number(period),
      methods,
      quizEvery: Number(quizEvery),
      hostId,
      memberIds: [hostId],
      inviteCode,
      sessionsByUser: {},
      createdAt: Date.now(),
    };
    db.rooms[room.id] = room;
    db.chats[room.id] = [];
    db.nudges[room.id] = [];
    return db;
  });

  return Response.json({ room });
}
