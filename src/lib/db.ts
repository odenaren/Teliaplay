import postgres from "postgres";

declare global {
  // eslint-disable-next-line no-var
  var __tpSql: ReturnType<typeof postgres> | undefined;
}

/**
 * Avgör om anslutningen ska använda TLS.
 *
 * Appen är inte bunden till någon leverantör — vilken Postgres som helst
 * fungerar — men de har olika krav. Molntjänster (Neon, Supabase, Render)
 * kräver TLS. Railways interna nätverk kör utan, och en lokal testdatabas har
 * det sällan påslaget. Att hårdkoda "require" gör att appen tyst vägrar
 * ansluta på hälften av alternativen.
 */
export function sslModeFor(url: string): "require" | false {
  const explicit = url.match(/[?&]sslmode=(\w+)/)?.[1];
  if (explicit === "disable") return false;
  if (explicit) return "require";

  const host = url.match(/@([^:/?#]+)/)?.[1] ?? "";

  if (/^(localhost|127\.0\.0\.1|\[::1\]|::1)$/.test(host)) return false;
  if (host.endsWith(".railway.internal")) return false;

  return "require";
}

function create() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL saknas. Kopiera .env.example till .env och klistra in " +
        "anslutningssträngen från din Postgres-leverantör.",
    );
  }

  return postgres(url, {
    ssl: sslModeFor(url),
    max: Number(process.env.DB_POOL_MAX ?? 8),
    idle_timeout: 20,
    connect_timeout: 15,
    // Prepared statements överlever inte en transaction pooler (Supabase 6543,
    // Neons -pooler-värd). Avstängt överallt — skillnaden är försumbar för våra
    // frågevolymer, och alternativet är en svårfelsökt krasch om man byter
    // anslutningssträng.
    prepare: false,
    onnotice(notice) {
      // Schemat är byggt på "if not exists". Varje sådan sats som inte behöver
      // göra något skickar en notis vid varje processtart, och de betyder att
      // allt är som det ska.
      const expected = ["42P07", "42P06", "42710", "42701"];
      const routine =
        expected.includes(String(notice.code)) || /, skipping$/.test(notice.message ?? "");

      if (!routine) console.warn("[db]", notice.message);
    },
  });
}

function getSql(): ReturnType<typeof postgres> {
  if (!globalThis.__tpSql) globalThis.__tpSql = create();
  return globalThis.__tpSql;
}

/**
 * Anslutningen skapas först när någon faktiskt frågar databasen — inte vid
 * import. Annars kraschar `next build` på maskiner utan DATABASE_URL, eftersom
 * bygget importerar varje route för att läsa dess konfiguration.
 */
export const sql = new Proxy((() => {}) as unknown as ReturnType<typeof postgres>, {
  apply(_target, _thisArg, args: unknown[]) {
    return (getSql() as unknown as (...a: unknown[]) => unknown)(...args);
  },
  get(_target, prop: string | symbol) {
    const instance = getSql() as unknown as Record<string | symbol, unknown>;
    const value = instance[prop];
    return typeof value === "function" ? value.bind(instance) : value;
  },
});

/**
 * OBS om ordningen i den här filen.
 *
 * Alla `alter table ... add column` MÅSTE ligga före alla `create index`.
 * "create table if not exists" rör inte en tabell som redan finns, så en
 * databas skapad av en äldre version saknar kolumner som tillkommit sedan
 * dess. Ligger ett index på en sådan kolumn tidigare i filen kraschar det med
 * "column ... does not exist" — och eftersom satserna körs i ordning nås
 * aldrig ALTER-satsen som skulle ha löst det.
 */
