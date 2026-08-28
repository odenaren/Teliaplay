#!/usr/bin/env node
/**
 * Labbet: hela appen, körd på riktigt, med provdata — och skärmbilder ut.
 *
 * Varför det finns: källorna (tv.nu, TMDB, SVT, TheSportsDB) går inte att nå
 * från utvecklingsmiljön, och en databas fanns inte heller. Följden var att
 * gränssnittet skrevs blint och skickades otestat. Det här är motmedlet.
 *
 *   npm run lab            bygger, startar, tar skärmbilder till lab-bilder/
 *   npm run lab -- --hall  samma, men servern står kvar så man kan klicka själv
 *
 * Databasen är PGlite: riktig Postgres kompilerad till wasm, som talar samma
 * nätverksprotokoll. Appen märker ingen skillnad — den ansluter över TCP med
 * postgres.js precis som mot Neon. Inget mockas, inget hoppas över.
 *
 * Bilderna: affischadresserna i provdatan pekar på riktiga värdar som inte går
 * att nå. Playwright svarar i deras ställe med en genererad ruta i rätt
 * proportion. Det gör att en trasig bildlänk syns som trasig, i stället för att
 * drunkna i att allt är trasigt.
 */

import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { spawn } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";
import * as fix from "./lab/fixtures.mjs";

const PORT_DB = 55432;
/*
 * Labbets egen VAULT_KEY. Den är hårdkodad med flit: den krypterar bara
 * provdata som lever i minnet i tre minuter, och att slumpa den skulle göra
 * att sådden inte kan skrivas av samma nyckel som servern läser med.
 * Använd den ALDRIG i drift — den står i git.
 */
const LAB_VAULT_KEY = "bGFiYmV0cy1ueWNrZWwtYWxkcmlnLWktZHJpZnQtMDA=";
const PORT_APP = 3999;
const UT = path.join(process.cwd(), "lab-bilder");

const hall = process.argv.includes("--hall");
/*
 * Kör utan VAULT_KEY.
 *
 * Halva valvets beteende ligger i vad som händer när nyckeln SAKNAS, och det
 * läget är det man faktiskt möter första gången man öppnar sidan. Ett labb som
 * bara kan visa det färdiga tillståndet missar just den skärm användaren
 * fastnar på.
 */
const utanValvnyckel = process.argv.includes("--utan-valvnyckel");
const bara = process.argv.find((a) => a.startsWith("--sida="))?.split("=")[1];

/** Sidorna labbet går igenom. Namnet blir filnamnet. */
const SIDOR = [
  ["start", "/"],
  ["bladdra", "/bladdra"],
  ["bladdra-genre", "/bladdra?genre=drama"],
  ["sport", "/sport"],
  ["tabla", "/tabla"],
  ["sok", "/sok?q=so"],
  ["ingar", "/ingar"],
  ["valv", "/valv"],
  ["kallor", "/kallor"],
  ["installningar", "/installningar"],
];

const städa = [];
async function stäng() {
  for (const f of städa.reverse()) {
    try {
      await f();
    } catch {
      /* stängning får inte dölja det riktiga felet */
    }
  }
}

