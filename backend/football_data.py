"""Optional match-data provider (football-data.org, free tier).

Best-effort by design: without an API key, or when the provider is unreachable,
every helper raises ProviderUnavailable and the app falls back to manual entry.
Only the competitions in SUPPORTED_LEAGUES offer auto-fill; every other ScoreLab
league keeps working exactly as before, filled by hand.

Quota strategy: one request per competition returns the whole season's matches.
Team splits, recent form and league averages are all computed locally from those
results, so a competition costs one request per cache window no matter how many
analyses are run against it.
"""

import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Dict, List, Optional, Tuple

BASE_URL = "https://api.football-data.org/v4"
REQUEST_TIMEOUT = 20
MATCHES_TTL = 6 * 60 * 60
RECENT_WINDOW = 5
MIN_LEAGUE_SAMPLE = 20

# ScoreLab league key -> football-data.org competition code (free tier only).
SUPPORTED_LEAGUES: Dict[str, str] = {
    "Liga Portugal": "PPL",
    "Premier League": "PL",
    "Championship": "ELC",
    "La Liga": "PD",
    "Serie A": "SA",
    "Bundesliga": "BL1",
    "Ligue 1": "FL1",
    "Eredivisie": "DED",
}

FINISHED_STATUSES = {"FINISHED", "AWARDED"}
UPCOMING_STATUSES = {"SCHEDULED", "TIMED"}


class ProviderUnavailable(Exception):
    """Raised whenever live data cannot be served; callers fall back to manual."""


_cache: Dict[str, Tuple[float, Any]] = {}


def get_api_key() -> str:
    return (os.getenv("FOOTBALL_DATA_KEY") or "").strip()


def is_configured() -> bool:
    return bool(get_api_key())


def supported_leagues() -> List[str]:
    return sorted(SUPPORTED_LEAGUES.keys())


def _cache_get(key: str, ttl: int) -> Optional[Any]:
    entry = _cache.get(key)
    if not entry:
        return None
    stored_at, value = entry
    if time.time() - stored_at > ttl:
        _cache.pop(key, None)
        return None
    return value


def _cache_put(key: str, value: Any) -> None:
    _cache[key] = (time.time(), value)


def _competition_code(league_key: str) -> str:
    code = SUPPORTED_LEAGUES.get(league_key)
    if not code:
        raise ProviderUnavailable(
            f"'{league_key}' não tem dados automáticos gratuitos. "
            "Preenche os dados desta liga manualmente."
        )
    return code


