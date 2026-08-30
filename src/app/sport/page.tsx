import { sql, hasDatabase, ensureSchema } from "@/lib/db";
import { aktivProfil } from "@/lib/profil";
import { kommandeMatcher, sportITablan } from "@/lib/queries";
import { krockar } from "@/lib/match";
import { MatchKort } from "@/components/MatchKort";
import { ProgramKort } from "@/components/ProgramKort";
import { LagValjare } from "@/components/LagValjare";
import { FavoritKnapp } from "@/components/FavoritKnapp";
import { Tom } from "@/components/Tom";
import { StartGuide } from "@/components/StartGuide";
import Link from "next/link";

export const dynamic = "force-dynamic";

/**
 * Sportnavet.
 *
 * Tre sektioner i fallande ordning av hur ofta man vill ha svar på dem:
 *   1. Mina lag — matcher, med kanal när sådan finns.
 *   2. Krockar — två lag samtidigt, sagt i förväg.
 *   3. All sport i tablån — det som sänds oavsett lag.
 */
export default async function Sport() {
  if (!hasDatabase()) return <StartGuide steg="databas" />;
  await ensureSchema();

  const profil = await aktivProfil();
  if (!profil) return <StartGuide steg="profil" />;

  const [matcher, sport, lag] = await Promise.all([
    kommandeMatcher(profil.id),
    sportITablan(),
    sql<{ id: string; namn: string; logo: string | null }[]>`
      select l.id, l.namn, l.logo
      from lag l join favorit f on f.ref_id = l.id and f.sort = 'lag'
      where f.profil_id = ${profil.id}
      order by l.namn
    `,
  ]);

  /*
   * "Sänd" betyder går att se, inte finns i tablån.
   *
   * En strömmad match har ingen tablåkanal och hamnade därför under rubriken
   * "Ingen sändning hittad" — tillsammans med matcher som verkligen inte går
   * att se. Hela Allsvenskan låg där. Det som avgör är om du kan titta, inte
   * hur sändningen råkar distribueras.
   */
  const sanda = matcher.filter((m) => m.var || m.strom);
  const osanda = matcher.filter((m) => !m.var && !m.strom);

  // Krockar: par av matcher som överlappar i tid. Bara bland de sända — två
  // matcher du ändå inte kan se krockar inte i praktiken.
  const konflikter = sanda.flatMap((a, i) =>
    sanda.slice(i + 1).filter((b) => krockar(a, b)).map((b) => [a, b] as const),
  );

  return (
    <div className="space-y-7">
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-[13px] font-semibold tracking-tight text-muted">Mina lag</h2>
          <Link href="/sport?valj=1" className="text-[11px] text-accent">
            Lägg till
          </Link>
        </div>

        {lag.length === 0 ? (
          <div className="space-y-3">
            <Tom
              rubrik="Inga favoritlag än"
              text="Välj lag så visar appen deras matcher, vilken kanal de går på, och säger till när matchen inte sänds på något du har."
            />
            <LagValjare />
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {lag.map((l) => (
              <span
                key={l.id}
                className="flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-[12px]"
              >
                {l.logo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={l.logo} alt="" className="h-4 w-4 object-contain" />
                )}
                {l.namn}
                <FavoritKnapp sort="lag" refId={l.id} aktiv etikett={`Sluta följa ${l.namn}`} />
              </span>
            ))}
          </div>
        )}
      </section>

      {konflikter.length > 0 && (
        <aside className="rounded-lg border border-accent/30 bg-accent/5 px-3 py-2.5 text-[12px]">
          <p className="font-medium text-accent">Krock</p>
          {konflikter.map(([a, b]) => (
            <p key={`${a.id}-${b.id}`} className="mt-0.5 text-muted">
              {a.hemma}–{a.borta} och {b.hemma}–{b.borta} går samtidigt.
            </p>
          ))}
        </aside>
      )}

      {sanda.length > 0 && (
        <section>
          <h2 className="mb-2 text-[13px] font-semibold tracking-tight text-muted">
            Kommande matcher
          </h2>
          <div className="rounded-lg border border-line bg-surface/40 px-3">
            {sanda.map((m) => (
              <MatchKort key={m.id} match={m} />
            ))}
          </div>
        </section>
      )}

      {osanda.length > 0 && (
        <section>
          <h2 className="mb-2 text-[13px] font-semibold tracking-tight text-muted">
            Ingen sändning hittad
          </h2>
          <p className="mb-2 text-[11px] leading-relaxed text-muted/80">
            De här matcherna har appen inte kunnat para ihop med något du har. Ofta betyder det
            att de inte sänds i Sverige, ibland att tablån inte sträcker sig så långt fram än.
            Det är den enda listan i appen som visar sådant du inte kan se — och den finns för
            att svaret &quot;nej&quot; också är ett svar.
          </p>
          <div className="rounded-lg border border-line/60 bg-surface/20 px-3 opacity-75">
            {osanda.map((m) => (
              <MatchKort key={m.id} match={m} />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-[13px] font-semibold tracking-tight text-muted">
          Sport på dina kanaler
        </h2>
        {sport.length === 0 ? (
          <Tom
            rubrik="Inget i sportkanalernas tablå"
            text="Antingen ingår inga sportkanaler, eller så har tablåhämtningen inte kört än."
            lank="/ingar"
            lankText="Se ingår-listan"
          />
        ) : (
          <div className="rounded-lg border border-line bg-surface/40 px-3">
            {sport.slice(0, 40).map((p) => (
              <ProgramKort key={p.id} program={p} />
            ))}
          </div>
        )}
      </section>

      {lag.length > 0 && (
        <section>
          <h2 className="mb-2 text-[13px] font-semibold tracking-tight text-muted">
            Lägg till fler lag
          </h2>
          <LagValjare />
        </section>
      )}

      <p className="text-center text-[11px] text-muted">
        <Link href={`/kalender/${profil.id}.ics`} className="underline decoration-dotted">
          Prenumerera på matcherna i kalendern
        </Link>
      </p>
    </div>
  );
}
