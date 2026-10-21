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
from typing import Any, Dict, List, Optional, Set, Tuple

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


# --- Emparelhar um jogo nosso com um jogo deles -------------------------
#
# As duas fontes escrevem os nomes à maneira delas: "Sporting CP" contra
# "Sporting Lisbon", "Wolverhampton Wanderers FC" contra "Wolves". Onde não
# houver certeza, não se inventa — o jogo fica sem contexto e o dossiê
# mostra-o a cinzento, que é a resposta honesta.

FIXTURE_TTL = 6 * 60 * 60
# As lesões de hoje mudam durante o dia, mas não de dez em dez minutos.
INJURY_TTL = 2 * 60 * 60
# As odds mexem-se a sério. Meia hora é o compromisso entre estar fresco e
# não gastar os cem pedidos do dia a ver o mesmo jogo.
ODDS_TTL = 30 * 60

NAME_MATCH_FLOOR = 0.62

# Palavras que só dizem que aquilo é um clube, e que cada fonte põe ou
# tira à vontade: "Sporting CP" e "Sporting Lisbon" são o mesmo clube.
_CLUB_WORDS = {
    "fc", "cf", "sc", "ac", "afc", "sad", "cd", "ss", "as", "ufc", "sv",
    "bv", "vfb", "vfl", "tsg", "fsv", "rc", "ud", "sd", "ogc", "losc",
    "calcio", "club", "clube", "futebol", "football", "association",
    "de", "do", "da", "of", "the", "and",
}


def _norm(name: str) -> str:
    """Um nome de equipa reduzido ao que as duas fontes têm em comum."""
    import unicodedata

    text = unicodedata.normalize("NFKD", (name or "").lower())
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = "".join(ch if ch.isalnum() or ch.isspace() else " " for ch in text)
    return " ".join(text.split())


def _words(name: str) -> Set[str]:
    """As palavras que distinguem uma equipa das outras.

    Fora as que só dizem "isto é um clube", e fora as de três letras ou
    menos, que são quase sempre a mesma coisa noutra língua. Se não
    sobrar nada, fica o nome inteiro — mais vale comparar mal do que não
    comparar.
    """
    words = _norm(name).split()
    kept = {w for w in words if len(w) > 3 and w not in _CLUB_WORDS}
    return kept or set(words)


def _pairs(ours: str, theirs: str) -> float:
    """Se duas palavras são a mesma, e com que confiança."""
    import difflib

    if ours == theirs:
        return 1.0

    # Prefixo longo partilhado: é assim que "wolves" e "wolverhampton" se
    # reconhecem, e "united"/"city" ou "madrid"/"sociedad" não.
    shared = 0
    for a, b in zip(ours, theirs):
        if a != b:
            break
        shared += 1
    if shared >= 5:
        return 0.9

    ratio = difflib.SequenceMatcher(None, ours, theirs).ratio()
    # "munchen"/"munich" vive aqui. "atletico"/"athletic" também passaria,
    # mas o clube inteiro não — ver _similar.
    return 0.8 if ratio >= 0.75 else 0.0


def _similar(ours: str, theirs: str) -> float:
    """Quanto é que dois nomes são a mesma equipa, de 0 a 1.

    Por palavras e não por letras. A semelhança bruta de texto dava 0,81 a
    "Manchester United" contra "Manchester City" — o suficiente para
    servir o jogo errado — e só 0,41 a "Wolverhampton Wanderers" contra
    "Wolves", que é a mesma equipa. O que separa os dois casos não é
    quanto texto têm em comum, é se a palavra que os distingue bate certo.

    Por isso: as palavras comuns não contam para nada, e **todas** as
    restantes do nome mais curto têm de encontrar par. "Atlético Madrid"
    contra "Athletic Bilbao" cai aqui, porque "madrid" não tem par, por
    mais parecidos que "atletico" e "athletic" sejam.
    """
    a, b = _words(ours), _words(theirs)
    if not a or not b:
        return 0.0
    if a == b:
        return 1.0

    only_a, only_b = a - b, b - a
    if not only_a or not only_b:
        # Um nome é o outro mais umas palavras: "Tottenham" dentro de
        # "Tottenham Hotspur".
        #
        # Aqui mora o limite desta função: "AC Milan" reduz-se a "milan",
        # que também está dentro de "Inter Milan". Pelo nome não há como
        # decidir — "Tottenham"/"Tottenham Hotspur" tem exactamente a
        # mesma forma e é a mesma equipa. Quem resolve isso é o jogo
        # inteiro em find_fixture: as duas equipas têm de bater, e dois
        # jogos empatados não escolhem nenhum.
        return 0.92

    shorter, longer = (only_a, only_b) if len(only_a) <= len(only_b) else (only_b, only_a)
    worst = 1.0
    for word in shorter:
        best = max((_pairs(word, other) for other in longer), default=0.0)
        if best == 0.0:
            return 0.0
        worst = min(worst, best)
    return worst


