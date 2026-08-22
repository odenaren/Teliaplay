import { sql, ensureSchema } from "@/lib/db";

/**
 * Matcherna som kalenderprenumeration.
 *
 * Varför det är värt en egen route: appen kan inte skicka notiser till en
 * telefon utan att du installerar något, men kalendern kan. Prenumererar du på
 * den här adressen i iOS eller Google Kalender dyker matcherna upp där du redan
 * tittar, med kanalen i titeln — och påminnelsen sköter telefonen.
 *
 * Adressen innehåller profil-id:t och är därmed en hemlighet på samma sätt som
 * en delad kalenderlänk brukar vara: den som har den kan läsa dina matcher.
 * Det är rätt avvägning för ett matchschema.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ fil: string }> }) {
  const { fil } = await params;
  const profilId = fil.replace(/\.ics$/, "");

  await ensureSchema();

  const matcher = await sql<
    { id: string; hemma: string; borta: string; start: Date; kanal: string | null }[]
  >`
    select m.id, m.hemma, m.borta, m.start, k.namn as kanal
    from sportmatch m
    left join program p on p.id = m.program_id
    left join kanal k on k.id = p.kanal_id and k.ingar = true
    where m.start > now() - interval '1 day'
      and exists (
        select 1 from favorit f join lag l on l.id = f.ref_id
        where f.profil_id = ${profilId} and f.sort = 'lag'
          and (l.namn = m.hemma or l.namn = m.borta)
      )
    order by m.start
  `;

  const rader = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//teliaplay//matcher//SV",
    "CALSCALE:GREGORIAN",
    "X-WR-CALNAME:Mina matcher",
    // Hur ofta klienten bör hämta om. Utan den frågar iOS ungefär en gång i
    // veckan, och en match som flyttas hinner passera innan du får veta.
    "X-PUBLISHED-TTL:PT2H",
  ];

  for (const m of matcher) {
    const slut = new Date(m.start.getTime() + 105 * 60_000);
    rader.push(
      "BEGIN:VEVENT",
      `UID:${m.id}@teliaplay`,
      `DTSTAMP:${ics(new Date())}`,
      `DTSTART:${ics(m.start)}`,
      `DTEND:${ics(slut)}`,
      `SUMMARY:${esc(`${m.hemma} – ${m.borta}${m.kanal ? ` (${m.kanal})` : ""}`)}`,
      `DESCRIPTION:${esc(m.kanal ? `Sänds på ${m.kanal}. Ingår i ditt paket.` : "Ingen sändning hittad på det du har.")}`,
      // Påminnelse en kvart före, i klienten. Det är den notis appen själv
      // inte kan skicka.
      "BEGIN:VALARM",
      "TRIGGER:-PT15M",
      "ACTION:DISPLAY",
      "DESCRIPTION:Matchen börjar snart",
      "END:VALARM",
      "END:VEVENT",
    );
  }

  rader.push("END:VCALENDAR");

  return new Response(rader.join("\r\n"), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "public, max-age=900",
    },
  });
}

function ics(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** Kommatecken och semikolon är fältavgränsare i ICS och måste escapas. */
function esc(s: string): string {
  return s.replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");
}
