export const runtime = 'nodejs';

import { BUILTIN_TOPICS } from '@/lib/builtinTopics';
import { getDb, updateDb } from '@/lib/store';
import { generateTopicFromMaterial } from '@/lib/generateTopic';
import { ensureUser } from '@/lib/ensureUser';

export async function GET() {
  try {
    const db = await getDb();
    return Response.json({
      topics: [...Object.values(BUILTIN_TOPICS), ...Object.values(db.topics)],
    });
  } catch (e) {
    return Response.json({ error: e.message || 'Failed to load topics' }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { title, material, ownerId, ownerName, deviceId, ownerColor } = body;
    if (!ownerId) return Response.json({ error: 'ownerId required' }, { status: 400 });

    let topic;
    try {
      topic = await generateTopicFromMaterial({ title, material, ownerId });
    } catch (e) {
      return Response.json({ error: e.message }, { status: 400 });
    }

    await updateDb((db) => {
      ensureUser(db, {
        id: ownerId,
        name: ownerName,
        deviceId,
        color: ownerColor,
      });
      db.topics[topic.id] = topic;
      return db;
    });

    return Response.json({ topic });
  } catch (e) {
    console.error('[POST /api/topics]', e);
    return Response.json({ error: e.message || 'Could not create topic' }, { status: 500 });
  }
}
