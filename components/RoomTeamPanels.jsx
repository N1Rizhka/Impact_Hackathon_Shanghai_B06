'use client';

import { unlockedSponsors } from '@/lib/sponsors';
import { buildTimeline, memberPoints } from '@/lib/scoring';

export function TeamTimeline({ room, members, onStartQuiz }) {
  const { overall, events, period, stats, activity, maxActivity } = buildTimeline({
    room,
    members,
    sessionsByUser: room.sessionsByUser || {},
  });

  return (
    <div className="card timeline-card" style={{ marginBottom: 14 }}>
      <div className="timeline-head">
        <div>
          <p className="eyebrow">Team timeline</p>
          <h3 style={{ margin: 0 }}>{period}-day journey</h3>
        </div>
        <div className="timeline-pct">{overall}%</div>
      </div>

      <div className="info-strip" aria-label="Team progress stats">
        <div>
          <strong>{stats.sessions}</strong>
          <span>sessions</span>
        </div>
        <div>
          <strong>{stats.quizzes}</strong>
          <span>checkpoints</span>
        </div>
        <div>
          <strong>
            {stats.activeMembers}/{stats.memberCount}
          </strong>
          <span>active</span>
        </div>
        <div>
          <strong>{stats.points}</strong>
          <span>points</span>
        </div>
      </div>

      <div className="activity-bars" aria-hidden>
        {activity.map((a) => (
          <span
            key={a.day}
            title={`Day ${a.day + 1}: ${a.count}`}
            style={{ height: `${Math.max(8, (a.count / maxActivity) * 100)}%` }}
            className={a.count ? 'on' : ''}
          />
        ))}
      </div>
      <p className="muted-line activity-caption">Daily activity</p>

      <ol className="chrono-line">
        {events.map((e) => (
          <li key={e.id} className={`chrono-item ${e.kind} ${e.done ? 'done' : ''} ${e.active ? 'active' : ''}`}>
            <div className="chrono-rail" aria-hidden>
              <span className="chrono-dot" />
            </div>
            <div className="chrono-body">
              <div className="chrono-meta">
                <span className="chrono-day">Day {e.day + 1}</span>
                <strong>{e.label}</strong>
              </div>
              <p className="muted-line">{e.detail}</p>
              {e.kind === 'checkpoint' && e.board?.length > 0 && (
                <ul className="chrono-board">
                  {e.board.map((row, i) => (
                    <li key={row.userId}>
                      <span>
                        #{i + 1} {row.name}
                      </span>
                      <div className="mini-bar" aria-hidden>
                        <i style={{ width: `${row.pct}%` }} />
                      </div>
                      <strong>
                        {row.score}/{row.total}
                      </strong>
                    </li>
                  ))}
                </ul>
              )}
              {e.kind === 'checkpoint' && e.cta && onStartQuiz && (
                <button type="button" className="btn sm primary" onClick={onStartQuiz}>
                  {e.done ? 'Retake checkpoint' : 'Take checkpoint'}
                </button>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function SponsorStrip({ room, members }) {
  const top = Math.max(0, ...members.map((m) => memberPoints(room.sessionsByUser?.[m.id] || [])));
  const sponsors = unlockedSponsors(top);
  const unlocked = sponsors.filter((s) => s.unlocked);
  if (!unlocked.length && top < 20) return null;

  return (
    <div className="sponsor-strip">
      {sponsors.map((s) => (
        <div key={s.id} className={`sponsor-chip ${s.unlocked ? 'on' : ''}`}>
          <strong>{s.name}</strong>
          {s.unlocked ? <code>{s.voucher}</code> : <span>{s.remaining} pts</span>}
        </div>
      ))}
    </div>
  );
}
