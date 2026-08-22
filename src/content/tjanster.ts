/**
 * Tjänstekatalogen.
 *
 * Här står allt appen behöver veta om varje streamingtjänst som KAN ingå i ett
 * Telia Play-paket: hur man djuplänkar till den, vad den heter hos TMDB, var
 * man aktiverar den hos Telia och var man återställer lösenordet.
 *
 * VIKTIGT: den här filen säger inte vad som ingår i DITT paket. Den beskriver
 * bara vilka tjänster som finns och hur de fungerar. Vad du faktiskt har rätt
 * att se avgörs av `tjanst.ingar` i databasen, som fylls i på /ingar — antingen
 * hämtat från Telia eller ikryssat för hand. Att blanda ihop de två vore precis
 * det fel appen finns för att undvika.
 *
 * Redaktionellt innehåll ligger som TypeScript i git, inte i databasen. Det gör
 * ändringar granskningsbara i en diff och överlever att databasen töms.
 */

export type TjanstId =
  | "viaplay"
  | "max"
  | "disney"
  | "tv4play"
  | "prime"
  | "skyshowtime"
  | "netflix"
  | "discovery"
  | "cmore"
  | "svtplay"
  | "teliaplay";

export interface Tjanst {
  id: TjanstId;
  namn: string;
  /** Kort etikett i trånga lägen, t.ex. på ett programkort. */
  kort: string;
  /** Färg för brickan. Tjänstens egen, så att den känns igen på en halv sekund. */
  farg: string;
  /**
   * TMDB:s provider-id för svenska marknaden (datan kommer från JustWatch).
   *
   * Slå upp aktuella id:n med:
   *   npm run probe -- tmdb-providers
   *
   * De ändras sällan men de ändras — HBO Max bytte id när tjänsten döptes om
   * till Max och tillbaka igen. Saknas id:t hämtas ingen katalog för tjänsten,
   * och det är rätt beteende: hellre tom katalog än fel katalog.
   */
  tmdbProvider?: number;
  /** Har tjänsten ett linjärt kanalutbud (tablå) utöver on demand? */
  harKanaler: boolean;
  /** Sida hos Telia där tjänsten aktiveras/kopplas till abonnemanget. */
  aktivering?: string;
  /** Tjänstens egen "glömt lösenord"-sida. Halva poängen med valvet. */
  glomtLosenord?: string;
  /** Sidan där man knappar in en kod från tv:n, när sådan finns. */
  tvInloggning?: string;
  webb: string;
  /**
   * Hur en titel-url byggs. `{id}` byts mot tjänstens eget id för titeln.
   * Saknas mönstret hamnar man på startsidan i stället — trubbigt men aldrig fel.
   */
  titelMonster?: string;
  /**
   * App-id på Apple TV (tvOS bundle identifier). pyatv använder det för att
   * öppna rätt app när vi inte har någon djuplänk att skicka.
   *
   * Kontrollera mot din egen låda med:
   *   npm run bridge:test -- apps
   *
   * Id:n skiljer sig mellan länder och uppdateringar; listan här är utgångsläget,
   * inte facit.
   */
  appleTvApp?: string;
  /** App-id på Samsung Tizen. Samma förbehåll som ovan. */
  tizenApp?: string;
}

