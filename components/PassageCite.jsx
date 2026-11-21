'use client';

import { useEffect, useId, useRef, useState } from 'react';

/**
 * Soft round “P” — hover / focus / tap reveals the source paragraph.
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
      className={`passage-cite ${shown ? 'open' : ''}`}
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
        <h2 style={{ marginTop: 0 }}>Hover the soft P for the source paragraph</h2>
        <p>
          Next to each question you&apos;ll see a quiet <span className="passage-p demo">P</span>.
          Hover it — the matching note paragraph appears.
        </p>
        <div className="passage-tutorial-demo">
          <div className="passage-tutorial-row">
            <strong>What captures sunlight in leaves?</strong>
            <PassageCite
              passage="Chlorophyll in leaves captures sunlight. Water and carbon dioxide become glucose and oxygen."
              label="From your notes"
            />
          </div>
          <p className="muted-line" style={{ margin: '10px 0 0' }}>
            Try hovering the P above.
          </p>
        </div>
        <button type="button" className="btn primary" onClick={onDismiss}>
          Got it
        </button>
      </div>
    </div>
  );
}
