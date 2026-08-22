"use client";

import { useEffect, useState, useTransition } from "react";
import { laggTillLag } from "@/app/actions";
import { LIGOR } from "@/content/ligor";

interface Lag {
  id: string;
  namn: string;
  logo: string | null;
  ligaId: string | null;
}

/**
 * Favoritlagsväljaren.
 *
 * Ligan först, sedan laget. Att söka fritext bland alla lag i världen låter
 * smidigare men ger tio "Manchester United" från olika register — med ligan
 * vald är listan tjugo lag lång och rätt lag går att peka på.
 */
export function LagValjare() {
  const [ligaId, setLigaId] = useState("");
  const [lag, setLag] = useState<Lag[]>([]);
  const [laddar, setLaddar] = useState(false);
  const [fel, setFel] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!ligaId) return setLag([]);
    const liga = LIGOR.find((l) => l.id === ligaId);
    if (!liga) return;

    setLaddar(true);
    setFel(null);
    fetch(`/api/lag?liga=${encodeURIComponent(liga.sportsdbId)}`)
      .then((r) => r.json())
      .then((d: { lag?: Lag[]; fel?: string }) => {
        setLag(d.lag ?? []);
        if (d.fel) setFel(d.fel);
      })
      .catch(() => setFel("Kunde inte hämta lagen just nu."))
      .finally(() => setLaddar(false));
  }, [ligaId]);

  return (
    <div className="space-y-3">
      <select
        value={ligaId}
        onChange={(e) => setLigaId(e.target.value)}
        className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-[13px] outline-none focus:border-accent/60"
      >
        <option value="">Välj liga…</option>
        {LIGOR.map((l) => (
          <option key={l.id} value={l.id}>
            {l.namn}
          </option>
        ))}
      </select>

      {laddar && <p className="text-[12px] text-muted">Hämtar lagen…</p>}
      {fel && <p className="text-[12px] text-live">{fel}</p>}

      {lag.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {lag.map((l) => (
            <form
              key={l.id}
              action={(fd) => start(() => void laggTillLag(fd))}
              className="contents"
            >
              <input type="hidden" name="sportsdbId" value={l.id} />
              <input type="hidden" name="namn" value={l.namn} />
              <input type="hidden" name="ligaId" value={ligaId} />
              <button
                type="submit"
                disabled={pending}
                className="flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-[12px] text-muted transition-colors hover:border-accent/50 hover:text-text disabled:opacity-50"
              >
                {l.logo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={l.logo} alt="" className="h-4 w-4 object-contain" />
                )}
                {l.namn}
              </button>
            </form>
          ))}
        </div>
      )}
    </div>
  );
}
