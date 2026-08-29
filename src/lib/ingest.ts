/**
 * Hämtningen. Allt som fyller databasen går härigenom.
 *
 * Stegen är oberoende av varandra och körs var för sig med sin egen felhantering.
 * Det är inte städighet utan en konsekvens av hur källorna beter sig: TMDB kan
 * vara nere utan att tv.nu är det, och en tablå som inte uppdateras är ett
 * mycket mindre problem än en tablå som försvinner för att en annan källa
 * fallerade. Varje steg loggas i `ingest_logg` och syns på /kallor.
 *
 * Ordningen spelar roll på ett ställe: sportmatcherna paras ihop med tablån,
 * så tablån måste hämtas först.
 */

import { sql, ensureSchema } from "./db";
import { TJANSTER, ALLTID_INGAR } from "@/content/tjanster";
import { KANALER, kanalNycklar } from "@/content/kanaler";
import { LIGOR } from "@/content/ligor";
import { titelNyckel, lagNyckel, hittaSandning, type Kandidat } from "./match";
import { tvDayKey } from "./time";
import * as tvnu from "./sources/tvnu";
import * as telia from "./sources/telia";
import * as tmdb from "./sources/tmdb";
import * as sportsdb from "./sources/sportsdb";
import * as svtplay from "./sources/svtplay";

export interface Steg {
  kalla: string;
  status: "ok" | "fel";
  antal: number;
  meddelande?: string;
  ms: number;
}

export interface Sammanfattning {
  steg: Steg[];
  ms: number;
}

/** Kör ett steg, mät det, logga det, och låt aldrig felet spilla över. */
async function kor(kalla: string, fn: () => Promise<number>): Promise<Steg> {
  const start = Date.now();
  try {
    const antal = await fn();
    const steg: Steg = { kalla, status: "ok", antal, ms: Date.now() - start };
    await logga(steg);
    return steg;
  } catch (err) {
    const steg: Steg = {
      kalla,
      status: "fel",
      antal: 0,
      meddelande: err instanceof Error ? err.message : String(err),
      ms: Date.now() - start,
    };
    await logga(steg);
    return steg;
  }
}

async function logga(steg: Steg): Promise<void> {
  await sql`
    insert into ingest_logg (kalla, status, antal, meddelande, ms)
    values (${steg.kalla}, ${steg.status}, ${steg.antal}, ${steg.meddelande ?? null}, ${steg.ms})
  `.catch(() => {
    // Loggen är diagnostik. Att en misslyckad loggskrivning skulle stoppa
    // hämtningen vore att låta felsökningsverktyget bli felkällan.
  });
}

/**
 * Full hämtning.
 *
 * `djup` styr vad som körs. Tablån hämtas var femtonde minut, katalogen en gång
 * per dygn — JustWatch uppdaterar ändå bara en gång per dygn, och att fråga
 * TMDB varje kvart ger ingen färskare data, bara onödig last.
 */
export async function hamtaAllt(djup: "snabb" | "full" = "snabb"): Promise<Sammanfattning> {
  const start = Date.now();
  await ensureSchema();

  const steg: Steg[] = [];

  steg.push(await kor("frö", froa));
  steg.push(await kor("telia", teliaSteg));
  steg.push(await kor("tv.nu kanaler", tvnuKanalSteg));
  steg.push(await kor("tv.nu tablå", tvnuTablaSteg));
  steg.push(await kor("sport", sportSteg));
  steg.push(await kor("matchning", matchningsSteg));

  steg.push(await kor("svt play", () => svtSteg(djup === "full")));

  if (djup === "full") {
    steg.push(await kor("tmdb", tmdbSteg));
  }

  steg.push(await kor("städning", stadning));

  return { steg, ms: Date.now() - start };
}

/* ------------------------------------------------------------------- frö */

/**
 * Skriver in tjänster och kanaler ur content-filerna.
 *
 * `on conflict do update` rör bara namn och sorteringsordning. `ingar` lämnas
 * orörd — den ägs av dig och av Telia-hämtningen, aldrig av en deploy. Att
 * skriva över den här skulle betyda att varje ny version nollställde vad du
 * kryssat i.
 */
