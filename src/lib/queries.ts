/**
 * Läsvägen. Alla frågor mot databasen som en sida behöver.
 *
 * Genomgående mönster: ingår-villkoret ligger i SQL-frågan, inte i ett filter
 * efteråt. `join tjanst t on t.id = k.tjanst_id where k.ingar and t.ingar` är
 * inte bara snabbare än att hämta allt och sålla — det gör att en glömd
 * filtrering i en komponent inte kan leda till att fel innehåll visas, eftersom
 * det aldrig lämnade databasen.
 *
 * lib/entitlement.ts finns ändå kvar, som andra spärr och som det som skriptet
 * check-entitlements.mjs kontrollerar. Bälte och hängslen, på den enda regel
 * där det är värt priset.
 */

import { sql, ensureSchema } from "./db";
import { tvDayRange, tvDayKey } from "./time";
import type { IngarKarta } from "./entitlement";
import type { ProgramVy, MatchVy, TitelVy, KanalRad, TjanstRad } from "./types";

/* ------------------------------------------------------------ ingår-karta */

export async function ingarKarta(): Promise<IngarKarta> {
  await ensureSchema();

  const [tjanster, kanaler, senast] = await Promise.all([
    sql<{ id: string }[]>`select id from tjanst where ingar = true`,
    sql<{ id: string }[]>`
      select k.id from kanal k join tjanst t on t.id = k.tjanst_id
      where k.ingar = true and t.ingar = true
    `,
    sql<{ verifierad_at: Date | null }[]>`
      select max(verifierad_at) as verifierad_at from tjanst where kalla = 'telia'
    `,
  ]);

  return {
    tjanster: new Set(tjanster.map((t) => t.id)),
    kanaler: new Set(kanaler.map((k) => k.id)),
    verifierad: senast[0]?.verifierad_at ?? null,
  };
}

/* ------------------------------------------------------------------ tablå */

export interface TablaKanal {
  id: string;
  namn: string;
  logo: string | null;
  tjanstId: string;
  sport: boolean;
  favorit: boolean;
  program: ProgramVy[];
}

/**
 * Hela tablån för ett tv-dygn.
 *
 * En fråga för kanalerna och en för programmen, sedan grupperat i minne. Att i
 * stället göra en fråga per kanal skulle vara trettio rundturer till databasen
 * per sidladdning.
 */
export async function tabla(
  dag: string,
  opts: { profilId?: string | null; baraSport?: boolean } = {},
): Promise<TablaKanal[]> {
  await ensureSchema();
  const { from, to } = tvDayRange(dag);

  const kanaler = await sql<
    (KanalRad & { favorit: boolean })[]
  >`
    select k.*, (f.ref_id is not null) as favorit
    from kanal k
    join tjanst t on t.id = k.tjanst_id
    left join favorit f
      on f.ref_id = k.id and f.sort = 'kanal' and f.profil_id = ${opts.profilId ?? ""}
    where k.ingar = true and t.ingar = true
      ${opts.baraSport ? sql`and k.sport = true` : sql``}
    order by (f.ref_id is null), k.sort
  `;

  if (kanaler.length === 0) return [];

  const program = await sql<ProgramVy[]>`
    select p.*, k.namn as "kanalNamn", k.logo as "kanalLogo",
           k.tjanst_id as "tjanstId", k.sport
    from program p
    join kanal k on k.id = p.kanal_id
    join tjanst t on t.id = k.tjanst_id
    where k.ingar = true and t.ingar = true
      and p.start >= ${from} and p.start < ${to}
      ${opts.baraSport ? sql`and k.sport = true` : sql``}
    order by p.start
  `;

  const perKanal = new Map<string, ProgramVy[]>();
  for (const p of program) {
    const lista = perKanal.get(p.kanal_id) ?? [];
    lista.push(p);
    perKanal.set(p.kanal_id, lista);
  }

  return kanaler.map((k) => ({
    id: k.id,
    namn: k.namn,
    logo: k.logo,
    tjanstId: k.tjanst_id,
    sport: k.sport,
    favorit: k.favorit,
    program: perKanal.get(k.id) ?? [],
  }));
}