export const SCHEMA = /* sql */ `
-- ---------------------------------------------------------------- profiler
-- Två personer, ingen inloggning. Se lib/profil.ts för resonemanget.
create table if not exists profil (
  id        text primary key,
  namn      text not null,
  farg      text not null default '#a06bff',
  -- Bcrypt-liknande hash av PIN-koden. Endast valvet (/valv) kräver den;
  -- resten av appen är öppen. null = inget valv för den här profilen.
  pin_hash  text,
  skapad    timestamptz not null default now()
);

-- --------------------------------------------------------------- tjänster
-- Facit för vad som ingår. Allt i appen hänger på den här tabellen.
create table if not exists tjanst (
  id            text primary key,
  namn          text not null,
  -- true = ingår i paketet. Default false: appen visar aldrig något den inte
  -- fått veta att du har.
  ingar         boolean not null default false,
  -- 'telia' = hämtat från Telias engagementinfo. 'manuell' = ikryssat av dig.
  -- 'auto' = alltid gratis (SVT). Visas på /ingar så att du ser när
  -- automatiken tystnat och siffran börjat bli gammal.
  kalla         text not null default 'manuell',
  verifierad_at timestamptz,
  -- Fritext från dig: "kompisens konto", "bara sport, inte film".
  notering      text
);

create table if not exists kanal (
  id        text primary key,
  tjanst_id text not null,
  namn      text not null,
  -- tv.nu:s eget id, satt av namnmatchningen vid hämtning. null = omatchad,
  -- syns på /ingar med en väljare.
  tvnu_id   text,
  -- Telias channel-id (cid), från contentsourcegateway. Används för djuplänk
  -- in i Telia Play och för att matcha mot engagementinfo.
  telia_cid text,
  logo      text,
  sport     boolean not null default false,
  ingar     boolean not null default false,
  kalla     text not null default 'manuell',
  sort      integer not null default 100
);

-- ------------------------------------------------------------------ tablå
create table if not exists program (
  id          text primary key,
  kanal_id    text not null,
  start       timestamptz not null,
  slut        timestamptz,
  titel       text not null,
  -- Normaliserad titel. Nyckel när en sportmatch ska paras ihop med sin
  -- sändning, se lib/match.ts.
  titel_key   text not null default '',
  beskrivning text,
  genre       text,
  sasong      integer,
  avsnitt     integer,
  bild        text,
  hamtad_at   timestamptz not null default now()
);

-- --------------------------------------------------------- film och serier
create table if not exists titel (
  id        text primary key,
  tmdb_id   integer,
  typ       text not null,           -- 'film' | 'serie'
  namn      text not null,
  ar        integer,
  poster    text,
  synopsis  text,
  betyg     numeric(3,1),
  uppdaterad_at timestamptz not null default now()
);

-- En rad per titel och tjänst. sedd_sist är hjärtat i "Sista chansen":
-- slutar en titel dyka upp i katalogen är den på väg bort.
create table if not exists tillganglig (
  titel_id   text not null,
  tjanst_id  text not null,
  sedd_forst timestamptz not null default now(),
  sedd_sist  timestamptz not null default now(),
  primary key (titel_id, tjanst_id)
);

-- ------------------------------------------------------------------ sport
create table if not exists lag (
  id          text primary key,
  sportsdb_id text,
  namn        text not null,
  namn_key    text not null default '',
  liga_id     text,
  logo        text
);

create table if not exists sportmatch (
  id          text primary key,
  sportsdb_id text,
  liga_id     text,
  hemma       text not null,
  borta       text not null,
  start       timestamptz not null,
  -- Programmet i tablån som visar matchen, satt av lib/match.ts. null = ingen
  -- träff ännu, vilket antingen betyder att tablån inte sträcker sig så långt
  -- eller att matchen inte sänds på något du har.
  program_id  text,
  -- Tjänsten som visar matchen när den INTE har någon linjär kanal
  -- (strömmande sport). Satt för hand eller från Telias content-API.
  tjanst_id   text,
  matchad_at  timestamptz,
  hamtad_at   timestamptz not null default now()
);

-- ------------------------------------------------------- per profil-data
create table if not exists favorit (
  profil_id text not null,
  sort      text not null,          -- 'kanal' | 'titel' | 'lag' | 'program' | 'liga'
  ref_id    text not null,
  skapad    timestamptz not null default now(),
  primary key (profil_id, sort, ref_id)
);

create table if not exists sett (
  profil_id text not null,
  sort      text not null,
  ref_id    text not null,
  -- 'startad' när appen skickat den till tv:n, 'sedd' när du markerat klart.
  status    text not null default 'startad',
  at        timestamptz not null default now(),
  primary key (profil_id, sort, ref_id)
);

create table if not exists block (
  profil_id     text not null,
  sort          text not null,
  ordning       integer not null default 100,
  aktiv         boolean not null default true,
  installningar jsonb not null default '{}'::jsonb,
  primary key (profil_id, sort)
);

-- ------------------------------------------------------------------ valvet
-- Lösenord och TOTP-nycklar ligger krypterade (AES-256-GCM, se lib/vault.ts).
-- Nyckeln finns bara i VAULT_KEY, aldrig i databasen — en läckt dump utan
-- nyckeln är obrukbar.
create table if not exists konto (
  id              text primary key,
  tjanst_id       text not null,
  agare           text,
  epost           text,
  losen_krypt     text,
  totp_krypt      text,
  notering        text,
  uppdaterad_at   timestamptz not null default now()
);

-- ----------------------------------------------------------- driftsupport
-- En rad per källa och hämtning. Grunden för /kallor och för paketvakten.
create table if not exists ingest_logg (
  id        bigserial primary key,
  kalla     text not null,
  status    text not null,          -- 'ok' | 'fel'
  antal     integer not null default 0,
  meddelande text,
  ms        integer,
  at        timestamptz not null default now()
);

-- Telias tokens. Kortlivade, förnyas av lib/sources/telia.ts.
create table if not exists telia_session (
  id            text primary key default 'default',
  access_token  text,
  refresh_token text,
  subscriber_token text,
  device_id     text,
  giltig_till   timestamptz,
  uppdaterad_at timestamptz not null default now()
);

-- Paketvaktens historik: vad engagementinfo svarade förra gången.
create table if not exists paket_snapshot (
  id      bigserial primary key,
  kanaler jsonb not null,
  at      timestamptz not null default now()
);

-- --------------------------------------------------------------- kolumner
-- Nya kolumner läggs till här, ALLTID före indexen längre ned.
alter table tjanst add column if not exists notering text;
alter table kanal  add column if not exists kalla text not null default 'manuell';
alter table program add column if not exists bild text;
alter table titel add column if not exists betyg numeric(3,1);
alter table sportmatch add column if not exists tjanst_id text;

-- ----------------------------------------------------------------- index
create index if not exists program_start_idx on program (start);
create index if not exists program_kanal_start_idx on program (kanal_id, start);
create index if not exists program_titel_key_idx on program (titel_key);
create index if not exists tillganglig_tjanst_idx on tillganglig (tjanst_id);
create index if not exists tillganglig_sedd_sist_idx on tillganglig (sedd_sist);
create index if not exists sportmatch_start_idx on sportmatch (start);
create index if not exists favorit_profil_idx on favorit (profil_id, sort);
create index if not exists sett_profil_idx on sett (profil_id, at desc);
create index if not exists lag_namn_key_idx on lag (namn_key);
create index if not exists ingest_logg_at_idx on ingest_logg (at desc);
`;

