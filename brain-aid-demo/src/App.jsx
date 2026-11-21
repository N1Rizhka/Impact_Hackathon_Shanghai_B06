import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import Logo from './Logo.jsx'
import './App.css'

const STEPS = ['home', 'room', 'plan', 'confidence', 'learn', 'rank']

const MEMBERS = [
  { id: 'you', name: 'You', color: '#114B3A', vibe: 'host' },
  { id: 'mei', name: 'Mei', color: '#E06B4A', vibe: 'streak queen' },
  { id: 'leo', name: 'Leo', color: '#7EB8C9', vibe: 'night owl' },
  { id: 'aria', name: 'Aria', color: '#E8A838', vibe: 'quiz gremlin' },
]

const METHODS = [
  { id: 'flashcards', label: 'Flashcards', blurb: 'Fast recall drills' },
  { id: 'errorHunt', label: 'Error hunt', blurb: 'Catch AI mistakes' },
  { id: 'quiz', label: 'Live quizzes', blurb: 'Check together' },
  { id: 'explain', label: 'Explain-back', blurb: 'Teach the room' },
]

const PERIODS = [
  { id: 7, label: '7 days', sub: 'sprint' },
  { id: 14, label: '14 days', sub: 'habit kick' },
  { id: 30, label: '30 days', sub: 'deep dive' },
]

const QUIZ_OPTS = [
  { id: 1, label: 'Every day' },
  { id: 2, label: 'Every 2 days' },
  { id: 3, label: 'Twice a week' },
]

const FLASHCARDS = [
  {
    front: 'What does photosynthesis need as inputs?',
    back: 'Light, water, and carbon dioxide (CO₂).',
  },
  {
    front: 'Where do the light-dependent reactions happen?',
    back: 'In the thylakoid membranes of the chloroplast.',
  },
  {
    front: 'What sugar is usually produced?',
    back: 'Glucose (C₆H₁₂O₆), with oxygen released as a byproduct.',
  },
]

const ERROR_PASSAGE = {
  topic: 'Photosynthesis — AI draft (trap mode)',
  disclaimer: 'This explanation was written to include mistakes on purpose. Tap every error you spot.',
  segments: [
    { text: 'Photosynthesis happens in the ', ok: true },
    { id: 'e1', text: 'mitochondria', ok: false, fix: 'chloroplasts' },
    { text: ' of plant cells. Plants take in ', ok: true },
    { id: 'e2', text: 'nitrogen gas', ok: false, fix: 'carbon dioxide (CO₂)' },
    { text: ' and water, then use sunlight to make sugar. The main sugar product is ', ok: true },
    { id: 'e3', text: 'protein', ok: false, fix: 'glucose' },
    { text: ', and they release oxygen. The green pigment that captures light is ', ok: true },
    { id: 'e4', text: 'hemoglobin', ok: false, fix: 'chlorophyll' },
    { text: '.', ok: true },
  ],
}

const EXIT_Q = {
  prompt: 'Quick check: which organelle runs photosynthesis?',
  options: ['Mitochondria', 'Chloroplast', 'Nucleus', 'Ribosome'],
  answer: 1,
}

function Avatar({ member, size = 44 }) {
  return (
    <div
      className="avatar"
      style={{
        width: size,
        height: size,
        background: member.color,
        fontSize: size * 0.36,
      }}
      title={member.name}
    >
      {member.name.slice(0, 1)}
    </div>
  )
}

function Progress({ step }) {
  const idx = STEPS.indexOf(step)
  if (idx <= 0) return null
  return (
    <div className="progress" aria-hidden>
      {STEPS.slice(1).map((s, i) => (
        <span key={s} className={`dot ${i < idx ? 'done' : ''} ${i === idx - 1 ? 'now' : ''}`} />
      ))}
    </div>
  )
}