async function froa(): Promise<number> {
  for (const t of TJANSTER) {
    const gratis = ALLTID_INGAR.includes(t.id);
    await sql`
      insert into tjanst (id, namn, ingar, kalla)
      values (${t.id}, ${t.namn}, ${gratis}, ${gratis ? "auto" : "manuell"})
      on conflict (id) do update set namn = excluded.namn
    `;
  }

  for (const k of KANALER) {
    await sql`
      insert into kanal (id, tjanst_id, namn, sport, sort)
      values (${k.id}, ${k.tjanst}, ${k.namn}, ${k.sport ?? false}, ${k.sort})
      on conflict (id) do update set
        namn      = excluded.namn,
        tjanst_id = excluded.tjanst_id,
        sport     = excluded.sport,
        sort      = excluded.sort
    `;
  }

  for (const l of LIGOR) {
    await sql`
      insert into lag (id, sportsdb_id, namn, namn_key, liga_id)
      values (${`liga:${l.id}`}, ${l.sportsdbId}, ${l.namn}, ${lagNyckel(l.namn)}, ${l.id})
      on conflict (id) do update set namn = excluded.namn
    `;
  }

  return TJANSTER.length + KANALER.length;
}

/* ----------------------------------------------------------------- Telia */

/**
 * Hämtar vad som faktiskt ingår, och larmar när det ändrats.
 *
 * Två saker händer här som inte syns i radantalet: kanalernas `ingar` sätts
 * från Telias svar, och svaret sparas som en ögonblicksbild. Skiljer sig den
 * från förra gången har paketet ändrats — en kanal har tillkommit eller
 * försvunnit — och det är precis den sortens tyst förändring som annars gör att
 * man sitter och undrar varför en match inte går att se längre.
 */
async function teliaSteg(): Promise<number> {
  if (!process.env.TELIA_USERNAME) {
    throw new Error("TELIA_USERNAME saknas — hoppar över, manuell lista gäller.");
  }

  const kanaler = await telia.hamtaKanaler();
  const mina = kanaler.filter((k) => k.ingar);

  // Matcha Telias kanalnamn mot våra egna kanaler på samma normalisering som
  // används mot tv.nu. Ett namn som inte matchar blir inte till en ny kanal —
  // katalogen ägs av content/kanaler.ts, och en okänd rad från Telia är oftast
  // en regional variant eller en radiokanal.
  const { kanalNyckel } = await import("@/content/kanaler");
  const index = new Map(KANALER.flatMap((k) => kanalNycklar(k).map((n) => [n, k.id])));

  let traffar = 0;
  const ingaende: string[] = [];

  for (const k of kanaler) {
    const id = index.get(kanalNyckel(k.namn));
    if (!id) continue;
    traffar++;
    if (k.ingar) ingaende.push(id);

    await sql`
      update kanal set
        telia_cid = ${k.cid},
        logo      = coalesce(${k.logo ?? null}, logo),
        ingar     = ${k.ingar},
        kalla     = 'telia'
      where id = ${id}
    `;
  }

  // Tjänsten ingår om minst en av dess kanaler gör det. Rena
  // streamingtjänster utan kanaler (Max, Disney+, Prime) syns inte i
  // engagementinfo alls och måste kryssas i för hand på /ingar — det är en
  // känd begränsning, inte ett fel, och /ingar säger det rakt ut.
  await sql`
    update tjanst set ingar = true, kalla = 'telia', verifierad_at = now()
    where id in (select distinct tjanst_id from kanal where ingar = true)
  `;

  await sparaSnapshot(ingaende);
  return traffar;
}

async function sparaSnapshot(kanalIds: string[]): Promise<void> {
  const sorterade = [...kanalIds].sort();
  const senaste = await sql<{ kanaler: string[] }[]>`
    select kanaler from paket_snapshot order by at desc limit 1
  `;

  const forra = senaste[0]?.kanaler;
  const oforandrat =
    Array.isArray(forra) &&
    forra.length === sorterade.length &&
    forra.every((k, i) => k === sorterade[i]);

  // Spara bara när något ändrats. En rad per hämtning skulle ge tiotusen rader
  // i månaden och göra historiken oläsbar.
  if (oforandrat) return;

  await sql`insert into paket_snapshot (kanaler) values (${JSON.stringify(sorterade)}::jsonb)`;
}

