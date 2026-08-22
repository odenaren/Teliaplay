"use client";

import { useState, useTransition } from "react";
import { spelaPaTv } from "@/app/actions";

/**
 * Startknappen.
 *
 * Beter sig olika beroende på om hembryggan svarar, och det är hela idén:
 *
 *   Brygga uppe  → ett tryck, bild på Apple TV:n, knappen kvitterar.
 *   Brygga nere  → samma tryck, men svaret blir en länk du kan följa här.
 *
 * Den får aldrig bli en död knapp. Att trycka "Spela" och inte få något alls
 * är sämre än att inte ha någon knapp — då hade man åtminstone tagit
 * fjärrkontrollen direkt.
 */
export function SpelaKnapp({
  tjanstId,
  titelId,
  namn,
  refId,
  sort,
  liten,
}: {
  tjanstId: string;
  titelId?: string | null;
  namn?: string | null;
  refId?: string;
  sort?: string;
  liten?: boolean;
}) {
  const [pending, start] = useTransition();
  const [svar, setSvar] = useState<{ ok: boolean; meddelande: string; lank: string | null } | null>(
    null,
  );

  const tryck = () =>
    start(async () => {
      setSvar(await spelaPaTv(tjanstId, { titelId, namn, refId, sort }));
    });

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={tryck}
        disabled={pending}
        className={`shrink-0 rounded-full border border-line bg-surface-2 transition-colors hover:border-accent/50 hover:text-accent disabled:opacity-50 ${
          liten ? "px-2 py-1 text-[10px]" : "px-3 py-1.5 text-xs"
        }`}
      >
        {pending ? "Startar…" : "▶ Spela"}
      </button>

      {svar && !svar.ok && svar.lank && (
        <a
          href={svar.lank}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] text-muted underline decoration-dotted hover:text-text"
          title={svar.meddelande}
        >
          öppna själv
        </a>
      )}
      {svar?.ok && <span className="text-[10px] text-sport">på tv:n</span>}
    </span>
  );
}
