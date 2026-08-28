import Link from "next/link";
import { hasDatabase } from "@/lib/db";
import {
  nyttIPaketet,
  sistaChansen,
  titlarIGenre,
  genrerMedInnehall,
  titlarHosTjanst,
  ingarKarta,
} from "@/lib/queries";
import { GENRER, genreNamn } from "@/content/genrer";
import { TJANSTER } from "@/content/tjanster";
import { Rad, Rutnat } from "@/components/Rad";
import { KategoriRad } from "@/components/KategoriRad";
import { Tips } from "@/components/Tips";
import { Tom } from "@/components/Tom";
import { StartGuide } from "@/components/StartGuide";

export const dynamic = "force-dynamic";

/**
 * Bläddra: hela katalogen, i rader man sveper.
 *
 * Sidan har två lägen och det är samma adress.
 *
 * Utan filter är den en översikt — nytt, snart borta, sedan en rad per genre
 * och en per tjänst. Rader och inte ett rutnät, eftersom ett rutnät med
 * fyrahundra affischer är en lista man skrollar förbi, medan en rad är ett
 * urval man tittar på. Rubriken gör urvalet begripligt: "Drama" är ett svar på
 * en fråga, "alla titlar" är ingen fråga alls.
 *
 * Med ?genre= eller ?tjanst= blir den ett rutnät över just den kategorin. Där
 * är rutnätet rätt, för då HAR man valt vad man letar efter.
 *
 * Ingår-regeln gäller överallt: varje fråga joinar mot `tjanst.ingar = true`.
 * Det som inte ingår finns inte på sidan, inte ens som en gråad ruta.
 */