/** Vad som sänds i den här stunden. */
export async function pagarNu(opts: { baraFavoriter?: boolean; profilId?: string | null } = {}): Promise<ProgramVy[]> {
  await ensureSchema();

  return sql<ProgramVy[]>`
    select p.*, k.namn as "kanalNamn", k.logo as "kanalLogo",
           k.tjanst_id as "tjanstId", k.sport,
           (f.ref_id is not null) as favorit
    from program p
    join kanal k on k.id = p.kanal_id
    join tjanst t on t.id = k.tjanst_id
    left join favorit f
      on f.ref_id = k.id and f.sort = 'kanal' and f.profil_id = ${opts.profilId ?? ""}
    where k.ingar = true and t.ingar = true
      and p.start <= now() and (p.slut is null or p.slut > now())
      ${opts.baraFavoriter ? sql`and f.ref_id is not null` : sql``}
    order by (f.ref_id is null), k.sort
  `;
}

/**
 * Kvällens sändningar.
 *
 * 18:00–23:00 svensk tid på det tv-dygn vi är inne i. Efter 23 är "ikväll"
 * inte längre en användbar fråga, och då visar blocket morgondagens kväll i
 * stället — det är vad man menar när man frågar efter midnatt.
 */
export async function ikvall(opts: { profilId?: string | null } = {}): Promise<ProgramVy[]> {
  await ensureSchema();
  const { from } = tvDayRange(tvDayKey());
  const start = new Date(from.getTime() + 12 * 3600_000); // 18:00
  const slut = new Date(from.getTime() + 17 * 3600_000); // 23:00

  return sql<ProgramVy[]>`
    select p.*, k.namn as "kanalNamn", k.logo as "kanalLogo",
           k.tjanst_id as "tjanstId", k.sport,
           (f.ref_id is not null) as favorit
    from program p
    join kanal k on k.id = p.kanal_id
    join tjanst t on t.id = k.tjanst_id
    left join favorit f
      on f.ref_id = k.id and f.sort = 'kanal' and f.profil_id = ${opts.profilId ?? ""}
    where k.ingar = true and t.ingar = true
      and p.start >= ${start} and p.start < ${slut}
    order by (f.ref_id is null), p.start, k.sort
  `;
}

/* ------------------------------------------------------------------ sport */

/**
 * Kommande matcher för profilens lag.
 *
 * Notera att matcher UTAN sändning också kommer med. Det är inte ett brott mot
 * ingår-regeln utan hela poängen med sportsidan: "din match sänds inte på något
 * du har" är ett svar du behöver, till skillnad från ett tips om en film du
 * inte kan se. Sidan visar dem åtskilda och tydligt märkta.
 */
export async function kommandeMatcher(
  profilId: string | null,
  opts: { dagar?: number } = {},
): Promise<MatchVy[]> {
  await ensureSchema();
  const dagar = opts.dagar ?? 14;

  const rader = await sql<
    (MatchVy & { kanal_id: string | null; kanal_namn: string | null; kanal_tjanst: string | null })[]
  >`
    select m.id, m.liga_id, m.hemma, m.borta, m.start, m.program_id, m.tjanst_id,
           k.id as kanal_id, k.namn as kanal_namn, k.tjanst_id as kanal_tjanst
    from sportmatch m
    left join program p on p.id = m.program_id
    left join kanal k on k.id = p.kanal_id
    left join tjanst t on t.id = k.tjanst_id
    where m.start > now() - interval '3 hours'
      and m.start < now() + ${`${dagar} days`}::interval
      and (
        -- Matchen rör ett lag profilen följer.
        exists (
          select 1 from favorit f
          join lag l on l.id = f.ref_id
          where f.profil_id = ${profilId ?? ""} and f.sort = 'lag'
            and (l.namn = m.hemma or l.namn = m.borta)
        )
      )
      -- Sändningen räknas bara om den ingår. Gör den inte det behandlas
      -- matchen som osänd, vilket är sant ur din synvinkel.
      and (k.id is null or (k.ingar = true and t.ingar = true))
    order by m.start
  `;

  return rader.map((r) => ({
    id: r.id,
    liga_id: r.liga_id,
    hemma: r.hemma,
    borta: r.borta,
    start: r.start,
    program_id: r.program_id,
    tjanst_id: r.tjanst_id,
    var: r.kanal_id
      ? { kanalId: r.kanal_id, kanalNamn: r.kanal_namn!, tjanstId: r.kanal_tjanst! }
      : null,
    favoritlag: [],
  }));
}

/** Sportsändningar i tablån, oavsett lag. Sportsidans andra halva. */
export async function sportITablan(dagar = 3): Promise<ProgramVy[]> {
  await ensureSchema();

  return sql<ProgramVy[]>`
    select p.*, k.namn as "kanalNamn", k.logo as "kanalLogo",
           k.tjanst_id as "tjanstId", k.sport
    from program p
    join kanal k on k.id = p.kanal_id
    join tjanst t on t.id = k.tjanst_id
    where k.ingar = true and t.ingar = true and k.sport = true
      and p.start > now() - interval '2 hours'
      and p.start < now() + ${`${dagar} days`}::interval
    order by p.start
    limit 200
  `;
}

