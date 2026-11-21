/** Points from completed sessions — quiz checkpoints weigh more. */
export function sessionPoints(entry) {
  if (!entry) return 0;
  if (entry.mode === 'quiz') {
    const score = Number(entry.score) || 0;
    const total = Math.max(1, Number(entry.total) || 1);
    return 25 + Math.round((score / total) * 35);
  }
  if (entry.mode === 'openQ') return 18;
  if (entry.mode === 'aiChat') return 16;
  if (entry.mode === 'videoExplain' || entry.mode === 'photoSchemes') return 16;
  if (entry.mode === 'explain') return 14;
  if (entry.mode === 'errorHunt') return 12;
  return 8;
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

function dayIndex(createdAt, at) {
  return Math.max(0, Math.floor((at - createdAt) / 86400000));
}

function formatDayLabel(day, period) {
  if (day <= 0) return 'Day 1';
  if (day >= period - 1) return `Day ${period}`;
  return `Day ${day + 1}`;
}

/**
 * Chronological team timeline: kickoff → real activity → quiz checkpoints → goal.
 * Includes simple infographic stats for the room page.
 */
export function buildTimeline({ room, members, sessionsByUser }) {
  const period = Math.max(1, Number(room.period) || 14);
  const created = room.createdAt || Date.now();
  const now = Date.now();
  const elapsedDays = Math.min(period, Math.max(0, (now - created) / 86400000));
  const memberCount = Math.max(1, members?.length || 1);
  const memberById = Object.fromEntries((members || []).map((m) => [m.id, m]));

  const allSessions = Object.entries(sessionsByUser || {}).flatMap(([userId, list]) =>
    (list || []).map((s) => ({ ...s, userId, userName: memberById[userId]?.name || 'Member' })),
  );
  allSessions.sort((a, b) => (a.at || 0) - (b.at || 0));

  const practiceSessions = allSessions.filter((s) => s.mode !== 'quiz');
  const quizSessions = allSessions.filter((s) => s.mode === 'quiz');

  // Planned checkpoint days: mid-period (and late if period is long)
  const plannedQuizDays = period >= 10 ? [Math.floor(period / 2), Math.floor((period * 3) / 4)] : [Math.max(1, Math.floor(period / 2))];

  const events = [];

  events.push({
    id: 'kickoff',
    kind: 'kickoff',
    day: 0,
    at: created,
    label: 'Kickoff',
    detail: room.teamName || 'Room opened',
    done: true,
  });

  // Cluster practice by day
  const practiceByDay = new Map();
  for (const s of practiceSessions) {
    const d = dayIndex(created, s.at || created);
    if (!practiceByDay.has(d)) practiceByDay.set(d, []);
    practiceByDay.get(d).push(s);
  }
  for (const [day, list] of [...practiceByDay.entries()].sort((a, b) => a[0] - b[0])) {
    const modes = [...new Set(list.map((x) => x.mode))];
    events.push({
      id: `practice-${day}`,
      kind: 'practice',
      day,
      at: list[0].at,
      label: 'Practice',
      detail: `${list.length} session${list.length === 1 ? '' : 's'} · ${modes.join(', ')}`,
      done: true,
      count: list.length,
    });
  }

  // Quiz checkpoints: planned slots + actual attempts with scoreboard
  for (const day of plannedQuizDays) {
    const attempts = quizSessions.filter((s) => dayIndex(created, s.at || created) === day);
    // Also attach quizzes near this day (±1) if not already listed elsewhere
    const nearby = quizSessions.filter((s) => {
      const d = dayIndex(created, s.at || created);
      return Math.abs(d - day) <= 1;
    });
    const use = nearby.length ? nearby : attempts;
    const byUser = new Map();
    for (const a of use) {
      const prev = byUser.get(a.userId);
      const ratio = (Number(a.score) || 0) / Math.max(1, Number(a.total) || 1);
      const prevRatio = prev ? (Number(prev.score) || 0) / Math.max(1, Number(prev.total) || 1) : -1;
      if (!prev || ratio >= prevRatio) byUser.set(a.userId, a);
    }
    const board = [...byUser.values()]
      .map((a) => ({
        userId: a.userId,
        name: a.userName,
        score: Number(a.score) || 0,
        total: Number(a.total) || 0,
        pct: Math.round(((Number(a.score) || 0) / Math.max(1, Number(a.total) || 1)) * 100),
      }))
      .sort((a, b) => b.pct - a.pct);

    events.push({
      id: `checkpoint-${day}`,
      kind: 'checkpoint',
      day,
      at: created + day * 86400000,
      label: 'Checkpoint quiz',
      detail: board.length
        ? `Best run: ${board[0].name} ${board[0].pct}%`
        : elapsedDays >= day
          ? 'Ready — take the checkpoint'
          : `Opens around ${formatDayLabel(day, period)}`,
      done: board.length > 0,
      active: elapsedDays >= day - 0.5,
      board,
      cta: true,
    });
  }

  // Orphan quizzes not near planned days
  for (const s of quizSessions) {
    const d = dayIndex(created, s.at || created);
    const covered = plannedQuizDays.some((pd) => Math.abs(pd - d) <= 1);
    if (covered) continue;
    if (events.some((e) => e.id === `checkpoint-extra-${d}`)) continue;
    const sameDay = quizSessions.filter((x) => dayIndex(created, x.at || created) === d);
    const board = sameDay
      .map((a) => ({
        userId: a.userId,
        name: a.userName,
        score: Number(a.score) || 0,
        total: Number(a.total) || 0,
        pct: Math.round(((Number(a.score) || 0) / Math.max(1, Number(a.total) || 1)) * 100),
      }))
      .sort((a, b) => b.pct - a.pct);
    events.push({
      id: `checkpoint-extra-${d}`,
      kind: 'checkpoint',
      day: d,
      at: s.at,
      label: 'Checkpoint quiz',
      detail: board[0] ? `${board[0].name} ${board[0].pct}%` : 'Completed',
      done: true,
      board,
      cta: false,
    });
  }

  events.push({
    id: 'goal',
    kind: 'goal',
    day: period - 1,
    at: created + (period - 1) * 86400000,
    label: `${period}-day goal`,
    detail: elapsedDays >= period ? 'Period complete' : `${Math.round((elapsedDays / period) * 100)}% of the journey`,
    done: elapsedDays >= period,
  });

  events.sort((a, b) => a.day - b.day || (a.at || 0) - (b.at || 0));

  // Deduplicate checkpoint days keeping the richer one
  const seenCheckpointDays = new Set();
  const deduped = [];
  for (const e of events) {
    if (e.kind === 'checkpoint') {
      const key = e.day;
      if (seenCheckpointDays.has(key)) continue;
      seenCheckpointDays.add(key);
    }
    deduped.push(e);
  }

  const activeMembers = members.filter((m) => (sessionsByUser?.[m.id] || []).length > 0).length;
  const pts = teamPoints(sessionsByUser || {});
  const overall = Math.min(
    100,
    Math.round(
      ((practiceSessions.length / Math.max(1, memberCount * 2)) * 35 +
        (quizSessions.length / memberCount) * 35 +
        (elapsedDays / period) * 30) *
        (quizSessions.length || practiceSessions.length ? 1 : 0.4),
    ),
  );

  // Simple daily activity bars (infographic)
  const activity = Array.from({ length: period }, (_, day) => {
    const count = allSessions.filter((s) => dayIndex(created, s.at || created) === day).length;
    return { day, count };
  });
  const maxActivity = Math.max(1, ...activity.map((a) => a.count));

  return {
    overall: Number.isFinite(overall) ? overall : 0,
    events: deduped,
    elapsedDays,
    period,
    stats: {
      sessions: allSessions.length,
      practice: practiceSessions.length,
      quizzes: quizSessions.length,
      activeMembers,
      memberCount,
      points: pts,
    },
    activity,
    maxActivity,
  };
}
