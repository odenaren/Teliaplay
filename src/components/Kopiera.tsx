"use client";

import { useState } from "react";

/**
 * Kopieringsknapp för lösenordet.
 *
 * Värdet visas aldrig i klartext på skärmen som förval. Inte för att någon
 * spionerar, utan för att man ofta har appen uppe medan man delar skärm eller
 * står bredvid någon — och ett lösenord som bara kopieras behöver aldrig läsas
 * högt.
 */
export function Kopiera({ varde, etikett }: { varde: string; etikett: string }) {
  const [kopierat, setKopierat] = useState(false);
  const [synligt, setSynligt] = useState(false);

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard?.writeText(varde);
          setKopierat(true);
          setTimeout(() => setKopierat(false), 1500);
        }}
        className="rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-[12px] transition-colors hover:border-accent/50"
      >
        {kopierat ? "Kopierat" : `Kopiera ${etikett}`}
      </button>

      <button
        type="button"
        onClick={() => setSynligt((v) => !v)}
        className="text-[11px] text-muted underline decoration-dotted hover:text-text"
      >
        {synligt ? "dölj" : "visa"}
      </button>

      {synligt && <code className="text-[12px] text-text">{varde}</code>}
    </span>
  );
}
