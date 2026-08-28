import Link from "next/link";

/**
 * Kategoriväljaren: en svepbar rad med etiketter.
 *
 * Länkar och inte knappar, avsiktligt. Varje kategori får en egen adress som
 * går att lägga till på hemskärmen, dela till någon annan eller backa ur med
 * telefonens bakåtsvep. En klientkomponent med useState hade sett likadan ut
 * och tappat alltihop.
 */
export function KategoriRad({
  poster,
  aktiv,
}: {
  poster: { id: string; namn: string; href: string }[];
  aktiv: string | null;
}) {
  return (
    <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
      {poster.map((p) => {
        const vald = p.id === aktiv;
        return (
          <Link
            key={p.id}
            href={p.href}
            aria-current={vald ? "page" : undefined}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-[12px] transition-colors ${
              vald
                ? "border-accent bg-accent/15 text-accent"
                : "border-line text-muted hover:border-accent/40 hover:text-text"
            }`}
          >
            {p.namn}
          </Link>
        );
      })}
    </div>
  );
}
