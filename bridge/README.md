# Hembryggan

Den lilla tjänsten som gör att en knapp i appen startar bild på Apple TV:n.

Appen ligger på Railway. Apple TV pratar bara med enheter på samma nätverk.
Alltså behövs något hemma som tar emot kommandot och för det vidare — den här
mappen. En Raspberry Pi räcker gott; det gör en NAS eller en gammal laptop
också, så länge den är igång och sitter på samma nät som tv:n.

## Vad den inte gör

Den hämtar ingen video, avkodar ingenting och rör ingen DRM. Den skickar en
länk till tvOS, precis som när du delar en länk från telefonen till tv:n. All
uppspelning sker i tjänsternas egna appar, med deras egna inloggningar.

## Installation

```bash
cd bridge
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

## Parkoppling

pyatv behöver credentials för att få styra lådan. Det görs en gång:

```bash
atvremote scan                              # hitta identifieraren
atvremote --id <ID> --protocol airplay pair
atvremote --id <ID> --protocol companion pair
```

Båda protokollen behövs: AirPlay för att väcka, Companion för att öppna appar.
Spara strängarna du får.

## Kör

```bash
export BRIDGE_SECRET="samma-som-i-appens-env"
export ATV_ID="<identifieraren från scan>"
export ATV_CREDENTIALS="<credentials från pair>"

uvicorn app:app --host 0.0.0.0 --port 8787
```

Gör den till en tjänst med systemd så att den överlever en omstart:

```ini
# /etc/systemd/system/teliaplay-brygga.service
[Unit]
Description=Teliaplay-brygga
After=network-online.target

[Service]
WorkingDirectory=/home/pi/bridge
Environment="BRIDGE_SECRET=…" "ATV_ID=…" "ATV_CREDENTIALS=…"
ExecStart=/home/pi/bridge/.venv/bin/uvicorn app:app --host 0.0.0.0 --port 8787
Restart=always

[Install]
WantedBy=multi-user.target
```

## Nå den utifrån

Appen på Railway måste kunna nå bryggan. Öppna INTE en port i routern — lägg en
tunnel emellan:

```bash
cloudflared tunnel --url http://localhost:8787
```

eller Tailscale Funnel om du redan kör Tailscale. Adressen du får sätter du som
`BRIDGE_URL` i appens miljövariabler, och samma `BRIDGE_SECRET` på båda sidor.

Hemligheten är det enda som skyddar bryggan. Den ska vara lång och slumpad:

```bash
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```

## Felsök

```bash
curl -H "X-Bridge-Secret: $BRIDGE_SECRET" localhost:8787/health
curl -H "X-Bridge-Secret: $BRIDGE_SECRET" localhost:8787/apps
```

`/apps` listar installerade appar med sina bundle-id:n. De hör hemma i
`src/content/tjanster.ts` som `appleTvApp` — id:n skiljer sig mellan länder och
uppdateringar, så listan i repot är ett utgångsläge, inte facit.

## Samsung

TV:n (S90D) kan väckas och bytas till rätt HDMI-ingång via dess WebSocket-API.
Det är inte byggt än — Apple TV ger bättre bild och är det du vill spela från.
Biblioteket heter `samsung-tv-ws-api` om du vill lägga till det; notera att
Wake-on-LAN bara fungerar över ethernet, inte wifi.
