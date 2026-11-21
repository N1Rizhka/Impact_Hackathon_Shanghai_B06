export const runtime = 'nodejs';

import { getDb, updateDb } from '@/lib/store';
import { ensureTopic, ensureUser } from '@/lib/ensureUser';

function code() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export async function GET(req) {
  try {
    const userId = new URL(req.url).searchParams.get('userId');
    const db = await getDb();
    const rooms = Object.values(db.rooms).filter((r) =>
      userId ? r.memberIds.includes(userId) : true,
    );
    return Response.json({ rooms });
  } catch (e) {
    return Response.json({ error: e.message || 'Failed to load rooms' }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const {
      teamName,
      topicId,
      period = 14,
      methods = ['flashcards', 'errorHunt', 'quiz'],
      quizEvery = 2,
      hostId,
      hostName,
      deviceId,
      hostColor,
      topic,
    } = body;

    if (!teamName?.trim() || !topicId || !hostId) {
      return Response.json({ error: 'teamName, topicId, hostId required' }, { status: 400 });
    }

    let room;
    await updateDb((db) => {
      const host = ensureUser(db, {
        id: hostId,
        name: hostName,
        deviceId,
        color: hostColor,
      });
      if (topic?.id) ensureTopic(db, topic);

      const inviteCode = code();
      room = {
        id: `r_${Date.now().toString(36)}`,
        teamName: teamName.trim().slice(0, 48),
        topicId,
        period: Number(period),
        methods,
        quizEvery: Number(quizEvery),
        hostId: host.id,
        memberIds: [host.id],
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
  } catch (e) {
    console.error('[POST /api/rooms]', e);
    return Response.json({ error: e.message || 'Could not create room' }, { status: 500 });
  }
}