def _league_row(league: str) -> Optional[Dict[str, Any]]:
    for row in league_coverage().get("leagues", []):
        if row.get("scorelab") == league:
            return row
    return None


def find_fixture(
    league: str, home: str, away: str, day: str, trace: Optional[Dict] = None
) -> Optional[Dict[str, Any]]:
    """O jogo deles que é o nosso, ou nada.

    `day` é a data do pontapé de saída em AAAA-MM-DD. Pedido por
    competição e não pelo dia do mundo inteiro: um dia de futebol são
    centenas de jogos e a resposta deles vem paginada, por isso o pedido
    global trazia a primeira página e os nossos ficavam de fora. Por
    competição são meia dúzia, e abrir dez jogos da mesma liga no mesmo
    dia continua a custar um pedido.

    `trace` é preenchido para quem quiser saber porque é que não deu.
    """
    if not is_configured():
        if trace is not None:
            trace["reason"] = "Sem chave."
        return None

    row = _league_row(league)
    if not row or not row.get("api_id") or not row.get("season"):
        if trace is not None:
            trace["reason"] = f"'{league}' não está no catálogo da fonte."
        return None

    wanted_id, season = row["api_id"], row["season"]
    key = f"fixtures:{wanted_id}:{season}:{day}"
    listing = _cached(key, FIXTURE_TTL)
    if listing is None:
        query = urllib.parse.urlencode(
            {"league": wanted_id, "season": season, "date": day}
        )
        try:
            payload = _request(f"/fixtures?{query}")
        except Exception as exc:
            if trace is not None:
                trace["reason"] = f"A fonte não respondeu ({exc})."
            return None
        complaint = _errors_of(payload)
        if complaint:
            if trace is not None:
                trace["reason"] = f"A fonte recusou: {complaint}"
            return None
        listing = payload.get("response")
        if not isinstance(listing, list):
            if trace is not None:
                trace["reason"] = "A fonte respondeu de forma inesperada."
            return None
        _store(key, listing)

    if trace is not None:
        trace["fixtures_seen"] = len(listing)
        trace["names"] = [
            f"{((e.get('teams') or {}).get('home') or {}).get('name')} vs "
            f"{((e.get('teams') or {}).get('away') or {}).get('name')}"
            for e in listing
            if isinstance(e, dict)
        ][:12]

    best, best_score, runner_up = None, 0.0, 0.0
    for entry in listing:
        if not isinstance(entry, dict):
            continue
        teams = entry.get("teams") or {}
        theirs_home = ((teams.get("home") or {}).get("name")) or ""
        theirs_away = ((teams.get("away") or {}).get("name")) or ""
        score = min(_similar(home, theirs_home), _similar(away, theirs_away))
        if score > best_score:
            best, best_score, runner_up = entry, score, best_score
        elif score > runner_up:
            runner_up = score

    if trace is not None:
        trace["best_score"] = round(best_score, 3)
        trace["runner_up"] = round(runner_up, 3)

    if best is None or best_score < NAME_MATCH_FLOOR:
        if trace is not None:
            trace["reason"] = "Nenhum jogo deles se parece o suficiente com este."
        return None

    # Dois jogos do mesmo dia igualmente parecidos com o nosso: não há
    # maneira de saber qual é, e escolher o mais provável aqui é escolher
    # ao calhas com ar de certeza. Fica sem contexto.
    if runner_up >= NAME_MATCH_FLOOR and best_score - runner_up < 0.1:
        if trace is not None:
            trace["reason"] = "Dois jogos deles parecem-se igualmente com este."
        return None

    fixture = best.get("fixture") or {}
    venue = fixture.get("venue") or {}
    return {
        "id": fixture.get("id"),
        "referee": fixture.get("referee"),
        "city": venue.get("city"),
        "stadium": venue.get("name"),
        "confidence": round(best_score, 3),
    }


def injuries_for(fixture_id: int) -> Optional[Dict[str, List[Dict[str, str]]]]:
    """Quem falta a este jogo, por equipa. Nada quando não se sabe.

    A diferença entre "não há lesionados" e "não sabemos" é toda: o
    primeiro é uma informação, o segundo é um buraco, e trocá-los era
    dizer a alguém que a equipa está inteira quando ninguém olhou.
    """
    if not is_configured() or not fixture_id:
        return None

    key = f"injuries:{fixture_id}"
    remembered = _cached(key, INJURY_TTL)
    if remembered is not None:
        return remembered

    try:
        payload = _request(f"/injuries?fixture={int(fixture_id)}")
    except Exception:
        return None
    if _errors_of(payload):
        return None

    rows = payload.get("response")
    if not isinstance(rows, list):
        return None

    by_team: Dict[str, List[Dict[str, str]]] = {}
    for row in rows:
        if not isinstance(row, dict):
            continue
        team = ((row.get("team") or {}).get("name")) or "?"
        player = row.get("player") or {}
        by_team.setdefault(team, []).append(
            {
                "name": player.get("name") or "?",
                # "Missing Fixture" é certo, "Questionable" é dúvida — e
                # uma dúvida não vale o mesmo que uma ausência.
                "certain": (player.get("type") or "") == "Missing Fixture",
                "reason": player.get("reason") or "",
            }
        )

    _store(key, by_team)
    return by_team


