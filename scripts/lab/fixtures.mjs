/**
 * Provdata för labbet.
 *
 * Den är inte slumpad. Varje rad finns för att den ställer en fråga till
 * gränssnittet: en titel utan affisch, en utan betyg, ett namn så långt att
 * det måste brytas, en match som krockar med en annan, ett block som är tomt.
 * Ett labb med prydlig data visar bara att prydlig data ser prydlig ut.
 */

const nu = Date.now();
const h = (timmar) => new Date(nu + timmar * 3600_000);
const d = (dagar) => new Date(nu + dagar * 86400_000);

/** Affischadresserna pekar på riktiga värdar. Playwright svarar i deras ställe. */
const poster = (n) => `https://image.tmdb.org/t/p/w342/lab-${n}.jpg`;
const svtbild = (n) => `https://www.svtstatic.se/image/large/1080/${n}/lab`;

export const TJANSTER = [
  ["viaplay", "Viaplay", true, "telia"],
  ["max", "HBO Max", true, "manuell"],
  ["disney", "Disney+", true, "manuell"],
  ["tv4play", "TV4 Play", true, "telia"],
  ["skyshowtime", "SkyShowtime", true, "manuell"],
  ["prime", "Prime Video", true, "manuell"],
  ["svtplay", "SVT Play", true, "auto"],
  ["discovery", "Discovery+", false, "manuell"],
  ["netflix", "Netflix", false, "manuell"],
];

export const KANALER = [
  ["svt1", "svtplay", "SVT1", false, 10],
  ["svt2", "svtplay", "SVT2", false, 11],
  ["tv4", "tv4play", "TV4", false, 12],
  ["tv3", "viaplay", "TV3", false, 13],
  ["kanal5", "discovery", "Kanal 5", false, 14],
  ["tv6", "viaplay", "TV6", false, 15],
  ["viaplay-sport-1", "viaplay", "Viaplay Sport 1", true, 30],
  ["tv4-fotboll", "tv4play", "TV4 Fotboll", true, 31],
  ["cmore-hockey", "cmore", "C More Hockey", true, 32],
];

/**
 * Titlar. Genrerna är de som TMDB faktiskt returnerar för svenska marknaden,
 * översatta i lib/genre.ts — labbet skriver dem som de lagras.
 */
export const TITLAR = [
  // namn, typ, år, betyg, genrer, tjänster, poster, nyhet(rank), sistaChans
  ["Dune: Del två", "film", 2024, 8.1, ["action", "sci-fi"], ["max"], 1, 0],
  ["Oppenheimer", "film", 2023, 8.1, ["drama", "historia"], ["skyshowtime"], 2, 0],
  ["Barbie", "film", 2023, 7.0, ["komedi", "aventyr"], ["max"], 3, 0],
  ["Sagan om ringen: Härskarringen", "film", 2001, 8.4, ["aventyr", "fantasy"], ["max", "prime"], null, 0],
  ["Succession", "serie", 2018, 8.9, ["drama"], ["max"], 4, 0],
  ["The Last of Us", "serie", 2023, 8.7, ["drama", "skrack"], ["max"], 5, 0],
  ["Andor", "serie", 2022, 8.4, ["sci-fi", "aventyr"], ["disney"], 6, 0],
  ["Shogun", "serie", 2024, 8.6, ["drama", "historia"], ["disney"], 7, 0],
  ["Bluey", "serie", 2018, 9.3, ["barn", "komedi"], ["disney"], null, 0],
  ["Snökaos i Sälen — en dokumentär om vintern 1998 och allt som gick fel", "film", 2022, 6.2, ["dokumentar"], ["tv4play"], null, 0],
  ["Bäst i test", "serie", 2016, 8.0, ["komedi"], ["svtplay"], 8, 0],
  ["Uppdrag granskning", "serie", 2001, 7.9, ["dokumentar"], ["svtplay"], null, 0],
  ["Vinterstudion", "serie", 2005, null, ["sport"], ["svtplay"], null, 0],
  ["Skärgårdsdoktorn", "serie", 1997, 6.4, ["drama"], ["svtplay"], null, 1],
  ["Den osynliga flickan", "film", 2021, 6.8, ["thriller"], ["viaplay"], null, 1],
  ["Snabba Cash", "serie", 2021, 6.6, ["thriller", "drama"], ["viaplay"], 9, 0],
  ["Solsidan", "serie", 2010, 7.6, ["komedi"], ["viaplay", "tv4play"], null, 0],
  ["Bron", "serie", 2011, 8.6, ["thriller", "drama"], ["viaplay"], null, 1],
  ["Mästarnas mästare", "serie", 2009, 7.2, ["sport"], ["svtplay"], null, 0],
  ["Fjällbackamorden", "serie", 2012, 6.1, ["thriller"], ["tv4play"], null, 0],
  ["Fångarna på fortet", "serie", 1990, 7.0, ["aventyr"], ["tv4play"], null, 0],
  ["Farmen", "serie", 2001, 5.9, ["dokumentar"], ["tv4play"], null, 0],
  ["Familjen Svensson", "serie", 2019, 6.0, ["komedi"], ["svtplay"], null, 0],
  ["Fixarna", "serie", 2020, 5.8, ["dokumentar"], ["svtplay"], null, 0],
  ["Alice i Underlandet", "film", 2010, 6.4, ["barn", "fantasy"], ["disney"], null, 0],
  ["Frost", "film", 2013, 7.4, ["barn", "aventyr"], ["disney"], null, 0],
  ["Top Gun: Maverick", "film", 2022, 8.2, ["action"], ["skyshowtime"], null, 1],
  ["Nyckeln till frihet", "film", 1994, 8.7, ["drama"], ["prime"], null, 0],
  ["Djävulen bär Prada", "film", 2006, 6.9, ["komedi", "drama"], ["skyshowtime"], null, 0],
  ["En natt i Lissabon", "film", 2019, null, ["drama"], ["prime"], null, 0],
];

