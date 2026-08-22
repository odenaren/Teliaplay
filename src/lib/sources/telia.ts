/**
 * Telias eget API — facit för vad som ingår i abonnemanget.
 *
 * Flödet är det som Telias egna klienter använder, kartlagt av Kodi-tillägget
 * plugin.video.teliaplay (Mariusz89B). Fem steg:
 *
 *   1. authenticate      användarnamn + lösenord  → auktoriseringskod
 *   2. oauth/token       koden                    → access + refresh token
 *   3. provision         access token             → enheten registrerad
 *   4. pubsub            access token             → subscriber token
 *   5. engagementinfo    subscriber token         → VILKA KANALER DU HAR
 *
 * Steg fem är hela poängen. Resten är vägen dit.
 *
 * TRE SAKER ATT VETA
 *
 * Det här API:et är inte publikt och inte dokumenterat. Det används här med
 * dina egna uppgifter för ditt eget abonnemang, för att visa dig vad du redan
 * betalar för. Det hämtar inga strömmar och kringgår inget kopieringsskydd.
 *
 * Det kommer att gå sönder. Inte kanske — när Telia ändrar något. Därför är
 * varje fel här ofarligt för resten av appen: hämtningen loggas som misslyckad,
 * den manuella ingår-listan står kvar orörd, och /ingar visar hur gammal
 * uppgiften är. En app som slutade fungera för att en tredjeparts-endpoint
 * flyttade vore ett sämre bygge än en som säger "jag har inte hört från Telia
 * på nio dagar".
 *
 * Lösenordet loggas aldrig, varken i klartext eller som del av en URL i ett
 * felmeddelande. Se `snalltFel()` längst ned.
 */

import { fetchJson, plocka } from "./http";
import { sql } from "../db";

const LOGIN = "https://logingateway-telia.clientapi-prod.live.tv.telia.net/logingateway/rest/v1";
const OTT = "https://ottapi.prod.telia.net/web";
const LAND = process.env.TELIA_COUNTRY ?? "se";

export interface TeliaKanal {
  cid: string;
  namn: string;
  logo?: string;
  /** Ingår i abonnemanget enligt engagementinfo. */
  ingar: boolean;
}

interface Session {
  accessToken: string;
  refreshToken?: string;
  subscriberToken?: string;
  deviceId: string;
}

/**
 * Enhets-id.
 *
 * Telia knyter sessionen till en enhet. Slumpar vi ett nytt id vid varje
 * hämtning registrerar vi en ny "enhet" var femtonde minut, och abonnemang har
 * tak för hur många enheter som får finnas. Id:t sparas därför i databasen och
 * återanvänds.
 */
async function deviceId(): Promise<string> {
  const rad = await sql<{ device_id: string | null }[]>`
    select device_id from telia_session where id = 'default'
  `;
  const befintligt = rad[0]?.device_id;
  if (befintligt) return befintligt;

  const nytt = crypto.randomUUID();
  await sql`
    insert into telia_session (id, device_id) values ('default', ${nytt})
    on conflict (id) do update set device_id = excluded.device_id
  `;
  return nytt;
}

async function logaIn(): Promise<Session> {
  const username = process.env.TELIA_USERNAME;
  const password = process.env.TELIA_PASSWORD;
  if (!username || !password) {
    throw new Error(
      "TELIA_USERNAME/TELIA_PASSWORD saknas. Utan dem hämtas ingenting från " +
        "Telia och appen använder den manuella ingår-listan på /ingar.",
    );
  }

  const device = await deviceId();

  const auth = await fetchJson(`${LOGIN}/authenticate`, {
    method: "POST",
    body: { username, password, deviceId: device },
    // Ett fel lösenord är inte något att försöka igen med — tre försök i rad
    // med fel uppgifter är ett bra sätt att bli utelåst.
    attempts: 1,
  }).catch(snalltFel("authenticate"));

  const code = plocka(auth, "authorizationCode", "code", "data.authorizationCode");
  if (typeof code !== "string") {
    throw new Error("authenticate svarade utan auktoriseringskod");
  }

  const token = await fetchJson(`${LOGIN}/oauth/token`, {
    method: "POST",
    body: { code, grant_type: "authorization_code", deviceId: device },
    attempts: 1,
  }).catch(snalltFel("oauth/token"));

  const accessToken = plocka(token, "access_token", "accessToken", "data.access_token");
  if (typeof accessToken !== "string") throw new Error("oauth/token svarade utan access_token");

  const refreshToken = plocka(token, "refresh_token", "refreshToken");
  const session: Session = {
    accessToken,
    refreshToken: typeof refreshToken === "string" ? refreshToken : undefined,
    deviceId: device,
  };

  // Provisioneringen är ett registreringssteg utan intressant svar, men utan
  // det svarar engagementinfo 401. Ett fel här är alltså inte kosmetiskt.
  await fetchJson(`${OTT}/${LAND}/tvclientgateway/rest/secure/v1/provision`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: { deviceId: device },
    attempts: 1,
  }).catch(snalltFel("provision"));

  const pubsub = await fetchJson(`${OTT}/${LAND}/tvclientgateway/rest/secure/v1/pubsub`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    attempts: 2,
  }).catch(snalltFel("pubsub"));

  const sub = plocka(pubsub, "subscriberToken", "token", "data.subscriberToken");
  if (typeof sub === "string") session.subscriberToken = sub;

  await sparaSession(session);
  return session;
}

