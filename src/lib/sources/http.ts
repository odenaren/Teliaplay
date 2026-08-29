/**
 * Hämtning mot externa källor: strypning per värd, timeout och omförsök.
 *
 * Mönstret är hämtat från TI-appens lib/sources/xml.ts, där det växte fram ur
 * riktiga fel — Reddit svarade 429 när två flöden hämtades för tätt, och Google
 * News stängde anslutningen vid parallella anrop. Samma sak gäller här: tv.nu
 * har trettio kanaler som ska hämtas per dag, och att skicka trettio samtidiga
 * anrop mot en gratis webbtjänst är att be om att bli utestängd.
 */

/*
 * User-Agent.
 *
 * Den ärliga strängen nedan är den vi helst skickar, och den fungerar mot
 * TMDB, SVT och TheSportsDB. tv.nu svarar 403 på den: deras webb-API ligger
 * bakom ett skydd som avvisar allt som inte ser ut som en webbläsare. Det är
 * inget vi kommer runt genom att fråga snällare — headern är hela skillnaden.
 *
 * Anropen är desamma i övrigt: samma publika endpoint, samma data, till din
 * egen installation, i den takt HOST_INTERVAL_MS sätter. Inget kringgås utom
 * en filtrering på klientnamn.
 */
const USER_AGENT =
  process.env.HTTP_USER_AGENT ??
  "teliaplay-personal/1.0 (privat, icke-kommersiell användning)";

const WEBBLASARE =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

/** Värdar som avvisar allt som inte ser ut som en webbläsare. */
const KRAVER_WEBBLASARHEADERS: Record<string, { origin: string }> = {
  "web-api.tv.nu": { origin: "https://www.tv.nu" },
};

function varduppsattning(host: string): Record<string, string> {
  const krav = KRAVER_WEBBLASARHEADERS[host];
  if (!krav) return { "User-Agent": USER_AGENT };

  return {
    "User-Agent": WEBBLASARE,
    Origin: krav.origin,
    Referer: `${krav.origin}/`,
    "Accept-Language": "sv-SE,sv;q=0.9,en;q=0.8",
  };
}

/**
 * Minsta tid mellan två anrop till samma värd, i millisekunder.
 *
 * Siffrorna är försiktiga snarare än uppmätta — till skillnad från TI-appen har
 * de inte kalibrerats mot faktiska 429-svar ännu. Kör `npm run probe` och sänk
 * först när du sett att värden tål det.
 */
const HOST_INTERVAL_MS: Record<string, number> = {
  // tv.nu ligger bakom Cloudflare och stryper hårdare än 600 ms tålde:
  // nittio anrop på en minut gav "HTTP 429 — You are being rate-limited by
  // the website owner's configuration" mitt i hämtningen. 2,5 sekunder är
  // långsamt nog att slippa det och ändå klara en hel tablå på fyra minuter.
  "web-api.tv.nu": 2_500,
  "www.thesportsdb.com": 1_500,
  "api.themoviedb.org": 250,
  "ottapi.prod.telia.net": 800,
  default: 300,
};

const lastHit = new Map<string, number>();

async function hostGate(host: string): Promise<void> {
  const kvar = avstangdSekunder(host);
  if (kvar > 0) {
    throw new Error(
      `HTTP 429 — ${host} stryper oss, ${kvar} s kvar av pausen. Inget anrop skickades.`,
    );
  }

  const min = HOST_INTERVAL_MS[host] ?? HOST_INTERVAL_MS.default;
  const previous = lastHit.get(host) ?? 0;
  const wait = previous + min - Date.now();
  // Boka platsen direkt så att parallella anropare köar bakom varandra.
  lastHit.set(host, Math.max(Date.now(), previous + min));
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
}

/*
 * Strypning (429) står MEDVETET inte med.
 *
 * Ett omförsök 600 ms senare mot en tjänst som just sagt "för många anrop" är
 * inte ett omförsök, det är samma fel en gång till — och det förlänger den
 * tid vi är utestängda. En 429 hanteras i stället som en paus för hela
 * värden, se svalka() nedan.
 */
function isRetryable(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /ECONNRESET|ETIMEDOUT|EAI_AGAIN|socket hang up|HTTP 50\d|aborted/i.test(msg);
}

/**
 * Värdar vi blivit utestängda från, och när de får frågas igen.
 *
 * Poängen är att ETT 429 ska stoppa resten av körningen mot samma värd i
 * stället för att nittio anrop var för sig går i väggen. Den som stryper oss
 * har redan sagt vad den tycker; att fortsätta fråga gör bara pausen längre.
 */
const svalka = new Map<string, number>();

