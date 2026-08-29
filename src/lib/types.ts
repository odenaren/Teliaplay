/** Delade typer mellan server och klient. */

export interface TjanstRad {
  id: string;
  namn: string;
  ingar: boolean;
  kalla: string;
  verifierad_at: Date | null;
  notering: string | null;
  /**
   * Hur mycket av tjänsten som ingår: 'allt' eller 'sport'.
   * En sportnivå ger matcherna men inte filmkatalogen — se content/paket.ts.
   */
  omfattning: "allt" | "sport";
  /** Lägre går först när en titel finns på flera tjänster. */
  prioritet: number;
}

export interface KanalRad {
  id: string;
  tjanst_id: string;
  namn: string;
  tvnu_id: string | null;
  telia_cid: string | null;
  logo: string | null;
  sport: boolean;
  ingar: boolean;
  kalla: string;
  sort: number;
}

export interface ProgramRad {
  id: string;
  kanal_id: string;
  start: Date;
  slut: Date | null;
  titel: string;
  titel_key: string;
  beskrivning: string | null;
  genre: string | null;
  sasong: number | null;
  avsnitt: number | null;
  bild: string | null;
}

/** Ett program med sin kanal och sin ingår-status upplöst. */
export interface ProgramVy extends ProgramRad {
  kanalNamn: string;
  kanalLogo: string | null;
  tjanstId: string;
  sport: boolean;
  favorit?: boolean;
}

export interface TitelRad {
  id: string;
  tmdb_id: number | null;
  typ: "film" | "serie";
  namn: string;
  ar: number | null;
  poster: string | null;
  synopsis: string | null;
  betyg: string | null;
  /** Tjänstens egen adress, när källan gav oss en. Annars byggs den ur mönstret. */
  extern_url: string | null;
  /** Våra genre-id:n, se content/genrer.ts. Tom lista när källan inte sa något. */
  genre: string[];
}

/** En titel med de tjänster den finns på — alltid bara sådana som ingår. */
export interface TitelVy extends TitelRad {
  tjanster: string[];
  sedd_forst: Date;
  sedd_sist: Date;
  /**
   * Sant när TJÄNSTEN säger att titeln snart försvinner, falskt när det är vår
   * egen gissning. Skillnaden visas i gränssnittet — en officiell uppgift och
   * en kvalificerad chansning ska inte se likadana ut för läsaren.
   */
  officiell?: boolean;
}

export interface MatchRad {
  id: string;
  liga_id: string | null;
  hemma: string;
  borta: string;
  start: Date;
  program_id: string | null;
  tjanst_id: string | null;
}

/**
 * En match med svaret på den enda fråga som betyder något: kan jag se den?
 *
 * `var` är null när matchen inte hittat någon sändning i något du har. Det är
 * inte ett fel — det är svaret "nej", och det ska visas som ett tydligt nej.
 */
export interface MatchVy extends MatchRad {
  var: { kanalId: string; kanalNamn: string; tjanstId: string } | null;
  favoritlag: string[];
}

export interface Profil {
  id: string;
  namn: string;
  farg: string;
  harPin: boolean;
}
