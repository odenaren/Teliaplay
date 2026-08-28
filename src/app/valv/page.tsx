import { cookies } from "next/headers";
import { sql, ensureSchema, hasDatabase } from "@/lib/db";
import { aktivProfil } from "@/lib/profil";
import { avkryptera, harNyckel, totpKod, totpSekunderKvar } from "@/lib/vault";
import { sparaKonto, sattPin, lasUpp } from "@/app/actions";
import { TJANSTER } from "@/content/tjanster";
import { ingarKarta } from "@/lib/queries";
import { TotpKod } from "@/components/TotpKod";
import { Kopiera } from "@/components/Kopiera";
import { StartGuide } from "@/components/StartGuide";

export const dynamic = "force-dynamic";

/**
 * Valvet.
 *
 * Sidan man öppnar när Apple TV:n loggat ut en ur Viaplay mitt i en matchstart.
 * Allt som behövs för att komma in igen på ett ställe: vem som äger kontot,
 * vilken mejl det ligger på, lösenordet bakom en kopieringsknapp, en färsk
 * 2FA-kod, och länken till "glömt lösenord" när inget av det hjälper.
 *
 * Bara tjänster som ingår listas. En inloggning till något du inte har är per
 * definition inte det du letar efter.
 */
export default async function Valv() {
  if (!hasDatabase()) return <StartGuide steg="databas" />;
  await ensureSchema();

  const profil = await aktivProfil();
  if (!profil) return <StartGuide steg="profil" />;

  const store = await cookies();
  const upplast = store.get(`tp_valv_${profil.id}`)?.value === "1";

  if (profil.harPin && !upplast) return <PinLucka />;

  const karta = await ingarKarta();
  const konton = await sql<
    {
      id: string;
      tjanst_id: string;
      agare: string | null;
      epost: string | null;
      losen_krypt: string | null;
      totp_krypt: string | null;
      notering: string | null;
    }[]
  >`select * from konto`;

  const mina = TJANSTER.filter((t) => karta.tjanster.has(t.id));
  const nyckel = harNyckel();

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-line bg-surface/40 px-3 py-3 text-[12px] leading-relaxed">
        <h1 className="text-[15px] font-semibold tracking-tight">Inloggningar</h1>
        <p className="mt-1 text-muted">
          {nyckel
            ? "Lösenord och 2FA-nycklar ligger krypterade i databasen. Nyckeln finns bara i VAULT_KEY — en databasdump utan den är obrukbar."
            : "VAULT_KEY saknas, så inga lösenord kan sparas. Sätt den under Variables i Railway — 32 slumpade byte i base64 — så dyker rutorna för lösenord och 2FA upp här. Återställningslänkarna nedan fungerar ändå."}
        </p>
        {!profil.harPin && (
          <form action={sattPin} className="mt-3 flex items-center gap-2">
            <input
              name="pin"
              inputMode="numeric"
              pattern="\d{4,8}"
              placeholder="Sätt en PIN"
              className="w-32 rounded border border-line bg-surface px-2 py-1 text-[12px] outline-none focus:border-accent/60"
            />
            <button type="submit" className="rounded border border-line px-2 py-1 text-[11px]">
              Lås valvet
            </button>
          </form>
        )}
      </section>

      {mina.map((t) => {
        const konto = konton.find((k) => k.tjanst_id === t.id);
        return (
          <section key={t.id} className="rounded-lg border border-line bg-surface/40">
            <header className="flex items-center gap-2 border-b border-line px-3 py-2.5">
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: t.farg }} aria-hidden />
              <h2 className="min-w-0 flex-1 truncate text-[14px] font-semibold">{t.namn}</h2>
              {konto?.agare && <span className="text-[11px] text-muted">{konto.agare}</span>}
            </header>

            <div className="space-y-2.5 px-3 py-3">
              {konto?.epost && (
                <div className="flex flex-wrap items-center gap-2 text-[12px]">
                  <span className="text-muted">{konto.epost}</span>
                  <Kopiera varde={konto.epost} etikett="mejl" />
                </div>
              )}

              {konto?.losen_krypt && <Losen paket={konto.losen_krypt} />}
              {konto?.totp_krypt && <Totp paket={konto.totp_krypt} />}

              <div className="flex flex-wrap gap-3 text-[11px]">
                {t.glomtLosenord && (
                  <a href={t.glomtLosenord} target="_blank" rel="noopener noreferrer" className="text-accent underline decoration-dotted">
                    Glömt lösenord
                  </a>
                )}
                {t.tvInloggning && (
                  <a href={t.tvInloggning} target="_blank" rel="noopener noreferrer" className="text-accent underline decoration-dotted">
                    Logga in på tv:n
                  </a>
                )}
                {t.aktivering && (
                  <a href={t.aktivering} target="_blank" rel="noopener noreferrer" className="text-muted underline decoration-dotted">
                    Aktivera via Telia
                  </a>
                )}
              </div>

              {konto?.notering && <p className="text-[11px] text-muted">{konto.notering}</p>}

              <details className="text-[11px]">
                <summary className="cursor-pointer text-muted">Ändra uppgifter</summary>
                <form action={sparaKonto} className="mt-2 space-y-2">
                  <input type="hidden" name="tjanstId" value={t.id} />
                  <Falt namn="agare" etikett="Vem äger kontot" varde={konto?.agare ?? ""} />
                  <Falt namn="epost" etikett="E-post" varde={konto?.epost ?? ""} />
                  {nyckel ? (
                    <>
                      <Falt namn="losen" etikett="Lösenord (tomt = rör inte)" typ="password" />
                      <Falt namn="totp" etikett="otpauth://-länk för 2FA" />
                    </>
                  ) : (
                    /*
                      Rutorna för lösenord och 2FA finns inte utan VAULT_KEY —
                      ett fält som tar emot ett lösenord och sedan kastar det
                      vore värre än inget fält alls.

                      Men de får inte bara FÖRSVINNA. Den som fyller i HBO Max
                      och undrar var lösenordsrutan tog vägen kopplar inte ihop
                      det med en rad högst upp på sidan om en miljövariabel.
                      Saknas något ska det stå där man letar efter det.
                    */
                    <p className="rounded border border-line bg-surface px-2 py-1.5 leading-relaxed text-muted">
                      <strong className="text-text">Ingen ruta för lösenord?</strong> Den kommer
                      när <code className="text-text">VAULT_KEY</code> är satt — utan nyckel finns
                      det ingenting att kryptera med, och appen sparar hellre inget lösenord än ett
                      i klartext. Ägare, mejl och anteckning fungerar under tiden.
                    </p>
                  )}
                  <Falt namn="notering" etikett="Notering" varde={konto?.notering ?? ""} />
                  <button type="submit" className="rounded border border-line px-2 py-1 text-[11px]">
                    Spara
                  </button>
                </form>
              </details>
            </div>
          </section>
        );
      })}
    </div>
  );
}

