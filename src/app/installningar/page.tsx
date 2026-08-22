import Link from "next/link";
import { sql, ensureSchema, hasDatabase } from "@/lib/db";
import { aktivProfil, allaProfiler } from "@/lib/profil";
import { sparaBlock, skapaProfil, dopOmProfil } from "@/app/actions";
import { BLOCK } from "@/content/block";
import { StartGuide } from "@/components/StartGuide";

export const dynamic = "force-dynamic";

/**
 * Inställningar: startsidans block, profilerna, och vägarna vidare.
 *
 * Blockredigeraren är ett vanligt formulär med kryssrutor och en siffra för
 * ordningen, inte drag-och-släpp. Det är en medveten nedprioritering: dragning
 * på mobil kräver antingen ett bibliotek eller en halv dags pekhantering, och
 * det här är något man ställer in två gånger om året.
 */
export default async function Installningar() {
  if (!hasDatabase()) return <StartGuide steg="databas" />;
  await ensureSchema();

  const profil = await aktivProfil();
  if (!profil) return <StartGuide steg="profil" />;

  const [profiler, rader] = await Promise.all([
    allaProfiler(),
    sql<{ sort: string; ordning: number; aktiv: boolean }[]>`
      select sort, ordning, aktiv from block where profil_id = ${profil.id}
    `,
  ]);

  const sparade = new Map(rader.map((r) => [r.sort, r]));

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-line bg-surface/40 px-3 py-3">
        <h1 className="text-[15px] font-semibold tracking-tight">Startsidan för {profil.namn}</h1>
        <p className="mt-1 text-[11px] leading-relaxed text-muted">
          Bocka i vad som ska synas och sätt ordningen. Lägre siffra hamnar högre upp. Din
          startsida och de andras har inget med varandra att göra.
        </p>

        <form action={sparaBlock} className="mt-3 space-y-2">
          {BLOCK.map((b, i) => {
            const sparad = sparade.get(b.sort);
            return (
              <label key={b.sort} className="flex items-center gap-3 rounded border border-line/60 px-2.5 py-2">
                <input
                  type="checkbox"
                  name={`aktiv:${b.sort}`}
                  defaultChecked={sparad ? sparad.aktiv : b.standard}
                  className="h-4 w-4 shrink-0 accent-[#a06bff]"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px]">{b.titel}</span>
                  <span className="block truncate text-[10px] text-muted">{b.beskrivning}</span>
                </span>
                <input
                  type="number"
                  name={`ordning:${b.sort}`}
                  defaultValue={sparad?.ordning ?? i * 10}
                  className="w-14 shrink-0 rounded border border-line bg-surface px-2 py-1 text-right text-[12px] outline-none focus:border-accent/60"
                />
              </label>
            );
          })}

          <button type="submit" className="rounded-lg bg-accent px-4 py-2 text-[13px] font-medium text-ink">
            Spara startsidan
          </button>
        </form>
      </section>

      <section className="rounded-lg border border-line bg-surface/40 px-3 py-3">
        <h2 className="text-[14px] font-semibold tracking-tight">Profiler</h2>

        <div className="mt-2 space-y-2">
          {profiler.map((p) => (
            <form key={p.id} action={dopOmProfil} className="flex items-center gap-2">
              <input type="hidden" name="id" value={p.id} />
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: p.farg }} aria-hidden />
              <input
                name="namn"
                defaultValue={p.namn}
                className="min-w-0 flex-1 rounded border border-line bg-surface px-2 py-1 text-[12px] outline-none focus:border-accent/60"
              />
              <button type="submit" className="shrink-0 rounded border border-line px-2 py-1 text-[11px]">
                Byt namn
              </button>
            </form>
          ))}
        </div>

        <form action={skapaProfil} className="mt-3 flex items-center gap-2">
          <input
            name="namn"
            placeholder="Ny profil"
            className="min-w-0 flex-1 rounded border border-line bg-surface px-2 py-1 text-[12px] outline-none focus:border-accent/60"
          />
          <select
            name="farg"
            defaultValue="#4fd18b"
            className="shrink-0 rounded border border-line bg-surface px-2 py-1 text-[12px]"
          >
            <option value="#4fd18b">Grön</option>
            <option value="#a06bff">Lila</option>
            <option value="#ff5470">Röd</option>
            <option value="#00a8e1">Blå</option>
          </select>
          <button type="submit" className="shrink-0 rounded border border-line px-2 py-1 text-[11px]">
            Lägg till
          </button>
        </form>
      </section>

      <nav className="grid grid-cols-2 gap-2 text-[13px]">
        <Lank href="/ingar" titel="Vad ingår" text="Tjänster och kanaler" />
        <Lank href="/valv" titel="Inloggningar" text="Lösenord och 2FA" />
        <Lank href="/kallor" titel="Källor" text="Hämtningens hälsa" />
        <Lank href={`/kalender/${profil.id}.ics`} titel="Kalender" text="Matcher i telefonen" />
      </nav>
    </div>
  );
}

function Lank({ href, titel, text }: { href: string; titel: string; text: string }) {
  return (
    <Link
      href={href}
      className="rounded-lg border border-line bg-surface/40 px-3 py-2.5 transition-colors hover:border-accent/40"
    >
      <span className="block font-medium">{titel}</span>
      <span className="block text-[11px] text-muted">{text}</span>
    </Link>
  );
}