# Os mercados deles com os nomes que nós usamos. O que não estiver aqui
# não é traduzido: uma odd no mercado errado é pior do que odd nenhuma.
ODDS_MARKETS = {
    ("Match Winner", "Home"): "Casa",
    ("Match Winner", "Draw"): "Empate",
    ("Match Winner", "Away"): "Fora",
    ("Double Chance", "Home/Draw"): "1X",
    ("Double Chance", "Draw/Away"): "2X",
    ("Goals Over/Under", "Over 2.5"): "Mais de 2.5 Golos",
    ("Goals Over/Under", "Under 2.5"): "Menos de 2.5 Golos",
    ("Goals Over/Under", "Over 3.5"): "Mais de 3.5 Golos",
    ("Goals Over/Under", "Under 3.5"): "Menos de 3.5 Golos",
    ("Both Teams Score", "Yes"): "Ambas Marcam",
    ("Both Teams Score", "No"): "BTTS No",
}


def _median(values: List[float]) -> float:
    ordered = sorted(values)
    middle = len(ordered) // 2
    if len(ordered) % 2:
        return ordered[middle]
    return (ordered[middle - 1] + ordered[middle]) / 2


def odds_for(fixture_id: int) -> Optional[Dict[str, float]]:
    """O preço do mercado por mercado nosso: a mediana das casas.

    Mediana e não a melhor: a melhor odd de uma casa qualquer é muitas
    vezes um erro dela, e nós queremos saber o que o mercado acha, não
    onde está a promoção. O que o mercado acha é a opinião mais bem
    informada que existe sobre um jogo — mais do que a nossa.
    """
    if not is_configured() or not fixture_id:
        return None

    key = f"odds:{fixture_id}"
    remembered = _cached(key, ODDS_TTL)
    if remembered is not None:
        return remembered

    try:
        payload = _request(f"/odds?fixture={int(fixture_id)}")
    except Exception:
        return None
    if _errors_of(payload):
        return None

    rows = payload.get("response")
    if not isinstance(rows, list) or not rows:
        return None

    gathered: Dict[str, List[float]] = {}
    for row in rows:
        for book in (row.get("bookmakers") or []):
            for bet in (book.get("bets") or []):
                bet_name = bet.get("name")
                for value in (bet.get("values") or []):
                    ours = ODDS_MARKETS.get((bet_name, value.get("value")))
                    if not ours:
                        continue
                    try:
                        price = float(value.get("odd"))
                    except (TypeError, ValueError):
                        continue
                    if price > 1:
                        gathered.setdefault(ours, []).append(price)

    if not gathered:
        return None

    prices = {
        market: round(_median(values), 2) for market, values in gathered.items()
    }
    _store(key, prices)
    return prices


def match_context(
    league: str, home: str, away: str, kickoff: str
) -> Dict[str, Any]:
    """Tudo o que esta fonte sabe sobre um jogo nosso, numa resposta só.

    Cada parte falha por si: pode haver árbitro sem lesões, odds sem
    tempo. O que falhar vem a null e o dossiê põe-no a cinzento — nunca
    um valor inventado para a linha não ficar vazia.
    """
    import weather_data

    answer: Dict[str, Any] = {
        "matched": False,
        "fixture_id": None,
        "referee": None,
        "stadium": None,
        "city": None,
        "injuries": None,
        "injuries_covered": False,
        "odds": None,
        "weather": None,
    }

    if not is_configured():
        answer["detail"] = "Fonte de contexto não configurada."
        return answer

    day = (kickoff or "")[:10]
    if len(day) != 10:
        answer["detail"] = "Jogo sem hora marcada."
        return answer

    trace: Dict[str, Any] = {}
    found = find_fixture(league, home, away, day, trace=trace)
    if not found:
        # O caso honesto mais comum: os nomes não bateram certo o
        # suficiente. Melhor dizê-lo do que servir o jogo errado.
        answer["detail"] = "Não encontrámos este jogo na fonte de contexto."
        answer["trace"] = trace
        return answer

    answer.update(
        matched=True,
        fixture_id=found.get("id"),
        referee=found.get("referee"),
        stadium=found.get("stadium"),
        city=found.get("city"),
        match_confidence=found.get("confidence"),
        detail="",
    )

    covered = any(
        row.get("scorelab") == league and row.get("injuries")
        for row in league_coverage().get("leagues", [])
    )
    answer["injuries_covered"] = covered
    if covered:
        answer["injuries"] = injuries_for(found.get("id"))

    answer["odds"] = odds_for(found.get("id"))
    answer["weather"] = weather_data.at_kickoff(found.get("city") or "", kickoff)
    return answer
