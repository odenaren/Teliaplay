import Link from "next/link";
import { skapaProfil } from "@/app/actions";

/**
 * Uppstartsguiden.
 *
 * Tre lägen, och appen kan bara vara i ett av dem åt gången. Varje läge visar
 * exakt det steg som saknas — inte hela installationsanvisningen, för då läser
 * man den inte.
 */
export function StartGuide({ steg }: { steg: "databas" | "profil" | "ingar" }) {
  if (steg === "databas") {
    return (
      <Ruta rubrik="Databasen är inte inkopplad">
        <p>
          Appen behöver en Postgres. Vilken som helst duger — Neons gratisnivå räcker gott
          för två personer.
        </p>
        <ol className="mt-3 space-y-1.5 text-muted">
          <li>1. Skapa en databas och kopiera anslutningssträngen.</li>
          <li>
            2. Klistra in den som <code className="text-text">DATABASE_URL</code> — i Railway
            under <strong className="text-text">Variables</strong>, eller i filen{" "}
            <code className="text-text">.env</code> om du kör appen på din egen dator.
          </li>
          <li>3. Ladda om den här sidan. Tabellerna skapas av sig själva.</li>
        </ol>
        <p className="mt-3 text-[11px] text-muted">
          Sitter du vid en dator med projektet utcheckat säger{" "}
          <code className="text-text">npm run db:check</code> exakt vad som är fel med
          strängen. Det behövs inte för att komma igång.
        </p>
      </Ruta>
    );
  }

  if (steg === "profil") {
    return (
      <Ruta rubrik="Vem är du?">
        <p>
          Två profiler, en till dig och en till din kompis. Ingen inloggning och inga lösenord —
          det är en växel i toppen, inte ett konto.
        </p>
        <form action={skapaProfil} className="mt-4 flex gap-2">
          <input
            name="namn"
            required
            maxLength={20}
            placeholder="Ditt namn"
            className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-[14px] outline-none focus:border-accent/60"
          />
          <input type="hidden" name="farg" value="#a06bff" />
          <button
            type="submit"
            className="shrink-0 rounded-lg bg-accent px-4 py-2 text-[13px] font-medium text-ink"
          >
            Skapa
          </button>
        </form>
        <p className="mt-2 text-[11px] text-muted">
          Du lägger till fler profiler senare under Inställningar.
        </p>
      </Ruta>
    );
  }

  return (
    <Ruta rubrik="Vad ingår i ditt paket?">
      <p>
        Appen visar ingenting förrän den vet vad du betalar för. Det är hela poängen: den kan
        inte tipsa om sådant du inte har om den inte känner till något alls.
      </p>
      <p className="mt-2 text-muted">
        Kryssa i tjänsterna och kanalerna en gång, eller lägg in dina Telia-uppgifter i{" "}
        <code className="text-text">.env</code> så hämtas listan automatiskt.
      </p>
      <Link
        href="/ingar"
        className="mt-4 inline-block rounded-lg bg-accent px-4 py-2 text-[13px] font-medium text-ink"
      >
        Ställ in vad som ingår
      </Link>
    </Ruta>
  );
}

function Ruta({ rubrik, children }: { rubrik: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-surface/60 px-4 py-5 text-[13px] leading-relaxed">
      <h2 className="text-[15px] font-semibold tracking-tight">{rubrik}</h2>
      <div className="mt-2 space-y-1">{children}</div>
    </section>
  );
}
