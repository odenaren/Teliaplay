"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { laggTillLag } from "@/app/actions";
import { LIGOR } from "@/content/ligor";

interface Lag {
  id: string;
  namn: string;
  logo: string | null;
  ligaId: string | null;
  liga: string | null;
  land: string | null;
}

/**
 * Favoritlagsväljaren.
 *
 * SÖKNINGEN ÄR HUVUDVÄGEN, ligan en genväg. Förut var det tvärtom, och det
 * höll bara så länge liga-id:na i content/ligor.ts stämde. När de inte gjorde
 * det — Allsvenskan och Bundesliga stod på samma id — valde man sin liga och
 * fick någon annans lag, utan att något sa ifrån. En väljare som visar tjugo
 * fel lag är sämre än en som visar noll och säger varför.
 *
 * Varje träff skriver ut sin liga och sitt land. Det är den kontrollen som gör
 * att man ser att "Hammarby" är rätt Hammarby, och att fel lag är fel innan man
 * lägger till det i stället för tre dagar senare när matcherna är konstiga.
 */
export function LagValjare() {
  const [fraga, setFraga] = useState("");
  const [ligaId, setLigaId] = useState("");
  const [lag, setLag] = useState<Lag[]>([]);
  const [laddar, setLaddar] = useState(false);
  const [fel, setFel] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const senaste = useRef(0);

  useEffect(() => {
    const sökt = fraga.trim();

    if (sökt.length < 2 && !ligaId) {
      setLag([]);
      setFel(null);
      return;
    }

    // Varje tangenttryck startar en hämtning, och svaren kan komma i fel
    // ordning. Räknaren gör att bara det senaste svaret får skriva — utan den
    // skriver ett långsamt svar på "dju" över ett snabbt på "djurgården".
    const min = ++senaste.current;
    const adress = sökt.length >= 2
      ? `/api/lag?sok=${encodeURIComponent(sökt)}`
      : `/api/lag?liga=${encodeURIComponent(LIGOR.find((l) => l.id === ligaId)?.sportsdbId ?? "")}`;

    setLaddar(true);
    setFel(null);

    const tidsur = setTimeout(() => {
      fetch(adress)
        .then((r) => r.json())
        .then((d: { lag?: Lag[]; fel?: string }) => {
          if (min !== senaste.current) return;
          setLag(d.lag ?? []);
          setFel(d.fel ?? null);
        })
        .catch(() => min === senaste.current && setFel("Kunde inte nå TheSportsDB just nu."))
        .finally(() => min === senaste.current && setLaddar(false));
    }, sökt ? 300 : 0);

    return () => clearTimeout(tidsur);
  }, [fraga, ligaId]);

  /*
   * Vid sökning gäller INTE ligafiltret.
   *
   * Det låter bakvänt tills man ser vad alternativet gör: liga-id:na i
   * content/ligor.ts är genvägar som kan vara fel — det var just ett felaktigt
   * id som gjorde att väljaren gav engelska lag. Filtrerar vi sökträffarna mot
   * ett id som inte stämmer försvinner rätt lag ur listan, och användaren får
   * "inga lag hette så" om ett lag som finns. Sökningen ska visa vad källan
   * svarade; ligan står utskriven på varje rad så att man ser vilket lag som är
   * vilket.
   */
  const visade = lag;

  return (
    <div className="space-y-3">
      <input
        type="search"
        value={fraga}
        onChange={(e) => setFraga(e.target.value)}
        placeholder="Sök lag — t.ex. Djurgården"
        autoComplete="off"
        className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-[14px] outline-none focus:border-accent/60"
      />

      <div className="flex items-center gap-2">
        <select
          value={ligaId}
          onChange={(e) => setLigaId(e.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-[13px] outline-none focus:border-accent/60"
        >
          <option value="">Alla ligor</option>
          {LIGOR.map((l) => (
            <option key={l.id} value={l.id}>
              {l.namn}
            </option>
          ))}
        </select>
        {ligaId && (
          <button
            type="button"
            onClick={() => setLigaId("")}
            className="shrink-0 rounded-lg border border-line px-3 py-2 text-[12px] text-muted hover:text-text"
          >
            Rensa
          </button>
        )}
      </div>

      {laddar && <p className="text-[12px] text-muted">Söker…</p>}

      {fel && (
        <p className="rounded-lg border border-live/30 bg-live/5 px-3 py-2 text-[12px] leading-relaxed text-text">
          {fel}
        </p>
      )}

      {!laddar && !fel && fraga.trim().length >= 2 && visade.length === 0 && (
        <p className="text-[12px] text-muted">
          Inga lag hette så. Prova utan å, ä, ö — registret är engelskspråkigt och
          stavar ofta &quot;Djurgarden&quot;.
        </p>
      )}

      {visade.length > 0 && (
        <ul className="divide-y divide-line/60 rounded-lg border border-line bg-surface/40">
          {visade.map((l) => (
            <li key={l.id}>
              <form action={(fd) => start(() => void laggTillLag(fd))}>
                <input type="hidden" name="sportsdbId" value={l.id} />
                <input type="hidden" name="namn" value={l.namn} />
                <input type="hidden" name="ligaId" value={ligaFranSportsdb(l.ligaId) ?? ligaId} />
                <button
                  type="submit"
                  disabled={pending}
                  className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-surface-2 disabled:opacity-50"
                >
                  {l.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={l.logo} alt="" className="h-6 w-6 shrink-0 object-contain" />
                  ) : (
                    <span className="h-6 w-6 shrink-0 rounded bg-surface-2" aria-hidden />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium">{l.namn}</span>
                    <span className="block truncate text-[11px] text-muted">
                      {[l.liga, l.land].filter(Boolean).join(" · ") || "okänd liga"}
                    </span>
                  </span>
                  <span className="shrink-0 text-[16px] leading-none text-accent" aria-hidden>
                    +
                  </span>
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** TheSportsDB:s liga-id → vårt, när vi känner igen det. */
function ligaFranSportsdb(sportsdbId: string | null): string | null {
  if (!sportsdbId) return null;
  return LIGOR.find((l) => l.sportsdbId === sportsdbId)?.id ?? null;
}
