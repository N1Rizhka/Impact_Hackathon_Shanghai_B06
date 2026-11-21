/** Build flashcards / error-hunt / quiz / explain-back from raw study text. */
export function generateTopicFromMaterial({ title, material, ownerId }) {
  const clean = String(material || '')
    .replace(/\r/g, '')
    .replace(/\t/g, ' ')
    .trim();
  if (clean.length < 40) {
    throw new Error('Upload or paste more study material (at least ~40 characters).');
  }

  const sentences = clean
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20);

  const words = [...new Set(clean.toLowerCase().match(/[a-zA-Z][a-zA-Z\-]{3,}/g) || [])]
    .filter((w) => !STOP.has(w))
    .slice(0, 24);

  const flashcards = sentences.slice(0, 5).map((s, i) => {
    const key = words[i] || words[0] || 'concept';
    return {
      front: `What should you remember about “${key}”?`,
      back: s.length > 180 ? `${s.slice(0, 177)}…` : s,
    };
  });
  while (flashcards.length < 3) {
    flashcards.push({
      front: `Key idea #${flashcards.length + 1}`,
      back: clean.slice(0, 160),
    });
  }

  const baseSentence =
    sentences[0] ||
    clean.split(/\s+/).slice(0, 28).join(' ') + '.';
  const { passage, errorCount } = plantErrors(baseSentence, words);

  const quiz = [];
  for (let i = 0; i < Math.min(3, words.length); i += 1) {
    const ans = words[i];
    const opts = shuffle([
      ans,
      words[(i + 3) % words.length] || 'alpha',
      words[(i + 5) % words.length] || 'beta',
      words[(i + 7) % words.length] || 'gamma',
    ]);
    quiz.push({
      q: `Which term appears in your material and matters for “${title || 'this topic'}"?`,
      options: opts.map(cap),
      answer: opts.indexOf(ans),
    });
  }
  if (!quiz.length) {
    quiz.push({
      q: 'Did you upload study material for this topic?',
      options: ['Yes', 'No', 'Maybe', 'Skip'],
      answer: 0,
    });
  }

  const explainKeywords = words.slice(0, 6);
  const id = `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

  return {
    id,
    title: title?.trim() || 'Custom topic',
    blurb: `Generated from your materials · ${clean.length} chars`,
    builtin: false,
    ownerId,
    tags: ['custom'],
    sourceMaterial: clean.slice(0, 8000),
    flashcards,
    errorPassage: passage,
    errorCount,
    quiz,
    explainPrompt: `Explain the core ideas of “${title || 'your topic'}” in your own words.`,
    explainKeywords,
    createdAt: Date.now(),
  };
}

function plantErrors(sentence, words) {
  const tokens = sentence.match(/\s+|[^\s]+/g) || [sentence];
  const candidates = tokens
    .map((t, i) => ({ t, i }))
    .filter(({ t }) => /^[A-Za-z][A-Za-z\-]{3,}$/.test(t));

  const picks = shuffle(candidates).slice(0, Math.min(4, Math.max(2, candidates.length)));
  const errorIds = new Set(picks.map((p) => p.i));
  const decoys = ['quantum', 'banana', 'mitochondria', 'helium', 'placeholder', 'foobar', 'nitrogen'];

  let n = 0;
  const passage = tokens.map((t, i) => {
    if (!errorIds.has(i)) return { t, ok: true };
    n += 1;
    const id = `e${n}`;
    const fix = t;
    const bad = decoys[(n + t.length) % decoys.length];
    return { t: bad, ok: false, id, fix };
  });

  // If planting failed, synthesize a short passage with errors.
  if (n === 0) {
    const w = words[0] || 'concept';
    return {
      errorCount: 2,
      passage: [
        { t: 'The ', ok: true },
        { t: 'key ', ok: true },
        { t: 'idea ', ok: true },
        { t: 'is ', ok: true },
        { t: 'banana', ok: false, id: 'e1', fix: w },
        { t: ', ', ok: true },
        { t: 'not ', ok: true },
        { t: 'helium', ok: false, id: 'e2', fix: words[1] || 'practice' },
        { t: '.', ok: true },
      ],
    };
  }

  return { passage, errorCount: n };
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function cap(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

const STOP = new Set(
  'this that with from your have will were been they them then than their there about into after before over under such only also just like when what which while would could should for and the are was not but can may use using used into onto across within without against during because against between among'.split(
    ' ',
  ),
);
