"""Second match-data provider (API-Football free tier) — availability only.

The forecast knows goals and fixtures. What it has never known is who is
actually playing: injuries, suspensions, the referee, the weather. This
module is the first stone of that, and for now it does exactly one thing —
say whether the key is there and whether the provider accepts it.

That is on purpose. A key nobody can confirm is worse than no key: the
dossier on the match page would keep saying "sem fonte ligada" and nobody
could tell whether the source was missing or the plumbing was broken.

Privacy note: the provider's /status answer carries the account holder's
name and email. None of that leaves this module — only the plan, the quota
and whether the key was accepted, which is all anybody needs to know.
"""

import json
import os
import time
import urllib.error
import urllib.request
from typing import Any, Dict, Optional, Tuple

BASE_URL = "https://v3.football.api-sports.io"
REQUEST_TIMEOUT = 15

# As nossas onze competições pelo nome que esta fonte lhes dá.
#
# Por nome e país, e não por um número decorado: um identificador errado
# devolve a liga de outro país sem se queixar, e isso passava despercebido
# até alguém reparar que o Brasileirão tinha nomes italianos. O número sai
# da resposta deles e aparece na sonda, para se conferir.
LEAGUE_NAMES: Dict[str, Tuple[str, str]] = {
    "Liga Portugal": ("Primeira Liga", "Portugal"),
    "Premier League": ("Premier League", "England"),
    "Championship": ("Championship", "England"),
    "La Liga": ("La Liga", "Spain"),
    "Serie A": ("Serie A", "Italy"),
    "Bundesliga": ("Bundesliga", "Germany"),
    "Ligue 1": ("Ligue 1", "France"),
    "Eredivisie": ("Eredivisie", "Netherlands"),
    "Liga dos Campeões": ("UEFA Champions League", "World"),
    "Campeonato da Europa": ("Euro Championship", "World"),
    "Brasileirão": ("Serie A", "Brazil"),
}

# O catálogo deles muda de época a época, não de hora a hora.
LEAGUES_TTL = 24 * 60 * 60

# Fifteen minutes is short enough to see a key appear right after a deploy
# and long enough that a page left open does not spend the day asking. The
# free plan allows a hundred calls a day and injuries are what they are for.
STATUS_TTL = 15 * 60

_cache: Dict[str, Tuple[float, Any]] = {}


def get_api_key() -> str:
    return (os.getenv("API_FOOTBALL_KEY") or "").strip()


def is_configured() -> bool:
    return bool(get_api_key())


def _cached(key: str, ttl: int) -> Optional[Any]:
    entry = _cache.get(key)
    if not entry:
        return None
    stored_at, value = entry
    if time.time() - stored_at > ttl:
        _cache.pop(key, None)
        return None
    return value


def _store(key: str, value: Any) -> None:
    _cache[key] = (time.time(), value)


def forget() -> None:
    """Drop what is remembered — for tests, and for a key just replaced."""
    _cache.clear()


def _request(path: str) -> Dict[str, Any]:
    api_key = get_api_key()
    if not api_key:
        raise RuntimeError("sem chave")

    request = urllib.request.Request(
        f"{BASE_URL}{path}", headers={"x-apisports-key": api_key}
    )
    with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT) as response:
        payload = json.loads(response.read().decode("utf-8"))

    if not isinstance(payload, dict):
        raise RuntimeError("resposta inesperada")
    return payload


def _errors_of(payload: Dict[str, Any]) -> str:
    """What the provider complained about, in one line.

    It answers 200 with an `errors` object rather than a 4xx when the key is
    wrong, so a bad key looks like a success to anything that only reads the
    status code.
    """
    errors = payload.get("errors")
    if isinstance(errors, dict) and errors:
        return "; ".join(str(value) for value in errors.values())
    if isinstance(errors, list) and errors:
        return "; ".join(str(value) for value in errors)
    return ""