let schemaApplied: Promise<void> | undefined;

export function ensureSchema(): Promise<void> {
  schemaApplied ??= applySchema().catch((err: unknown) => {
    // Låt nästa anrop försöka igen i stället för att cacha misslyckandet.
    schemaApplied = undefined;
    throw err;
  });
  return schemaApplied;
}

/**
 * Kör schemat sats för sats i stället för som ett enda block.
 *
 * Skickas allt på en gång avbryts resten så fort en sats fallerar, och det gör
 * att en trasig indexrad kan hindra kolumnpåfyllnaden längre ned från att
 * någonsin köras. Med en sats i taget är felen isolerade.
 *
 * Alla satser är idempotenta ("if not exists"), så att köra dem vid varje
 * processtart är gratis.
 */
async function applySchema(): Promise<void> {
  /*
   * Kommentarerna stryks FÖRE uppdelningen på semikolon, inte efter.
   *
   * Ordningen är inte en smaksak. En kommentar som innehåller ett semikolon —
   * och svensk prosa gör det förr eller senare — delar annars satsen mitt itu,
   * och båda halvorna fallerar med "syntax error". Felet ser ut som ett
   * trasigt schema men är ett trasigt skiljetecken, och tabellen som inte
   * skapades märks först när en fråga mot den kastar.
   */
  const statements = SCHEMA.replace(/^\s*--.*$/gm, "")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);

  const failures: { statement: string; message: string }[] = [];

  for (const statement of statements) {
    try {
      await sql.unsafe(statement);
    } catch (err) {
      failures.push({
        statement: statement.replace(/\s+/g, " ").slice(0, 70),
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (failures.length === 0) return;

  // Går databasen inte att nå alls fallerar varje sats med samma meddelande.
  // Att skriva ut alla begraver den enda rad som betyder något.
  const distinct = new Set(failures.map((f) => f.message));

  if (distinct.size === 1) {
    console.warn(
      `[db] hela schemat gick inte igenom (${failures.length} satser), samma orsak för alla:\n` +
        `  ${failures[0].message}`,
    );
    return;
  }

  console.warn(
    `[db] ${failures.length} schemasatser gick inte igenom:\n  ` +
      failures.map((f) => `${f.statement}… → ${f.message}`).join("\n  "),
  );
}

/**
 * Är databasen konfigurerad över huvud taget?
 *
 * Sidorna använder den här för att visa uppstartsguiden i stället för ett
 * stackspår när DATABASE_URL saknas.
 */
export function hasDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL);
}
