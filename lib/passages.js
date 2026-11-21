/** Split study text into readable paragraphs / note slides. */
export function splitPassages(material) {
  const clean = String(material || '')
    .replace(/\r/g, '')
    .replace(/\t/g, ' ')
    .trim();
  if (!clean) return [];

  let parts = clean
    .split(/\n\s*\n+/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter((p) => p.length > 20);

  if (parts.length < 2) {
    parts = clean
      .split(/(?<=[.!?])\s+/)
      .map((p) => p.trim())
      .filter((p) => p.length > 25);
  }

  if (!parts.length) parts = [clean.slice(0, 280)];

  return parts.slice(0, 24).map((text, i) => ({
    id: `p${i + 1}`,
    index: i + 1,
    text: text.slice(0, 420),
  }));
}

/** Pick the best matching passage for a question / answer blob. */
export function findPassageFor(material, ...hints) {
  const passages = splitPassages(material);
  if (!passages.length) return null;

  const blob = hints
    .filter(Boolean)
    .map((h) => String(h).toLowerCase())
    .join(' ');
  if (!blob.trim()) return passages[0];

  const words = [...new Set(blob.match(/[a-zA-Z][a-zA-Z\-]{3,}/g) || [])].slice(0, 12);
  let best = passages[0];
  let bestScore = -1;
  for (const p of passages) {
    const lower = p.text.toLowerCase();
    let score = 0;
    for (const w of words) {
      if (lower.includes(w)) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = p;
    }
  }
  return best;
}

/** Ensure flashcards / quiz / open questions carry a sourcePassage for the P-cite UI. */
export function attachPassagesToTopic(topic) {
  if (!topic) return topic;
  const material = topic.sourceMaterial || buildCorpus(topic);
  const passages = splitPassages(material);
  if (!passages.length) return topic;

  const next = { ...topic, passages };

  next.flashcards = (topic.flashcards || []).map((c, i) => {
    if (c.sourcePassage) return c;
    const hit = findPassageFor(material, c.front, c.back) || passages[i % passages.length];
    return { ...c, sourcePassage: hit.text, passageId: hit.id };
  });

  next.quiz = (topic.quiz || []).map((q, i) => {
    if (q.sourcePassage) return q;
    const hit = findPassageFor(material, q.q, ...(q.options || [])) || passages[i % passages.length];
    return { ...q, sourcePassage: hit.text, passageId: hit.id };
  });

  next.openQuestions = (topic.openQuestions || []).map((q, i) => {
    if (q.sourcePassage) return q;
    const hit = findPassageFor(material, q.q, q.guidance) || passages[i % passages.length];
    return { ...q, sourcePassage: hit.text, passageId: hit.id };
  });

  if (!next.explainSourcePassage) {
    const hit = findPassageFor(material, topic.explainPrompt, ...(topic.explainKeywords || []));
    next.explainSourcePassage = hit?.text || passages[0].text;
  }

  return next;
}

function buildCorpus(topic) {
  const parts = [];
  for (const c of topic.flashcards || []) parts.push(`${c.front} ${c.back}`);
  for (const q of topic.quiz || []) parts.push(`${q.q} ${(q.options || []).join(' ')}`);
  for (const q of topic.openQuestions || []) parts.push(`${q.q} ${q.guidance || ''}`);
  if (topic.explainPrompt) parts.push(topic.explainPrompt);
  return parts.join('\n\n');
}
