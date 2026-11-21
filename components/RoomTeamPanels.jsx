'use client';

import { unlockedSponsors } from '@/lib/sponsors';
import { bestQuizAttempt, buildTimeline, memberPoints, teamPoints } from '@/lib/scoring';

export function TeamTimeline({ room, members }) {
  const { overall, nodes } = buildTimeline({
    room,
    members,
    sessionsByUser: room.sessionsByUser || {},
  });

  return (
    <div className="card timeline-card" style={{ marginBottom: 12 }}>
      <div className="timeline-head">
        <div>
          <p className="eyebrow">Team timeline</p>
          <h3 style={{ margin: 0 }}>Progress to the {room.period}-day goal</h3>
        </div>
        <div className="timeline-pct">{overall}%</div>
      </div>
      <div className="timeline-track" aria-hidden>
        <div className="timeline-fill" style={{ width: `${overall}%` }} />
      </div>
      <ol className="timeline-nodes">
        {nodes.map((n) => (
          <li key={n.id} className={n.done ? 'done' : ''}>
            <span className="dot" />
            <strong>{n.label}</strong>
            <span>{n.detail}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function QuizLeaderboard({ room, members, userId }) {
  const rows = members
    .map((m) => {
      const best = bestQuizAttempt(room.sessionsByUser?.[m.id] || []);
      return {
        ...m,
        best,
        ratio: best ? (Number(best.score) || 0) / Math.max(1, Number(best.total) || 1) : -1,
        isYou: m.id === userId,
      };
    })
    .sort((a, b) => {
      if (b.ratio !== a.ratio) return b.ratio - a.ratio;
      return (b.best?.at || 0) - (a.best?.at || 0);
    });

  const any = rows.some((r) => r.best);

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <p className="eyebrow">Checkpoint quiz · competitive</p>
      <h3 style={{ marginTop: 0 }}>Who did better?</h3>
      {!any ? (
        <p className="muted-line">No checkpoint runs yet — finish a quiz to appear here.</p>
      ) : (
        <ol className="rank quiz-rank">
          {rows.map((m, i) => (
            <li key={m.id} className={m.isYou ? 'you' : ''}>
              <span>#{m.best ? i + 1 : '—'}</span>
              <div>
                <strong>
                  {m.name}
                  {m.isYou ? ' (you)' : ''}
                </strong>
                <span className="muted-line">
                  {m.best
                    ? `${m.best.score}/${m.best.total} correct`
                    : 'Not attempted'}
                </span>
              </div>
              <strong>{m.best ? `${Math.round(m.ratio * 100)}%` : '—'}</strong>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export function SponsorPerks({ room, members }) {
  const points = teamPoints(room.sessionsByUser || {});
  const top = Math.max(0, ...members.map((m) => memberPoints(room.sessionsByUser?.[m.id] || [])));
  const unlockPoints = Math.max(points, top);
  const sponsors = unlockedSponsors(unlockPoints);

  return (
    <div className="card sponsor-card">
      <p className="eyebrow">Sponsors</p>
      <h3 style={{ marginTop: 0 }}>Study perks</h3>
      <p className="muted-line" style={{ marginBottom: 12 }}>
        Team best: <strong>{unlockPoints} pts</strong> — unlock vouchers as anyone scores.
      </p>
      <div className="sponsor-grid">
        {sponsors.map((s) => (
          <div
            key={s.id}
            className={`sponsor-tile ${s.unlocked ? 'on' : ''}`}
            style={{ '--sponsor': s.accent }}
          >
            <strong>{s.name}</strong>
            <span className="muted-line">{s.city} · {s.blurb}</span>
            <span>{s.perk}</span>
            {s.unlocked ? (
              <code className="voucher">{s.voucher}</code>
            ) : (
              <span className="muted-line">{s.remaining} pts to unlock</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