async function main() {
  console.log("→ startar Postgres (pglite) på", PORT_DB);
  const db = await PGlite.create();
  const dbServer = new PGLiteSocketServer({ db, port: PORT_DB, host: "127.0.0.1" });
  await dbServer.start();
  // pglite kan kasta under nedstängning (den städar en transaktion som inte
  // finns). Bilderna är redan skrivna då, så felet är brus — men ett brus som
  // ger körningen exitkod 1 och ser ut som ett misslyckande.
  städa.push(
    async () => {
      try {
        await dbServer.stop();
      } catch {
        /* nedstängning får inte dölja resultatet */
      }
    },
    async () => {
      try {
        await db.close();
      } catch {
        /* samma sak */
      }
    },
  );

  const url = `postgresql://lab:lab@127.0.0.1:${PORT_DB}/postgres`;
  process.env.DATABASE_URL = url;
  if (!utanValvnyckel) process.env.VAULT_KEY = LAB_VAULT_KEY;

  console.log("→ skapar schemat med appens egen ensureSchema()");
  const { ensureSchema, sql: appSql } = await import("@/lib/db");
  await ensureSchema();
  // Samma skäl som nedan: appmodulens pool får inte ligga kvar och hålla
  // PGlites enda plats när servern ska ansluta.
  await appSql.end({ timeout: 5 });

  console.log("→ fyller på provdata");
  const sql = postgres(url, { ssl: false, prepare: false, max: 1 });
  städa.push(() => sql.end({ timeout: 5 }));
  await seed(sql);

  /*
   * Släpp anslutningen INNAN servern startar.
   *
   * PGlites socketserver betjänar en klient i taget. Ligger såddens anslutning
   * kvar får appen aldrig komma fram — den står och väntar på en plats som
   * aldrig blir ledig, och det syns som sidor som laddar i evighet eller
   * svarar 500. Ett låsningsfel som ser ut som ett applikationsfel, vilket är
   * den dyraste sorten att felsöka.
   */
  await sql.end({ timeout: 5 });

  console.log("→ bygger appen");
  await kör("npx", ["next", "build"], { DATABASE_URL: url, VAULT_KEY: LAB_VAULT_KEY });

  await frigörPort(PORT_APP);

  console.log("→ startar servern på", PORT_APP);
  const server = spawn("npx", ["next", "start", "-p", String(PORT_APP)], {
    env: {
      ...process.env,
      DATABASE_URL: url,
      INGEST_SCHEDULER: "off",
      PORT: String(PORT_APP),
      // PGlites socketserver betjänar EN anslutning i taget. Appens pool tar
      // annars atta, och de sju som koar syns som en sida som aldrig laddar
      // klart. Mot en riktig Postgres galler inte det har.
      DB_POOL_MAX: "1",
      VAULT_KEY: utanValvnyckel ? "" : LAB_VAULT_KEY,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  städa.push(() => void server.kill("SIGTERM"));
  // Servern får skriva rakt in i en buffert. Ett 500 ska kunna visas som den
  // stacktrace det är, inte som en tyst skärmbild av en felruta.
  const serverlogg = [];
  for (const ström of [server.stdout, server.stderr]) {
    ström.on("data", (b) => {
      const rad = String(b).trimEnd();
      if (rad) serverlogg.push(rad);
    });
  }
  globalThis.__labLogg = serverlogg;

  // En server som dör vid start (upptagen port, kraschad import) ska säga det
  // med en gång. Utan det här står labbet och pollar en adress som aldrig
  // kommer att svara, och rapporterar till slut "servern svarade aldrig" — sant,
  // men inte vad man behöver veta.
  let serverdöd = null;
  server.on("exit", (kod, signal) => {
    if (kod !== 0 && kod !== null) serverdöd = `servern avslutades med kod ${kod}`;
    else if (signal && signal !== "SIGTERM") serverdöd = `servern dödades av ${signal}`;
  });
  const levande = () => serverdöd;
  await vänta(`http://127.0.0.1:${PORT_APP}/kallor`, levande);

  await skärmbilder();

  if (hall) {
    console.log(`\n  Servern står kvar på http://127.0.0.1:${PORT_APP} — ctrl+c avslutar.`);
    await new Promise(() => {});
  }
}

/* ------------------------------------------------------------------ seed */

async function seed(sql) {
  // Appens egen normalisering, inte en kopia av den. Labbet satte förut
  // nycklarna med toLowerCase(), och "frölunda" matchade då aldrig appens
  // "frolunda" — vilket såg ut som att matchningen var trasig när det var
  // provdatan som var det.
  const { lagNyckel, titelNyckel } = await import("@/lib/match");

  for (const [id, namn, ingar, kalla] of fix.TJANSTER) {
    await sql`insert into tjanst (id, namn, ingar, kalla, verifierad_at)
              values (${id}, ${namn}, ${ingar}, ${kalla}, now())
              on conflict (id) do update set ingar = excluded.ingar`;
  }
  for (const [id, tjanst, namn, sport, sort] of fix.KANALER) {
    await sql`insert into kanal (id, tjanst_id, namn, tvnu_id, sport, ingar, kalla, sort)
              values (${id}, ${tjanst}, ${namn}, ${id}, ${sport}, true, 'manuell', ${sort})
              on conflict (id) do nothing`;
  }

  await sql`insert into profil (id, namn, farg) values ('lab', 'Labbet', '#a06bff')
            on conflict (id) do nothing`;

  let i = 0;
  for (const [namn, typ, ar, betyg, genrer, tjanster, nyhet, sista] of fix.TITLAR) {
    const id = `lab-t${i}`;
    const ärSvt = tjanster.includes("svtplay");
    await sql`
      insert into titel (id, typ, namn, ar, poster, synopsis, betyg, genre, extern_url)
      values (${id}, ${typ}, ${namn}, ${ar},
              ${ärSvt ? fix.svtbild(`900${i}/1`) : fix.poster(i)},
              ${`Provtext för ${namn}. Finns bara i labbet.`},
              ${betyg}, ${genrer}, null)
      on conflict (id) do nothing`;

    for (const tj of tjanster) {
      await sql`
        insert into tillganglig (titel_id, tjanst_id, sista_chansen, nyhet_at, nyhet_rank, sedd_sist)
        values (${id}, ${tj}, ${Boolean(sista)},
                ${nyhet ? new Date(Date.now() - nyhet * 3600_000) : null},
                ${nyhet ?? null},
                ${sista ? fix.d(-6) : new Date()})
        on conflict (titel_id, tjanst_id) do nothing`;
    }
    i++;
  }

  // En titel helt utan affisch: gränssnittet ska klara det utan hål i raden.
  await sql`insert into titel (id, typ, namn, ar, poster, genre)
            values ('lab-utan-bild', 'serie', 'Program utan affisch', 2020, null, ${["drama"]})
            on conflict (id) do nothing`;
  await sql`insert into tillganglig (titel_id, tjanst_id) values ('lab-utan-bild', 'svtplay')
            on conflict do nothing`;

  for (const p of fix.program()) {
    await sql`insert into program (id, kanal_id, start, slut, titel, titel_key, genre)
              values (${p.id}, ${p.kanal_id}, ${p.start}, ${p.slut}, ${p.titel},
                      ${titelNyckel(p.titel)}, ${p.genre})
              on conflict (id) do nothing`;
  }

  for (const [id, sportsdbId, namn, ligaId] of fix.LAG) {
    await sql`insert into lag (id, sportsdb_id, namn, namn_key, liga_id)
              values (${id}, ${sportsdbId}, ${namn}, ${lagNyckel(namn)}, ${ligaId})
              on conflict (id) do nothing`;
    await sql`insert into favorit (profil_id, sort, ref_id) values ('lab', 'lag', ${id})
              on conflict do nothing`;
  }
  for (const m of fix.matcher()) {
    await sql`insert into sportmatch (id, liga_id, hemma, borta, start, program_id, matchad_at)
              values (${m.id}, ${m.liga_id}, ${m.hemma}, ${m.borta}, ${m.start}, ${m.program_id},
                      ${m.program_id ? new Date() : null})
              on conflict (id) do nothing`;
  }

  /*
   * Valvet: ett komplett konto, ett utan lösenord och ett som inte finns alls.
   * De tre raderna är hela poängen — sidan ska se lika färdig ut för tjänsten
   * man inte fyllt i som för den man fyllt i.
   */
  const { kryptera } = await import("@/lib/vault");
  const hemlig = (v) => (utanValvnyckel ? null : kryptera(v));
  await sql`
    insert into konto (id, tjanst_id, agare, epost, losen_krypt, totp_krypt, notering)
    values
      ('konto:viaplay', 'viaplay', 'Jag', 'jag@example.com',
       ${hemlig("hemligt-losenord-123")},
       ${hemlig("otpauth://totp/Viaplay:jag@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Viaplay")},
       'Betalas av mig, delas med Kalle'),
      ('konto:max', 'max', 'Kalle', 'kalle@example.com', null, null,
       'Kalles konto — fråga honom om lösenordet')
    on conflict (id) do nothing`;

  await sql`insert into favorit (profil_id, sort, ref_id) values ('lab', 'kanal', 'svt1')
            on conflict do nothing`;
  await sql`insert into ingest_logg (kalla, status, antal, meddelande)
            values ('tv.nu', 'ok', 412, null), ('svt play', 'ok', 96, null),
                   ('tmdb', 'fel', 0, 'TMDB_API_KEY saknas — ingen katalog hämtad')`;

  const [{ antal }] = await sql`select count(*)::int as antal from titel`;
  console.log(`   ${antal} titlar, ${fix.program().length} program, ${fix.LAG.length} lag`);
}

/* ---------------------------------------------------------- skärmbilder */

async function skärmbilder() {
  const { chromium, devices } = await import("playwright");
  rmSync(UT, { recursive: true, force: true });
  mkdirSync(UT, { recursive: true });

  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  städa.push(() => browser.close());

  const ctx = await browser.newContext({
    ...devices["iPhone 13"],
    locale: "sv-SE",
    timezoneId: "Europe/Stockholm",
  });
  // Profilkakan, så att labbet slipper klicka sig förbi uppstartsguiden.
  await ctx.addCookies([
    { name: "tp_profil", value: "lab", domain: "127.0.0.1", path: "/" },
  ]);

  // Bildvärdarna går inte att nå härifrån. Svara i deras ställe.
  await ctx.route("**/*", async (route) => {
    const req = route.request();
    if (req.resourceType() !== "image") return route.continue();
    const u = req.url();
    if (u.startsWith(`http://127.0.0.1:${PORT_APP}`)) return route.continue();
    return route.fulfill({ contentType: "image/svg+xml", body: platshallare(u) });
  });

  // Allt annat utanför appen går ändå inte att nå härifrån. Bryt direkt i
  // stället för att låta varje sida vänta ut en timeout per blockerad adress.
  await ctx.route("**/*", (route) =>
    route.request().url().startsWith(`http://127.0.0.1:${PORT_APP}`)
      ? route.continue()
      : route.abort(),
  );

  const sidor = bara ? SIDOR.filter(([namn]) => namn === bara) : SIDOR;

  for (const [namn, väg] of sidor) {
    const sida = await ctx.newPage();
    /*
     * Bara fel som betyder något.
     *
     * Labbet bryter varje anrop utanför appen med flit, och webbläsaren
     * loggar då ett ERR_FAILED per blockerad adress. Räknas de som fel blir
     * varje sida röd och rödmarkeringen slutar betyda något — vilket är
     * exakt så man missar det riktiga felet när det väl kommer.
     */
    const konsolfel = [];
    const struntfel = /ERR_FAILED|ERR_BLOCKED|net::ERR_ABORTED|Failed to load resource/i;
    sida.on(
      "console",
      (m) => m.type() === "error" && !struntfel.test(m.text()) && konsolfel.push(m.text()),
    );
    sida.on("pageerror", (e) => konsolfel.push(String(e)));

    const svar = await sida.goto(`http://127.0.0.1:${PORT_APP}${väg}`, {
      waitUntil: "domcontentloaded",
      timeout: 20_000,
    });

    /*
     * Fäll ut allt hopfällt.
     *
     * Formulär ligger bakom <details> och är därför osynliga för labbet i
     * normalläge — och det är just inuti dem felen sitter, eftersom ingen
     * tittar där. En skärmbild av en hopfälld sida bevisar bara att pilen
     * ritas.
     */
    await sida.evaluate(() => {
      for (const d of document.querySelectorAll("details")) d.open = true;
    });

    const fil = path.join(UT, `${namn}${utanValvnyckel ? "-utan-nyckel" : ""}.png`);
    await sida.screenshot({ path: fil, fullPage: true });

    const status = svar?.status() ?? 0;
    const flagga = status === 200 && konsolfel.length === 0 ? "✓" : "✗";
    console.log(`  ${flagga} ${namn.padEnd(16)} ${status}  ${väg}`);
    for (const f of konsolfel.slice(0, 3)) console.log(`      ! ${f.slice(0, 200)}`);

    if (status >= 500) {
      const logg = globalThis.__labLogg ?? [];
      for (const rad of logg.slice(-16)) console.log(`      | ${rad.slice(0, 200)}`);
      logg.length = 0;
    }

    await sida.close();
  }

  console.log(`\n  Bilderna ligger i ${path.relative(process.cwd(), UT)}/`);
}

/** Genererad affisch, med adressen inskriven så att fel bild syns som fel bild. */
function platshallare(url) {
  const namn = decodeURIComponent(url.split("/").pop() ?? "bild").slice(0, 22);
  const ton = [...namn].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="342" height="513">
    <rect width="342" height="513" fill="hsl(${ton} 30% 28%)"/>
    <text x="171" y="250" fill="hsl(${ton} 25% 78%)" font-family="sans-serif"
          font-size="16" text-anchor="middle">affisch</text>
    <text x="171" y="272" fill="hsl(${ton} 20% 62%)" font-family="monospace"
          font-size="11" text-anchor="middle">${namn}</text>
  </svg>`;
}

/* ------------------------------------------------------------- verktyg */

function kör(cmd, args, env = {}) {
  return new Promise((ok, nej) => {
    const p = spawn(cmd, args, { env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"] });
    let ut = "";
    p.stdout.on("data", (b) => (ut += b));
    p.stderr.on("data", (b) => (ut += b));
    p.on("close", (kod) =>
      kod === 0 ? ok(ut) : nej(new Error(`${cmd} ${args.join(" ")} gav ${kod}\n${ut.slice(-3000)}`)),
    );
  });
}

async function vänta(url, levande = () => null, försök = 80) {
  for (let i = 0; i < försök; i++) {
    const död = levande();
    if (död) {
      const logg = (globalThis.__labLogg ?? []).slice(-20).join("\n");
      throw new Error(`${död}\n${logg}`);
    }

    try {
      // Vilket svar som helst duger som livstecken. Ett 500 är ett resultat att
      // rapportera, inte ett skäl att stå kvar och hoppas på ett bättre.
      return (await fetch(url)).status;
    } catch {
      /* servern är inte uppe än */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`servern svarade aldrig på ${url}`);
}

/**
 * Dödar det som redan lyssnar på porten.
 *
 * En kvarglömd server från en tidigare körning är värre än ett upptaget portfel:
 * den SVARAR, med en gammal version av appen, och labbet fotograferar den utan
 * att märka något. Skärmbilderna ser rimliga ut och visar fel kod.
 */
async function frigörPort(port) {
  try {
    await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(2000) });
  } catch {
    return; // ingen lyssnar, vilket är det normala
  }

  console.log(`   porten ${port} var upptagen — stänger den som låg kvar`);
  const { execSync } = await import("node:child_process");
  try {
    execSync(
      `ps -eo pid,args | grep -E "next-server|next start -p ${port}" | grep -v grep | awk '{print $1}' | xargs -r kill -9`,
      { stdio: "ignore" },
    );
  } catch {
    /* fanns inget att döda */
  }
  await new Promise((r) => setTimeout(r, 1500));
}

/*
 * Nedstängningen får inte avgöra utfallet.
 *
 * pglite kastar ibland när den stängs — den städar en transaktion som inte
 * finns kvar — och det sker EFTER att bilderna är skrivna. Utan den här
 * vakten slutar en lyckad körning med en stacktrace och exitkod 1, vilket är
 * det enda felmeddelande som är värre än inget: ett som säger att något gick
 * sönder när det inte gjorde det.
 */
let lyckades = false;

process.on("uncaughtException", (err) => {
  if (lyckades) process.exit(0);
  console.error("\n✗ labbet stannade:", err.message);
  process.exit(1);
});

main()
  .then(async () => {
    lyckades = true;
    if (!hall) await stäng();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error("\n✗ labbet stannade:", err.message);
    await stäng();
    process.exit(1);
  });