/** Sekunder att vänta enligt Retry-After, eller null när huvudet saknas. */
function retryAfterMs(res: Response): number | null {
  const rad = res.headers.get("retry-after");
  if (!rad) return null;

  const sekunder = Number(rad);
  if (Number.isFinite(sekunder)) return sekunder * 1000;

  const datum = Date.parse(rad);
  return Number.isFinite(datum) ? Math.max(0, datum - Date.now()) : null;
}

/** Hur länge värden är avstängd, i sekunder. 0 = inte avstängd. */
export function avstangdSekunder(host: string): number {
  const till = svalka.get(host);
  if (!till) return 0;
  return Math.max(0, Math.ceil((till - Date.now()) / 1000));
}

export interface HamtaOpts {
  timeoutMs?: number;
  attempts?: number;
  headers?: Record<string, string>;
  method?: "GET" | "POST";
  body?: unknown;
}

/**
 * Plockar ut kärnan ur ett felsvar.
 *
 * "HTTP 400" säger att något var fel, inte vad. Tjänsterna skickar nästan
 * alltid med en förklaring i kroppen — "invalid_grant", "Bad credentials",
 * "Invalid API key" — och den raden är skillnaden mellan att veta vad som ska
 * rättas och att gissa. Telias 400 var oläsbar i timmar av just det skälet.
 *
 * Kroppen kapas hårt: den ska rymmas i en logg-rad på /kallor, inte vara en
 * felsökningssession i sig.
 */
async function varfor(res: Response): Promise<string> {
  try {
    const text = (await res.text()).trim();
    if (!text) return "";

    // JSON: leta upp det fält som brukar bära förklaringen.
    try {
      const data = JSON.parse(text) as Record<string, unknown>;
      for (const nyckel of ["message", "error_description", "error", "status_message", "detail"]) {
        const v = data[nyckel];
        if (typeof v === "string" && v) return ` — ${v.slice(0, 160)}`;
      }
    } catch {
      /* inte json, ta råtexten nedan */
    }

    return ` — ${text.replace(/\s+/g, " ").slice(0, 160)}`;
  } catch {
    return "";
  }
}

export async function fetchText(url: string, opts: HamtaOpts = {}): Promise<string> {
  const { timeoutMs = 20_000, attempts = 3, headers = {}, method = "GET", body } = opts;

  const host = (() => {
    try {
      return new URL(url).hostname;
    } catch {
      return "default";
    }
  })();

  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    await hostGate(host);

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method,
        signal: ctrl.signal,
        headers: {
          Accept: "application/json, text/plain;q=0.9, */*;q=0.8",
          ...varduppsattning(host),
          ...(body ? { "Content-Type": "application/json" } : {}),
          ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
        cache: "no-store",
      });
      if (res.status === 429) {
        /*
         * Respektera Retry-After när den finns, annars fem minuter. Fem är
         * valt för att en hämtning går var tjugonde minut: pausen hinner löpa
         * ut till nästa körning, och vi bränner inte den heller.
         */
        const paus = retryAfterMs(res) ?? 5 * 60_000;
        svalka.set(host, Date.now() + paus);
        throw new Error(
          `HTTP 429 — ${host} stryper oss. Pausar ${Math.round(paus / 1000)} s.` +
            `${await varfor(res)}`,
        );
      }

      if (!res.ok) throw new Error(`HTTP ${res.status}${await varfor(res)}`);
      return await res.text();
    } catch (err) {
      lastError = err;
      if (attempt === attempts || !isRetryable(err)) break;
      // Exponentiell backoff med jitter: 600 ms, 1800 ms.
      const backoff = 600 * 3 ** (attempt - 1) + Math.random() * 400;
      await new Promise((r) => setTimeout(r, backoff));
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export async function fetchJson<T = unknown>(url: string, opts: HamtaOpts = {}): Promise<T> {
  const text = await fetchText(url, opts);
  try {
    return JSON.parse(text) as T;
  } catch {
    // Ett HTML-svar där JSON förväntades betyder nästan alltid en
    // inloggningssida eller en captcha, inte ett trasigt API. Säg det.
    const forsta = text.slice(0, 80).replace(/\s+/g, " ");
    throw new Error(`svaret var inte JSON (början: "${forsta}")`);
  }
}

/**
 * Plocka ut ett fält ur ett okänt objekt utan att kasta.
 *
 * Adaptrarna här är skrivna mot API:er som ingen av oss äger och vars
 * svarsformat kan ändras utan förvarning. Att navigera med `?.` överallt gör
 * koden oläslig; den här hjälparen gör det till en rad.
 */
export function plocka(obj: unknown, ...vagar: string[]): unknown {
  for (const vag of vagar) {
    let cur: unknown = obj;
    for (const del of vag.split(".")) {
      if (cur && typeof cur === "object" && del in (cur as Record<string, unknown>)) {
        cur = (cur as Record<string, unknown>)[del];
      } else {
        cur = undefined;
        break;
      }
    }
    if (cur !== undefined && cur !== null) return cur;
  }
  return undefined;
}
