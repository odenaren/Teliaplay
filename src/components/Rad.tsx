import Link from "next/link";
import { TitelKort } from "./TitelKort";
import type { TitelVy } from "@/lib/types";

/**
 * En vågrät rad affischer med rubrik.
 *
 * Hela bläddrandet är byggt av den här. Att ha den på ett ställe är inte bara
 * mindre kod: raderna får samma svepkänsla, samma avstånd och samma
 * rubriktyngd, och det är den likheten som gör en sida bläddringsbar. Sex
 * varianter av "ungefär samma rad" läses som sex olika saker.
 *
 * Kanterna: raden bryter ut ur sidans marginal med -mx-4 och lägger tillbaka
 * den som padding. Utan det tar affischerna slut en centimeter från skärmkanten
 * och det ser ut som att raden är slut när den inte är det.
 */
export function Rad({
  rubrik,
  underrubrik,
  titlar,
  mer,
  merText = "Se alla",
}: {
  rubrik: string;
  underrubrik?: string;
  titlar: TitelVy[];
  mer?: string;
  merText?: string;
}) {
  if (titlar.length === 0) return null;

  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-[14px] font-semibold tracking-tight">{rubrik}</h2>
          {underrubrik && (
            <p className="mt-0.5 text-[11px] leading-snug text-muted">{underrubrik}</p>
          )}
        </div>
        {mer && (
          <Link
            href={mer}
            className="shrink-0 text-[11px] text-muted underline decoration-dotted hover:text-accent"
          >
            {merText}
          </Link>
        )}
      </div>

      <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1">
        {titlar.map((t) => (
          <div key={t.id} className="snap-start">
            <TitelKort titel={t} />
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * Samma titlar, men som rutnät. Sidan man landar på när man valt en kategori.
 *
 * Två spalter på telefon, inte tre. Tre fick affischerna att bli 113 px breda,
 * och då rymdes inte "2018 · 8.9" bredvid Spela-knappen utan klipptes till
 * "2018 · …". Ett betyg som inte går att läsa är en rad som lika gärna kan tas
 * bort — och betyget är halva skälet att välja den ena titeln framför den
 * andra.
 */
export function Rutnat({ titlar }: { titlar: TitelVy[] }) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-3">
      {titlar.map((t) => (
        <TitelKort key={t.id} titel={t} bred />
      ))}
    </div>
  );
}
