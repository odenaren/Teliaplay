import { tjansterMedStatus, kanalerMedStatus, omatchadeKanaler } from "@/lib/queries";
import { hasDatabase } from "@/lib/db";
import {
  vaxlaTjanst,
  vaxlaKanal,
  kopplaKanal,
  kryssaPaket,
  vaxlaOmfattning,
  vaxlaPrioritet,
} from "@/app/actions";
import { PAKET } from "@/content/paket";
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
          {/*
            Den vanligaste förvirringen i hela appen: man kryssar i en tjänst,
            går till Bläddra, och det är tomt. Kryssrutan säger bara att du HAR
            tjänsten — katalogen måste hämtas innan den finns att visa, och den
            hämtningen går en gång per dygn. Att säga det här är billigare än
            att låta någon tro att appen är trasig.
          */}
          Nykryssat syns inte direkt. Kryssrutan säger att du har tjänsten; titlarna hämtas separat,
          en gång per dygn. Vill du inte vänta:{" "}
          <Link href="/kallor" className="text-accent underline decoration-dotted">
            tryck Uppdatera på Källor
          </Link>
          , så hämtas katalogen med en gång.
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

      <section className="rounded-lg border border-line bg-surface/40 px-3 py-3">
        <h2 className="text-[13px] font-semibold tracking-tight">Har du ett av Telias paket?</h2>
        <p className="mt-1 text-[11px] leading-relaxed text-muted">
          Kryssar i allt som ingår i paketet på en gång. Den tar aldrig bort något du redan
          kryssat i — och kontrollera mot Telias egen app, för de byter innehåll utan att säga
          till oss.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {PAKET.map((p) => (
            <form key={p.id} action={kryssaPaket.bind(null, p.id)}>
              <button
                type="submit"
                className="rounded-full border border-line px-3 py-1.5 text-[12px] transition-colors hover:border-accent/50 hover:text-accent"
              >
                {p.namn}
                <span className="ml-1.5 text-[10px] text-muted">
                  {p.tjanster.length} tjänster
                </span>
              </button>
            </form>
          ))}
        </div>

        {/*
          Finstilta, med Telias egna ord.

          Det är HÄR paketets verkliga innehåll står: att Viaplay bara är
          sporten, att TV4 Play bara är fotbollen. Utan de raderna ser knappen
          ut att kryssa i fem hela tjänster, vilket är precis det missförstånd
          som fick appen att visa hundratals filmer som inte gick att spela.
        */}
        {PAKET.map((p) => (
          <dl key={p.id} className="mt-3 space-y-1 text-[11px] leading-relaxed">
            {p.tjanster
              .filter((t) => t.anmarkning)
              .map((t) => (
                <div key={t.id} className="flex gap-2">
                  <dt className="shrink-0 text-muted">
                    {TJANSTER.find((x) => x.id === t.id)?.namn ?? t.id}
                  </dt>
                  <dd className={t.omfattning === "sport" ? "text-sport" : "text-muted"}>
                    {t.anmarkning}
                  </dd>
                </div>
              ))}
            <p className="pt-1 text-[10px] text-muted">
              Avskrivet {p.avskrivet} från {p.kalla}. Telia ändrar sina paket — stäm av mot deras
              app om något ser fel ut.
            </p>
          </dl>
        ))}
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
                  {rad.ingar && rad.omfattning === "sport" && (
                    <span className="text-sport"> · bara sport</span>
                  )}
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

            {/*
              Sportnivå eller hela tjänsten.

              Visas bara för tjänster som HAR en filmkatalog — för en ren
              kanaltjänst är frågan meningslös. "Bara sport" betyder att
              matcherna och kanalerna ingår men att katalogen inte hämtas och
              inte visas: det är skillnaden mellan att ha Viaplay och att kunna
              se Viaplays filmer.
            */}
            {rad.ingar && def.tmdbProvider && (
              <div className="flex items-center gap-2 border-b border-line px-3 py-2 text-[11px]">
                <span className="text-muted">Ingår:</span>
                {(["allt", "sport"] as const).map((v) => (
                  <form key={v} action={vaxlaOmfattning.bind(null, def.id, v)}>
                    <button
                      type="submit"
                      className={`rounded-full border px-2 py-0.5 transition-colors ${
                        rad.omfattning === v
                          ? "border-accent bg-accent/15 text-accent"
                          : "border-line text-muted hover:text-text"
                      }`}
                    >
                      {v === "allt" ? "hela tjänsten" : "bara sport"}
                    </button>
                  </form>
                ))}

                {/*
                  Föredragen tjänst.

                  Avgör vart Spela tar dig när en titel finns på flera. Samma
                  film kan vara reklamfri på den ena och full av reklam på den
                  andra, och vilken som är bäst vet bara du.
                */}
                <form
                  action={vaxlaPrioritet.bind(null, def.id, rad.prioritet >= 100)}
                  className="ml-auto"
                >
                  <button
                    type="submit"
                    title="Välj den här när en titel finns på flera tjänster"
                    className={`rounded-full border px-2 py-0.5 transition-colors ${
                      rad.prioritet < 100
                        ? "border-accent bg-accent/15 text-accent"
                        : "border-line text-muted hover:text-text"
                    }`}
                  >
                    {rad.prioritet < 100 ? "★ föredras" : "☆ föredra"}
                  </button>
                </form>
              </div>
            )}

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
