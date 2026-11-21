export const runtime = 'nodejs';

import { chatCompletion, hasAiConfig } from '@/lib/ai';
import { BUILTIN_TOPICS } from '@/lib/builtinTopics';
import { getDb } from '@/lib/store';
import { getTopicStudyMaterial } from '@/lib/topicMaterial';

/**
 * Premium AI tutor chat — answers ONLY from the topic's study materials
 * (uploaded PDF/notes text). Refuses when the materials don't cover it.
 */
export async function POST(req) {
  try {
    if (!hasAiConfig()) {
      return Response.json(
        { error: 'AI is not configured on this deployment (missing OPENAI_API_KEY).' },
        { status: 503 },
      );
    }

    const body = await req.json();
    const { topicId, topic: topicPayload, messages } = body;
    if (!Array.isArray(messages) || !messages.length) {
      return Response.json({ error: 'messages required' }, { status: 400 });
    }

    const db = await getDb();
    let topic =
      (topicId && (db.topics[topicId] || BUILTIN_TOPICS[topicId])) ||
      (topicPayload?.id ? topicPayload : null);

    // Prefer client snapshot when it includes richer sourceMaterial (same session).
    if (topicPayload?.sourceMaterial && String(topicPayload.sourceMaterial).length > 40) {
      topic = { ...(topic || {}), ...topicPayload };
    }

    const material = getTopicStudyMaterial(topic);
    if (!material || material.length < 40) {
      return Response.json(
        { error: 'This topic has no study material for the AI tutor. Upload a PDF or notes first.' },
        { status: 400 },
      );
    }

    const history = messages
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && m.content)
      .slice(-12)
      .map((m) => ({
        role: m.role,
        content: String(m.content).slice(0, 2000),
      }));

    if (!history.length || history[history.length - 1].role !== 'user') {
      return Response.json({ error: 'Last message must be from the user' }, { status: 400 });
    }

    const { content, model } = await chatCompletion({
      temperature: 0.2,
      maxTokens: 800,
      messages: [
        {
          role: 'system',
          content: `You are Brain Aid's Premium study tutor for the topic "${topic?.title || 'Study pack'}".

STRICT RULES:
1. You may ONLY use facts from STUDY MATERIALS below (from the learner's uploaded PDF/notes).
2. Do NOT use outside knowledge, web facts, or guesses beyond those materials.
3. If the materials do not contain enough information to answer, say clearly: "I don't see that in your uploaded materials." and suggest what part of the notes to re-read.
4. Keep answers concise and helpful for lifelong learners.
5. Quote or paraphrase the materials when helpful; never invent citations.

STUDY MATERIALS:
---
${material}
---`,
        },
        ...history,
      ],
    });

    return Response.json({
      reply: content,
      model,
      grounded: true,
    });
  } catch (e) {
    console.error('[POST /api/topics/chat]', e);
    return Response.json({ error: e.message || 'AI chat failed' }, { status: 500 });
  }
}
