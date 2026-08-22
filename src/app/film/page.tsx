import { nyttIPaketet, sistaChansen, ingarKarta } from "@/lib/queries";
import { hasDatabase } from "@/lib/db";
import { TitelKort } from "@/components/TitelKort";
import { Tom } from "@/components/Tom";
import { StartGuide } from "@/components/StartGuide";
import { TJANSTER } from "@/content/tjanster";
import Link from "next/link";

export const dynamic = "force-dynamic";

/**
 * Film och serier — men bara det som ingår.
 *
 * Katalogen är hämtad med `with_watch_providers` satt till dina tjänster, så
 * inget annat har någonsin nått databasen. Det är avsiktligt gjort i frågan
 * mot TMDB i stället för som ett filter här: det billigaste sättet att aldrig
 * visa fel sak är att aldrig hämta den.
 */
export default async function Film() {
  if (!hasDatabase()) return <StartGuide steg="databas" />;

  const [nytt, sista, karta] = await Promise.all([
    nyttIPaketet(30),
    sistaChansen(20),
    ingarKarta(),
  ]);

  const mina = TJANSTER.filter((t) => karta.tjanster.has(t.id) && t.tmdbProvider);

  if (nytt.length === 0 && sista.length === 0) {
    return (
      <Tom
        rubrik="Ingen katalog hämtad"
        text="Film- och serielistan kräver TMDB_API_KEY i .env och hämtas en gång per dygn — JustWatch, som datan kommer från, uppdaterar inte oftare än så."
        lank="/kallor"
        lankText="Se källor"
      />
    );
  }

  return (
    <div className="space-y-7">
      <p className="text-[12px] leading-relaxed text-muted">
        Allt här går att spela nu, utan att köpa till något. Hämtat för{" "}
        {mina.map((t) => t.namn).join(", ") || "dina tjänster"}.
      </p>

      {nytt.length > 0 && (
        <section>
          <h2 className="mb-2 text-[13px] font-semibold tracking-tight text-muted">
            Nytt i paketet
          </h2>
          <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
            {nytt.map((t) => (
              <TitelKort key={t.id} titel={t} />
            ))}
          </div>
        </section>
      )}

      {sista.length > 0 && (
        <section>
          <h2 className="mb-1 text-[13px] font-semibold tracking-tight text-muted">
            Sista chansen
          </h2>
          <p className="mb-2 text-[11px] leading-relaxed text-muted/80">
            De här titlarna har slutat dyka upp i katalogen och är troligen på väg bort. Det är
            en gissning byggd på att de saknats i några dygns hämtningar — något officiellt
            avpubliceringsdatum finns inte i gratisdatan.
          </p>
          <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
            {sista.map((t) => (
              <TitelKort key={t.id} titel={t} />
            ))}
          </div>
        </section>
      )}

      <p className="text-center text-[11px] text-muted">
        <Link href="/sok" className="underline decoration-dotted">
          Leta efter något särskilt
        </Link>
      </p>
    </div>
  );
}
