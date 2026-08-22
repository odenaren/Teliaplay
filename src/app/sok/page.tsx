import { sokTitlar, sokProgram, ingarKarta } from "@/lib/queries";
import { hasDatabase } from "@/lib/db";
import { TitelKort } from "@/components/TitelKort";
import { ProgramKort } from "@/components/ProgramKort";
import { StartGuide } from "@/components/StartGuide";
import { IngarVakt } from "@/components/IngarVakt";

export const dynamic = "force-dynamic";

/**
 * En sökruta för allt som ingår — tablå och katalog i samma svar.
 *
 * Plus ingår-vakten: klistra in vad som helst och få veta om det ingår. Den
 * frågan är egentligen appens hela existensberättigande i en ruta, och den
 * fungerar även för sådant appen inte listar.
 */
export default async function Sok({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  if (!hasDatabase()) return <StartGuide steg="databas" />;

  const { q = "" } = await searchParams;
  const fraga = q.trim();

  const [titlar, program, karta] = await Promise.all([
    fraga ? sokTitlar(fraga) : Promise.resolve([]),
    fraga ? sokProgram(fraga) : Promise.resolve([]),
    ingarKarta(),
  ]);

  return (
    <div className="space-y-6">
      <form action="/sok" className="flex gap-2">
        <input
          name="q"
          defaultValue={fraga}
          placeholder="Sök i allt som ingår"
          autoComplete="off"
          className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-[14px] outline-none focus:border-accent/60"
        />
        <button
          type="submit"
          className="shrink-0 rounded-lg bg-accent px-4 py-2 text-[13px] font-medium text-ink"
        >
          Sök
        </button>
      </form>

      {fraga && titlar.length === 0 && program.length === 0 && (
        <div className="rounded-lg border border-line bg-surface/40 px-4 py-6 text-center">
          <p className="text-[14px] font-medium">Ingen träff i det du har</p>
          <p className="mx-auto mt-1 max-w-sm text-[12px] leading-relaxed text-muted">
            Sökningen går bara mot innehåll som ingår i paketet. Att det inte finns här betyder
            antingen att det inte ingår, eller att katalogen inte hunnit hämtas.
          </p>
        </div>
      )}

      {program.length > 0 && (
        <section>
          <h2 className="mb-2 text-[13px] font-semibold tracking-tight text-muted">I tablån</h2>
          <div className="rounded-lg border border-line bg-surface/40 px-3">
            {program.map((p) => (
              <ProgramKort key={p.id} program={p} />
            ))}
          </div>
        </section>
      )}

      {titlar.length > 0 && (
        <section>
          <h2 className="mb-2 text-[13px] font-semibold tracking-tight text-muted">
            Film och serier
          </h2>
          <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
            {titlar.map((t) => (
              <TitelKort key={t.id} titel={t} />
            ))}
          </div>
        </section>
      )}

      <IngarVakt mina={[...karta.tjanster]} />
    </div>
  );
}
