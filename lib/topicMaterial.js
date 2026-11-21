/** Text the AI tutor is allowed to use for a topic (uploaded PDF/notes only). */
export function getTopicStudyMaterial(topic) {
  if (!topic) return '';
  const direct = String(topic.sourceMaterial || '').trim();
  if (direct.length >= 40) return direct.slice(0, 12000);

  // Built-in packs have no upload — derive a closed corpus from the pack itself.
  const parts = [];
  if (topic.title) parts.push(`Topic: ${topic.title}`);
  if (topic.blurb) parts.push(topic.blurb);
  for (const c of topic.flashcards || []) {
    parts.push(`Q: ${c.front}\nA: ${c.back}`);
  }
  for (const q of topic.quiz || []) {
    parts.push(`Checkpoint: ${q.q}\nOptions: ${(q.options || []).join(' | ')}`);
  }
  for (const q of topic.openQuestions || []) {
    parts.push(`Open: ${q.q}\nGuidance: ${q.guidance || ''}`);
  }
  if (topic.explainPrompt) parts.push(topic.explainPrompt);
  return parts.join('\n\n').slice(0, 12000);
}
