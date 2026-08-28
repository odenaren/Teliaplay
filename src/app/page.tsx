import Link from "next/link";
import { hasDatabase } from "@/lib/db";
import { sql, ensureSchema } from "@/lib/db";
import { aktivProfil } from "@/lib/profil";
import { blockDef, BLOCK } from "@/content/block";
import {
  pagarNu,
  ikvall,
  kommandeMatcher,
  nyttIPaketet,
  sistaChansen,
  sparat,
  ingarKarta,
  paketForandring,
} from "@/lib/queries";
import { alderDagar } from "@/lib/entitlement";
import { ProgramKort } from "@/components/ProgramKort";
import { MatchKort } from "@/components/MatchKort";
import { TitelKort } from "@/components/TitelKort";
import { Tips } from "@/components/Tips";
import { Tom } from "@/components/Tom";
import { StartGuide } from "@/components/StartGuide";
import type { BlockSort } from "@/content/block";

export const dynamic = "force-dynamic";

/**
 * Startsidan är en lista block som profilen själv bestämmer ordningen på.
 *
 * Blocken hämtas parallellt, inte i tur och ordning. Sex block i sekvens mot en
 * databas i Frankfurt är en halv sekunds väntan som inte behöver finnas.
 */
export default async function Start() {
  if (!hasDatabase()) return <StartGuide steg="databas" />;

  await ensureSchema();
  const profil = await aktivProfil();
  if (!profil) return <StartGuide steg="profil" />;

  const karta = await ingarKarta();
  if (karta.tjanster.size <= 1) return <StartGuide steg="ingar" />;

  const rader = await sql<{ sort: string; ordning: number; aktiv: boolean }[]>`
    select sort, ordning, aktiv from block where profil_id = ${profil.id} order by ordning
  `;

  // En profil utan sparad layout får standarduppsättningen. Det händer för
  // profiler som skapades innan ett block fanns.
  const valda = rader.length > 0 ? rader.filter((r) => r.aktiv) : BLOCK.filter((b) => b.standard).map((b, i) => ({ sort: b.sort, ordning: i * 10, aktiv: true }));

  const innehall = await Promise.all(
    valda.map(async (rad) => ({ sort: rad.sort as BlockSort, data: await hamtaBlock(rad.sort as BlockSort, profil.id) })),
  );

  const forandring = await paketForandring();
  const alder = alderDagar(karta);

  /*
   * Tipset högst upp är räknat, inte skrivet i förväg. Det står bara där när
   * appen faktiskt har något att säga om just den här kvällen — annars är det
   * en rad man lär sig hoppa över, och då syns den inte heller den gången den
   * betyder något.
   */
  const påVägBort = (await sistaChansen(20)).filter((t) => t.officiell).length;

  return (
    <div className="space-y-7">
      {forandring && (
        <aside className="rounded-lg border border-accent/30 bg-accent/5 px-3 py-2.5 text-[12px]">
          <p className="font-medium text-accent">Paketet har ändrats</p>
          <p className="mt-0.5 text-muted">
            {forandring.nya.length > 0 && <>Nytt: {forandring.nya.join(", ")}. </>}
            {forandring.borta.length > 0 && <>Borta: {forandring.borta.join(", ")}. </>}
            <Link href="/ingar" className="underline decoration-dotted">
              Se ingår-listan
            </Link>
          </p>
        </aside>
      )}

      {alder !== null && alder > 7 && (
        <aside className="rounded-lg border border-line px-3 py-2 text-[11px] text-muted">
          Ingår-listan bekräftades senast för {alder} dagar sedan. Telia-hämtningen kan ha
          slutat fungera — <Link href="/kallor" className="underline decoration-dotted">se källor</Link>.
        </aside>
      )}

      {påVägBort > 0 && (
        <Tips
          ton="brådskande"
          text={`${påVägBort} ${påVägBort === 1 ? "titel du kan se" : "titlar du kan se"} försvinner inom kort enligt tjänsten själv.`}
          lank="/bladdra"
          lankText="Se vilka"
        />
      )}

      {innehall.map(({ sort, data }) => (
        <BlockVy key={sort} sort={sort} data={data} />
      ))}

      <div className="pt-2 text-center">
        <Link
          href="/installningar"
          className="text-[11px] text-muted underline decoration-dotted hover:text-text"
        >
          Ändra vad som visas här
        </Link>
      </div>
    </div>
  );
}

type BlockData = Awaited<ReturnType<typeof hamtaBlock>>;

