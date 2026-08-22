/**
 * Hämtning mot externa källor: strypning per värd, timeout och omförsök.
 *
 * Mönstret är hämtat från TI-appens lib/sources/xml.ts, där det växte fram ur
 * riktiga fel — Reddit svarade 429 när två flöden hämtades för tätt, och Google
 * News stängde anslutningen vid parallella anrop. Samma sak gäller här: tv.nu
 * har trettio kanaler som ska hämtas per dag, och att skicka trettio samtidiga
 * anrop mot en gratis webbtjänst är att be om att bli utestängd.
 */

const USER_AGENT =
  process.env.HTTP_USER_AGENT ??
  "teliaplay-personal/1.0 (privat, icke-kommersiell användning)";

/**
 * Minsta tid mellan två anrop till samma värd, i millisekunder.
 *
 * Siffrorna är försiktiga snarare än uppmätta — till skillnad från TI-appen har
 * de inte kalibrerats mot faktiska 429-svar ännu. Kör `npm run probe` och sänk
 * först när du sett att värden tål det.
 */
const HOST_INTERVAL_MS: Record<string, number> = {
  "web-api.tv.nu": 600,
  "www.thesportsdb.com": 1_500,
  "api.themoviedb.org": 250,
  "ottapi.prod.telia.net": 800,
  default: 300,
};

const lastHit = new Map<string, number>();

async function hostGate(host: string): Promise<void> {
  const min = HOST_INTERVAL_MS[host] ?? HOST_INTERVAL_MS.default;
  const previous = lastHit.get(host) ?? 0;
  const wait = previous + min - Date.now();
  // Boka platsen direkt så att parallella anropare köar bakom varandra.
  lastHit.set(host, Math.max(Date.now(), previous + min));
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
}

function isRetryable(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /ECONNRESET|ETIMEDOUT|EAI_AGAIN|socket hang up|HTTP (429|50\d)|aborted/i.test(msg);
}

export interface HamtaOpts {
  timeoutMs?: number;
  attempts?: number;
  headers?: Record<string, string>;
  method?: "GET" | "POST";
  body?: unknown;
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
          "User-Agent": USER_AGENT,
          Accept: "application/json, text/plain;q=0.9, */*;q=0.8",
          ...(body ? { "Content-Type": "application/json" } : {}),
          ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
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