export default function App() {
  const [step, setStep] = useState('home')
  const [topic] = useState('Photosynthesis basics')
  const [period, setPeriod] = useState(14)
  const [methods, setMethods] = useState(['flashcards', 'errorHunt', 'quiz'])
  const [quizEvery, setQuizEvery] = useState(2)
  const [confidence, setConfidence] = useState(2)
  const [cardIdx, setCardIdx] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [found, setFound] = useState([])
  const [exitPick, setExitPick] = useState(null)
  const [sessionDone, setSessionDone] = useState(false)

  const chosenMethod = useMemo(() => {
    if (confidence <= 2 && methods.includes('flashcards')) return 'flashcards'
    if (confidence >= 4 && methods.includes('errorHunt')) return 'errorHunt'
    if (methods.includes('errorHunt')) return 'errorHunt'
    if (methods.includes('flashcards')) return 'flashcards'
    return 'errorHunt'
  }, [confidence, methods])

  const errorIds = ERROR_PASSAGE.segments.filter((s) => !s.ok).map((s) => s.id)
  const allFound = found.length === errorIds.length

  const rankings = useMemo(() => {
    const base = [
      { id: 'mei', score: 92, streak: 9, label: 'Most committed' },
      { id: 'you', score: sessionDone ? 88 : 71, streak: sessionDone ? 6 : 5, label: sessionDone ? 'Rising fast' : 'Building' },
      { id: 'aria', score: 84, streak: 4, label: 'Quiz beast' },
      { id: 'leo', score: 76, streak: 3, label: 'Steady' },
    ]
    return base
      .map((r) => ({ ...r, member: MEMBERS.find((m) => m.id === r.id) }))
      .sort((a, b) => b.score - a.score)
  }, [sessionDone])

  function toggleMethod(id) {
    setMethods((prev) => {
      if (prev.includes(id)) {
        if (prev.length === 1) return prev
        return prev.filter((m) => m !== id)
      }
      return [...prev, id]
    })
  }

  function toggleError(id) {
    if (sessionDone) return
    setFound((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function finishLearn() {
    setSessionDone(true)
    setStep('rank')
  }

  function resetDemo() {
    setStep('home')
    setPeriod(14)
    setMethods(['flashcards', 'errorHunt', 'quiz'])
    setQuizEvery(2)
    setConfidence(2)
    setCardIdx(0)
    setFlipped(false)
    setFound([])
    setExitPick(null)
    setSessionDone(false)
  }

  return (
    <div className="app">
      <div className="grain" aria-hidden />
      <header className="topbar">
        <button type="button" className="brand" onClick={resetDemo}>
          <Logo className="brand-mark" size={30} />
          Brain Aid
        </button>
        <Progress step={step} />
      </header>

      <main className="stage">
        <AnimatePresence mode="wait">
          {step === 'home' && (
            <motion.section
              key="home"
              className="panel hero"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.35 }}
            >
              <div className="hero-copy">
                <Logo className="hero-logo" size={88} />
                <p className="eyebrow">Lifelong learning, with your people</p>
                <h1>Brain Aid</h1>
                <p className="lede">
                  Open a room. Set a commitment. Learn with AI that adapts to your confidence —
                  including modes that make you catch mistakes, not just collect answers.
                </p>
                <div className="cta-row">
                  <button type="button" className="btn primary" onClick={() => setStep('room')}>
                    Enter the demo room
                  </button>
                  <span className="hint">2-minute interactive walkthrough</span>
                </div>
              </div>
              <div className="hero-visual" aria-hidden>
                <motion.div
                  className="orbit"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 48, repeat: Infinity, ease: 'linear' }}
                >
                  {MEMBERS.map((m, i) => (
                    <div
                      key={m.id}
                      className="orbit-node"
                      style={{ transform: `rotate(${i * 90}deg) translate(118px) rotate(-${i * 90}deg)` }}
                    >
                      <Avatar member={m} size={52} />
                    </div>
                  ))}
                </motion.div>
                <div className="orbit-core">
                  <strong>{topic.split(' ')[0]}</strong>
                  <span>14-day room</span>
                </div>
              </div>
            </motion.section>
          )}

          {step === 'room' && (
            <motion.section
              key="room"
              className="panel"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3 }}
            >
              <div className="panel-head">
                <div>
                  <p className="eyebrow">Your room</p>
                  <h2>{topic}</h2>
                  <p className="sub">Friends + matched learners. One shared commitment.</p>
                </div>
                <div className="pill live">Live demo data</div>
              </div>

              <div className="member-grid">
                {MEMBERS.map((m, i) => (
                  <motion.div
                    key={m.id}
                    className="member"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 * i }}
                  >
                    <Avatar member={m} size={48} />
                    <div>
                      <strong>{m.name}</strong>
                      <span>{m.vibe}</span>
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="actions">
                <button type="button" className="btn ghost" onClick={() => setStep('home')}>
                  Back
                </button>
                <button type="button" className="btn primary" onClick={() => setStep('plan')}>
                  Build the plan
                </button>
              </div>
            </motion.section>
          )}

          {step === 'plan' && (
            <motion.section
              key="plan"
              className="panel"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
            >
              <div className="panel-head">
                <div>
                  <p className="eyebrow">Commitment plan</p>
                  <h2>How will this room learn?</h2>
                  <p className="sub">Period, methods, and quiz rhythm — decided together.</p>
                </div>
              </div>

              <div className="plan-block">
                <h3>Time window</h3>
                <div className="choice-row">
                  {PERIODS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={`choice ${period === p.id ? 'on' : ''}`}
                      onClick={() => setPeriod(p.id)}
                    >
                      <strong>{p.label}</strong>
                      <span>{p.sub}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="plan-block">
                <h3>Learning methods</h3>
                <div className="choice-row wrap">
                  {METHODS.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      className={`choice ${methods.includes(m.id) ? 'on' : ''}`}
                      onClick={() => toggleMethod(m.id)}
                    >
                      <strong>{m.label}</strong>
                      <span>{m.blurb}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="plan-block">
                <h3>Quiz frequency</h3>
                <div className="choice-row">
                  {QUIZ_OPTS.map((q) => (
                    <button
                      key={q.id}
                      type="button"
                      className={`choice ${quizEvery === q.id ? 'on' : ''}`}
                      onClick={() => setQuizEvery(q.id)}
                    >
                      <strong>{q.label}</strong>
                    </button>
                  ))}
                </div>
              </div>

              <div className="actions">
                <button type="button" className="btn ghost" onClick={() => setStep('room')}>
                  Back
                </button>
                <button type="button" className="btn primary" onClick={() => setStep('confidence')}>
                  Lock plan · start session
                </button>
              </div>
            </motion.section>
          )}

          {step === 'confidence' && (
            <motion.section
              key="confidence"
              className="panel"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
            >
              <div className="panel-head">
                <div>
                  <p className="eyebrow">Personalization</p>
                  <h2>How confident do you feel today?</h2>
                  <p className="sub">
                    Brain Aid picks a teaching method from your confidence + the room plan.
                  </p>
                </div>
              </div>

              <div className="confidence">
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={confidence}
                  onChange={(e) => setConfidence(Number(e.target.value))}
                  aria-label="Confidence level"
                />
                <div className="conf-labels">
                  <span>Shaky</span>
                  <span>Okay</span>
                  <span>Solid</span>
                </div>
                <motion.div
                  className="method-preview"
                  key={chosenMethod}
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                >
                  <span className="eyebrow">AI will start with</span>
                  <strong>
                    {chosenMethod === 'flashcards' && 'Flashcards — rebuild the foundation'}
                    {chosenMethod === 'errorHunt' && 'Error hunt — catch planted mistakes'}
                    {chosenMethod === 'quiz' && 'A quick quiz round'}
                  </strong>
                  <p>
                    Room plan: {period} days · quizzes {QUIZ_OPTS.find((q) => q.id === quizEvery)?.label.toLowerCase()} ·{' '}
                    {methods.length} methods unlocked
                  </p>
                </motion.div>
              </div>

              <div className="actions">
                <button type="button" className="btn ghost" onClick={() => setStep('plan')}>
                  Back
                </button>
                <button
                  type="button"
                  className="btn primary"
                  onClick={() => {
                    setFound([])
                    setCardIdx(0)
                    setFlipped(false)
                    setExitPick(null)
                    setStep('learn')
                  }}
                >
                  Begin learning
                </button>
              </div>
            </motion.section>
          )}

          {step === 'learn' && (
            <motion.section
              key="learn"
              className="panel learn"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
            >
              <div className="panel-head">
                <div>
                  <p className="eyebrow">Session · {chosenMethod === 'errorHunt' ? 'Error hunt' : 'Flashcards'}</p>
                  <h2>{topic}</h2>
                  <p className="sub">
                    {chosenMethod === 'errorHunt'
                      ? 'Tap every incorrect claim. Correct answers appear after you catch them.'
                      : 'Flip each card, then take the shared exit check.'}
                  </p>
                </div>
              </div>

              {chosenMethod === 'flashcards' && (
                <div className="flash-wrap">
                  <button
                    type="button"
                    className={`flash ${flipped ? 'is-flipped' : ''}`}
                    onClick={() => setFlipped((f) => !f)}
                  >
                    <div className="flash-face front">
                      <span>Card {cardIdx + 1}/{FLASHCARDS.length}</span>
                      <p>{FLASHCARDS[cardIdx].front}</p>
                      <em>Tap to flip</em>
                    </div>
                    <div className="flash-face back">
                      <span>Answer</span>
                      <p>{FLASHCARDS[cardIdx].back}</p>
                    </div>
                  </button>
                  <div className="flash-nav">
                    <button
                      type="button"
                      className="btn ghost"
                      disabled={cardIdx === 0}
                      onClick={() => {
                        setCardIdx((i) => Math.max(0, i - 1))
                        setFlipped(false)
                      }}
                    >
                      Prev
                    </button>
                    {cardIdx < FLASHCARDS.length - 1 ? (
                      <button
                        type="button"
                        className="btn primary"
                        onClick={() => {
                          setCardIdx((i) => i + 1)
                          setFlipped(false)
                        }}
                      >
                        Next card
                      </button>
                    ) : (
                      <button type="button" className="btn primary" onClick={() => setExitPick(null)}>
                        Ready for exit check
                      </button>
                    )}
                  </div>
                  {cardIdx === FLASHCARDS.length - 1 && (
                    <ExitCheck exitPick={exitPick} setExitPick={setExitPick} onDone={finishLearn} />
                  )}
                </div>
              )}

              {chosenMethod === 'errorHunt' && (
                <div className="hunt">
                  <p className="disclaimer">{ERROR_PASSAGE.disclaimer}</p>
                  <div className="passage">
                    {ERROR_PASSAGE.segments.map((seg, i) =>
                      seg.ok ? (
                        <span key={i}>{seg.text}</span>
                      ) : (
                        <button
                          key={seg.id}
                          type="button"
                          className={`trap ${found.includes(seg.id) ? 'caught' : ''}`}
                          onClick={() => toggleError(seg.id)}
                        >
                          {found.includes(seg.id) ? (
                            <>
                              <s>{seg.text}</s> <b>{seg.fix}</b>
                            </>
                          ) : (
                            seg.text
                          )}
                        </button>
                      ),
                    )}
                  </div>
                  <div className="hunt-status">
                    <div className="meter">
                      <div style={{ width: `${(found.length / errorIds.length) * 100}%` }} />
                    </div>
                    <span>
                      {found.length}/{errorIds.length} mistakes caught
                    </span>
                  </div>
                  {allFound && (
                    <ExitCheck exitPick={exitPick} setExitPick={setExitPick} onDone={finishLearn} />
                  )}
                </div>
              )}

              <div className="actions">
                <button type="button" className="btn ghost" onClick={() => setStep('confidence')}>
                  Back
                </button>
              </div>
            </motion.section>
          )}

          {step === 'rank' && (
            <motion.section
              key="rank"
              className="panel"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
            >
              <div className="panel-head">
                <div>
                  <p className="eyebrow">Room pulse</p>
                  <h2>Commitment board</h2>
                  <p className="sub">
                    Rankings reward showing up and proving understanding — not just points from AI answers.
                  </p>
                </div>
                {sessionDone && <div className="pill win">You completed today&apos;s proof</div>}
              </div>

              <ol className="rank-list">
                {rankings.map((r, i) => (
                  <motion.li
                    key={r.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.08 * i }}
                    className={r.id === 'you' ? 'you' : ''}
                  >
                    <span className="place">#{i + 1}</span>
                    <Avatar member={r.member} size={42} />
                    <div className="rank-meta">
                      <strong>{r.member.name}</strong>
                      <span>
                        {r.label} · {r.streak}-day streak
                      </span>
                    </div>
                    <div className="score">
                      <b>{r.score}</b>
                      <small>commit</small>
                    </div>
                  </motion.li>
                ))}
              </ol>

              <div className="outro">
                <p>
                  That&apos;s the Brain Aid loop: <strong>room → plan → confidence → learn → prove → rank</strong>.
                  Built for lifelong learning with people who stay.
                </p>
              </div>

              <div className="actions">
                <button type="button" className="btn ghost" onClick={() => setStep('confidence')}>
                  Try another confidence
                </button>
                <button type="button" className="btn primary" onClick={resetDemo}>
                  Replay demo
                </button>
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </main>

      <footer className="foot">
        <span>Impact Hackathon · Education &amp; AI concept demo</span>
        <span>Sample data labeled · not a live product</span>
      </footer>
    </div>
  )
}

function ExitCheck({ exitPick, setExitPick, onDone }) {
  const correct = exitPick === EXIT_Q.answer
  return (
    <motion.div
      className="exit"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <h3>Follow-up check</h3>
      <p>{EXIT_Q.prompt}</p>
      <div className="exit-opts">
        {EXIT_Q.options.map((opt, i) => (
          <button
            key={opt}
            type="button"
            className={`choice ${exitPick === i ? (correct ? 'on' : 'bad') : ''}`}
            onClick={() => setExitPick(i)}
            disabled={exitPick !== null}
          >
            <strong>{opt}</strong>
          </button>
        ))}
      </div>
      {exitPick !== null && (
        <div className="exit-result">
          {correct ? (
            <>
              <p>Nice — understanding checked. Onto the room board.</p>
              <button type="button" className="btn primary" onClick={onDone}>
                See rankings
              </button>
            </>
          ) : (
            <>
              <p>Not quite. Chloroplasts run photosynthesis. Try again conceptually next round.</p>
              <button type="button" className="btn primary" onClick={onDone}>
                Still see rankings
              </button>
            </>
          )}
        </div>
      )}
    </motion.div>
  )
}
