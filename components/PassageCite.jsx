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
    <div className="passage-tutorial" role="status">
      <div className="passage-tutorial-card">
        <span className="passage-p demo" aria-hidden="true">
          P
        </span>
        <p>Hover the soft P to see the source paragraph.</p>
        <button type="button" className="passage-tutorial-dismiss" onClick={onDismiss}>
          Got it
        </button>
      </div>
    </div>
  );
}
