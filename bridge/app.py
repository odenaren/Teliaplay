"""
Hembryggan — det som gör att en knapp i webbläsaren startar bild på Apple TV:n.

Varför den behövs: Apple TV pratar bara med enheter på samma nätverk, och
appen ligger på Railway. Något hemma måste ta emot kommandot och föra det
vidare. Det här är det något: ett par hundra rader kring pyatv.

Vad den INTE gör: den hämtar ingen video, avkodar ingenting och rör ingen
DRM. Den skickar en länk till tvOS, precis som när du delar en länk från
telefonen till tv:n. All uppspelning sker i tjänsternas egna appar.

Körs på en Raspberry Pi, en NAS, en gammal laptop — vad som helst som är igång
och sitter på samma nät som tv:n. Se README.md i den här mappen.
"""

from __future__ import annotations

import asyncio
import os
import secrets

import pyatv
from pyatv.const import Protocol
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel

APP_SECRET = os.environ.get("BRIDGE_SECRET", "")
ATV_ID = os.environ.get("ATV_ID", "")
ATV_CREDENTIALS = os.environ.get("ATV_CREDENTIALS", "")

app = FastAPI(title="teliaplay-brygga")


class SpelaBegaran(BaseModel):
    deeplink: str
    app: str | None = None
    wake: bool = True


def kontrollera(hemlighet: str | None) -> None:
    """
    Delad hemlighet i stället för riktig autentisering.

    Bryggan sitter bakom en tunnel och har exakt en användare. Ett OAuth-flöde
    här vore att bygga en bankvalvsdörr till ett skjul. Jämförelsen görs ändå i
    konstant tid — en jämförelse som avbryter vid första felaktiga tecknet
    läcker hemligheten en bokstav i taget.
    """
    if not APP_SECRET:
        raise HTTPException(500, "BRIDGE_SECRET är inte satt på bryggan")
    if not hemlighet or not secrets.compare_digest(hemlighet, APP_SECRET):
        raise HTTPException(401, "fel hemlighet")


async def anslut():
    """
    Ansluter till Apple TV:n.

    Uppkopplingen görs per anrop i stället för att hållas öppen. En hållen
    session överlever inte att tv:n sover, att routern startar om eller att
    IP-adressen byts — och felet visar sig då som ett kommando som tyst inte
    händer. Att koppla upp tar en sekund och gör beteendet förutsägbart.
    """
    loop = asyncio.get_running_loop()
    traffar = await pyatv.scan(loop, identifier=ATV_ID or None, timeout=5)
    if not traffar:
        raise HTTPException(503, "hittade ingen Apple TV på nätet")

    konf = traffar[0]
    if ATV_CREDENTIALS:
        # Parkopplingen görs en gång med `atvremote pair`, se README.
        # Utan credentials går det att se enheten men inte styra den.
        konf.set_credentials(Protocol.AirPlay, ATV_CREDENTIALS)
        konf.set_credentials(Protocol.Companion, ATV_CREDENTIALS)

    return await pyatv.connect(konf, loop)


@app.get("/health")
async def health(x_bridge_secret: str | None = Header(default=None)):
    kontrollera(x_bridge_secret)
    try:
        atv = await anslut()
        try:
            return {"ok": True, "device": atv.service.identifier or "Apple TV"}
        finally:
            atv.close()
    except HTTPException:
        raise
    except Exception as err:  # noqa: BLE001
        return {"ok": False, "device": None, "message": str(err)}


@app.post("/play")
async def play(begaran: SpelaBegaran, x_bridge_secret: str | None = Header(default=None)):
    kontrollera(x_bridge_secret)

    atv = await anslut()
    try:
        if begaran.wake:
            # turn_on är en no-op på en redan vaken låda, så det kostar inget
            # att alltid göra det. Att hoppa över det kostar däremot en tryckning
            # på fjärrkontrollen, vilket är precis vad appen ska ta bort.
            try:
                await atv.power.turn_on()
            except Exception:  # noqa: BLE001
                pass

        # launch_app tar både en universallänk och ett bundle-id. Länken är
        # alltid att föredra: den öppnar rätt app OCH navigerar till titeln.
        mal = begaran.deeplink or begaran.app
        if not mal:
            raise HTTPException(400, "varken deeplink eller app angiven")

        await atv.apps.launch_app(mal)
        return {"ok": True, "message": "Startat på Apple TV."}

    except HTTPException:
        raise
    except Exception as err:  # noqa: BLE001
        # Ett fel här ska inte se ut som ett serverfel i appen — knappen
        # faller tillbaka på länken, och meddelandet är det som visas.
        return {"ok": False, "message": f"Apple TV svarade inte: {err}"}
    finally:
        atv.close()


@app.get("/apps")
async def apps(x_bridge_secret: str | None = Header(default=None)):
    """
    Installerade appar med sina bundle-id:n.

    Används för att fylla i `appleTvApp` i content/tjanster.ts — id:n skiljer
    sig mellan länder och uppdateringar, och att gissa dem ger en app som
    öppnar fel sak.
    """
    kontrollera(x_bridge_secret)

    atv = await anslut()
    try:
        installerade = await atv.apps.app_list()
        return {"apps": [{"namn": a.name, "id": a.identifier} for a in installerade]}
    finally:
        atv.close()