/* ----------------------------------------------------------- film & serier */

/*
 * OM `tj.omfattning = 'allt'` I VARJE FRÅGA HÄR NEDAN.
 *
 * Att en tjänst ingår betyder inte att hela tjänsten gör det. I Telias Stora
 * sportpaketet ingår "Viaplay Sport — film och serier ingår inte" och "TV4 Play
 * Sport Fotboll", alltså sportnivåer av tjänster som också säljer film.
 *
 * Utan det här villkoret visade appen hela Viaplays filmkatalog för någon som
 * bara har sporten. Det är inte en skönhetsfläck — det är exakt det appen finns
 * för att undvika, och det värsta felet den kan göra: att tipsa om något du
 * inte kan se.
 *
 * Villkoret sitter i FRÅGAN och inte bara i hämtningen, med flit. Hämtningen
 * hindrar nya titlar från att komma in; frågan gör att titlar som redan ligger
 * i databasen från en tidigare körning försvinner ur vyn med en gång.
 */

/**
 * Nytt i paketet.
 *
 * Bygger på `nyhet_at`, som bara sätts av källor som FAKTISKT vet: SVT:s
 * latest_start och TMDB:s datumfiltrerade discover. Tidigare stod här
 * `sedd_forst`, alltså när vi råkade skriva in raden — och den dagen SVT:s
 * A-Ö-lista importerades i klump blev alla rader lika nya på en gång.
 * Sorteringen föll då tillbaka på insättningsordningen, som är alfabetisk, och
 * blocket fylldes med program som alla började på samma bokstav.
 *
 * `nyhet_rank` är källans egen ordning och avgör inom samma körning, eftersom
 * de raderna delar tidsstämpel ner till millisekunden.
 *
 * Affischkravet är medvetet: det här är en rad man bläddrar i med ögat. En
 * titel utan bild hör hemma i sökningen, inte i en bildrad.
 */
export async function nyttIPaketet(antal = 24): Promise<TitelVy[]> {
  await ensureSchema();

  return sql<TitelVy[]>`
    select t.*, array_agg(a.tjanst_id order by tj.prioritet, a.tjanst_id) as tjanster,
           min(a.sedd_forst) as sedd_forst, max(a.sedd_sist) as sedd_sist
    from titel t
    join tillganglig a on a.titel_id = t.id
    join tjanst tj on tj.id = a.tjanst_id and tj.ingar = true and tj.omfattning = 'allt'
    where a.nyhet_at is not null
      and a.nyhet_at > now() - interval '60 days'
      and t.poster is not null
    group by t.id
    order by max(a.nyhet_at) desc, min(a.nyhet_rank) asc nulls last, t.betyg desc nulls last
    limit ${antal}
  `;
}

/**
 * Titlar i en genre, det bästa först.
 *
 * Sorteringen är betyg och inte popularitet, och det är ett val: popularitet
 * gör varje genre till samma tio titlar man redan sett omtalade. Betyg lyfter
 * det man missade. Titlar utan betyg hamnar sist i stället för att försvinna —
 * SVT:s eget material har sällan något betyg alls.
 */
export async function titlarIGenre(genreId: string, antal = 20): Promise<TitelVy[]> {
  await ensureSchema();

  return sql<TitelVy[]>`
    select t.*, array_agg(a.tjanst_id order by tj.prioritet, a.tjanst_id) as tjanster,
           min(a.sedd_forst) as sedd_forst, max(a.sedd_sist) as sedd_sist
    from titel t
    join tillganglig a on a.titel_id = t.id
    join tjanst tj on tj.id = a.tjanst_id and tj.ingar = true and tj.omfattning = 'allt'
    where ${genreId} = any(t.genre)
      and t.poster is not null
    group by t.id
    order by t.betyg desc nulls last, t.namn
    limit ${antal}
  `;
}

/**
 * Vilka genrer som har tillräckligt med innehåll för att vara värda en rad.
 *
 * En rubrik med två titlar under sig ser ut som ett fel. Tröskeln gör att
 * bläddringssidan bara visar rader som går att bläddra i.
 */
export async function genrerMedInnehall(minst = 4): Promise<{ genre: string; antal: number }[]> {
  await ensureSchema();

  return sql<{ genre: string; antal: number }[]>`
    select g as genre, count(distinct t.id)::int as antal
    from titel t
    cross join lateral unnest(t.genre) as g
    join tillganglig a on a.titel_id = t.id
    join tjanst tj on tj.id = a.tjanst_id and tj.ingar = true and tj.omfattning = 'allt'
    where t.poster is not null
    group by g
    having count(distinct t.id) >= ${minst}
    order by count(distinct t.id) desc
  `;
}

