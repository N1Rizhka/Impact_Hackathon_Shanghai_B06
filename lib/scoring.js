/** Points from completed sessions — quiz checkpoints weigh more. */
export function sessionPoints(entry) {
  if (!entry) return 0;
  if (entry.mode === 'quiz') {
    const score = Number(entry.score) || 0;
    const total = Math.max(1, Number(entry.total) || 1);
    return 25 + Math.round((score / total) * 35);
  }
  if (entry.mode === 'openQ') return 18;
  if (entry.mode === 'explain') return 14;
  if (entry.mode === 'errorHunt') return 12;
  return 8; // flashcards / default
}

export function memberPoints(sessions = []) {
  return sessions.reduce((sum, s) => sum + sessionPoints(s), 0);
}

export function teamPoints(sessionsByUser = {}) {
  return Object.values(sessionsByUser).reduce((sum, list) => sum + memberPoints(list), 0);
}

export function bestQuizAttempt(sessions = []) {
  const quizzes = sessions.filter((s) => s.mode === 'quiz' && s.total);
  if (!quizzes.length) return null;
  return quizzes.reduce((best, s) => {
    const ratio = (Number(s.score) || 0) / Math.max(1, Number(s.total) || 1);
    const bestRatio = best
      ? (Number(best.score) || 0) / Math.max(1, Number(best.total) || 1)
      : -1;
    return ratio >= bestRatio ? s : best;
  }, null);
}

/** Goal timeline milestones for a room period. */
export function buildTimeline({ room, members, sessionsByUser }) {
  const period = Math.max(1, Number(room.period) || 14);
  const created = room.createdAt || Date.now();
  const elapsedDays = Math.min(period, Math.max(0, (Date.now() - created) / 86400000));
  const memberCount = Math.max(1, members?.length || 1);
  const allSessions = Object.values(sessionsByUser || {}).flat();
  const studyCount = allSessions.filter((s) => s.mode !== 'quiz').length;
  const quizCount = allSessions.filter((s) => s.mode === 'quiz').length;
  const openCount = allSessions.filter((s) => s.mode === 'openQ').length;
  const expectedStudy = memberCount * Math.max(2, Math.ceil(period / 3));
  const studyPct = Math.min(1, studyCount / expectedStudy);
  const quizPct = Math.min(1, quizCount / memberCount);
  const openPct = Math.min(1, openCount / memberCount);
  const timePct = Math.min(1, elapsedDays / period);
  const overall = Math.round(((studyPct + quizPct + openPct + timePct) / 4) * 100);

  const nodes = [
    {
      id: 'kickoff',
      label: 'Kickoff',
      detail: 'Room opened',
      done: true,
    },
    {
      id: 'practice',
      label: 'Practice',
      detail: `${studyCount} study sessions`,
      done: studyCount >= memberCount,
    },
    {
      id: 'checkpoint',
      label: 'Quiz checkpoint',
      detail: quizCount ? `${quizCount} attempt${quizCount === 1 ? '' : 's'}` : 'Waiting for first run',
      done: quizCount >= 1,
    },
    {
      id: 'open',
      label: 'Open questions',
      detail: openCount ? `${openCount} AI reflections` : 'Show your reasoning',
      done: openCount >= 1,
    },
    {
      id: 'goal',
      label: `${period}-day goal`,
      detail: `${Math.round(timePct * 100)}% of period · ${overall}% team progress`,
      done: overall >= 70 || timePct >= 1,
    },
  ];

  return { overall, nodes, elapsedDays, period };
}