export const TJANSTER: Tjanst[] = [
  {
    id: "teliaplay",
    namn: "Telia Play",
    kort: "Telia",
    farg: "#990ae3",
    harKanaler: true,
    aktivering: "https://www.telia.se/support/tv-och-streaming/guider/aktivera-teliaplay",
    glomtLosenord: "https://www.telia.se/privat/mitt-telia",
    webb: "https://www.teliaplay.se",
    titelMonster: "https://www.teliaplay.se/{id}",
    appleTvApp: "se.telia.TeliaPlay",
    tizenApp: "3201907018125",
  },
  {
    id: "viaplay",
    namn: "Viaplay",
    kort: "Viaplay",
    farg: "#ff2d55",
    tmdbProvider: 76,
    harKanaler: true,
    aktivering: "https://www.telia.se/support/tv-och-streaming/guider/aktivera-viaplay",
    glomtLosenord: "https://viaplay.se/account/forgot-password",
    tvInloggning: "https://viaplay.se/tv",
    webb: "https://viaplay.se",
    titelMonster: "https://viaplay.se/product/{id}",
    appleTvApp: "com.viaplay.Viaplay",
    tizenApp: "3201603005348",
  },
  {
    id: "max",
    namn: "HBO Max",
    kort: "Max",
    farg: "#7b2ff7",
    tmdbProvider: 1899,
    harKanaler: false,
    aktivering: "https://www.telia.se/support/tv-och-streaming/guider/aktivera-max",
    glomtLosenord: "https://auth.max.com/password",
    tvInloggning: "https://play.max.com/tvsignin",
    webb: "https://play.max.com",
    titelMonster: "https://play.max.com/video/watch/{id}",
    appleTvApp: "com.wbd.stream",
    tizenApp: "3201601007230",
  },
  {
    id: "disney",
    namn: "Disney+",
    kort: "Disney+",
    farg: "#0c204a",
    tmdbProvider: 337,
    harKanaler: false,
    aktivering: "https://www.telia.se/support/tv-och-streaming/guider/aktivera-disney",
    glomtLosenord: "https://www.disneyplus.com/login/forgot-password",
    webb: "https://www.disneyplus.com",
    titelMonster: "https://www.disneyplus.com/sv-se/browse/entity-{id}",
    appleTvApp: "com.disney.disneyplus",
    tizenApp: "3201901017640",
  },
  {
    id: "tv4play",
    namn: "TV4 Play",
    kort: "TV4",
    farg: "#e5001a",
    tmdbProvider: 400,
    harKanaler: true,
    aktivering: "https://www.telia.se/support/tv-och-streaming/guider/aktivera-streamingtjanst",
    glomtLosenord: "https://www.tv4play.se/losenord",
    webb: "https://www.tv4play.se",
    titelMonster: "https://www.tv4play.se/program/{id}",
    appleTvApp: "se.tv4.tv4play",
    tizenApp: "3201510005981",
  },
  {
    id: "prime",
    namn: "Prime Video",
    kort: "Prime",
    farg: "#00a8e1",
    tmdbProvider: 119,
    harKanaler: false,
    aktivering: "https://www.telia.se/support/tv-och-streaming/guider/aktivera-streamingtjanst",
    glomtLosenord: "https://www.amazon.se/ap/forgotpassword",
    tvInloggning: "https://www.primevideo.com/mytv",
    webb: "https://www.primevideo.com",
    titelMonster: "https://www.primevideo.com/detail/{id}",
    appleTvApp: "com.amazon.aiv.AIVApp",
    tizenApp: "3201910019365",
  },
  {
    id: "skyshowtime",
    namn: "SkyShowtime",
    kort: "Sky",
    farg: "#00b2ff",
    tmdbProvider: 1773,
    harKanaler: false,
    aktivering: "https://www.telia.se/support/tv-och-streaming/guider/aktivera-streamingtjanst",
    glomtLosenord: "https://www.skyshowtime.com/se/forgot-password",
    webb: "https://www.skyshowtime.com",
    titelMonster: "https://www.skyshowtime.com/se/watch/asset/{id}",
    appleTvApp: "com.skyshowtime.skyshowtime",
    tizenApp: "3201703012079",
  },
  {
    id: "netflix",
    namn: "Netflix",
    kort: "Netflix",
    farg: "#e50914",
    tmdbProvider: 8,
    harKanaler: false,
    aktivering: "https://www.telia.se/support/tv-och-streaming/guider/aktivera-streamingtjanst",
    glomtLosenord: "https://www.netflix.com/loginhelp",
    webb: "https://www.netflix.com",
    titelMonster: "https://www.netflix.com/title/{id}",
    appleTvApp: "com.netflix.Netflix",
    tizenApp: "3201907018807",
  },
  {
    id: "discovery",
    namn: "discovery+",
    kort: "d+",
    farg: "#2175d9",
    tmdbProvider: 520,
    harKanaler: true,
    aktivering: "https://www.telia.se/support/tv-och-streaming/guider/aktivera-streamingtjanst",
    glomtLosenord: "https://www.discoveryplus.com/se/forgot-password",
    webb: "https://www.discoveryplus.com/se",
    titelMonster: "https://www.discoveryplus.com/se/video/{id}",
    appleTvApp: "com.discovery.mobile.dplus",
    tizenApp: "3201803015934",
  },
  {
    id: "cmore",
    namn: "C More",
    kort: "C More",
    farg: "#0b1c2c",
    harKanaler: true,
    webb: "https://www.tv4play.se",
    appleTvApp: "se.tv4.tv4play",
  },
  {
    id: "svtplay",
    namn: "SVT Play",
    kort: "SVT",
    farg: "#3b7ad9",
    tmdbProvider: 1918,
    harKanaler: true,
    webb: "https://www.svtplay.se",
    titelMonster: "https://www.svtplay.se/video/{id}",
    appleTvApp: "se.svt.svtplay",
    tizenApp: "3201907018484",
  },
];

const BY_ID = new Map(TJANSTER.map((t) => [t.id, t]));

export function tjanst(id: string): Tjanst | undefined {
  return BY_ID.get(id as TjanstId);
}

/**
 * SVT och andra fria kanaler ingår alltid, oavsett abonnemang.
 *
 * Att kräva att du kryssar i SVT Play på /ingar vore att låtsas att appen inte
 * vet något den faktiskt vet. Public service finansieras via skatten och ligger
 * utanför paketfrågan.
 */
export const ALLTID_INGAR: TjanstId[] = ["svtplay"];