/* ----------------------------------------------------------------- tv.nu */

async function tvnuKanalSteg(): Promise<number> {
  const lista = await tvnu.hamtaKanaler();
  const vara = KANALER.map((k) => ({ id: k.id, nycklar: kanalNycklar(k) }));
  const { traffar } = tvnu.matchaKanaler(vara, lista);

  for (const [id, t] of traffar) {
    await sql`
      update kanal set tvnu_id = ${t.id}, logo = coalesce(logo, ${t.logo ?? null})
      where id = ${id}
    `;
  }

  return traffar.size;
}

/**
 * Tablån för de kanaler som ingår.
 *
 * Bara de som ingår — att hämta trettio kanaler du inte har är trettio anrop
 * per dag mot en gratis tjänst för data som aldrig får visas. Ingår-filtret
 * sparar alltså inte bara skärmyta utan också trafik.
 */
async function tvnuTablaSteg(): Promise<number> {
  const kanaler = await sql<{ id: string; tvnu_id: string }[]>`
    select k.id, k.tvnu_id
    from kanal k join tjanst t on t.id = k.tjanst_id
    where k.ingar = true and t.ingar = true and k.tvnu_id is not null
    order by k.sort
  `;

  const dagar = [0, 1, 2].map((n) => tvDayKey(new Date(Date.now() + n * 86_400_000)));
  let antal = 0;

  /*
   * Brytare.
   *
   * Trettio kanaler gånger tre dagar är nittio anrop, vart och ett med tre
   * försök och backoff. Är tv.nu nere kostar det över en minut att misslyckas
   * nittio gånger i rad — varje kvart, i onödan, mot en tjänst som redan har
   * problem. Fem misslyckanden i följd betyder att källan är nere och inte att
   * just den kanalen strular, och då är det rätt att sluta försöka och säga det.
   */
  let ifoljd = 0;
  const TAK = 5;

  for (const kanal of kanaler) {
    for (const dag of dagar) {
      if (ifoljd >= TAK) {
        throw new Error(
          `tv.nu svarade inte på ${TAK} anrop i rad — avbryter. ` +
            `${antal} sändningar hann sparas.`,
        );
      }

      const program = await tvnu.hamtaTabla(kanal.tvnu_id, dag).catch(() => null);
      if (program === null) {
        ifoljd++;
        continue;
      }
      ifoljd = 0;

      for (const p of program) {
        const id = `${kanal.id}:${p.start.getTime()}`;
        await sql`
          insert into program (id, kanal_id, start, slut, titel, titel_key, beskrivning, genre, sasong, avsnitt, bild)
          values (
            ${id}, ${kanal.id}, ${p.start}, ${p.slut}, ${p.titel}, ${titelNyckel(p.titel)},
            ${p.beskrivning ?? null}, ${p.genre ?? null}, ${p.sasong ?? null},
            ${p.avsnitt ?? null}, ${p.bild ?? null}
          )
          on conflict (id) do update set
            slut        = excluded.slut,
            titel       = excluded.titel,
            titel_key   = excluded.titel_key,
            beskrivning = excluded.beskrivning,
            genre       = excluded.genre,
            hamtad_at   = now()
        `;
        antal++;
      }
    }
  }

  return antal;
}

/* ----------------------------------------------------------------- sport */

/** Matcher för favoritlagen. Bara de — ingen bryr sig om resten. */
async function sportSteg(): Promise<number> {
  const lag = await sql<{ id: string; sportsdb_id: string | null }[]>`
    select distinct l.id, l.sportsdb_id
    from lag l join favorit f on f.ref_id = l.id and f.sort = 'lag'
    where l.sportsdb_id is not null
  `;

  let antal = 0;
  for (const l of lag) {
    const matcher = await sportsdb.hamtaMatcher(l.sportsdb_id!).catch(() => []);
    for (const m of matcher) {
      if (!m.start) continue;
      await sql`
        insert into sportmatch (id, sportsdb_id, liga_id, hemma, borta, start)
        values (${`sdb:${m.id}`}, ${m.id}, ${m.ligaId}, ${m.hemma}, ${m.borta}, ${m.start})
        on conflict (id) do update set
          start     = excluded.start,
          hamtad_at = now()
      `;
      antal++;
    }
  }

  return antal;
}

