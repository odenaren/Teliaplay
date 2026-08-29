import { Bricka } from "./Bricka";
import { SpelaKnapp } from "./SpelaKnapp";
import { FavoritKnapp } from "./FavoritKnapp";
import { TJANSTER } from "@/content/tjanster";
import type { TitelVy } from "@/lib/types";

/**
 * En film eller serie: affisch, tjänst, och en knapp som startar den.
 *
 * Två bredder. `bred` fyller sin spalt och används i rutnätet på en
 * kategorisida; utan den är kortet 132 px och ligger i en svepbar rad. Måtten
 * är valda så att det alltid syns en bit av nästa affisch i kanten — det är
 * det som säger "det finns mer åt höger" utan en pil som ska tryckas på.
 */
export function TitelKort({
  titel,
  favorit,
  bred,
}: {
  titel: TitelVy;
  favorit?: boolean;
  bred?: boolean;
}) {
  /*
   * array_agg ger [null] när ingen rad matchade. Filtrera bort, annars ritas
   * en tom bricka som ser ut som ett fel.
   *
   * Ordningen är content/tjanster.ts egen, inte databasens. Spela-knappen tar
   * FÖRSTA tjänsten i listan, och den ordningen var tidigare godtycklig — en
   * film som gick på både Viaplay och Prime kunde skicka dig till endera,
   * olika mellan två sidladdningar. Nu är märket längst till vänster alltid
   * det knappen använder, vilket är det enda som gör knappen förutsägbar.
   */
  const ordning = new Map(TJANSTER.map((t, i) => [t.id as string, i]));
  const tjanster = (titel.tjanster ?? [])
    .filter(Boolean)
    .sort((a, b) => (ordning.get(a) ?? 99) - (ordning.get(b) ?? 99));

  return (
    <article className={bred ? "w-full" : "w-[132px] shrink-0"}>
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
          /*
           * Ingen affisch. Titeln skrivs ut i rutan i stället för att lämna ett
           * hål — SVT:s A-Ö-lista saknar bilder helt, och ett tomt block läses
           * som en trasig bild snarare än som ett program utan omslag.
           */
          <div className="flex h-full items-center justify-center bg-surface-2 p-2 text-center text-[11px] leading-snug text-muted">
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

        {titel.officiell && (
          <span className="absolute inset-x-0 bottom-0 bg-live/85 px-1.5 py-0.5 text-center text-[9px] font-medium text-white">
            Snart borta
          </span>
        )}
      </div>

      {/*
        Två rader avsatta åt titeln, alltid — även när den bara behöver en.
        Utan min-höjden hamnar Spela-knappen på olika höjd i samma rad så fort
        en titel är lång nog att brytas, och raden ser trasig ut fastän varje
        kort för sig är rätt.
      */}
      <h3 className="mt-1.5 line-clamp-2 min-h-[2.2em] text-[12px] font-medium leading-snug">
        {titel.namn}
      </h3>
      <div className="mt-0.5 flex items-center justify-between gap-1">
        <span className="truncate text-[10px] text-muted">
          {titel.ar ?? ""}
          {titel.betyg ? ` · ${titel.betyg}` : ""}
        </span>
        {tjanster[0] && (
          <SpelaKnapp
            tjanstId={tjanster[0]}
            url={titel.extern_url}
            namn={titel.namn}
            refId={titel.id}
            sort="titel"
            liten
          />
        )}
      </div>
    </article>
  );
}
