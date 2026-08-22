import { tjansterMedStatus, kanalerMedStatus, omatchadeKanaler } from "@/lib/queries";
import { hasDatabase } from "@/lib/db";
import { vaxlaTjanst, vaxlaKanal, kopplaKanal } from "@/app/actions";
import { TJANSTER } from "@/content/tjanster";
import { StartGuide } from "@/components/StartGuide";
import Link from "next/link";

export const dynamic = "force-dynamic";

/**
 * Ingår-listan. Appens fundament.
 *
 * Varje rad visar VAR uppgiften kommer ifrån: hämtad från Telia, ikryssad av
 * dig, eller alltid gratis. Det är inte kosmetika. Den dagen Telia ändrar sitt
 * API slutar raderna uppdateras, och utan källangivelsen skulle appen se
 * likadan ut som dagen innan medan uppgifterna långsamt blev fel.
 */
export default async function Ingar() {
  if (!hasDatabase()) return <StartGuide steg="databas" />;

  const [tjanster, kanaler, omatchade] = await Promise.all([
    tjansterMedStatus(),
    kanalerMedStatus(),
    omatchadeKanaler(),
  ]);

  const kanalerPerTjanst = new Map<string, typeof kanaler>();
  for (const k of kanaler) {
    const lista = kanalerPerTjanst.get(k.tjanst_id) ?? [];
    lista.push(k);
    kanalerPerTjanst.set(k.tjanst_id, lista);
  }

  const teliaPa = Boolean(process.env.TELIA_USERNAME);

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-line bg-surface/40 px-3 py-3 text-[12px] leading-relaxed">
        <h1 className="text-[15px] font-semibold tracking-tight">Vad ingår i ditt paket</h1>
        <p className="mt-1 text-muted">
          Allt appen visar hämtas ur den här listan. Kryssar du ur något försvinner det överallt —
          tablå, sport, film, sök. Det finns ingen väg runt den.
        </p>
        <p className="mt-2 text-muted">
          {teliaPa ? (
            <>
              Telia-hämtningen är påslagen och fyller i kanalerna automatiskt. Rena
              streamingtjänster utan kanaler (Max, Disney+, Prime, SkyShowtime) syns inte i
              Telias svar och måste kryssas i för hand — det är en känd begränsning i deras API,
              inte ett fel i appen.
            </>
          ) : (
            <>
              Telia-hämtningen är avstängd (TELIA_USERNAME saknas i .env). Kryssa i listan för
              hand — det tar tio minuter en gång.
            </>
          )}
        </p>
      </section>

      {omatchade.length > 0 && (
        <section className="rounded-lg border border-accent/30 bg-accent/5 px-3 py-3">
          <h2 className="text-[13px] font-semibold text-accent">
            {omatchade.length} kanaler saknar tablå
          </h2>
          <p className="mt-1 text-[11px] leading-relaxed text-muted">
            De ingår i paketet men appen har inte hittat dem hos tv.nu, så deras rader i tablån
            blir tomma. Kör <code className="text-text">npm run probe -- tvnu</code> för att se
            vad de heter där, och klistra in id:t här.
          </p>
          <div className="mt-2 space-y-2">
            {omatchade.map((k) => (
              <form key={k.id} action={kopplaKanal} className="flex items-center gap-2">
                <input type="hidden" name="id" value={k.id} />
                <span className="w-32 shrink-0 truncate text-[12px]">{k.namn}</span>
                <input
                  name="tvnuId"
                  placeholder="id hos tv.nu"
                  className="min-w-0 flex-1 rounded border border-line bg-surface px-2 py-1 text-[12px] outline-none focus:border-accent/60"
                />
                <button type="submit" className="shrink-0 rounded border border-line px-2 py-1 text-[11px]">
                  Koppla
                </button>
              </form>
            ))}
          </div>
        </section>
      )}

      {TJANSTER.map((def) => {
        const rad = tjanster.find((t) => t.id === def.id);
        if (!rad) return null;
        const mina = kanalerPerTjanst.get(def.id) ?? [];

        return (
          <section key={def.id} className="rounded-lg border border-line bg-surface/40">
            <header className="flex items-center gap-2 border-b border-line px-3 py-2.5">
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ background: def.farg }}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-[14px] font-semibold">{def.namn}</h2>
                <p className="text-[10px] text-muted">
                  {rad.kalla === "telia"
                    ? `hämtat från Telia${rad.verifierad_at ? ` ${datum(rad.verifierad_at)}` : ""}`
                    : rad.kalla === "auto"
                      ? "fri kanal, ingår alltid"
                      : "ikryssad av dig"}
                </p>
              </div>

              <form action={vaxlaTjanst.bind(null, def.id, !rad.ingar)}>
                <button
                  type="submit"
                  className={`shrink-0 rounded-full px-3 py-1 text-[12px] font-medium transition-colors ${
                    rad.ingar ? "bg-sport/15 text-sport" : "border border-line text-muted"
                  }`}
                >
                  {rad.ingar ? "Ingår" : "Ingår inte"}
                </button>
              </form>
            </header>

            {rad.ingar && mina.length > 0 && (
              <div className="flex flex-wrap gap-1.5 px-3 py-2.5">
                {mina.map((k) => (
                  <form key={k.id} action={vaxlaKanal.bind(null, k.id, !k.ingar)}>
                    <button
                      type="submit"
                      className={`rounded-full px-2 py-1 text-[11px] transition-colors ${
                        k.ingar
                          ? "border border-sport/40 text-text"
                          : "border border-line text-muted line-through"
                      }`}
                      title={k.tvnu_id ? `tv.nu: ${k.tvnu_id}` : "ingen tablå kopplad"}
                    >
                      {k.namn}
                      {k.ingar && !k.tvnu_id && <span className="ml-1 text-accent">·</span>}
                    </button>
                  </form>
                ))}
              </div>
            )}
          </section>
        );
      })}

      <p className="text-center text-[11px] text-muted">
        <Link href="/kallor" className="underline decoration-dotted">
          Hur hämtningen mår
        </Link>
      </p>
    </div>
  );
}

function datum(d: Date): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    day: "numeric",
    month: "short",
  }).format(d);
}
