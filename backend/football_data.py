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

import concurrent.futures
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


def get_season_matches(
    league_key: str, season: Optional[int] = None
) -> List[Dict[str, Any]]:
    code = _competition_code(league_key)
    cache_key = f"matches:{code}:{season or 'current'}"

    cached = _cache_get(cache_key, MATCHES_TTL)
    if cached is not None:
        return cached

    params = {"season": season} if season else None
    payload = _request(f"/competitions/{code}/matches", params)
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


def matches_for_days(days: int = 7) -> Dict[str, Any]:
    """Every analysable fixture across the covered competitions, next N days.

    Competitions that fail are skipped instead of breaking the whole board, so a
    single unavailable league never hides the rest.
    """
    now = time.time()
    horizon = now + max(1, days) * 24 * 60 * 60
    board: List[Dict[str, Any]] = []
    unavailable: List[str] = []

    def load(league_key: str):
        try:
            return league_key, upcoming_fixtures(league_key, limit=100), None
        except ProviderUnavailable as exc:
            return league_key, [], exc

    # Fetch the competitions concurrently: sequentially this is 8 round trips
    # and makes the first (cold cache) load painfully slow.
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(load, supported_leagues()))

    for league_key, fixtures, failure in results:
        if failure is not None:
            unavailable.append(league_key)
            continue

        for fixture in fixtures:
            kickoff = fixture.get("kickoff")
            if not kickoff:
                continue
            stamp = _kickoff_stamp(kickoff)
            if stamp is None:
                continue
            # A fixture whose kickoff has passed is not upcoming, whatever the
            # provider still calls it: its status can lag the whistle by an hour
            # or more, and a board that offers a game already under way is
            # offering a bet nobody can place.
            if stamp < now or stamp > horizon:
                continue
            board.append({**fixture, "league": league_key})

    board.sort(key=lambda item: item.get("kickoff") or "")
    return {"matches": board, "unavailable": unavailable}


def league_diagnostics(days: int = 7) -> Dict[str, Any]:
    """One row per competition: does it answer, and what does it actually hold?

    The board hides a failure by design — one dead competition must not take the
    other seven down — which means a competition can go missing for days without
    anyone being told. This is the page that says why: the provider's own error
    for the ones that fail, and the counts for the ones that work, so "there are
    Dutch games on and I see none" has an answer instead of a guess.
    """
    horizon = time.time() + max(1, days) * 24 * 60 * 60
    now = time.time()

    def probe(league_key: str) -> Dict[str, Any]:
        row: Dict[str, Any] = {
            "league": league_key,
            "code": SUPPORTED_LEAGUES[league_key],
            "ok": False,
            "error": None,
            "matches": 0,
            "finished": 0,
            "upcoming": 0,
            "within_days": 0,
            "next_kickoff": None,
            "season": None,
        }

        try:
            matches = get_season_matches(league_key)
        except ProviderUnavailable as exc:
            row["error"] = str(exc)
            return row
        except Exception as exc:  # noqa: BLE001 - reported, never raised on
            row["error"] = f"Erro inesperado: {exc}"
            return row

        row["ok"] = True
        row["matches"] = len(matches)

        kickoffs: List[str] = []
        for match in matches:
            if _is_finished(match):
                row["finished"] += 1
                continue
            if match.get("status") not in UPCOMING_STATUSES:
                continue

            row["upcoming"] += 1
            kickoff = match.get("utcDate")
            if not kickoff:
                continue
            stamp = _kickoff_stamp(kickoff)
            if stamp is None:
                continue
            if now <= stamp <= horizon:
                row["within_days"] += 1
            if stamp >= now:
                kickoffs.append(kickoff)

        if kickoffs:
            row["next_kickoff"] = min(kickoffs)
        if matches:
            row["season"] = ((matches[0].get("season") or {}).get("startDate") or "")[:4]

        return row

    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        rows = list(pool.map(probe, supported_leagues()))

    return {
        "configured": is_configured(),
        "days": days,
        "leagues": rows,
        "failing": [row["league"] for row in rows if not row["ok"]],
        "empty": [row["league"] for row in rows if row["ok"] and row["within_days"] == 0],
    }