/** Tablå: två dygn, med en lucka på TV6 så att tomma rader syns i labbet. */
export function program() {
  const rader = [];
  const mall = [
    ["svt1", "Rapport", "nyheter", 0.5],
    ["svt1", "Uppdrag granskning", "dokumentär", 1],
    ["svt2", "Vinterstudion", "sport", 2],
    ["tv4", "Nyheterna", "nyheter", 0.5],
    ["tv4", "Solsidan", "komedi", 0.5],
    ["tv3", "Efterlyst", "dokumentär", 1],
    ["kanal5", "Vem bor här?", "livsstil", 1],
    ["viaplay-sport-1", "Allsvenskan: Djurgården – Hammarby", "sport", 2],
    ["tv4-fotboll", "Premier League: Arsenal – Liverpool", "sport", 2],
    ["cmore-hockey", "SHL: Frölunda – Skellefteå", "sport", 2.5],
  ];

  let i = 0;
  for (let dag = 0; dag < 2; dag++) {
    let klocka = 17;
    for (const [kanal, titel, genre, langd] of mall) {
      const start = new Date(d(dag).setHours(Math.floor(klocka), (klocka % 1) * 60, 0, 0));
      rader.push({
        id: `lab-p${i++}`,
        kanal_id: kanal,
        start,
        slut: new Date(start.getTime() + langd * 3600_000),
        titel: dag === 0 ? titel : `${titel} (repris)`,
        genre,
      });
      klocka += langd;
    }
  }

  // Ett program som pågår just nu, så att "Direkt nu" aldrig är tomt i labbet.
  rader.push({
    id: "lab-nu",
    kanal_id: "svt1",
    start: h(-0.4),
    slut: h(0.6),
    titel: "Aktuellt",
    genre: "nyheter",
  });
  return rader;
}

export const LAG = [
  ["lab-djurgarden", "133604", "Djurgården", "allsvenskan"],
  ["lab-hammarby", "133605", "Hammarby", "allsvenskan"],
  ["lab-frolunda", "134851", "Frölunda", "shl"],
];

export function matcher() {
  return [
    { id: "lab-m1", liga_id: "allsvenskan", hemma: "Djurgården", borta: "Hammarby", start: h(3), program_id: "lab-p7" },
    // Krockar med matchen ovan: samma kväll, annan sport. Krockvarningen ska synas.
    { id: "lab-m2", liga_id: "shl", hemma: "Frölunda", borta: "Skellefteå", start: h(3.5), program_id: "lab-p9" },
    // Ingen sändning alls — sportsidans enda tillåtna "nej".
    { id: "lab-m3", liga_id: "allsvenskan", hemma: "Hammarby", borta: "Malmö FF", start: d(4), program_id: null },
  ];
}

export { poster, svtbild, h, d };
