/**
 * Inbyggd schemaläggare. Startar med servern, vilket gör att vi klarar oss med
 * EN Railway-tjänst i stället för en separat cron-tjänst.
 *
 * Två takter, av olika skäl:
 *
 *   Tablån var 20:e minut. Den ändras sällan men den ändras — sport drar över
 *   tiden och skjuter kvällen framåt, och en tablå som visar gårdagens tider
 *   under en förlängning är precis när man tittar på den.
 *
 *   Katalogen en gång per dygn. JustWatch, som TMDB:s tillgänglighetsdata
 *   kommer från, gör EN export per dygn. Att hämta oftare ger inte färskare
 *   data, bara last på någon annans gratis-API.
 *
 * Sätt INGEST_SCHEDULER=off för att stänga av helt.
 */

const MINUTE = 60_000;

function tablaIntervallMs(): number {
  const override = Number(process.env.INGEST_INTERVAL_MINUTES);
  if (Number.isFinite(override) && override >= 5) return override * MINUTE;
  return 20 * MINUTE;
}

/**
 * Är det dags för dygnets fulla hämtning?
 *
 * 05:00 svensk tid: JustWatchs export har hunnit igenom TMDB under natten, och
 * ingen sitter och väntar på svar från appen då.
 */
function dagsForFull(senaste: number | null): boolean {
  if (senaste === null) return true;
  const timmarSedan = (Date.now() - senaste) / 3600_000;
  if (timmarSedan < 20) return false;

  const timme = Number(
    new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Europe/Stockholm",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(new Date()),
  );
  return timme >= 5 || timmarSedan > 30;
}

async function start() {
  if (process.env.INGEST_SCHEDULER === "off") return;
  // I dev startar servern om vid varje filändring — vi vill inte hämta då.
  if (process.env.NODE_ENV !== "production") return;

  const { hamtaAllt } = await import("./ingest");

  let running = false;
  let senasteFulla: number | null = null;

  const run = async (anledning: string) => {
    if (running) return;
    running = true;
    try {
      const full = dagsForFull(senasteFulla);
      const { steg, ms } = await hamtaAllt(full ? "full" : "snabb");
      if (full) senasteFulla = Date.now();

      const fel = steg.filter((s) => s.status === "fel");
      console.log(
        `[hämtning:${anledning}] ${steg.length - fel.length}/${steg.length} ok, ${ms} ms` +
          (full ? " (full)" : ""),
      );
      for (const f of fel) console.warn(`[hämtning] ${f.kalla}: ${f.meddelande}`);
    } catch (err) {
      console.error("[hämtning] misslyckades:", err);
    } finally {
      running = false;
    }
  };

  // Vänta en stund efter start så att deployen hinner bli frisk först.
  setTimeout(() => void run("start"), 30_000);

  const tick = () => {
    void run("schema");
    setTimeout(tick, tablaIntervallMs());
  };
  setTimeout(tick, tablaIntervallMs());

  console.log(`[hämtning] schemaläggare igång, intervall ${tablaIntervallMs() / MINUTE} min`);
}

// Modulen importeras bara från instrumentation.ts när vi kör i node-runtime.
void start();

export {};