def results_for_fixtures(
    league_key: str, fixture_ids: List[int]
) -> List[Dict[str, Any]]:
    """Final scores for fixtures already analysed.

    Served from the same season cache the auto-fill uses, so checking results
    for a whole history of analyses costs no extra quota.
    """
    matches = get_season_matches(league_key)
    by_id = {match.get("id"): match for match in matches}

    results: List[Dict[str, Any]] = []
    for fixture_id in fixture_ids:
        match = by_id.get(fixture_id)
        if not match:
            continue

        home_goals, away_goals = _full_time_goals(match)
        finished = _is_finished(match) and home_goals is not None and away_goals is not None
        home_team = match.get("homeTeam") or {}
        away_team = match.get("awayTeam") or {}

        results.append(
            {
                "fixture_id": fixture_id,
                "status": match.get("status"),
                "finished": finished,
                "home_goals": home_goals if finished else None,
                "away_goals": away_goals if finished else None,
                "kickoff": match.get("utcDate"),
                "home_name": home_team.get("shortName") or home_team.get("name"),
                "away_name": away_team.get("shortName") or away_team.get("name"),
            }
        )

    return results


def _kickoff_stamp(kickoff: str) -> Optional[float]:
    """An ISO-8601 UTC kickoff as a Unix timestamp, or None if unparseable."""
    try:
        return (
            time.mktime(time.strptime(kickoff.replace("Z", "UTC"), "%Y-%m-%dT%H:%M:%S%Z"))
            - time.timezone
        )
    except (ValueError, AttributeError):
        return None


def _played_before(match: Dict[str, Any], before: Optional[str]) -> bool:
    """Was this match already played by `before` (an ISO-8601 UTC kickoff)?

    The provider's dates are all the same fixed-width UTC format, so comparing
    them as strings orders them correctly. `before` is what keeps a scored
    forecast honest: rebuilding what the model knew on the morning of a match
    must not see the match itself, nor anything played after it.
    """
    if not before:
        return True
    return (match.get("utcDate") or "") < before


def _team_side_record(
    matches: List[Dict[str, Any]],
    team_id: int,
    side: str,
    before: Optional[str] = None,
) -> Dict[str, int]:
    """Season and recent goal record for a team, restricted to home or away games."""
    key = "homeTeam" if side == "home" else "awayTeam"

    played = []
    for match in matches:
        if not _is_finished(match):
            continue
        if not _played_before(match, before):
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


def league_goal_averages(
    matches: List[Dict[str, Any]], before: Optional[str] = None
) -> Dict[str, float]:
    played = 0
    home_goals = 0
    away_goals = 0

    for match in matches:
        if not _is_finished(match):
            continue
        if not _played_before(match, before):
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


def calibration() -> Dict[str, Any]:
    """Measured goal averages for every covered competition.

    These come from actual results of the season in progress, so they replace
    the hand-entered presets whenever live data exists.
    """

    def measure(league_key: str):
        try:
            matches = get_season_matches(league_key)
        except ProviderUnavailable:
            return league_key, None
        return league_key, league_goal_averages(matches) or None

    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(measure, supported_leagues()))

    return {
        "leagues": {key: value for key, value in results if value},
        "pending": [key for key, value in results if not value],
    }