async function hamtaBlock(sort: BlockSort, profilId: string) {
  const def = blockDef(sort);
  const antal = def?.antal ?? 6;

  switch (sort) {
    case "nasta-match":
      return { typ: "match" as const, poster: (await kommandeMatcher(profilId)).slice(0, antal) };
    case "live-nu":
      return { typ: "program" as const, poster: (await pagarNu({ profilId })).slice(0, antal) };
    case "ikvall":
      return { typ: "program" as const, poster: (await ikvall({ profilId })).slice(0, antal) };
    case "favoritkanaler":
      return {
        typ: "program" as const,
        poster: (await pagarNu({ profilId, baraFavoriter: true })).slice(0, antal),
      };
    case "nytt-i-paketet":
      return { typ: "titel" as const, poster: await nyttIPaketet(antal) };
    case "sista-chansen":
      return { typ: "titel" as const, poster: await sistaChansen(antal) };
    case "sparat": {
      const { titlar, program } = await sparat(profilId);
      return { typ: "blandat" as const, titlar, program };
    }
    case "fortsatt-titta":
      return { typ: "titel" as const, poster: [] };
    default:
      return { typ: "program" as const, poster: [] };
  }
}

function BlockVy({ sort, data }: { sort: BlockSort; data: BlockData }) {
  const def = blockDef(sort);
  if (!def) return null;

  const tomt =
    data.typ === "blandat"
      ? data.titlar.length === 0 && data.program.length === 0
      : data.poster.length === 0;

  return (
    <section>
      <h2 className="mb-2 text-[14px] font-semibold tracking-tight">{def.titel}</h2>

      {tomt ? (
        <TomtBlock sort={sort} />
      ) : data.typ === "titel" ? (
        <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1">
          {data.poster.map((t) => (
            <div key={t.id} className="snap-start">
              <TitelKort titel={t} />
            </div>
          ))}
        </div>
      ) : data.typ === "match" ? (
        <div className="rounded-lg border border-line bg-surface/40 px-3">
          {data.poster.map((m) => (
            <MatchKort key={m.id} match={m} />
          ))}
        </div>
      ) : data.typ === "blandat" ? (
        <div className="space-y-3">
          {data.program.length > 0 && (
            <div className="rounded-lg border border-line bg-surface/40 px-3">
              {data.program.map((p) => (
                <ProgramKort key={p.id} program={p} />
              ))}
            </div>
          )}
          {data.titlar.length > 0 && (
            <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
              {data.titlar.map((t) => (
                <TitelKort key={t.id} titel={t} favorit />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-line bg-surface/40 px-3">
          {data.poster.map((p) => (
            <ProgramKort key={p.id} program={p} />
          ))}
        </div>
      )}
    </section>
  );
}

/** Tomt block: säg vad som saknas, inte bara att det är tomt. */
function TomtBlock({ sort }: { sort: BlockSort }) {
  if (sort === "nasta-match") {
    return (
      <Tom
        rubrik="Inga matcher"
        text="Välj favoritlag så visas deras matcher här, med kanal och startknapp."
        lank="/sport"
        lankText="Välj lag"
      />
    );
  }
  if (sort === "favoritkanaler") {
    return (
      <Tom
        rubrik="Inga favoritkanaler"
        text="Stjärnmärk kanaler i tablån så hamnar de överst och visas här."
        lank="/tabla"
        lankText="Till tablån"
      />
    );
  }
  if (sort === "nytt-i-paketet" || sort === "sista-chansen") {
    return (
      <Tom
        rubrik="Katalogen är inte hämtad än"
        text="Film- och serielistan kräver en TMDB-nyckel och hämtas en gång per dygn. SVT Play hämtas utan nyckel och borde synas ändå."
        lank="/kallor"
        lankText="Se källor"
      />
    );
  }
  if (sort === "sparat") {
    return (
      <Tom
        rubrik="Inget sparat"
        text="Tryck stjärnan på ett program eller en film så hamnar den här — det är listan över sådant du vill komma ihåg till i kväll."
        lank="/bladdra"
        lankText="Hitta något"
      />
    );
  }
  if (sort === "live-nu" || sort === "ikvall") {
    return (
      <Tom
        rubrik="Tablån är tom"
        text="Tablån hämtas var tjugonde minut. Är den tom en längre stund har hämtningen fastnat."
        lank="/kallor"
        lankText="Se källor"
      />
    );
  }
  return (
    <Tom
      rubrik="Inget här just nu"
      text="Blocket fylls när det finns något att visa."
      lank="/kallor"
      lankText="Se källor"
    />
  );
}