/**
 * Parar ihop matcher med sändningar.
 *
 * Körs efter tablån, och bara på matcher som ännu inte hittat sin sändning
 * eller vars matchning är äldre än tablåhämtningen. En match som redan pekar
 * på rätt program behöver inte räknas om varje kvart.
 */
async function matchningsSteg(): Promise<number> {
  const matcher = await sql<{ id: string; hemma: string; borta: string; start: Date }[]>`
    select id, hemma, borta, start
    from sportmatch
    where start > now() - interval '4 hours'
      and start < now() + interval '14 days'
      and (program_id is null or matchad_at < now() - interval '6 hours')
  `;

  if (matcher.length === 0) return 0;

  // Kandidaterna hämtas en gång för alla matcher i stället för per match.
  // Tablån för två veckor på tjugo kanaler är några tusen rader — trivialt i
  // minne, men tvåhundra separata frågor vore det inte.
  const kandidater = await sql<Kandidat[]>`
    select p.id, p.kanal_id as "kanalId", p.titel_key, p.start
    from program p
    join kanal k on k.id = p.kanal_id
    join tjanst t on t.id = k.tjanst_id
    where k.ingar = true and t.ingar = true
      and p.start > now() - interval '4 hours'
  `;

  let traffar = 0;
  for (const m of matcher) {
    const traff = hittaSandning(m, kandidater as unknown as Kandidat[]);
    await sql`
      update sportmatch
      set program_id = ${traff?.id ?? null}, matchad_at = now()
      where id = ${m.id}
    `;
    if (traff) traffar++;
  }

  return traffar;
}

/* -------------------------------------------------------------- SVT Play */

/**
 * SVT Play:s katalog.
 *
 * Körs vid varje hämtning, inte bara den dygnsvisa. SVT kostar ingen nyckel
 * och tre anrop, och till skillnad från JustWatch-exporten är deras data
 * färsk — nytt på SVT Play dyker upp samma dag.
 *
 * Hela A–Ö-listan hämtas bara vid full körning. Den är tusentals rader utan
 * bilder och finns för sökningens skull, inte för att bläddras i.
 *
 * Steget kräver INTE att svtplay är ikryssad på /ingar. SVT är public service
 * och ligger i ALLTID_INGAR — att kräva att du kryssar i något du redan
 * betalat för via skatten vore att låtsas att appen inte vet något den vet.
 */
