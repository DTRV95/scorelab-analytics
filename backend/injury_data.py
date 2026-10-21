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