/**
 * Avkrypteringen sker i en egen komponent så att ett fel — fel nyckel, ändrad
 * data — blir en rad text i stället för en kraschad sida.
 */
function Losen({ paket }: { paket: string }) {
  try {
    return <Kopiera varde={avkryptera(paket)} etikett="lösenord" />;
  } catch {
    return (
      <p className="text-[11px] text-live">
        Lösenordet går inte att avkryptera. Har VAULT_KEY bytts ut?
      </p>
    );
  }
}

function Totp({ paket }: { paket: string }) {
  try {
    const uri = avkryptera(paket);
    return <TotpKod kod={totpKod(uri)} sekunder={totpSekunderKvar(uri)} />;
  } catch {
    return <p className="text-[11px] text-live">2FA-nyckeln går inte att läsa.</p>;
  }
}

function Falt({
  namn,
  etikett,
  varde,
  typ = "text",
}: {
  namn: string;
  etikett: string;
  varde?: string;
  typ?: string;
}) {
  return (
    <label className="block">
      <span className="text-[10px] text-muted">{etikett}</span>
      <input
        name={namn}
        type={typ}
        defaultValue={varde}
        autoComplete="off"
        className="mt-0.5 w-full rounded border border-line bg-surface px-2 py-1 text-[12px] outline-none focus:border-accent/60"
      />
    </label>
  );
}

function PinLucka() {
  return (
    <form
      action={async (fd: FormData) => {
        "use server";
        await lasUpp(fd);
      }}
      className="mx-auto mt-10 max-w-xs rounded-lg border border-line bg-surface/40 px-4 py-6 text-center"
    >
      <h1 className="text-[15px] font-semibold tracking-tight">Valvet är låst</h1>
      <p className="mt-1 text-[12px] text-muted">Upplåsningen gäller i en timme.</p>
      <input
        name="pin"
        inputMode="numeric"
        autoFocus
        className="mt-4 w-full rounded-lg border border-line bg-surface px-3 py-2 text-center text-[18px] tracking-[0.4em] outline-none focus:border-accent/60"
      />
      <button type="submit" className="mt-3 w-full rounded-lg bg-accent px-4 py-2 text-[13px] font-medium text-ink">
        Lås upp
      </button>
    </form>
  );
}
