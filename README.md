# Vad ingår

Allt som faktiskt ingår i Telia Play-paketet, på ett ställe. Och — viktigare —
ingenting annat.

Byggd efter samma mönster som [TI](https://github.com/odenaren/TI).

---

## Vad appen löser

Ett Telia Play-paket är egentligen ett knippe andra tjänster: Viaplay, HBO Max,
Disney+, TV4 Play, Prime, SkyShowtime, plus ett trettiotal kanaler. Ingen av
dem vet vad du betalat för. Telias egen app tipsar om sport som inte ingår,
Viaplay marknadsför filmpaketet du inte har, och resultatet är att du inte vet
vad du får titta på.

Den här appen vänder på det. Den vet vad som ingår, och visar bara det.

**Ingår-filtret** är hela produkten. Allt innehåll måste kunna peka på en
tjänst eller kanal du betalar för. Saknas beviset visas posten inte alls —
inte gråad, inte med hänglås, inte "uppgradera för att se". Borta.

Regeln ligger i `lib/entitlement.ts` och i SQL-frågornas `where`-villkor, och
den kontrolleras maskinellt av `npm run check:ingar`. Faller en enda post är
utfallet rött. Det är en regel som inte går att upprätthålla med ögat: den
gäller på trettio ställen, och räcker till tills någon lägger till ett block en
tisdagskväll.

Det enda undantaget är sportsidans lista över matcher **utan** sändning. Där är
poängen att visa ett nej — "din match sänds inte på något du har" är ett svar du
behöver, till skillnad från ett tips om en film du inte kan se.

## Sidor

| Sida | Innehåll |
| --- | --- |
| `/` | Startsidan, block du själv väljer och sorterar |
| `/sport` | Favoritlagens matcher med kanal, krockvarning, all sport i tablån |
| `/tabla` | Tv-tablå tre dagar framåt, bara kanaler som ingår |
| `/film` | Nytt i paketet och Sista chansen |
| `/sok` | En sökruta över allt inkluderat, plus ingår-vakten |
| `/ingar` | Vad som ingår, och varifrån den uppgiften kommer |
| `/valv` | Inloggningar, 2FA-koder och återställningslänkar |
| `/kallor` | Hämtningens hälsa, bryggans status, attribution |
| `/installningar` | Startsidans block, profilerna |

---

## Kom igång

```bash
npm install
cp .env.example .env      # fyll i DATABASE_URL
npm run db:check          # granskar anslutningen och rapporterar fel på svenska
npm run dev
```

Första gången: skapa en profil, gå till `/ingar` och kryssa i vad som ingår.
Appen visar ingenting förrän den vet det — det är avsiktligt.

### Databas

Vilken Postgres som helst duger. **Neon** rekommenderas: gratisplanen tillåter
100 projekt. Välj *Pooled connection*-strängen.

TLS slås på automatiskt utom mot localhost och `*.railway.internal`.

Klistra in strängen precis som den står. Parametrar som bara betyder något för
libpq — `channel_binding`, `sslcert` och deras släktingar — stryks av
`stadaUrl()` i `lib/db.ts` innan drivrutinen får strängen. Utan den strykningen
skickas de vidare som startup-parametrar och Postgres stänger anslutningen med
"unrecognized configuration parameter", vilket ser ut som ett TLS- eller
lösenordsfel och felsöks som ett sådant i en timme. Neon lägger med
`channel_binding` i strängen man kopierar ur panelen.

> `.env.local` har **högre prioritet** än `.env` i Next. Har du båda är det
> `.env.local` som gäller.

### Drift

En enda Railway-tjänst räcker. Schemaläggaren startar med servern via
`instrumentation.ts` — ingen separat cron-tjänst behövs.

| Vad | Hur ofta | Varför |
| --- | --- | --- |
| Tablå, sport, matchning | var 20:e minut | sport drar över tiden och skjuter kvällen framåt |
| Film- och seriekatalog | en gång per dygn, ~05:00 | JustWatch gör EN export per dygn — oftare ger inget |

**Kör bara EN instans.** Två repliker betyder två schemaläggare.

#### Variabler i Railway

Railway läser ingen `.env` — allt måste in under *Variables* på tjänsten. Det
minsta som behövs för att appen ska starta är två rader:

| Variabel | Värde |
| --- | --- |
| `DATABASE_URL` | Neons pooled-sträng, eller `${{Postgres.DATABASE_URL}}` om databasen ligger i samma projekt |
| `INGEST_SECRET` | `node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"` |

Med bara de två fungerar tablå och sport. Resten låser upp en funktion var, och
appen säger själv till på `/kallor` när något saknas:

| Variabel | Utan den |
| --- | --- |
| `TMDB_API_KEY` | ingen film- och seriekatalog — `/film` står tom. Ta *API Key* (32 tecken), inte *Read Access Token* |
| `TELIA_USERNAME`, `TELIA_PASSWORD` | kanallistan kryssas i för hand på `/ingar` |
| `VAULT_KEY` (`npm run vault:key`) | `/valv` sparar inga lösenord, bara återställningslänkar |
| `BRIDGE_URL`, `BRIDGE_SECRET` | Spela-knappen blir en länk i stället för en start på tv:n |
| `SPORTSDB_KEY` | faller tillbaka på testnyckeln `3`, vilket räcker för ett hushåll |

`PORT` sätter Railway själv — skriv inte över den. `VAULT_KEY` går inte att byta
i efterhand utan att allt sparat i valvet blir obrukbart.

Efter första deployen: öppna `/ingar` och kryssa i vad som ingår. Innan appen
vet det visar den ingenting, och det är inte ett fel.

---

## Vad som ingår, och varifrån appen vet det

Två vägar, och den ena är inte en nödlösning för den andra.

**Manuellt.** Du kryssar i tjänster och kanaler på `/ingar`. Tar tio minuter en
gång. Går aldrig sönder.

**Från Telia.** Med `TELIA_USERNAME` och `TELIA_PASSWORD` i `.env` loggar appen
in mot Telias eget API och hämtar exakt vilka kanaler ditt abonnemang ger:

```
authenticate → oauth/token → provision → pubsub → engagementinfo
```

Det sista svaret är facit. Kedjan är kartlagd av Kodi-tillägget
`plugin.video.teliaplay`. Testa den med `npm run telia:login`.

Tre saker att veta:

- API:et är **inte publikt**. Det används här med dina egna uppgifter för ditt
  eget abonnemang, för att visa dig vad du redan betalar för. Det hämtar inga
  strömmar och kringgår inget kopieringsskydd.
- Det **kommer att gå sönder**. Inte kanske — när Telia ändrar något. Därför är
  varje fel ofarligt: hämtningen loggas som misslyckad, den manuella listan står
  kvar orörd, och `/ingar` visar hur gammal uppgiften är. Är den över en vecka
  gammal säger startsidan till.
- Lösenordet **loggas aldrig**, varken i klartext eller som del av en URL i ett
  felmeddelande. Se `snalltFel()` i `lib/sources/telia.ts`.

Rena streamingtjänster utan kanaler — HBO Max, Disney+, Prime, SkyShowtime —
syns inte i Telias kanalregister alls och måste kryssas i för hand. Det är en
begränsning i deras API, och `/ingar` säger det rakt ut i stället för att låtsas
att listan är komplett.

---

## Att starta på tv:n

Allt i paketet är Widevine-skyddat och rättigheterna ligger hos varje tjänst.
Att spela upp strömmarna i en egen sida går inte att göra lagligt, och det är
inte värt att försöka.

Det appen gör i stället är att ta bort varje steg mellan "jag vill se det här"
och bild på tv:n:

1. Du trycker **Spela**.
2. Railway-appen skickar kommandot till pyatv-bryggan hemma.
3. Bryggan väcker Apple TV:n, öppnar rätt app och djuplänkar till titeln.

Utan brygga blir knappen en vanlig länk i stället. Aldrig en död knapp — se
`components/SpelaKnapp.tsx`.

Bryggan ligger i `bridge/` med egen README: en FastAPI-tjänst kring pyatv som
körs på en Pi, en NAS eller en gammal dator på hemnätet, och nås från Railway
genom en Cloudflare- eller Tailscale-tunnel.

Djuplänkarna har tre precisionsnivåer och appen använder alltid den bästa den
kan: direkt till titeln, till tjänstens sök med namnet ifyllt, eller till
startsidan. Att hoppa över mellannivån vore lätt och dumt — skillnaden mellan
"öppna Viaplay" och "öppna Viaplay med matchen redan sökt" är hela avståndet
mellan att orka och att inte orka.

---

## Valvet

Apple TV loggar ut dig ur Viaplay en gång i halvåret, alltid vid en matchstart,
och lösenordet ligger i ett mejl från 2023 eller i huvudet på din kompis.

`/valv` samlar allt som behövs för att komma in igen: vem som äger kontot,
vilken mejl, lösenordet bakom en kopieringsknapp, en färsk 2FA-kod, och länken
till "glömt lösenord" när inget av det hjälper.

Nyckeln uppe till höger, bredvid profilväxeln, går dit från vilken sida som
helst. Sidan låg först bara under Inställningar, vilket är fel ställe för något
man behöver i exakt det läge man står framför tv:n med en match som redan
börjat.

- **AES-256-GCM**, nyckeln i `VAULT_KEY` och ingen annanstans. En databasdump
  utan nyckeln är obrukbar.
- Egen slumpad IV per hemlighet. Att återanvända en IV i GCM är inte en
  skönhetsfläck utan ett haveri.
- **TOTP** enligt RFC 6238, verifierad mot standardens testvektorer. Hemligheten
  lämnar aldrig servern; klienten får koden och en nedräkning.
- PIN-lås per profil, upplåsning i en timme.

Vill du inte lagra lösenord alls: hoppa över `VAULT_KEY`. Återställningslänkarna
och kontoöversikten fungerar ändå.

---

## Skript

| Kommando | Gör |
| --- | --- |
| `npm run probe` | Pingar varje källa och **skriver ut svaret** — kör det först |
| `npm run dry-run` | Hela hämtkedjan mot riktiga källor **utan databas** |
| `npm run check:ingar` | Ingår-testet: verifierar att inget otillåtet skulle visas |
| `npm run db:check` | Granskar anslutningen och kontrollerar att tabellerna finns |
| `npm run telia:login` | Provar Telia-inloggningen, listar vad som ingår |
| `npm run ingest` | Triggar en hämtning mot en körande server |
| `npm run bridge:test` | Pingar bryggan, listar appar på Apple TV:n |
| `npm run vault:key` | Genererar en VAULT_KEY |
| `npm run lab` | **Kör hela appen mot en riktig databas med provdata och tar skärmbilder** |

`dry-run` och `check:ingar` importerar appens **riktiga** moduler via en
alias-loader, inte kopior av dem. Ett testskript som duplicerar parsningen
testar sina egna regler och driver isär vid första ändring.

### Labbet

```bash
npm run lab              # bygger, startar, skärmbilder till lab-bilder/
npm run lab -- --hall    # samma, men servern står kvar så du kan klicka själv
npm run lab -- --sida=bladdra   # bara en sida
```

Appen skrevs länge utan att någon sett den köra. Källorna går inte att nå från
utvecklingsmiljön och en databas fanns inte heller, så gränssnittet
kontrollerades genom att läsa koden. Det höll ungefär så länge man kan tro: två
av de fel som till slut hittades — en lista med bara program på F, en lagväljare
som gav engelska lag oavsett liga — syntes inte i koden alls. De syntes på
skärmen.

Labbet startar **PGlite**, en riktig Postgres kompilerad till wasm som talar
samma nätverksprotokoll, fyller den med provdata, bygger appen, startar den och
går igenom sidorna med Playwright. Inget mockas: samma `ensureSchema()`, samma
frågor, samma `postgres.js`. Sidor som svarar 500 skriver ut serverns
stacktrace i stället för att bli en skärmbild av en felruta.

Provdatan i `scripts/lab/fixtures.mjs` är avsiktligt obekväm — en titel utan
affisch, ett namn som måste brytas på två rader, två matcher som krockar, ett
block utan innehåll. Ett labb med prydlig data visar bara att prydlig data ser
prydlig ut.

Affischadresserna pekar på riktiga värdar som inte går att nå härifrån.
Playwright svarar i deras ställe med en genererad ruta i rätt proportion, så
att en trasig bildlänk syns som trasig i stället för att drunkna i att allt är
trasigt.

En sak stämmer inte med driften: PGlites socketserver betjänar en anslutning i
taget, så labbet kör med `DB_POOL_MAX=1`. Mot Neon eller Railway gäller inte
den begränsningen.

### Kör `npm run probe` innan du litar på tablån

Adaptrarna mot tv.nu och TheSportsDB är skrivna mot dokumenterade svarsformat,
inte mot svar som körts i maskinen där de skrevs — nätverket där appen byggdes
släppte inte igenom någon av dem. Parsningen är därför medvetet tolerant: den
letar efter varje fält på flera rimliga platser i stället för att kräva en exakt
form. `probe` skriver ut det faktiska svaret så att du kan rätta en felgissad
fältplacering på fem minuter.

Telia-kedjan har samma förbehåll och testas med `npm run telia:login`, och
SVT-kedjan med `npm run probe -- svtplay`.

### Spaning mot källor appen ännu inte använder

```bash
npm run probe -- tvnu-streaming   # finns tillgänglighet per titel hos tv.nu?
npm run probe -- tvmatchen        # sport med kanal, inklusive strömmar
```

De körs bara när de namnges och testar inte appen — de undersöker sajter vi
överväger att bygga mot, och skriver ut rådata. Två saker är värda att veta
innan man bygger vidare på dem:

**tv.nu visar var en titel går att streama**, inte bara när den går på tv. Det är
samma fråga som TMDB/JustWatch besvarar, men med svenska marknaden som
utgångspunkt i stället för som ett bihang — och utan dygnsfördröjningen.

**tvmatchen.nu kopplar match till kanal direkt**, inklusive strömmar utan linjär
kanal. Det är exakt den lucka `lib/match.ts` fyller genom att gissa på lagnamn i
en programtitel. En källa som redan gjort kopplingen vore bättre än en heuristik.
De har inga publicerade API-villkor — fråga dem (kontakt@tvmatchen.nu) innan
något byggs in.

---

## Källor

| Vad | Källa |
| --- | --- |
| Vad som ingår | Telias eget API, med dina uppgifter |
| Tv-tablå | `web-api.tv.nu` — samma endpoints som `iptv-org/epg` använder |
| Film och serier | TMDB, tillgänglighetsdata från **JustWatch** |
| SVT Play | SVT:s eget GraphQL-API, `api.svt.se/contento/graphql` |
| Matcher och lag | TheSportsDB |

Attributionen på `/kallor` är inget att ta bort: TMDB drar in nyckeln om
JustWatch inte anges som källa.

Vilken kanal som sänder en match räknas fram ur tablån, inte hämtas från
TheSportsDB — deras tv-uppgifter är crowdsourcade och ofta amerikanska, och en
felaktig kanaluppgift är värre än ingen alls i just den här appen.

Tablådatan stannar i din installation. Den republiceras inte.

---

## SVT Play

SVT ligger i `ALLTID_INGAR` och kryssas aldrig i på `/ingar`. Public service
finansieras via skatten, och att kräva att du bockar för något du redan betalat
för vore att låtsas att appen inte vet något den vet.

Katalogen hämtas från **SVT:s eget GraphQL-API**, inte via TMDB. Skälet är att
SVT Play till stor del är svenskt egenproducerat — dokumentärer, Uppdrag
granskning, SVT:s dramaserier — och sådant är tunt eller frånvarande i TMDB,
vars tillgänglighetsdata dessutom är en dygnsgammal JustWatch-export. SVT vet
själva vad som ligger uppe, och säger det gratis och samma dag.

Servern använder *persisted queries*: i stället för en hel fråga skickas en
sha256-hash som pekar ut en fråga servern redan känner till. Hasharna i
`lib/sources/svtplay.ts` kommer ur SVT:s egen webbklient. Ändrar SVT sina
frågor svarar servern `PersistedQueryNotFound`, och då behöver hasharna
uppdateras — adaptern säger det rakt ut i felmeddelandet i stället för att
returnera tomt.

Tre urval hämtas vid varje körning, hela A–Ö-listan bara vid den dygnsvisa:

| Urval | Blir |
| --- | --- |
| `latest_start` | Nytt i paketet |
| `popular_start` | katalogens botten |
| `lastchance_start` | **Sista chansen, på riktigt** |
| A–Ö (full körning) | sökbarhet — tusentals program utan bilder |

Det sista är en verklig vinst. För de kommersiella tjänsterna är "Sista chansen"
en gissning: en titel som slutat dyka upp i katalogen antas vara på väg bort.
SVT säger det rakt ut. Därför får deras titlar en egen flagga
(`tillganglig.sista_chansen`) i stället för att köras genom heuristiken, och
`/film` skriver ut vilket av de två man tittar på. En officiell uppgift och en
kvalificerad chansning ska inte se likadana ut för läsaren.

SVT ger också titelns riktiga adress, som sparas i `titel.extern_url`. En färdig
adress från källan slår alltid ett mönster vi byggt själva — se `lib/deeplink.ts`.

---

## Arkitektur

```
Next.js 15 (App Router, TypeScript) + Tailwind v4
Postgres via postgres.js
Railway — en tjänst, schemaläggare i instrumentation.ts
pyatv-brygga hemma, nås via tunnel
```

```
src/content/   tjanster.ts, kanaler.ts, ligor.ts, block.ts   redaktionellt, i git
src/lib/       db.ts, entitlement.ts, ingest.ts, queries.ts, profil.ts,
               match.ts, deeplink.ts, vault.ts, bridge.ts, time.ts, scheduler.ts
src/lib/sources/  telia.ts, tvnu.ts, tmdb.ts, sportsdb.ts
src/app/       page.tsx, /sport, /tabla, /film, /sok, /ingar, /valv,
               /kallor, /installningar, /kalender/[fil]
bridge/        pyatv-bryggan, egen README
```

### Kanalerna gissas inte

`content/kanaler.ts` innehåller kanalnamn och alias, **inte** tv.nu:s interna
id:n. Vid hämtningen matchas namnen mot tv.nu:s egen lista med normaliserad
jämförelse, och kanaler som inte hittar sin motsvarighet listas på `/ingar` med
en ruta där du kopplar dem en gång.

Skillnaden mot att hårdkoda en slug: en slug som slutar gälla ger en tom
tablårad utan förklaring. En misslyckad namnmatchning ger en rad på `/ingar` som
säger exakt vad som fattas.

### Schemat

`ensureSchema()` körs **sats för sats**, och anropas från läsvägarna också.
Kommentarerna stryks **före** uppdelningen på semikolon — en kommentar som
innehåller ett semikolon delar annars satsen mitt itu, och tabellen som inte
skapades märks först när en fråga mot den kastar. Det felet fanns här i en
timme och kostade en tabell.

Alla `alter table add column` ligger före indexen.

### Brytare i tablåhämtningen

Trettio kanaler gånger tre dagar är nittio anrop med backoff. Är tv.nu nere
kostar det över en minut att misslyckas nittio gånger i rad — varje kvart, mot
en tjänst som redan har problem. Fem misslyckanden i följd betyder att källan är
nere, inte att just den kanalen strular, och då avbryts steget med besked.
Mätt: 72 sekunder blev 3.

---

## Profiler

Två personer, ingen inloggning. En cookie pekar ut vald profil och en växel
ligger i toppen.

Det är avsiktligt att den som har adressen kan byta profil. Ett riktigt
inloggningsflöde vore fel verktyg för två kompisar som delar ett tv-paket, och
skulle mest göra att ingen orkar öppna appen. Det enda som faktiskt är låst är
valvet.

Per profil: favoriter, favoritlag, startsidans block, sparat och sett.

---

## Inte byggt, men förberett

- **Samsung S90D-styrning.** Bryggan kan väcka tv:n och byta HDMI-ingång via
  `samsung-tv-ws-api`. Apple TV ger bättre bild och är det du vill spela från,
  så det ligger sist. Wake-on-LAN fungerar bara över ethernet, inte wifi.
- **Push-notiser.** Kalenderflödet (`/kalender/<profil>.ics`) löser samma sak
  utan att något behöver installeras: matcherna hamnar i telefonens kalender med
  kanalen i titeln och en påminnelse femton minuter före.
- **Kostnadsvyn.** `sett`-tabellen fyller redan på med en rad per start per
  tjänst. Underlaget finns; vyn som visar vad ni faktiskt använder per månad
  är inte byggd.
- **Strömmande sport utan linjär kanal.** Viaplay-only-strömmar syns inte i
  någon tablå. `sportmatch.tjanst_id` finns för att kunna peka ut dem för hand.
