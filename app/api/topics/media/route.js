export const runtime = 'nodejs';

import { chatCompletion, hasAiConfig } from '@/lib/ai';
import { BUILTIN_TOPICS } from '@/lib/builtinTopics';
import { getDb } from '@/lib/store';
import { getTopicStudyMaterial } from '@/lib/topicMaterial';

/**
 * Generate Premium media from topic materials only:
 * - videoExplain → narrated scene deck
 * - photoSchemes → labeled scheme / diagram
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
    const { kind, topicId, topic: topicPayload } = body;
    if (kind !== 'videoExplain' && kind !== 'photoSchemes') {
      return Response.json({ error: 'kind must be videoExplain or photoSchemes' }, { status: 400 });
    }

    const db = await getDb();
    let topic =
      (topicId && (db.topics[topicId] || BUILTIN_TOPICS[topicId])) ||
      (topicPayload?.id ? topicPayload : null);
    if (topicPayload?.sourceMaterial && String(topicPayload.sourceMaterial).length > 40) {
      topic = { ...(topic || {}), ...topicPayload };
    }

    const material = getTopicStudyMaterial(topic);
    if (!material || material.length < 40) {
      return Response.json(
        { error: 'Upload study material first so Premium media can be grounded in your PDF/notes.' },
        { status: 400 },
      );
    }

    if (kind === 'videoExplain') {
      try {
        const { content } = await chatCompletion({
          temperature: 0.35,
          maxTokens: 1800,
          responseFormat: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content: `You create a short study VIDEO EXPLANATION as JSON scenes.
Use ONLY the STUDY MATERIALS. No outside facts.
Return JSON:
{
  "title": "short title",
  "scenes": [
    { "title": "...", "narration": "2-4 spoken sentences", "onScreen": "what to show (labels/diagram cue)", "seconds": 8 }
  ]
}
Make 4 to 6 scenes that teach the core ideas in order.`,
            },
            {
              role: 'user',
              content: `Topic: ${topic?.title || 'Study pack'}\n\nSTUDY MATERIALS:\n${material.slice(0, 8000)}`,
            },
          ],
        });
        const parsed = JSON.parse(extractJson(content));
        const scenes = Array.isArray(parsed.scenes)
          ? parsed.scenes
              .filter((s) => s && s.narration)
              .slice(0, 8)
              .map((s, i) => ({
                title: String(s.title || `Scene ${i + 1}`).slice(0, 80),
                narration: String(s.narration).slice(0, 500),
                onScreen: String(s.onScreen || '').slice(0, 220),
                seconds: Math.min(20, Math.max(5, Number(s.seconds) || 8)),
              }))
          : [];
        if (scenes.length >= 3) {
          return Response.json({
            kind,
            title: String(parsed.title || topic?.title || 'Video explanation').slice(0, 100),
            scenes,
            generatedBy: 'ai',
          });
        }
      } catch (err) {
        console.warn('[media video] AI failed, using material fallback:', err?.message || err);
      }
      return Response.json({ kind, ...fallbackVideo(topic, material), generatedBy: 'fallback' });
    }

    try {
      const { content } = await chatCompletion({
        temperature: 0.3,
        maxTokens: 1600,
        responseFormat: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `You create a PHOTO SCHEME (study diagram) as JSON from materials only.
Return JSON:
{
  "title": "diagram title",
  "caption": "one sentence",
  "nodes": [{"id":"n1","label":"short label","detail":"optional"}],
  "edges": [{"from":"n1","to":"n2","label":"optional"}]
}
Use 4 to 8 nodes that map the process/structure in the materials. No outside concepts.`,
          },
          {
            role: 'user',
            content: `Topic: ${topic?.title || 'Study pack'}\n\nSTUDY MATERIALS:\n${material.slice(0, 8000)}`,
          },
        ],
      });
      const parsed = JSON.parse(extractJson(content));
      const nodes = Array.isArray(parsed.nodes)
        ? parsed.nodes
            .filter((n) => n && n.label)
            .slice(0, 10)
            .map((n, i) => ({
              id: String(n.id || `n${i + 1}`).slice(0, 24),
              label: String(n.label).slice(0, 48),
              detail: String(n.detail || '').slice(0, 120),
            }))
        : [];
      const nodeIds = new Set(nodes.map((n) => n.id));
      const edges = Array.isArray(parsed.edges)
        ? parsed.edges
            .filter((e) => e && nodeIds.has(e.from) && nodeIds.has(e.to))
            .slice(0, 12)
            .map((e) => ({
              from: String(e.from),
              to: String(e.to),
              label: String(e.label || '').slice(0, 40),
            }))
        : [];
      if (nodes.length >= 3) {
        return Response.json({
          kind,
          title: String(parsed.title || `${topic?.title || 'Topic'} scheme`).slice(0, 100),
          caption: String(parsed.caption || '').slice(0, 200),
          nodes,
          edges,
          generatedBy: 'ai',
        });
      }
    } catch (err) {
      console.warn('[media scheme] AI failed, using material fallback:', err?.message || err);
    }
    return Response.json({ kind, ...fallbackScheme(topic, material), generatedBy: 'fallback' });
  } catch (e) {
    console.error('[POST /api/topics/media]', e);
    return Response.json({ error: e.message || 'Media generation failed' }, { status: 500 });
  }
}

function fallbackVideo(topic, material) {
  const chunks = String(material)
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 30)
    .slice(0, 5);
  while (chunks.length < 3) chunks.push(material.slice(0, 160));
  return {
    title: `${topic?.title || 'Topic'} — video`,
    scenes: chunks.map((c, i) => ({
      title: `Part ${i + 1}`,
      narration: c.slice(0, 400),
      onScreen: c.split(/\s+/).slice(0, 8).join(' '),
      seconds: 8,
    })),
  };
}

function fallbackScheme(topic, material) {
  const words = [...new Set(material.toLowerCase().match(/[a-zA-Z][a-zA-Z\-]{4,}/g) || [])].slice(0, 6);
  const nodes = words.map((w, i) => ({
    id: `n${i + 1}`,
    label: w.charAt(0).toUpperCase() + w.slice(1),
    detail: '',
  }));
  while (nodes.length < 3) {
    nodes.push({ id: `n${nodes.length + 1}`, label: `Idea ${nodes.length + 1}`, detail: '' });
  }
  const edges = nodes.slice(0, -1).map((n, i) => ({
    from: n.id,
    to: nodes[i + 1].id,
    label: 'next',
  }));
  return {
    title: `${topic?.title || 'Topic'} scheme`,
    caption: 'Key terms pulled from your materials',
    nodes,
    edges,
  };
}

function extractJson(content) {
  const trimmed = String(content).trim();
  try {
    JSON.parse(trimmed);
    return trimmed;
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
    throw new Error('AI returned invalid JSON');
  }
}