/** Titlar hos en enskild tjänst. Raden man går till när man vet var man vill leta. */
export async function titlarHosTjanst(tjanstId: string, antal = 20): Promise<TitelVy[]> {
  await ensureSchema();

  return sql<TitelVy[]>`
    select t.*, array_agg(a2.tjanst_id order by tj2.prioritet, a2.tjanst_id) as tjanster,
           min(a2.sedd_forst) as sedd_forst, max(a2.sedd_sist) as sedd_sist
    from titel t
    join tillganglig a on a.titel_id = t.id and a.tjanst_id = ${tjanstId}
    join tjanst tj on tj.id = a.tjanst_id and tj.ingar = true and tj.omfattning = 'allt'
    /*
     * Den andra kopplingen finns för att kunna visa ALLA tjänster titeln går
     * att se på, inte bara den man filtrerat fram. Den måste lyda samma regler
     * som den första — annars listas tjänster som inte ingår, eller som bara
     * ingår för sporten.
     *
     * Det felet fanns här: en film som gick på både Viaplay och Prime fick
     * båda märkena, och Spela-knappen tog den första i listan — Viaplay, som
     * abonnenten inte har film på. Appen skickade alltså iväg någon till en
     * tjänst den själv visste var fel.
     */
    join tillganglig a2 on a2.titel_id = t.id
    join tjanst tj2 on tj2.id = a2.tjanst_id and tj2.ingar = true and tj2.omfattning = 'allt'
    where t.poster is not null
    group by t.id
    order by t.betyg desc nulls last, t.namn
    limit ${antal}
  `;
}

/**
 * Titlar som är, eller troligen är, på väg bort.
 *
 * Två sorters underlag, och de blandas inte ihop:
 *
 * SVT säger det själva. Deras urval `lastchance_start` är en officiell uppgift
 * om vad som snart tas ned, och den sparas som `tillganglig.sista_chansen`.
 *
 * För de kommersiella tjänsterna finns ingen sådan uppgift gratis, och där får
 * `sedd_sist` gälla: titeln kom inte med i de senaste katalogsvaren. Det är ett
 * närmevärde. Två dygns tystnad är för lite (en missad hämtning räcker), en
 * vecka är för mycket. Fyra dygn är kompromissen.
 *
 * De officiella sorteras först, och `officiell` följer med ut så att
 * gränssnittet kan säga vilket av de två man tittar på.
 */
export async function sistaChansen(antal = 12): Promise<TitelVy[]> {
  await ensureSchema();

  return sql<TitelVy[]>`
    select t.*, array_agg(a.tjanst_id order by tj.prioritet, a.tjanst_id) as tjanster,
           min(a.sedd_forst) as sedd_forst, max(a.sedd_sist) as sedd_sist,
           bool_or(a.sista_chansen) as officiell
    from titel t
    join tillganglig a on a.titel_id = t.id
    join tjanst tj on tj.id = a.tjanst_id and tj.ingar = true and tj.omfattning = 'allt'
    group by t.id
    having bool_or(a.sista_chansen)
        or (max(a.sedd_sist) < now() - interval '4 days'
            and max(a.sedd_sist) > now() - interval '21 days')
    order by bool_or(a.sista_chansen) desc, max(a.sedd_sist)
    limit ${antal}
  `;
}

/** Sökning i det som ingår. Enda sökrutan du behöver. */
export async function sokTitlar(fraga: string, antal = 40): Promise<TitelVy[]> {
  await ensureSchema();
  if (!fraga.trim()) return [];

  return sql<TitelVy[]>`
    select t.*, array_agg(a.tjanst_id order by tj.prioritet, a.tjanst_id) as tjanster,
           min(a.sedd_forst) as sedd_forst, max(a.sedd_sist) as sedd_sist
    from titel t
    join tillganglig a on a.titel_id = t.id
    join tjanst tj on tj.id = a.tjanst_id and tj.ingar = true and tj.omfattning = 'allt'
    where t.namn ilike ${`%${fraga}%`}
    group by t.id
    order by t.betyg desc nulls last
    limit ${antal}
  `;
}

