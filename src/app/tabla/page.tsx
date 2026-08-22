import Link from "next/link";
import { tabla } from "@/lib/queries";
import { aktivProfil } from "@/lib/profil";
import { tvDayKey, dagEtikett } from "@/lib/time";
import { hasDatabase } from "@/lib/db";
import { ProgramKort } from "@/components/ProgramKort";
import { FavoritKnapp } from "@/components/FavoritKnapp";
import { Bricka } from "@/components/Bricka";
import { Tom } from "@/components/Tom";
import { StartGuide } from "@/components/StartGuide";

export const dynamic = "force-dynamic";

/**
 * Tv-tablån.
 *
 * Bara kanaler som ingår, favoriter först. Dagväljaren går tre dagar framåt —
 * längre än så hämtas inte, eftersom tv.nu:s uppgifter längre fram ändå ändras
 * innan dagen kommer.
 */
export default async function Tabla({
  searchParams,
}: {
  searchParams: Promise<{ dag?: string; sport?: string }>;
}) {
  if (!hasDatabase()) return <StartGuide steg="databas" />;

  const params = await searchParams;
  const profil = await aktivProfil();
  const dag = params.dag ?? tvDayKey();
  const baraSport = params.sport === "1";

  const kanaler = await tabla(dag, { profilId: profil?.id, baraSport });

  const dagar = [0, 1, 2].map((n) => tvDayKey(new Date(Date.now() + n * 86_400_000)));

  return (
    <div className="space-y-4">
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        {dagar.map((d) => (
          <Link
            key={d}
            href={`/tabla?dag=${d}${baraSport ? "&sport=1" : ""}`}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-[12px] transition-colors ${
              d === dag ? "border-accent/60 bg-accent/10 text-accent" : "border-line text-muted"
            }`}
          >
            {dagEtikett(d)}
          </Link>
        ))}

        <Link
          href={`/tabla?dag=${dag}${baraSport ? "" : "&sport=1"}`}
          className={`ml-auto shrink-0 rounded-full border px-3 py-1.5 text-[12px] transition-colors ${
            baraSport ? "border-sport/60 bg-sport/10 text-sport" : "border-line text-muted"
          }`}
        >
          Bara sport
        </Link>
      </div>

      {kanaler.length === 0 ? (
        <Tom
          rubrik="Tablån är tom"
          text={
            baraSport
              ? "Inga sportkanaler ingår, eller så är de inte kopplade till tv.nu än."
              : "Antingen ingår inga kanaler än, eller så har tablåhämtningen inte kört."
          }
          lank="/ingar"
          lankText="Se ingår-listan"
        />
      ) : (
        kanaler.map((kanal) => (
          <section key={kanal.id} className="rounded-lg border border-line bg-surface/40">
            <header className="flex items-center gap-2 border-b border-line px-3 py-2">
              {kanal.logo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={kanal.logo} alt="" className="h-5 w-5 shrink-0 rounded object-contain" />
              )}
              <h2 className="min-w-0 flex-1 truncate text-[13px] font-semibold">{kanal.namn}</h2>
              <Bricka tjanstId={kanal.tjanstId} liten />
              <FavoritKnapp sort="kanal" refId={kanal.id} aktiv={kanal.favorit} />
            </header>

            <div className="px-3">
              {kanal.program.length === 0 ? (
                <p className="py-3 text-[12px] text-muted">
                  Ingen tablå hämtad för den här dagen.
                </p>
              ) : (
                kanal.program.map((p) => <ProgramKort key={p.id} program={p} visaKanal={false} />)
              )}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
