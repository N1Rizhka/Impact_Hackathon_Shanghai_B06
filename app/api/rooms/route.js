export const runtime = 'nodejs';

import { summarizeAudience } from '@/lib/demographics';
import { getDb, updateDb } from '@/lib/store';
import { ensureTopic, ensureUser } from '@/lib/ensureUser';

function code() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function withAudience(db, room) {
  const members = (room.memberIds || []).map((id) => db.users[id]).filter(Boolean);
  return {
    ...room,
    audience: summarizeAudience(members),
  };
}

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get('userId');
    const scope = url.searchParams.get('scope'); // 'public' | 'mine' | null
    const db = await getDb();

    let rooms = Object.values(db.rooms);
    if (scope === 'public') {
      rooms = rooms.filter((r) => r.visibility === 'public');
    } else if (userId) {
      rooms = rooms.filter((r) => r.memberIds.includes(userId));
    }

    return Response.json({
      rooms: rooms.map((r) => withAudience(db, r)),
    });
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
      visibility = 'private',
    } = body;

    if (!teamName?.trim() || !topicId || !hostId) {
      return Response.json({ error: 'teamName, topicId, hostId required' }, { status: 400 });
    }

    const vis = visibility === 'public' ? 'public' : 'private';

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
        visibility: vis,
        sessionsByUser: {},
        createdAt: Date.now(),
      };
      db.rooms[room.id] = room;
      db.chats[room.id] = [];
      db.nudges[room.id] = [];
      return db;
    });

    const db = await getDb();
    return Response.json({ room: withAudience(db, room) });
  } catch (e) {
    console.error('[POST /api/rooms]', e);
    return Response.json({ error: e.message || 'Could not create room' }, { status: 500 });
  }
}