/** Sökning i tablån. Samma ruta, andra halvan av svaret. */
export async function sokProgram(fraga: string, antal = 40): Promise<ProgramVy[]> {
  await ensureSchema();
  if (!fraga.trim()) return [];

  return sql<ProgramVy[]>`
    select p.*, k.namn as "kanalNamn", k.logo as "kanalLogo",
           k.tjanst_id as "tjanstId", k.sport
    from program p
    join kanal k on k.id = p.kanal_id
    join tjanst t on t.id = k.tjanst_id
    where k.ingar = true and t.ingar = true
      and p.start > now() - interval '2 hours'
      and (p.titel ilike ${`%${fraga}%`} or p.beskrivning ilike ${`%${fraga}%`})
    order by p.start
    limit ${antal}
  `;
}

/* --------------------------------------------------------------- profildata */

export async function sparat(profilId: string): Promise<{ titlar: TitelVy[]; program: ProgramVy[] }> {
  await ensureSchema();

  const [titlar, program] = await Promise.all([
    sql<TitelVy[]>`
      select t.*, array_agg(a.tjanst_id order by tj.prioritet, a.tjanst_id) as tjanster,
             min(a.sedd_forst) as sedd_forst, max(a.sedd_sist) as sedd_sist
      from titel t
      join favorit f on f.ref_id = t.id and f.sort = 'titel' and f.profil_id = ${profilId}
      join tillganglig a on a.titel_id = t.id
      join tjanst tj on tj.id = a.tjanst_id and tj.ingar = true and tj.omfattning = 'allt'
      group by t.id
      order by max(f.skapad) desc
    `,
    sql<ProgramVy[]>`
      select p.*, k.namn as "kanalNamn", k.logo as "kanalLogo",
             k.tjanst_id as "tjanstId", k.sport
      from program p
      join favorit f on f.ref_id = p.id and f.sort = 'program' and f.profil_id = ${profilId}
      join kanal k on k.id = p.kanal_id
      join tjanst t on t.id = k.tjanst_id
      where k.ingar = true and t.ingar = true and p.start > now() - interval '4 hours'
      order by p.start
    `,
  ]);

  return { titlar, program };
}

/* ---------------------------------------------------------- inställningar */

export async function tjansterMedStatus(): Promise<TjanstRad[]> {
  await ensureSchema();
  return sql<TjanstRad[]>`select * from tjanst order by ingar desc, namn`;
}

export async function kanalerMedStatus(): Promise<KanalRad[]> {
  await ensureSchema();

  /*
   * Antalet sändningar per kanal följer med, och det är hela poängen.
   *
   * Ett tv.nu-id fylls i för hand och kan vara fel. Utan siffran syns det inte:
   * kanalen ser rätt ut på /ingar, tablån är bara tom, och man har ingenting
   * att gå på. Står det "0 program" bredvid ett ifyllt id är det id:t som är
   * fel — det är en hel felsökning ersatt av en siffra.
   */
  return sql<KanalRad[]>`
    select k.*, coalesce(p.antal, 0)::int as program_antal
    from kanal k
    left join (
      select kanal_id, count(*) as antal
      from program
      where start > now() - interval '1 day'
      group by kanal_id
    ) p on p.kanal_id = k.id
    order by k.sort
  `;
}

/** Kanaler som ingår men saknar koppling till tv.nu — alltså tom tablå. */
export async function omatchadeKanaler(): Promise<KanalRad[]> {
  await ensureSchema();
  return sql<KanalRad[]>`
    select k.* from kanal k join tjanst t on t.id = k.tjanst_id
    where k.ingar = true and t.ingar = true and k.tvnu_id is null
    order by k.sort
  `;
}

export interface Kallhalsa {
  kalla: string;
  status: string;
  antal: number;
  meddelande: string | null;
  at: Date;
}

export async function kallhalsa(): Promise<Kallhalsa[]> {
  await ensureSchema();
  return sql<Kallhalsa[]>`
    select distinct on (kalla) kalla, status, antal, meddelande, at
    from ingest_logg
    order by kalla, at desc
  `;
}

/** Paketförändringar: vad som tillkommit och försvunnit sedan förra gången. */
export async function paketForandring(): Promise<{ nya: string[]; borta: string[]; at: Date } | null> {
  await ensureSchema();

  const rader = await sql<{ kanaler: string[]; at: Date }[]>`
    select kanaler, at from paket_snapshot order by at desc limit 2
  `;
  if (rader.length < 2) return null;

  const [nu, forra] = rader;
  const nya = nu.kanaler.filter((k) => !forra.kanaler.includes(k));
  const borta = forra.kanaler.filter((k) => !nu.kanaler.includes(k));
  if (nya.length === 0 && borta.length === 0) return null;

  return { nya, borta, at: nu.at };
}
