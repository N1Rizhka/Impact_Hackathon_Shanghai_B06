import { BUILTIN_TOPICS } from '@/lib/builtinTopics';
import { getDb, updateDb } from '@/lib/store';
import { generateTopicFromMaterial } from '@/lib/generateTopic';

export async function GET() {
  const db = await getDb();
  return Response.json({
    topics: [...Object.values(BUILTIN_TOPICS), ...Object.values(db.topics)],
  });
}

export async function POST(req) {
  const body = await req.json();
  const { title, material, ownerId } = body;
  if (!ownerId) return Response.json({ error: 'ownerId required' }, { status: 400 });

  let topic;
  try {
    topic = generateTopicFromMaterial({ title, material, ownerId });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 400 });
  }

  await updateDb((db) => {
    db.topics[topic.id] = topic;
    return db;
  });

  return Response.json({ topic });
}