def _request(path: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    api_key = get_api_key()
    if not api_key:
        raise ProviderUnavailable("Fonte de dados não configurada.")

    url = f"{BASE_URL}{path}"
    if params:
        url = f"{url}?{urllib.parse.urlencode(params)}"

    request = urllib.request.Request(url, headers={"X-Auth-Token": api_key})

    try:
        with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        if exc.code == 429:
            raise ProviderUnavailable(
                "Demasiados pedidos à fonte de dados. Tenta novamente daqui a um minuto."
            ) from exc
        if exc.code in (401, 403):
            raise ProviderUnavailable(
                "A chave da fonte de dados foi recusada ou esta competição não está "
                "incluída no plano gratuito."
            ) from exc
        raise ProviderUnavailable(f"Fonte de dados respondeu {exc.code}.") from exc
    except Exception as exc:  # network, timeout, malformed JSON
        raise ProviderUnavailable("Não foi possível contactar a fonte de dados.") from exc

    if not isinstance(payload, dict):
        raise ProviderUnavailable("Resposta inesperada da fonte de dados.")

    return payload


def get_season_matches(league_key: str) -> List[Dict[str, Any]]:
    code = _competition_code(league_key)
    cache_key = f"matches:{code}"

    cached = _cache_get(cache_key, MATCHES_TTL)
    if cached is not None:
        return cached

    payload = _request(f"/competitions/{code}/matches")
    matches = payload.get("matches")
    if not isinstance(matches, list):
        raise ProviderUnavailable("Resposta sem jogos para esta competição.")

    _cache_put(cache_key, matches)
    return matches


def _full_time_goals(match: Dict[str, Any]) -> Tuple[Optional[int], Optional[int]]:
    full_time = (match.get("score") or {}).get("fullTime") or {}
    return full_time.get("home"), full_time.get("away")


def _is_finished(match: Dict[str, Any]) -> bool:
    return match.get("status") in FINISHED_STATUSES


def upcoming_fixtures(league_key: str, limit: int = 40) -> List[Dict[str, Any]]:
    matches = get_season_matches(league_key)

    fixtures = []
    for match in matches:
        if match.get("status") not in UPCOMING_STATUSES:
            continue
        home = match.get("homeTeam") or {}
        away = match.get("awayTeam") or {}
        if not home.get("id") or not away.get("id"):
            continue
        fixtures.append(
            {
                "fixture_id": match.get("id"),
                "kickoff": match.get("utcDate"),
                "matchday": match.get("matchday"),
                "home_id": home.get("id"),
                "home_name": home.get("shortName") or home.get("name"),
                "away_id": away.get("id"),
                "away_name": away.get("shortName") or away.get("name"),
            }
        )

    fixtures.sort(key=lambda item: item.get("kickoff") or "")
    return fixtures[:limit]


def _team_side_record(
    matches: List[Dict[str, Any]], team_id: int, side: str
) -> Dict[str, int]:
    """Season and recent goal record for a team, restricted to home or away games."""
    key = "homeTeam" if side == "home" else "awayTeam"

    played = []
    for match in matches:
        if not _is_finished(match):
            continue
        if (match.get(key) or {}).get("id") != team_id:
            continue
        home_goals, away_goals = _full_time_goals(match)
        if home_goals is None or away_goals is None:
            continue
        scored, conceded = (
            (home_goals, away_goals) if side == "home" else (away_goals, home_goals)
        )
        played.append(
            {
                "date": match.get("utcDate") or "",
                "scored": scored,
                "conceded": conceded,
            }
        )

    played.sort(key=lambda item: item["date"])
    recent = played[-RECENT_WINDOW:]

    return {
        "games": len(played),
        "scored": sum(item["scored"] for item in played),
        "conceded": sum(item["conceded"] for item in played),
        "recent_games": len(recent),
        "recent_scored": sum(item["scored"] for item in recent),
        "recent_conceded": sum(item["conceded"] for item in recent),
    }


def league_goal_averages(matches: List[Dict[str, Any]]) -> Dict[str, float]:
    played = 0
    home_goals = 0
    away_goals = 0

    for match in matches:
        if not _is_finished(match):
            continue
        home, away = _full_time_goals(match)
        if home is None or away is None:
            continue
        played += 1
        home_goals += home
        away_goals += away

    if played < MIN_LEAGUE_SAMPLE:
        return {}

    return {
        "league_home_goals_avg": round(home_goals / played, 2),
        "league_away_goals_avg": round(away_goals / played, 2),
        "sample_matches": played,
    }


def build_prefill(league_key: str, fixture_id: int) -> Dict[str, Any]:
    matches = get_season_matches(league_key)

    target = next(
        (match for match in matches if match.get("id") == fixture_id), None
    )
    if not target:
        raise ProviderUnavailable("Jogo não encontrado nesta competição.")

    home_team = target.get("homeTeam") or {}
    away_team = target.get("awayTeam") or {}
    home_id = home_team.get("id")
    away_id = away_team.get("id")
    if not home_id or not away_id:
        raise ProviderUnavailable("Jogo sem equipas identificadas.")

    home = _team_side_record(matches, home_id, "home")
    away = _team_side_record(matches, away_id, "away")

    if home["games"] == 0 and away["games"] == 0:
        raise ProviderUnavailable(
            "Ainda não há jogos disputados suficientes nesta época para preencher."
        )

    payload: Dict[str, Any] = {
        "equipa_casa": home_team.get("shortName") or home_team.get("name") or "",
        "equipa_fora": away_team.get("shortName") or away_team.get("name") or "",
        "jogos_casa": home["games"],
        "golos_marcados_casa": home["scored"],
        "golos_sofridos_casa": home["conceded"],
        "jogos_casa_rec": home["recent_games"],
        "golos_marcados_casa_rec": home["recent_scored"],
        "golos_sofridos_casa_rec": home["recent_conceded"],
        "jogos_fora": away["games"],
        "golos_marcados_fora": away["scored"],
        "golos_sofridos_fora": away["conceded"],
        "jogos_fora_rec": away["recent_games"],
        "golos_marcados_fora_rec": away["recent_scored"],
        "golos_sofridos_fora_rec": away["recent_conceded"],
        "source": {"provider": "football-data.org", "league": league_key},
    }

    averages = league_goal_averages(matches)
    if averages:
        payload["league_averages"] = averages

    return payload
