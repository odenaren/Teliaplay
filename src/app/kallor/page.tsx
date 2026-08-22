import { kallhalsa, ingarKarta } from "@/lib/queries";
import { hasDatabase } from "@/lib/db";
import { hamtaNu } from "@/app/actions";
import { alderDagar } from "@/lib/entitlement";
import { StartGuide } from "@/components/StartGuide";
import { UppdateraKnapp } from "@/components/UppdateraKnapp";
import { BryggStatus } from "@/components/BryggStatus";

export const dynamic = "force-dynamic";

/**
 * Källhälsa och attribution.
 *
 * Sidan man går till när något ser konstigt ut. Varje källa visar sin senaste
 * körning: gick den igenom, hur många rader, och vad felet var om det gick
 * fel. Utan den blir felsökning gissningar — "tablån är tom" kan lika gärna
 * betyda att ingenting ingår som att tv.nu svarade 503.
 *
 * Attributionen längst ned är inte frivillig. TMDB drar in nyckeln om
 * JustWatch inte anges som källa, och Telias uppgifter är deras.
 */
export default async function Kallor() {
  if (!hasDatabase()) return <StartGuide steg="databas" />;

  const [halsa, karta] = await Promise.all([kallhalsa(), ingarKarta()]);
  const alder = alderDagar(karta);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-[15px] font-semibold tracking-tight">Källor</h1>
        <UppdateraKnapp action={hamtaNu} />
      </div>

      <section className="rounded-lg border border-line bg-surface/40">
        {halsa.length === 0 ? (
          <p className="px-3 py-4 text-[12px] text-muted">
            Ingen hämtning har körts än. Tryck Uppdatera, eller vänta — schemaläggaren startar
            trettio sekunder efter serverstart.
          </p>
        ) : (
          halsa.map((k) => (
            <div key={k.kalla} className="flex items-start gap-3 border-b border-line/60 px-3 py-2.5 last:border-0">
              <span
                className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                  k.status === "ok" ? "bg-sport" : "bg-live"
                }`}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="truncate text-[13px] font-medium">{k.kalla}</h2>
                  <span className="shrink-0 text-[10px] text-muted">{sedan(k.at)}</span>
                </div>
                <p className="text-[11px] text-muted">
                  {k.status === "ok" ? `${k.antal} rader` : k.meddelande}
                </p>
              </div>
            </div>
          ))
        )}
      </section>

      <BryggStatus />

      <section className="space-y-2 text-[11px] leading-relaxed text-muted">
        <h2 className="text-[13px] font-semibold tracking-tight text-text">Varifrån datan kommer</h2>
        <p>
          <strong className="text-text">Vad som ingår</strong> — Telias eget API, med dina
          uppgifter. {alder === null ? "Aldrig bekräftat." : `Senast bekräftat för ${alder} dagar sedan.`}{" "}
          Slutar det svara står den manuella listan kvar oförändrad.
        </p>
        <p>
          <strong className="text-text">Tv-tablån</strong> — tv.nu. Hämtas för de kanaler som
          ingår, tre dagar framåt.
        </p>
        <p>
          <strong className="text-text">Film och serier</strong> — The Movie Database (TMDB).
          Uppgifterna om var en titel går att se kommer från{" "}
          <a href="https://www.justwatch.com" target="_blank" rel="noopener noreferrer" className="underline decoration-dotted">
            JustWatch
          </a>
          . Den här produkten använder TMDB:s API men är varken godkänd eller certifierad av TMDB.
        </p>
        <p>
          <strong className="text-text">Matcher och lag</strong> — TheSportsDB. Vilken kanal som
          sänder räknas fram ur tablån, inte hämtas därifrån.
        </p>
      </section>
    </div>
  );
}

function sedan(at: Date): string {
  const min = Math.round((Date.now() - at.getTime()) / 60_000);
  if (min < 1) return "nyss";
  if (min < 60) return `${min} min sedan`;
  const tim = Math.round(min / 60);
  if (tim < 24) return `${tim} tim sedan`;
  return `${Math.round(tim / 24)} dygn sedan`;
}
