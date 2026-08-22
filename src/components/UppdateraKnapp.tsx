"use client";

import { useTransition } from "react";

/** Kör en hämtning nu. Går via en server action, ingen nyckel behövs. */
export function UppdateraKnapp({ action }: { action: () => Promise<void> }) {
  const [pending, start] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => void action())}
      className="rounded-full border border-line px-3 py-1.5 text-[12px] transition-colors hover:border-accent/50 hover:text-accent disabled:opacity-50"
    >
      {pending ? "Hämtar…" : "Uppdatera"}
    </button>
  );
}