export default async function Bladdra({
  searchParams,
}: {
  searchParams: Promise<{ genre?: string; tjanst?: string }>;
}) {
  if (!hasDatabase()) return <StartGuide steg="databas" />;

  const { genre: valdGenre, tjanst: valdTjanst } = await searchParams;
  const [karta, medInnehall] = await Promise.all([ingarKarta(), genrerMedInnehall(1)]);

  const minaTjanster = TJANSTER.filter((t) => karta.tjanster.has(t.id));

  /*
   * Bara kategorier som har något bakom sig.
   *
   * En etikett som leder till en tom sida är värre än ingen etikett: man
   * trycker på den, får ingenting, och lär sig att kategorierna inte är att
   * lita på. Tröskeln är en enda titel — det räcker för att knappen ska vara
   * ärlig.
   */
  const genrerAttVälja = GENRER.filter((g) => medInnehall.some((x) => x.genre === g.id));

  const kategorier = [
    { id: "", namn: "Allt", href: "/bladdra" },
    ...genrerAttVälja.map((g) => ({ id: g.id, namn: g.namn, href: `/bladdra?genre=${g.id}` })),
    ...minaTjanster.map((t) => ({ id: t.id, namn: t.namn, href: `/bladdra?tjanst=${t.id}` })),
  ];

  const rubrikrad = (
    <KategoriRad poster={kategorier} aktiv={valdGenre ?? valdTjanst ?? ""} />
  );

  /* ------------------------------------------------ ett valt filter */

  if (valdGenre || valdTjanst) {
    const titlar = valdGenre
      ? await titlarIGenre(valdGenre, 60)
      : await titlarHosTjanst(valdTjanst!, 60);

    const namn = valdGenre
      ? genreNamn(valdGenre)
      : (TJANSTER.find((t) => t.id === valdTjanst)?.namn ?? valdTjanst!);

    return (
      <div className="space-y-5">
        {rubrikrad}

        <div>
          <h1 className="text-[15px] font-semibold tracking-tight">{namn}</h1>
          <p className="mt-0.5 text-[11px] text-muted">
            {titlar.length === 0
              ? "Inget här ännu."
              : `${titlar.length} ${titlar.length === 1 ? "titel" : "titlar"} du kan spela nu.`}
          </p>
        </div>

        {titlar.length > 0 ? (
          <Rutnat titlar={titlar} />
        ) : (
          <Tom
            rubrik="Tomt i den här kategorin"
            text="Antingen har katalogen inte hämtats än, eller så finns inget i den här kategorin på tjänsterna du har."
            lank="/kallor"
            lankText="Se källor"
          />
        )}
      </div>
    );
  }

  /* ------------------------------------------------------ översikten */

  const [nytt, sista] = await Promise.all([nyttIPaketet(20), sistaChansen(20)]);

  // Rader kräver mer än en etikett gör: fyra titlar. En rubrik med två
  // affischer under sig ser ut som ett fel, medan en etikett med två träffar
  // bakom sig är ett hederligt sökresultat. Ordningen är vår egen och inte
  // träffantalets — annars byter sidan utseende varje gång katalogen hämtas.
  const genrerAttVisa = GENRER.filter((g) =>
    medInnehall.some((x) => x.genre === g.id && x.antal >= 4),
  );

  const genreRader = await Promise.all(
    genrerAttVisa.map(async (g) => ({ genre: g, titlar: await titlarIGenre(g.id, 20) })),
  );

  /*
   * Tjänsterna får INGA egna affischrader här.
   *
   * De hade sådana, och sidan blev fjorton skärmhöjder lång med samma titlar
   * en gång till under en annan rubrik. Genrerna svarar på "vad är jag sugen
   * på", tjänsten på "var ligger den" — och den andra frågan ställer man när
   * man redan vet vad man letar efter. Då är en knapp rätt, inte tjugo
   * affischer man måste skrolla förbi.
   */

  const tomt =
    nytt.length === 0 && sista.length === 0 && genreRader.every((r) => r.titlar.length === 0);

  if (tomt) {
    return (
      <div className="space-y-5">
        {rubrikrad}
        <Tom
          rubrik="Ingen katalog hämtad"
          text="Film- och serielistan kräver en TMDB-nyckel och hämtas en gång per dygn. SVT Play hämtas utan nyckel och borde synas här ändå — gör den inte det har hämtningen fastnat."
          lank="/kallor"
          lankText="Se källor"
        />
      </div>
    );
  }

  const officiellaSista = sista.filter((t) => t.officiell).length;

  return (
    <div className="space-y-7">
      {rubrikrad}

      {officiellaSista > 0 && (
        <Tips
          ton="brådskande"
          text={`${officiellaSista} ${officiellaSista === 1 ? "titel" : "titlar"} på SVT Play försvinner inom kort — det är SVT:s egen uppgift, inte en gissning.`}
        />
      )}

      <Rad
        rubrik="Nytt i paketet"
        underrubrik="Nyss tillkommet hos tjänsterna du har."
        titlar={nytt}
      />

      <Rad
        rubrik="Sista chansen"
        underrubrik={
          officiellaSista > 0
            ? "Märkta titlar tas bort enligt tjänsten själv. Övriga är en gissning: de har slutat dyka upp i katalogen."
            : "En gissning: de har slutat dyka upp i katalogen de senaste dygnen."
        }
        titlar={sista}
      />

      {genreRader.map(({ genre, titlar }) => (
        <Rad
          key={genre.id}
          rubrik={genre.namn}
          titlar={titlar}
          mer={`/bladdra?genre=${genre.id}`}
        />
      ))}

      <section>
        <h2 className="mb-2 text-[14px] font-semibold tracking-tight">Per tjänst</h2>
        <div className="grid grid-cols-2 gap-2">
          {minaTjanster.map((t) => (
            <Link
              key={t.id}
              href={`/bladdra?tjanst=${t.id}`}
              className="flex items-center gap-2 rounded-lg border border-line bg-surface/40 px-3 py-2.5 text-[13px] transition-colors hover:border-accent/40"
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: t.farg }}
                aria-hidden
              />
              <span className="truncate">{t.namn}</span>
            </Link>
          ))}
        </div>
      </section>

      <Tips
        text="Hittar du inte något särskilt går det snabbare att söka — sökningen letar i allt som ingår, och svarar nej när något inte gör det."
        lank="/sok"
        lankText="Till sökningen"
      />

      <p className="pb-2 text-center text-[11px] text-muted">
        <Link href="/ingar" className="underline decoration-dotted hover:text-text">
          Saknas en tjänst? Kryssa i vad som ingår
        </Link>
      </p>
    </div>
  );
}