def probability_board(days: int = 7, limit: int = 80) -> Dict[str, Any]:
    """Every analysable fixture, forecast and ranked by its strongest signal.

    Reuses matches_for_days and build_prefill, so it costs nothing beyond
    what those already fetch and cache: this only adds a numpy simulation
    per fixture, no extra requests to the data provider.
    """
    # Imported here, not at module load: model.py has no reason to know this
    # module exists, and importing it up top would make every football_data
    # call pay numpy's import cost even when only fixtures are needed.
    from model import pick_headline_market, probabilidades_jogo
    from schemas import ProbabilityRequest

    board = matches_for_days(days)
    ranked: List[Dict[str, Any]] = []
    skipped = 0

    for fixture in board["matches"]:
        try:
            prefill = build_prefill(fixture["league"], fixture["fixture_id"])
            averages = prefill.get("league_averages") or {}
            data = ProbabilityRequest(
                equipa_casa=prefill["equipa_casa"],
                equipa_fora=prefill["equipa_fora"],
                liga=fixture["league"],
                jogos_casa=prefill["jogos_casa"],
                golos_marcados_casa=prefill["golos_marcados_casa"],
                golos_sofridos_casa=prefill["golos_sofridos_casa"],
                jogos_casa_rec=prefill["jogos_casa_rec"],
                golos_marcados_casa_rec=prefill["golos_marcados_casa_rec"],
                golos_sofridos_casa_rec=prefill["golos_sofridos_casa_rec"],
                jogos_fora=prefill["jogos_fora"],
                golos_marcados_fora=prefill["golos_marcados_fora"],
                golos_sofridos_fora=prefill["golos_sofridos_fora"],
                jogos_fora_rec=prefill["jogos_fora_rec"],
                golos_marcados_fora_rec=prefill["golos_marcados_fora_rec"],
                golos_sofridos_fora_rec=prefill["golos_sofridos_fora_rec"],
                **(
                    {
                        "league_home_goals_avg": averages["league_home_goals_avg"],
                        "league_away_goals_avg": averages["league_away_goals_avg"],
                    }
                    if averages
                    else {}
                ),
            )
            result = probabilidades_jogo(data)
            headline = pick_headline_market(result["mercados"])
        except ProviderUnavailable:
            skipped += 1
            continue
        except Exception:
            # One malformed fixture must never take the whole board down.
            skipped += 1
            continue

        ranked.append(
            {
                "fixture_id": fixture["fixture_id"],
                "league": fixture["league"],
                "home_name": fixture["home_name"],
                "away_name": fixture["away_name"],
                "kickoff": fixture.get("kickoff"),
                "headline_market": headline["mercado"],
                "headline_pct": headline["probabilidade_pct"],
                "amostra_pct": result["amostra_pct"],
                "amostra_label": result["amostra_label"],
                "lambda_casa": result["lambda_casa"],
                "lambda_fora": result["lambda_fora"],
                "total_golos_esperados": result["total_golos_esperados"],
                "mercados": result["mercados"],
            }
        )

    ranked.sort(key=lambda item: item["kickoff"] or "")

    return {
        "matches": ranked[:limit],
        "unavailable": board["unavailable"],
        "skipped": skipped,
    }


def build_prefill(league_key: str, fixture_id: int) -> Dict[str, Any]:
    matches = get_season_matches(league_key)

    target = next(
        (match for match in matches if match.get("id") == fixture_id), None
    )
    if not target:
        raise ProviderUnavailable("Jogo não encontrado nesta competição.")

    return _prefill_for_match(matches, target, league_key)


