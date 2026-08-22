import { Bricka } from "./Bricka";
import { SpelaKnapp } from "./SpelaKnapp";
import { FavoritKnapp } from "./FavoritKnapp";
import type { TitelVy } from "@/lib/types";

/** En film eller serie. Affisch, tjänst, och en knapp som startar den. */
export function TitelKort({ titel, favorit }: { titel: TitelVy; favorit?: boolean }) {
  // array_agg ger [null] när ingen rad matchade. Filtrera bort, annars ritas
  // en tom bricka som ser ut som ett fel.
  const tjanster = (titel.tjanster ?? []).filter(Boolean);

  return (
    <article className="w-[132px] shrink-0">
      <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-surface-2">
        {titel.poster ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={titel.poster}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center p-2 text-center text-[11px] text-muted">
            {titel.namn}
          </div>
        )}

        <div className="absolute left-1 top-1 flex flex-wrap gap-1">
          {tjanster.map((t) => (
            <Bricka key={t} tjanstId={t} liten />
          ))}
        </div>

        <div className="absolute right-0 top-0">
          <FavoritKnapp sort="titel" refId={titel.id} aktiv={Boolean(favorit)} />
        </div>
      </div>

      <h3 className="mt-1.5 truncate text-[12px] font-medium">{titel.namn}</h3>
      <div className="flex items-center justify-between gap-1">
        <span className="text-[10px] text-muted">
          {titel.ar ?? ""}
          {titel.betyg ? ` · ${titel.betyg}` : ""}
        </span>
        {tjanster[0] && (
          <SpelaKnapp tjanstId={tjanster[0]} namn={titel.namn} refId={titel.id} sort="titel" liten />
        )}
      </div>
    </article>
  );
}
