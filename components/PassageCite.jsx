'use client';

import { useEffect, useId, useRef, useState } from 'react';

/**
 * Round “P” control — hover/focus/tap reveals the source paragraph from notes.
 */
export default function PassageCite({ passage, label = 'From your notes', forceOpen = false, onOpened }) {
  const [open, setOpen] = useState(false);
  const shown = forceOpen || open;
  const tipId = useId();
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!shown || !onOpened) return;
    onOpened();
  }, [shown, onOpened]);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDoc);
    return () => document.removeEventListener('pointerdown', onDoc);
  }, [open]);

  if (!passage) return null;

  return (
    <span
      className={`passage-cite ${shown ? 'open' : ''} ${forceOpen ? 'tutorial' : ''}`}
      ref={wrapRef}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => !forceOpen && setOpen(false)}
    >
      <button
        type="button"
        className="passage-p"
        aria-label="Show source paragraph from your notes"
        aria-describedby={shown ? tipId : undefined}
        aria-expanded={shown}
        onFocus={() => setOpen(true)}
        onBlur={() => !forceOpen && setOpen(false)}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        P
      </button>
      {shown && (
        <span className="passage-tip" id={tipId} role="tooltip">
          <strong>{label}</strong>
          <em>{passage}</em>
        </span>
      )}
    </span>
  );
}

export function PassageTutorial({ onDismiss }) {
  return (
    <div className="passage-tutorial" role="dialog" aria-modal="true">
      <div className="passage-tutorial-card">
        <p className="eyebrow">Quick tip</p>
        <h2 style={{ marginTop: 0 }}>Find the paragraph behind each question</h2>
        <p>
          Look for the round <span className="passage-p demo">P</span> next to a question. Hover or tap
          it to see the matching slide / paragraph from your uploaded notes.
        </p>
        <div className="passage-tutorial-demo">
          <span className="muted-line">Example</span>
          <div className="passage-tutorial-row">
            <strong>What captures sunlight in leaves?</strong>
            <span className="passage-p demo" aria-hidden="true">
              P
            </span>
          </div>
          <div className="passage-tip static" role="tooltip">
            <strong>From your notes</strong>
            <em>
              Chlorophyll in leaves captures sunlight. Water and carbon dioxide become glucose and
              oxygen.
            </em>
          </div>
        </div>
        <button type="button" className="btn primary" onClick={onDismiss}>
          Got it — start practicing
        </button>
      </div>
    </div>
  );
}
