"""O tempo à hora do jogo, pela open-meteo. Grátis e sem chave.

Duas chamadas encadeadas: a cidade vira coordenadas, as coordenadas viram
previsão para aquela hora. A primeira guarda-se praticamente para sempre
— Lisboa não muda de sítio — e a segunda por meia hora.

Nada disto é essencial: sem resposta, a linha do tempo fica a cinzento no
dossiê e o resto do jogo continua igual.
"""

import json
import time
import urllib.parse
import urllib.request
from typing import Any, Dict, Optional, Tuple

GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search"
FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
REQUEST_TIMEOUT = 10

CITY_TTL = 30 * 24 * 60 * 60
FORECAST_TTL = 30 * 60

# A previsão só existe para uns dias à frente, e pedir para lá disso é
# gastar tempo para receber nada.
MAX_DAYS_AHEAD = 10

_cache: Dict[str, Tuple[float, Any]] = {}


def forget() -> None:
    _cache.clear()


def _cached(key: str, ttl: int) -> Optional[Any]:
    entry = _cache.get(key)
    if not entry:
        return None
    stored_at, value = entry
    if time.time() - stored_at > ttl:
        _cache.pop(key, None)
        return None
    return value


def _get(url: str) -> Dict[str, Any]:
    with urllib.request.urlopen(url, timeout=REQUEST_TIMEOUT) as response:
        payload = json.loads(response.read().decode("utf-8"))
    if not isinstance(payload, dict):
        raise RuntimeError("resposta inesperada")
    return payload


def coordinates(city: str) -> Optional[Tuple[float, float]]:
    if not city or not city.strip():
        return None

    key = f"city:{city.strip().lower()}"
    remembered = _cached(key, CITY_TTL)
    if remembered is not None:
        return tuple(remembered) if remembered else None

    params = urllib.parse.urlencode({"name": city.strip(), "count": 1})
    try:
        payload = _get(f"{GEOCODE_URL}?{params}")
    except Exception:
        return None

    results = payload.get("results")
    if not isinstance(results, list) or not results:
        # Guardado como "não há": uma cidade que eles não conhecem não
        # passa a conhecer-se por se perguntar outra vez.
        _store(key, [])
        return None

    first = results[0]
    lat, lon = first.get("latitude"), first.get("longitude")
    if lat is None or lon is None:
        _store(key, [])
        return None

    _store(key, [lat, lon])
    return (lat, lon)


def _store(key: str, value: Any) -> None:
    _cache[key] = (time.time(), value)


# O código deles para o que está a cair, dito em português.
CONDITIONS = {
    0: "céu limpo",
    1: "pouco nublado",
    2: "nublado",
    3: "encoberto",
    45: "nevoeiro",
    48: "nevoeiro gelado",
    51: "chuvisco fraco",
    53: "chuvisco",
    55: "chuvisco forte",
    61: "chuva fraca",
    63: "chuva",
    65: "chuva forte",
    71: "neve fraca",
    73: "neve",
    75: "neve forte",
    80: "aguaceiros",
    81: "aguaceiros fortes",
    82: "aguaceiros muito fortes",
    95: "trovoada",
    96: "trovoada com granizo",
    99: "trovoada com granizo",
}


def at_kickoff(city: str, kickoff_iso: str) -> Optional[Dict[str, Any]]:
    """O tempo naquela cidade àquela hora, ou nada."""
    if not kickoff_iso:
        return None

    try:
        hour = kickoff_iso[:13]  # AAAA-MM-DDTHH
        stamp = time.strptime(hour, "%Y-%m-%dT%H")
    except (ValueError, TypeError):
        return None

    ahead = (time.mktime(stamp) - time.time()) / 86400
    if ahead > MAX_DAYS_AHEAD or ahead < -1:
        return None

    where = coordinates(city)
    if not where:
        return None

    key = f"forecast:{where[0]},{where[1]}:{hour}"
    remembered = _cached(key, FORECAST_TTL)
    if remembered is not None:
        return remembered or None

    params = urllib.parse.urlencode(
        {
            "latitude": where[0],
            "longitude": where[1],
            "hourly": "temperature_2m,precipitation,wind_speed_10m,weather_code",
            "forecast_days": 16,
        }
    )
    try:
        payload = _get(f"{FORECAST_URL}?{params}")
    except Exception:
        return None

    hourly = payload.get("hourly") or {}
    times = hourly.get("time")
    if not isinstance(times, list):
        return None

    try:
        index = next(i for i, moment in enumerate(times) if moment.startswith(hour))
    except StopIteration:
        _store(key, {})
        return None

    def pick(field):
        values = hourly.get(field)
        return values[index] if isinstance(values, list) and index < len(values) else None

    code = pick("weather_code")
    answer = {
        "temperature_c": pick("temperature_2m"),
        "precipitation_mm": pick("precipitation"),
        "wind_kmh": pick("wind_speed_10m"),
        "condition": CONDITIONS.get(code, "sem descrição") if code is not None else None,
    }
    _store(key, answer)
    return answer
