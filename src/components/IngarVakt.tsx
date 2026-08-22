"use client";

import { useState } from "react";

interface Traff {
  namn: string;
  ar: number | null;
  typ: string;
  poster: string | null;
  ingar: boolean;
  tjanster: string[];
}

/**
 * "Får jag se det här?"
 *
 * Klistra in en titel — från en kompis tips, en trailer, en artikel — och få
 * ett rakt svar. Skiljer sig från sökrutan ovanför genom att den frågar TMDB
 * direkt i stället för vår egen katalog, och därför kan svara även om titeln
 * inte finns i något du har. Det är den enda platsen i appen där ett nej får
 * ta plats, och det är för att nejet är svaret du bad om.
 */
export function IngarVakt({ mina }: { mina: string[] }) {
  const [fraga, setFraga] = useState("");
  const [traffar, setTraffar] = useState<Traff[] | null>(null);
  const [laddar, setLaddar] = useState(false);
  const [fel, setFel] = useState<string | null>(null);

  const fraga_ = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fraga.trim()) return;

    setLaddar(true);
    setFel(null);
    try {
      const res = await fetch(`/api/vakt?q=${encodeURIComponent(fraga)}`);
      const data = (await res.json()) as { traffar?: Traff[]; fel?: string };
      setTraffar(data.traffar ?? []);
      if (data.fel) setFel(data.fel);
    } catch {
      setFel("Kunde inte fråga just nu.");
    } finally {
      setLaddar(false);
    }
  };

  return (
    <section className="rounded-lg border border-line bg-surface/40 px-3 py-3">
      <h2 className="text-[13px] font-semibold tracking-tight">Får jag se det här?</h2>
      <p className="mt-0.5 text-[11px] leading-relaxed text-muted">
        Skriv en filmtitel eller ett serienamn så svarar appen ja eller nej, och var.
        {mina.length > 0 && ` Kontrolleras mot ${mina.length} tjänster du har.`}
      </p>

      <form onSubmit={fraga_} className="mt-2 flex gap-2">
        <input
          value={fraga}
          onChange={(e) => setFraga(e.target.value)}
          placeholder="t.ex. Dune"
          className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-[13px] outline-none focus:border-accent/60"
        />
        <button
          type="submit"
          disabled={laddar}
          className="shrink-0 rounded-lg border border-line px-3 py-2 text-[12px] disabled:opacity-50"
        >
          {laddar ? "Kollar…" : "Kolla"}
        </button>
      </form>

      {fel && <p className="mt-2 text-[11px] text-live">{fel}</p>}

      {traffar && traffar.length === 0 && !fel && (
        <p className="mt-2 text-[12px] text-muted">Hittade ingen titel med det namnet.</p>
      )}

      {traffar && traffar.length > 0 && (
        <ul className="mt-3 space-y-2">
          {traffar.map((t) => (
            <li key={`${t.namn}-${t.ar}`} className="flex items-center gap-2 text-[12px]">
              <span
                className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-medium ${
                  t.ingar ? "bg-sport/15 text-sport" : "bg-line/60 text-muted"
                }`}
              >
                {t.ingar ? "INGÅR" : "NEJ"}
              </span>
              <span className="min-w-0 flex-1 truncate">
                {t.namn}
                {t.ar ? ` (${t.ar})` : ""}
              </span>
              <span className="shrink-0 text-muted">
                {t.ingar ? t.tjanster.join(", ") : "inte i ditt paket"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