async function svtSteg(full: boolean): Promise<number> {
  const urval: svtplay.Urval[] = ["latest_start", "popular_start", "lastchance_start"];

  /*
   * Nyhetsplatsen kommer BARA ur latest_start, och bara därifrån.
   *
   * popular_start är populärt, inte nytt. A-Ö-listan är hela katalogen i
   * bokstavsordning. Låter man någon av dem sätta nyhetsstämpeln blir "Nytt i
   * paketet" en alfabetisk klump — trettio program som alla börjar på F,
   * presenterade som veckans nyheter. Det var precis vad appen gjorde.
   */
  const titlar: { titel: svtplay.SvtTitel; nyhetsplats?: number }[] = [];

  for (const u of urval) {
    const svar = await svtplay.hamtaUrval(u);
    for (const [plats, titel] of svar.entries()) {
      titlar.push({ titel, nyhetsplats: u === "latest_start" ? plats : undefined });
    }
  }
  if (full) {
    for (const titel of await svtplay.hamtaAllaProgram()) titlar.push({ titel });
  }

  if (titlar.length === 0) {
    throw new Error("SVT svarade utan titlar — troligen en förändrad fråga, se sources/svtplay.ts");
  }

  /*
   * Samma titel kan ligga i flera urval — populär OCH på väg bort är inget
   * ovanligt. Slå ihop dem först, och låt sista chansen vinna: en titel som
   * står i lastchance ska flaggas även om den också råkade ligga i latest.
   */
  const unika = new Map<string, { titel: svtplay.SvtTitel; nyhetsplats?: number }>();
  for (const post of titlar) {
    const befintlig = unika.get(post.titel.vag);
    if (!befintlig) {
      unika.set(post.titel.vag, post);
      continue;
    }
    unika.set(post.titel.vag, {
      titel: {
        ...befintlig.titel,
        sistaChansen: befintlig.titel.sistaChansen || post.titel.sistaChansen,
      },
      // Låg plats vinner: hamnar titeln i både latest och popular är det
      // latest-platsen som betyder något.
      nyhetsplats: minsta(befintlig.nyhetsplats, post.nyhetsplats),
    });
  }

  for (const { titel: t, nyhetsplats } of unika.values()) {
    const id = `svt:${t.vag}`;
    await sql`
      insert into titel (id, typ, namn, poster, synopsis, extern_url)
      values (${id}, ${t.typ}, ${t.namn}, ${t.bild}, ${t.synopsis}, ${svtplay.svtplayUrl(t.vag)})
      on conflict (id) do update set
        namn     = excluded.namn,
        poster   = coalesce(excluded.poster, titel.poster),
        synopsis = coalesce(excluded.synopsis, titel.synopsis),
        extern_url = excluded.extern_url,
        uppdaterad_at = now()
    `;
    await sql`
      insert into tillganglig (titel_id, tjanst_id, sista_chansen, nyhet_at, nyhet_rank)
      values (${id}, 'svtplay', ${t.sistaChansen},
              ${nyhetsplats === undefined ? null : new Date()}, ${nyhetsplats ?? null})
      on conflict (titel_id, tjanst_id) do update set
        sedd_sist     = now(),
        sista_chansen = excluded.sista_chansen,
        nyhet_at      = coalesce(tillganglig.nyhet_at, excluded.nyhet_at),
        nyhet_rank    = coalesce(tillganglig.nyhet_rank, excluded.nyhet_rank)
    `;
  }

  return unika.size;
}

/** Minsta av två platser, där odefinierad betyder "ingen plats alls". */
function minsta(a?: number, b?: number): number | undefined {
  if (a === undefined) return b;
  if (b === undefined) return a;
  return Math.min(a, b);
}

/* ------------------------------------------------------------------ TMDB */

/**
 * Katalogen för de tjänster som ingår.
 *
 * `sedd_sist` uppdateras vid varje hämtning. Det är den som gör "Sista chansen"
 * möjlig: en titel som slutar dyka upp i svaret slutar få sin tidsstämpel
 * uppdaterad, och efter en vecka är det ett rimligt antagande att den lämnat
 * tjänsten. Det är ingen officiell uppgift om avpubliceringsdatum — sådan finns
 * inte gratis — men det är ett ärligt närmevärde, och /film säger vad det bygger
 * på.
 */
async function tmdbSteg(): Promise<number> {
  const tjanster = await sql<{ id: string }[]>`select id from tjanst where ingar = true`;
  const providers = tjanster
    .map((t) => TJANSTER.find((x) => x.id === t.id)?.tmdbProvider)
    .filter((p): p is number => typeof p === "number");

  if (providers.length === 0) {
    throw new Error("inga tjänster med TMDB-provider ingår — hoppar över katalogen");
  }

  let antal = 0;

  /*
   * Felen samlas, de sväljs inte.
   *
   * Anropen låg förut bakom `.catch(() => [])`, vilket gjorde ett trasigt
   * TMDB omöjligt att se: saknades nyckeln misslyckades varje anrop, steget
   * returnerade noll rader och loggades som OK. /kallor visade en grön prick
   * och "0 rader", appen var tom, och ingenting någonstans sa varför.
   *
   * Ett enskilt fel ska fortfarande inte stoppa resten — en provider som
   * strular får inte ta katalogen för de andra med sig. Men går INGET in och
   * det fanns fel, då är det felet svaret, och det ska stå på /kallor.
   */
  const fel: string[] = [];
  const notera = (err: unknown) => {
    const text = err instanceof Error ? err.message : String(err);
    if (!fel.includes(text)) fel.push(text);
    return [];
  };

  for (const typ of ["film", "serie"] as const) {
    // En provider i taget, annars går det inte att veta VILKEN tjänst som
    // visar titeln — och det är just den uppgiften appen finns för att ge.
    for (const t of tjanster) {
      const provider = TJANSTER.find((x) => x.id === t.id)?.tmdbProvider;
      if (!provider) continue;

      const titlar = await tmdb.hamtaKatalog([provider], typ).catch(notera);
      for (const titel of titlar) {
        await sparaTitel(titel, typ, t.id);
        antal++;
      }

      /*
       * Nyheterna hämtas separat och skrivs efter katalogen, så att nyhet_at
       * sätts på rader som just skapats av loopen ovan. Ordningen från TMDB
       * bevaras som nyhet_rank — titlar från samma körning delar tidsstämpel,
       * och utan rangen faller de tillbaka på insättningsordning.
       */
      const nya = await tmdb.hamtaNyheter([provider], typ).catch(notera);
      for (const [plats, titel] of nya.entries()) {
        await sparaTitel(titel, typ, t.id, plats);
      }
    }
  }

  if (antal === 0 && fel.length > 0) {
    throw new Error(fel.join(" · "));
  }

  // Delvis lyckat: säg vad som fattas, men behåll det som kom in.
  if (fel.length > 0) {
    console.warn(`[tmdb] ${antal} titlar hämtade, men: ${fel.join(" · ")}`);
  }

  return antal;
}