def _prefill_for_match(
    matches: List[Dict[str, Any]],
    target: Dict[str, Any],
    league_key: str,
    before: Optional[str] = None,
) -> Dict[str, Any]:
    """Model inputs for one fixture.

    `before` cuts the history off at a moment in time. Scoring past forecasts
    passes the fixture's own kickoff, which is the difference between measuring
    the model and flattering it with results it could not have had.
    """
    fixture_id = target.get("id")
    home_team = target.get("homeTeam") or {}
    away_team = target.get("awayTeam") or {}
    home_id = home_team.get("id")
    away_id = away_team.get("id")
    if not home_id or not away_id:
        raise ProviderUnavailable("Jogo sem equipas identificadas.")

    home = _team_side_record(matches, home_id, "home", before)
    away = _team_side_record(matches, away_id, "away", before)

    if home["games"] == 0 and away["games"] == 0:
        raise ProviderUnavailable(
            "Ainda não há jogos disputados suficientes para preencher este jogo. "
            "Preenche os dados manualmente."
        )

    payload: Dict[str, Any] = {
        # Carried into the saved analysis so the result can be matched back to
        # this exact fixture later, without name-guessing.
        "fixture_id": fixture_id,
        "league": league_key,
        "kickoff": target.get("utcDate"),
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

    averages = league_goal_averages(matches, before)
    if averages:
        payload["league_averages"] = averages

    return payload


# Scoring a season costs one simulation per fixture, so it runs at reduced
# precision: see estimate_market_distributions for why that is safe here.
ACCURACY_ITERATIONS = 2_000
ACCURACY_TTL = 6 * 60 * 60
CALIBRATION_BUCKET_PCT = 10

# Five of the fifteen markets the board forecasts are the exact mirror of
# another one: "Menos de 2.5" is true whenever "Mais de 2.5" is false, and a
# probability and its complement score identically. Counting both would weigh
# those events twice and make the calibration curve symmetric by construction
# rather than by merit, so the totals count one side of each pair. The mirrors
# still get their own row in the per-market table, where they are worth reading
# on their own terms.
MIRRORED_MARKETS = frozenset(
    {
        "1X",
        "2X",
        "Menos de 2.5 Golos",
        "Menos de 3.5 Golos",
        "BTTS No",
    }
)


def _bucket_label(probability_pct: float) -> str:
    floor = min(
        int(probability_pct // CALIBRATION_BUCKET_PCT) * CALIBRATION_BUCKET_PCT, 90
    )
    return f"{floor}-{floor + CALIBRATION_BUCKET_PCT}%"


def model_accuracy(league_key: str, season: Optional[int] = None) -> Dict[str, Any]:
    """How the model actually did, measured on every match already played.

    Each fixture is forecast again from the league as it stood before its own
    kickoff, then scored against the final result. That is the only honest way
    to answer "is this thing right?": a forecast built from a season that
    already contains the match would be marking its own homework.

    What comes back is not a verdict but the evidence for one — per market and
    per confidence band, how often the model said something would happen
    against how often it did, plus the Brier score, which punishes being
    confident and wrong far more than being unsure and wrong.
    """
    from model import pick_headline_market, probabilidades_jogo, settle_markets
    from schemas import ProbabilityRequest

    cache_key = f"accuracy:{league_key}:{season or 'current'}"
    cached = _cache_get(cache_key, ACCURACY_TTL)
    if cached is not None:
        return cached

    matches = get_season_matches(league_key, season)
    played = [
        match
        for match in matches
        if _is_finished(match) and None not in _full_time_goals(match)
    ]
    played.sort(key=lambda match: match.get("utcDate") or "")

    markets: Dict[str, Dict[str, float]] = {}
    buckets: Dict[str, Dict[str, float]] = {}
    # Every distinct prediction, so the overall figures can be worked out over
    # events counted once each.
    counted: List[Tuple[str, float, bool]] = []
    headline_predictions = 0
    headline_hits = 0
    headline_prob_sum = 0.0
    scored = 0
    skipped = 0

    for match in played:
        kickoff = match.get("utcDate")
        home_goals, away_goals = _full_time_goals(match)

        try:
            prefill = _prefill_for_match(matches, match, league_key, before=kickoff)
            averages = prefill.get("league_averages") or {}
            data = ProbabilityRequest(
                equipa_casa=prefill["equipa_casa"],
                equipa_fora=prefill["equipa_fora"],
                liga=league_key,
                jogos_casa=prefill["jogos_casa"],
                golos_marcados_casa=prefill["golos_marcados_casa"],
                golos_sofridos_casa=prefill["golos_sofridos_casa"],
                jogos_casa_rec=prefill["jogos_casa_rec"],
                golos_marcados_casa_rec=prefill["golos_marcados_casa_rec"],
                golos_sofridos_casa_rec=prefill["golos_sofridos_casa_rec"],
                jogos_fora=prefill["jogos_fora"],
                golos_marcados_fora=prefill["golos_marcados_fora"],
                golos_sofridos_fora=prefill["golos_sofridos_fora"],
                jogos_fora_rec=prefill["jogos_fora_rec"],
                golos_marcados_fora_rec=prefill["golos_marcados_fora_rec"],
                golos_sofridos_fora_rec=prefill["golos_sofridos_fora_rec"],
                **(
                    {
                        "league_home_goals_avg": averages["league_home_goals_avg"],
                        "league_away_goals_avg": averages["league_away_goals_avg"],
                    }
                    if averages
                    else {}
                ),
            )
            forecast = probabilidades_jogo(data, iterations=ACCURACY_ITERATIONS)
        except ProviderUnavailable:
            # Early-season fixtures have no history to forecast from. They are
            # not failures, they are simply not scoreable.
            skipped += 1
            continue
        except Exception:
            skipped += 1
            continue

        outcomes = settle_markets(home_goals, away_goals)
        scored += 1

        for entry in forecast["mercados"]:
            name = entry["mercado"]
            landed = outcomes.get(name)
            if landed is None:
                continue

            probability = entry["probabilidade_pct"] / 100
            row = markets.setdefault(
                name,
                {"market": name, "grupo": entry["grupo"], "samples": 0, "hits": 0,
                 "prob_sum": 0.0, "brier_sum": 0.0},
            )
            row["samples"] += 1
            row["hits"] += 1 if landed else 0
            row["prob_sum"] += probability
            row["brier_sum"] += (probability - (1.0 if landed else 0.0)) ** 2

            if name in MIRRORED_MARKETS:
                continue

            counted.append((name, probability, bool(landed)))

            bucket = _bucket_label(entry["probabilidade_pct"])
            band = buckets.setdefault(
                bucket, {"bucket": bucket, "samples": 0, "hits": 0, "prob_sum": 0.0}
            )
            band["samples"] += 1
            band["hits"] += 1 if landed else 0
            band["prob_sum"] += probability

        headline = pick_headline_market(forecast["mercados"])
        if outcomes.get(headline["mercado"]) is not None:
            headline_predictions += 1
            headline_prob_sum += headline["probabilidade_pct"] / 100
            headline_hits += 1 if outcomes[headline["mercado"]] else 0

    def rate(hits: float, samples: float) -> float:
        return round(hits / samples * 100, 1) if samples else 0.0

    market_rows = [
        {
            "market": row["market"],
            "grupo": row["grupo"],
            "samples": int(row["samples"]),
            "predicted_pct": rate(row["prob_sum"], row["samples"]),
            "actual_pct": rate(row["hits"], row["samples"]),
            "gap_pp": round(
                rate(row["hits"], row["samples"]) - rate(row["prob_sum"], row["samples"]),
                1,
            ),
            "brier": round(row["brier_sum"] / row["samples"], 4) if row["samples"] else 0.0,
            # False for the mirror of another market on the same board. The row
            # is still worth reading; it just must not be counted a second time
            # in a total, or listed beside the market it is the opposite of.
            "counted": row["market"] not in MIRRORED_MARKETS,
        }
        for row in markets.values()
    ]
    market_rows.sort(key=lambda row: row["market"])

    bucket_rows = [
        {
            "bucket": band["bucket"],
            "samples": int(band["samples"]),
            "predicted_pct": rate(band["prob_sum"], band["samples"]),
            "actual_pct": rate(band["hits"], band["samples"]),
            "gap_pp": round(
                rate(band["hits"], band["samples"]) - rate(band["prob_sum"], band["samples"]),
                1,
            ),
        }
        for band in buckets.values()
    ]
    bucket_rows.sort(key=lambda row: int(row["bucket"].split("-")[0]))

    total_samples = len(counted)
    total_brier = (
        sum((prob - (1.0 if landed else 0.0)) ** 2 for _, prob, landed in counted)
        / total_samples
        if total_samples
        else 0.0
    )

    # What the same predictions would have scored by ignoring the match
    # entirely and always quoting how often that market lands. It is the
    # honest thing to compare a forecast against: beating it is the whole job,
    # and a Brier score on its own says nothing without it.
    base_rates: Dict[str, List[bool]] = {}
    for name, _prob, landed in counted:
        base_rates.setdefault(name, []).append(landed)

    baseline_brier = (
        sum(
            (sum(landed) / len(landed) - (1.0 if landed_one else 0.0)) ** 2
            for name, landed in base_rates.items()
            for landed_one in landed
        )
        / total_samples
        if total_samples
        else 0.0
    )

    payload = {
        "league": league_key,
        "season": season,
        "fixtures_scored": scored,
        "fixtures_skipped": skipped,
        "predictions": total_samples,
        "markets_counted": len(base_rates),
        "markets_forecast": len(market_rows),
        "brier": round(total_brier, 4),
        "baseline_brier": round(baseline_brier, 4),
        # Above zero means the forecast beat simply knowing how often each
        # market lands; at or below zero it added nothing.
        "skill_pct": round((1 - total_brier / baseline_brier) * 100, 1)
        if baseline_brier
        else 0.0,
        "headline": {
            "predictions": headline_predictions,
            "predicted_pct": rate(headline_prob_sum, headline_predictions),
            "actual_pct": rate(headline_hits, headline_predictions),
        },
        "markets": market_rows,
        "calibration": bucket_rows,
    }

    _cache_put(cache_key, payload)
    return payload