async function sparaSession(s: Session): Promise<void> {
  await sql`
    insert into telia_session (id, access_token, refresh_token, subscriber_token, device_id, uppdaterad_at)
    values ('default', ${s.accessToken}, ${s.refreshToken ?? null}, ${s.subscriberToken ?? null}, ${s.deviceId}, now())
    on conflict (id) do update set
      access_token     = excluded.access_token,
      refresh_token    = excluded.refresh_token,
      subscriber_token = excluded.subscriber_token,
      uppdaterad_at    = now()
  `;
}

/**
 * Kanalerna, med ingår-flaggan satt.
 *
 * Två anrop: hela kanalutbudet, och listan över vad du har rätt till. Det andra
 * är det som betyder något — men utan det första har vi bara id:n utan namn.
 */
export async function hamtaKanaler(): Promise<TeliaKanal[]> {
  const session = await logaIn();
  const auth = { Authorization: `Bearer ${session.accessToken}` };

  const alla = await fetchJson(
    `${OTT}/${LAND}/contentsourcegateway/rest/v1/channels`,
    { headers: auth },
  ).catch(snalltFel("channels"));

  const engagemang = await fetchJson(
    `${OTT}/${LAND}/engagementgateway/rest/secure/v2/engagementinfo`,
    {
      headers: {
        ...auth,
        ...(session.subscriberToken ? { "X-Subscriber-Token": session.subscriberToken } : {}),
      },
    },
  ).catch(snalltFel("engagementinfo"));

  const mina = new Set(cidUr(engagemang));
  const ut: TeliaKanal[] = [];

  const lista = (plocka(alla, "channels", "data.channels", "data") as unknown[]) ?? [];
  for (const rad of Array.isArray(lista) ? lista : []) {
    const cid = plocka(rad, "id", "cid", "channelId");
    const namn = plocka(rad, "name", "title", "channelName");
    if ((typeof cid !== "string" && typeof cid !== "number") || typeof namn !== "string") continue;

    const logo = plocka(rad, "logo", "images.logo", "logoUrl");
    ut.push({
      cid: String(cid),
      namn,
      logo: typeof logo === "string" ? logo : undefined,
      ingar: mina.has(String(cid)),
    });
  }

  // Svarade engagementinfo med noll kanaler har något gått fel i auth-kedjan
  // snarare än att abonnemanget verkligen är tomt. Att skriva "inget ingår"
  // till databasen då skulle tömma appen.
  if (mina.size === 0) {
    throw new Error(
      "engagementinfo svarade utan kanaler. Sannolikt en trasig session, inte " +
        "ett tomt abonnemang — den manuella listan lämnas orörd.",
    );
  }

  return ut;
}

function cidUr(svar: unknown): string[] {
  const lista =
    (plocka(svar, "channelIds", "channels", "data.channels", "engagements", "data") as unknown[]) ??
    [];
  if (!Array.isArray(lista)) return [];

  const ut: string[] = [];
  for (const rad of lista) {
    if (typeof rad === "string" || typeof rad === "number") {
      ut.push(String(rad));
      continue;
    }
    const cid = plocka(rad, "channelId", "id", "cid");
    if (typeof cid === "string" || typeof cid === "number") ut.push(String(cid));
  }
  return ut;
}

/**
 * Fel utan hemligheter.
 *
 * Ett nätverksfel bär ofta med sig hela URL:en, och ett POST-fel kan bära
 * kroppen. Här står lösenordet. Meddelandet skrivs därför om till steget som
 * fallerade plus statuskoden — det räcker för felsökning och läcker inget.
 */
function snalltFel(steg: string) {
  return (err: unknown): never => {
    const rad = err instanceof Error ? err.message : String(err);
    const status = rad.match(/HTTP (\d{3})/)?.[1];
    throw new Error(
      status ? `Telia ${steg}: HTTP ${status}` : `Telia ${steg}: anropet gick inte igenom`,
    );
  };
}