/**
 * Skriver en TMDB-titel och kopplingen till tjänsten.
 *
 * `nyhetsplats` sätts bara när raden kommer ur nyhetslistan. Katalogloopen
 * lämnar den odefinierad, och då rörs varken nyhet_at eller nyhet_rank — en
 * massimport ska aldrig kunna se ut som en nyhet.
 */
async function sparaTitel(
  titel: tmdb.TmdbTitel,
  typ: "film" | "serie",
  tjanstId: string,
  nyhetsplats?: number,
): Promise<void> {
  const id = `tmdb:${typ}:${titel.tmdbId}`;

  await sql`
    insert into titel (id, tmdb_id, typ, namn, ar, poster, synopsis, betyg, genre)
    values (${id}, ${titel.tmdbId}, ${typ}, ${titel.namn}, ${titel.ar},
            ${titel.poster}, ${titel.synopsis}, ${titel.betyg}, ${titel.genrer})
    on conflict (id) do update set
      namn = excluded.namn, poster = excluded.poster,
      synopsis = excluded.synopsis, betyg = excluded.betyg,
      -- Genrerna skrivs bara över när det nya svaret faktiskt har några.
      -- Ett tomt svar ska inte tömma en titel som redan var kategoriserad.
      genre = case when cardinality(excluded.genre) > 0 then excluded.genre else titel.genre end,
      uppdaterad_at = now()
  `;

  if (nyhetsplats === undefined) {
    await sql`
      insert into tillganglig (titel_id, tjanst_id) values (${id}, ${tjanstId})
      on conflict (titel_id, tjanst_id) do update set sedd_sist = now()
    `;
    return;
  }

  await sql`
    insert into tillganglig (titel_id, tjanst_id, nyhet_at, nyhet_rank)
    values (${id}, ${tjanstId}, now(), ${nyhetsplats})
    on conflict (titel_id, tjanst_id) do update set
      sedd_sist = now(),
      -- Nyhetsstämpeln sätts en gång och står kvar. Att skriva om den vid varje
      -- körning skulle hålla samma titel överst i "Nytt i paketet" i tre
      -- månader, så länge den ligger kvar i TMDB:s datumfönster.
      nyhet_at   = coalesce(tillganglig.nyhet_at, now()),
      nyhet_rank = coalesce(tillganglig.nyhet_rank, ${nyhetsplats})
  `;
}

/* --------------------------------------------------------------- städning */

/**
 * Slänger det som passerat.
 *
 * Gamla program är inte bara skräp utan aktivt skadliga: en tablåfråga som
 * plöjer ett halvårs sändningar blir långsam, och en titelmatchning mot
 * fjolårets repriser ger fel svar. Sparat och favoriter rörs aldrig.
 */
async function stadning(): Promise<number> {
  const program = await sql`delete from program where start < now() - interval '2 days'`;
  const matcher = await sql`delete from sportmatch where start < now() - interval '7 days'`;
  const logg = await sql`delete from ingest_logg where at < now() - interval '30 days'`;
  return program.count + matcher.count + logg.count;
}