def account_status(force: bool = False) -> Dict[str, Any]:
    """Whether the injury source is ready, and how much of today is left.

    Never raises: this is what a page asks in order to show a red light, and
    a red light that crashes the page is no light at all.
    """
    if not is_configured():
        return {
            "configured": False,
            "accepted": False,
            "detail": "Sem chave. Falta a variável API_FOOTBALL_KEY no servidor.",
            "plan": None,
            "requests_today": None,
            "daily_limit": None,
        }

    if not force:
        remembered = _cached("status", STATUS_TTL)
        if remembered is not None:
            return remembered

    try:
        payload = _request("/status")
    except urllib.error.HTTPError as exc:
        answer = {
            "configured": True,
            "accepted": False,
            "detail": (
                "A chave foi recusada pela API-Football."
                if exc.code in (401, 403)
                else f"A API-Football respondeu {exc.code}."
            ),
            "plan": None,
            "requests_today": None,
            "daily_limit": None,
        }
        _store("status", answer)
        return answer
    except Exception:  # network, timeout, malformed JSON
        # Not cached: a passing network blip should not read as a dead key
        # for the next quarter of an hour.
        return {
            "configured": True,
            "accepted": False,
            "detail": "Não foi possível contactar a API-Football.",
            "plan": None,
            "requests_today": None,
            "daily_limit": None,
        }

    complaint = _errors_of(payload)
    if complaint:
        answer = {
            "configured": True,
            "accepted": False,
            "detail": f"A API-Football recusou o pedido: {complaint}",
            "plan": None,
            "requests_today": None,
            "daily_limit": None,
        }
        _store("status", answer)
        return answer

    response = payload.get("response")
    if not isinstance(response, dict):
        answer = {
            "configured": True,
            "accepted": False,
            "detail": "A API-Football respondeu de forma inesperada.",
            "plan": None,
            "requests_today": None,
            "daily_limit": None,
        }
        _store("status", answer)
        return answer

    subscription = response.get("subscription") or {}
    requests = response.get("requests") or {}

    answer = {
        "configured": True,
        "accepted": True,
        "detail": "Ligada.",
        # Deliberately nothing from response["account"]: that block is the
        # name and email of whoever owns the key.
        "plan": subscription.get("plan"),
        "active": bool(subscription.get("active", True)),
        "requests_today": requests.get("current"),
        "daily_limit": requests.get("limit_day"),
    }
    _store("status", answer)
    return answer


def _current_season(entry: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """A época a decorrer, pela palavra deles.

    Com recurso à mais recente quando nenhuma se diz corrente: a seguir a
    uma época acabada e antes de a outra arrancar, nenhuma traz
    `current: true`, e isso não é razão para dizer que a liga não existe.
    """
    seasons = entry.get("seasons")
    if not isinstance(seasons, list) or not seasons:
        return None

    for season in seasons:
        if isinstance(season, dict) and season.get("current"):
            return season

    latest = [s for s in seasons if isinstance(s, dict) and s.get("year")]
    return max(latest, key=lambda s: s["year"]) if latest else None


def league_coverage(force: bool = False) -> Dict[str, Any]:
    """Quais das nossas competições é que esta fonte cobre, e com o quê.

    Uma liga que eles não tenham, ou cuja época corrente o plano gratuito
    não inclua, fica a dizê-lo — para o dossiê do jogo a pôr a cinzento em
    vez de mostrar zero lesionados, que se leria como "estão todos bons".
    """
    if not is_configured():
        return {"configured": False, "leagues": [], "detail": "Sem chave."}

    if not force:
        remembered = _cached("coverage", LEAGUES_TTL)
        if remembered is not None:
            return remembered

    try:
        payload = _request("/leagues")
    except Exception:
        # Sem cache: não vale a pena guardar um dia inteiro de "não sei".
        return {
            "configured": True,
            "leagues": [],
            "detail": "Não foi possível contactar a API-Football.",
        }

    complaint = _errors_of(payload)
    if complaint:
        return {
            "configured": True,
            "leagues": [],
            "detail": f"A API-Football recusou o pedido: {complaint}",
        }

    catalogue = payload.get("response")
    if not isinstance(catalogue, list):
        return {
            "configured": True,
            "leagues": [],
            "detail": "A API-Football respondeu de forma inesperada.",
        }

    index: Dict[Tuple[str, str], Dict[str, Any]] = {}
    for entry in catalogue:
        if not isinstance(entry, dict):
            continue
        league = entry.get("league") or {}
        country = entry.get("country") or {}
        name, land = league.get("name"), country.get("name")
        if isinstance(name, str) and isinstance(land, str):
            index.setdefault((name, land), entry)

    leagues = []
    for ours, (name, land) in sorted(LEAGUE_NAMES.items()):
        entry = index.get((name, land))
        if not entry:
            leagues.append(
                {
                    "scorelab": ours,
                    "found": False,
                    "detail": f"Não há '{name}' ({land}) no catálogo desta fonte.",
                }
            )
            continue

        season = _current_season(entry)
        cover = (season or {}).get("coverage") or {}
        leagues.append(
            {
                "scorelab": ours,
                "found": True,
                "api_id": (entry.get("league") or {}).get("id"),
                "api_name": name,
                "country": land,
                "season": (season or {}).get("year"),
                "season_is_current": bool((season or {}).get("current")),
                "injuries": bool(cover.get("injuries")),
                "odds": bool(cover.get("odds")),
                "detail": "",
            }
        )

    answer = {
        "configured": True,
        "detail": "",
        "with_injuries": sum(1 for row in leagues if row.get("injuries")),
        "total": len(leagues),
        "leagues": leagues,
    }
    _store("coverage", answer)
    return answer
