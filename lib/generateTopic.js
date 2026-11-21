import { chatCompletion, hasAiConfig } from '@/lib/ai';

/** Build flashcards / error-hunt / quiz / explain-back from raw study text. */
export async function generateTopicFromMaterial({ title, material, ownerId }) {
  const clean = String(material || '')
    .replace(/\r/g, '')
    .replace(/\t/g, ' ')
    .trim();
  if (clean.length < 40) {
    throw new Error('Upload or paste more study material (at least ~40 characters).');
  }

  if (hasAiConfig()) {
    try {
      return await generateWithAi({ title, clean, ownerId });
    } catch (err) {
      console.warn('[generateTopic] AI failed, using heuristic:', err?.message || err);
    }
  }

  return generateHeuristic({ title, clean, ownerId });
}

async function generateWithAi({ title, clean, ownerId }) {
  const excerpt = clean.slice(0, 6000);
  const { content } = await chatCompletion({
    temperature: 0.35,
    maxTokens: 2800,
    responseFormat: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `You are Brain Aid, a study coach. From the learner's material, create practice tasks.
Return ONLY valid JSON with this exact shape:
{
  "title": "short topic title",
  "blurb": "one friendly sentence about what they will practice",
  "flashcards": [{"front":"question","back":"answer"}, ... 4 to 6 items],
  "quiz": [{"q":"checkpoint question","options":["A","B","C","D"],"answer":0}, ... 3 to 5 items],
  "openQuestions": [{"q":"open-ended question","guidance":"what a strong answer covers","keywords":["term1","term2"]}, ... 2 to 4 items],
  "errorPassage": [{"t":"token or space","ok":true} or {"t":"wrongWord","ok":false,"id":"e1","fix":"correctWord"}, ...],
  "errorCount": <number of ok:false tokens>,
  "explainPrompt": "prompt asking them to explain the topic in their own words",
  "explainKeywords": ["keyword1","keyword2", ... 4 to 8 key terms from the material]
}

Rules:
- Ground every item in the material; do not invent unrelated facts.
- Quiz items are competitive checkpoints (not lesson content) — test understanding after practice.
- openQuestions must require written reasoning (AI evidence of learning); include 2–4 keyword hints each.
- Quiz answer is the 0-based index of the correct option.
- errorPassage must be a readable sequence of tokens (words, punctuation, spaces). Plant 2–5 deliberate factual/term errors with ok:false, unique ids e1..eN, and the correct fix.
- Keep language clear for lifelong learners.`,
      },
      {
        role: 'user',
        content: `Preferred title: ${title?.trim() || '(invent a short title)'}\n\nStudy material:\n${excerpt}`,
      },
    ],
  });

  const parsed = parseJsonObject(content);
  return normalizeAiTopic(parsed, { title, clean, ownerId });
}

function normalizeAiTopic(raw, { title, clean, ownerId }) {
  const flashcards = Array.isArray(raw.flashcards)
    ? raw.flashcards
        .filter((c) => c && c.front && c.back)
        .slice(0, 8)
        .map((c) => ({
          front: String(c.front).slice(0, 220),
          back: String(c.back).slice(0, 400),
        }))
    : [];

  const quiz = Array.isArray(raw.quiz)
    ? raw.quiz
        .filter((q) => q && q.q && Array.isArray(q.options) && q.options.length >= 2)
        .slice(0, 6)
        .map((q) => {
          const options = q.options.map((o) => String(o).slice(0, 120)).slice(0, 4);
          let answer = Number(q.answer);
          if (!Number.isInteger(answer) || answer < 0 || answer >= options.length) answer = 0;
          return { q: String(q.q).slice(0, 280), options, answer };
        })
    : [];

  let passage = Array.isArray(raw.errorPassage) ? raw.errorPassage : [];
  passage = passage
    .filter((p) => p && typeof p.t === 'string')
    .slice(0, 120)
    .map((p, i) => {
      if (p.ok === false) {
        return {
          t: String(p.t).slice(0, 40),
          ok: false,
          id: String(p.id || `e${i + 1}`).slice(0, 12),
          fix: String(p.fix || p.t).slice(0, 40),
        };
      }
      return { t: String(p.t).slice(0, 40), ok: true };
    });

  let errorCount = passage.filter((p) => !p.ok).length;
  if (errorCount === 0 || passage.length < 4) {
    const fallback = generateHeuristic({ title, clean, ownerId });
    passage = fallback.errorPassage;
    errorCount = fallback.errorCount;
  }

  if (flashcards.length < 3 || quiz.length < 2) {
    const fallback = generateHeuristic({ title, clean, ownerId });
    while (flashcards.length < 3 && fallback.flashcards[flashcards.length]) {
      flashcards.push(fallback.flashcards[flashcards.length]);
    }
    while (quiz.length < 2 && fallback.quiz[quiz.length]) {
      quiz.push(fallback.quiz[quiz.length]);
    }
  }

  const explainKeywords = Array.isArray(raw.explainKeywords)
    ? raw.explainKeywords.map((k) => String(k).toLowerCase()).filter(Boolean).slice(0, 10)
    : [];

  let openQuestions = normalizeOpenQuestions(raw.openQuestions);
  if (openQuestions.length < 2) {
    openQuestions = generateHeuristic({ title, clean, ownerId }).openQuestions;
  }

  const id = `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

  return {
    id,
    title: String(raw.title || title || 'Custom topic').trim().slice(0, 80) || 'Custom topic',
    blurb: String(raw.blurb || 'AI practice pack from your materials').slice(0, 160),
    builtin: false,
    ownerId,
    tags: ['custom', 'ai'],
    sourceMaterial: clean.slice(0, 8000),
    flashcards,
    errorPassage: passage,
    errorCount,
    quiz,
    openQuestions,
    explainPrompt:
      String(raw.explainPrompt || `Explain the core ideas of “${title || 'your topic'}” in your own words.`).slice(
        0,
        280,
      ),
    explainKeywords:
      explainKeywords.length >= 3
        ? explainKeywords
        : generateHeuristic({ title, clean, ownerId }).explainKeywords,
    createdAt: Date.now(),
    generatedBy: 'ai',
  };
}

function normalizeOpenQuestions(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((q) => q && q.q)
    .slice(0, 5)
    .map((q) => ({
      q: String(q.q).slice(0, 320),
      guidance: String(q.guidance || 'Cover the key ideas from your material.').slice(0, 220),
      keywords: Array.isArray(q.keywords)
        ? q.keywords.map((k) => String(k).toLowerCase()).filter(Boolean).slice(0, 6)
        : [],
    }));
}

function parseJsonObject(content) {
  const trimmed = String(content).trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error('AI returned invalid JSON');
  }
}

function generateHeuristic({ title, clean, ownerId }) {
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
  const openQuestions = [
    {
      q: `In your own words, what is the most important idea in “${title || 'this topic'}”?`,
      guidance: 'Name the core concept and why it matters.',
      keywords: words.slice(0, 3),
    },
    {
      q: 'Give one example or application from the material and explain it briefly.',
      guidance: 'Connect a detail from the text to a real situation.',
      keywords: words.slice(1, 4),
    },
    {
      q: 'What would you still want to practice with a teammate?',
      guidance: 'Be specific about a gap or tricky part.',
      keywords: words.slice(2, 5),
    },
  ];
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
    openQuestions,
    explainPrompt: `Explain the core ideas of “${title || 'your topic'}” in your own words.`,
    explainKeywords,
    createdAt: Date.now(),
    generatedBy: 'heuristic',
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
