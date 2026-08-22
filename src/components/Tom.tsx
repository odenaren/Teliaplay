import Link from "next/link";

/**
 * Tomt läge.
 *
 * En tom sida i den här appen betyder nästan aldrig "det finns inget" utan
 * "något är inte inställt än" — ingår-listan är tom, tablån inte hämtad,
 * inget favoritlag valt. Att skriva ut vilket av dem det är, och länka dit,
 * är skillnaden mellan en app som verkar trasig och en som säger vad den
 * behöver.
 */
export function Tom({
  rubrik,
  text,
  lank,
  lankText,
}: {
  rubrik: string;
  text: string;
  lank?: string;
  lankText?: string;
}) {
  return (
    <div className="rounded-lg border border-dashed border-line px-4 py-8 text-center">
      <p className="text-[14px] font-medium">{rubrik}</p>
      <p className="mx-auto mt-1 max-w-sm text-[12px] leading-relaxed text-muted">{text}</p>
      {lank && (
        <Link
          href={lank}
          className="mt-3 inline-block rounded-full border border-line px-3 py-1.5 text-[12px] text-accent hover:border-accent/50"
        >
          {lankText ?? "Ställ in"}
        </Link>
      )}
    </div>
  );
}
