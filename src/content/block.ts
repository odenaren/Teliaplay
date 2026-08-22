/**
 * Blocken som startsidan byggs av.
 *
 * Varje profil har sin egen lista: ordning, av/på och inställningar per block.
 * Listan här beskriver bara vilka block som FINNS och hur de beter sig som
 * förval. Det du väljer sparas i tabellen `block`, nycklad på profil.
 *
 * Att lägga till ett block är en rad här plus ett fall i components/Block.tsx.
 */

export type BlockSort =
  | "nasta-match"
  | "live-nu"
  | "ikvall"
  | "favoritkanaler"
  | "nytt-i-paketet"
  | "sista-chansen"
  | "fortsatt-titta"
  | "sparat";

export interface BlockDef {
  sort: BlockSort;
  titel: string;
  /** Vad blocket svarar på. Visas i redigeringsläget, inte på startsidan. */
  beskrivning: string;
  /** Med i en ny profils startsida? */
  standard: boolean;
  /** Hur många poster som visas som förval. */
  antal: number;
}

export const BLOCK: BlockDef[] = [
  {
    sort: "nasta-match",
    titel: "Nästa match för mina lag",
    beskrivning: "Kommande matcher för dina favoritlag, med kanal och startknapp.",
    standard: true,
    antal: 4,
  },
  {
    sort: "live-nu",
    titel: "Direkt nu",
    beskrivning: "Det som sänds i den här stunden på kanaler du har.",
    standard: true,
    antal: 6,
  },
  {
    sort: "ikvall",
    titel: "Ikväll på tv",
    beskrivning: "Kvällens sändningar 18–23 på dina kanaler.",
    standard: true,
    antal: 8,
  },
  {
    sort: "favoritkanaler",
    titel: "Mina kanaler",
    beskrivning: "Vad som går just nu på kanalerna du stjärnmärkt.",
    standard: true,
    antal: 6,
  },
  {
    sort: "nytt-i-paketet",
    titel: "Nytt i paketet",
    beskrivning: "Filmer och serier som dykt upp i tjänsterna du har den senaste tiden.",
    standard: true,
    antal: 12,
  },
  {
    sort: "sista-chansen",
    titel: "Sista chansen",
    beskrivning: "Titlar som slutat synas i katalogen och troligen är på väg bort.",
    standard: false,
    antal: 8,
  },
  {
    sort: "fortsatt-titta",
    titel: "Fortsätt titta",
    beskrivning: "Sådant du startat härifrån men inte markerat som sett.",
    standard: false,
    antal: 6,
  },
  {
    sort: "sparat",
    titel: "Sparat",
    beskrivning: "Din egen lista.",
    standard: true,
    antal: 8,
  },
];

const BY_SORT = new Map(BLOCK.map((b) => [b.sort, b]));

export function blockDef(sort: string): BlockDef | undefined {
  return BY_SORT.get(sort as BlockSort);
}
