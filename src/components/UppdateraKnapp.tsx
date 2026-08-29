"use client";

import { useTransition } from "react";

/**
 * Kör en full hämtning nu — tablå, sport, SVT och film- och seriekatalogen.
 *
 * Den tar tiotals sekunder eftersom katalogen är med, och därför säger den
 * "Hämtar allt…" i stället för "Hämtar…". En knapp som ser klar ut medan den
 * jobbar trycks en gång till.
 */
export function UppdateraKnapp({ action }: { action: () => Promise<void> }) {
  const [pending, start] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => void action())}
      className="rounded-full border border-line px-3 py-1.5 text-[12px] transition-colors hover:border-accent/50 hover:text-accent disabled:opacity-50"
    >
      {pending ? "Hämtar allt…" : "Uppdatera"}
    </button>
  );
}
