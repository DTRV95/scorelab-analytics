"""O preço a que o mercado põe um jogo (The Odds API).

Vale mais do que parece. O modelo diz o que acha que vai acontecer; o
mercado diz o que milhares de pessoas com dinheiro em cima acham. Quando
os dois discordam muito, quem costuma estar errado não é o mercado — e
saber disso antes de apostar é a diferença entre uma aposta e um donativo.

Há dois serviços com nomes quase iguais e maneiras diferentes de receber
a chave: the-odds-api.com leva-a num parâmetro, theoddsapi.com num
cabeçalho. Em vez de obrigar alguém a saber qual é qual, tentam-se os
dois e guarda-se o que responder.
"""

import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Dict, List, Optional, Tuple

REQUEST_TIMEOUT = 15
SPORTS_TTL = 24 * 60 * 60
ODDS_TTL = 20 * 60

# Os dois serviços, por ordem de tentativa.
FLAVOURS = (
    {
        "name": "the-odds-api.com",
        "base": "https://api.the-odds-api.com/v4",
        "auth": "query",
    },
    {
        "name": "theoddsapi.com",
        "base": "https://api.theoddsapi.com",
        "auth": "header",
    },
)

# As nossas competições pela chave que eles lhes dão. Confirmada contra
# o /sports da própria fonte pela sonda — não decorada.
SPORT_KEYS: Dict[str, str] = {
    "Premier League": "soccer_epl",
    "Championship": "soccer_efl_champ",
    "La Liga": "soccer_spain_la_liga",
    "Serie A": "soccer_italy_serie_a",
    "Bundesliga": "soccer_germany_bundesliga",
    "Ligue 1": "soccer_france_ligue_one",
    "Eredivisie": "soccer_netherlands_eredivisie",
    "Liga Portugal": "soccer_portugal_primeira_liga",
    "Liga dos Campeões": "soccer_uefa_champs_league",
    "Brasileirão": "soccer_brazil_campeonato",
    "Campeonato da Europa": "soccer_uefa_european_championship",
}

_cache: Dict[str, Tuple[float, Any]] = {}


def get_api_key() -> str:
    return (os.getenv("ODDS_API_KEY") or "").strip()


def is_configured() -> bool:
    return bool(get_api_key())


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


def _store(key: str, value: Any) -> None:
    _cache[key] = (time.time(), value)


def _fetch(flavour: Dict[str, str], path: str, params: Dict[str, Any]) -> Any:
    api_key = get_api_key()
    query = dict(params)
    headers = {}
    if flavour["auth"] == "query":
        query["apiKey"] = api_key
    else:
        headers["x-api-key"] = api_key

    url = f"{flavour['base']}{path}?{urllib.parse.urlencode(query)}"
    request = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT) as response:
        return json.loads(response.read().decode("utf-8"))


def _working_flavour() -> Optional[Dict[str, Any]]:
    """Qual dos dois serviços é que esta chave abre, e o que ele tem.

    Guardado por um dia: a chave não muda de serviço a meio da tarde.
    """
    remembered = _cached("flavour", SPORTS_TTL)
    if remembered is not None:
        return remembered or None

    for flavour in FLAVOURS:
        try:
            listing = _fetch(flavour, "/sports", {})
        except Exception:
            continue
        if not isinstance(listing, list):
            continue
        keys = {
            row.get("key")
            for row in listing
            if isinstance(row, dict) and row.get("key")
        }
        if not keys:
            continue
        answer = {"flavour": flavour, "keys": sorted(keys)}
        _store("flavour", answer)
        return answer

    return None


def account_status() -> Dict[str, Any]:
    """Se a chave das odds serve, e que competições nossas estão lá."""
    if not is_configured():
        return {
            "configured": False,
            "accepted": False,
            "detail": "Sem chave. Falta a variável ODDS_API_KEY no servidor.",
        }

    found = _working_flavour()
    if not found:
        return {
            "configured": True,
            "accepted": False,
            "detail": (
                "Nenhum dos dois serviços de odds aceitou esta chave "
                "(the-odds-api.com nem theoddsapi.com)."
            ),
        }

    available = set(found["keys"])
    ours = {
        league: key for league, key in SPORT_KEYS.items() if key in available
    }
    missing = sorted(set(SPORT_KEYS) - set(ours))

    return {
        "configured": True,
        "accepted": True,
        "detail": "Ligada.",
        "service": found["flavour"]["name"],
        "our_leagues": sorted(ours),
        "missing_leagues": missing,
        "sports_listed": len(available),
    }


# Os mercados deles com os nomes que nós usamos.
_OUTCOME_NAMES = {"Draw": "Empate"}


def _ours(market: str, outcome: str, home: str, away: str) -> Optional[str]:
    if market == "h2h":
        if outcome == home:
            return "Casa"
        if outcome == away:
            return "Fora"
        if outcome in ("Draw", "draw"):
            return "Empate"
        return None
    if market == "totals":
        return None  # tratado à parte, que precisa do ponto
    return None


def _median(values: List[float]) -> float:
    ordered = sorted(values)
    middle = len(ordered) // 2
    if len(ordered) % 2:
        return ordered[middle]
    return (ordered[middle - 1] + ordered[middle]) / 2


def odds_for(
    league: str, home: str, away: str, kickoff: str, trace: Optional[Dict] = None
) -> Optional[Dict[str, float]]:
    """O preço mediano das casas para este jogo, por mercado nosso.

    Mediana e não a melhor: a melhor é muitas vezes o erro de uma casa
    distraída, e o que queremos saber é o que o mercado acha, não onde
    está a promoção.
    """
    if not is_configured():
        if trace is not None:
            trace["reason"] = "Sem chave."
        return None

    sport = SPORT_KEYS.get(league)
    if not sport:
        if trace is not None:
            trace["reason"] = f"'{league}' não tem chave nesta fonte."
        return None

    found = _working_flavour()
    if not found:
        if trace is not None:
            trace["reason"] = "A chave não foi aceite."
        return None

    key = f"odds:{sport}"
    listing = _cached(key, ODDS_TTL)
    if listing is None:
        try:
            listing = _fetch(
                found["flavour"],
                f"/sports/{sport}/odds",
                {
                    "regions": "eu,uk",
                    "markets": "h2h,totals",
                    "oddsFormat": "decimal",
                },
            )
        except Exception as exc:
            if trace is not None:
                trace["reason"] = f"A fonte não respondeu ({exc})."
            return None
        if not isinstance(listing, list):
            if trace is not None:
                trace["reason"] = "A fonte respondeu de forma inesperada."
            return None
        _store(key, listing)

    # O jogo deles que é o nosso. Aqui o nome volta a ser o problema, e a
    # solução é a mesma: compara-se por palavras e, sem certeza, não se
    # devolve nada.
    from injury_data import NAME_MATCH_FLOOR, _similar

    day = (kickoff or "")[:10]
    best, best_score = None, 0.0
    for game in listing:
        if not isinstance(game, dict):
            continue
        if day and not str(game.get("commence_time", "")).startswith(day):
            continue
        score = min(
            _similar(home, game.get("home_team") or ""),
            _similar(away, game.get("away_team") or ""),
        )
        if score > best_score:
            best, best_score = game, score

    if trace is not None:
        trace["games_seen"] = len(listing)
        trace["best_score"] = round(best_score, 3)

    if best is None or best_score < NAME_MATCH_FLOOR:
        if trace is not None:
            trace["reason"] = "Nenhum jogo deles se parece o suficiente com este."
        return None

    their_home = best.get("home_team") or ""
    their_away = best.get("away_team") or ""
    gathered: Dict[str, List[float]] = {}

    for book in best.get("bookmakers") or []:
        for market in book.get("markets") or []:
            name = market.get("key")
            for outcome in market.get("outcomes") or []:
                label = outcome.get("name")
                try:
                    price = float(outcome.get("price"))
                except (TypeError, ValueError):
                    continue
                if price <= 1:
                    continue

                if name == "h2h":
                    ours = _ours("h2h", label, their_home, their_away)
                elif name == "totals":
                    point = outcome.get("point")
                    if point is None:
                        continue
                    side = "Mais" if label == "Over" else "Menos"
                    ours = f"{side} de {point:g} Golos"
                    if ours not in (
                        "Mais de 2.5 Golos",
                        "Menos de 2.5 Golos",
                        "Mais de 3.5 Golos",
                        "Menos de 3.5 Golos",
                    ):
                        ours = None
                else:
                    ours = None

                if ours:
                    gathered.setdefault(ours, []).append(price)

    if not gathered:
        if trace is not None:
            trace["reason"] = "O jogo veio sem preços que saibamos ler."
        return None

    return {
        market: round(_median(values), 2) for market, values in gathered.items()
    }


# Os mercados 1X2, que são os que se podem normalizar em conjunto.
_ONE_X_TWO = ("Casa", "Empate", "Fora")


def implied_pct(prices: Dict[str, float]) -> Dict[str, float]:
    """O que o preço do mercado diz, em probabilidade, sem a margem.

    Uma odd de 2,00 não quer dizer 50%: a casa cobra a sua margem e a
    soma dos três resultados dá sempre mais de 100. Comparar a nossa
    probabilidade com a odd em bruto era dar-nos razão de graça, por isso
    a margem é retirada onde os três preços existem.

    Nos mercados em que não dá para normalizar — porque falta o outro
    lado — devolve-se a leitura directa, que peca por excesso e portanto
    nunca nos favorece.
    """
    out: Dict[str, float] = {}

    trio = [prices.get(name) for name in _ONE_X_TWO]
    if all(isinstance(price, (int, float)) and price > 1 for price in trio):
        overround = sum(100 / price for price in trio)
        for name, price in zip(_ONE_X_TWO, trio):
            out[name] = round((100 / price) / overround * 100, 1)

    # Duplas hipóteses saem das simples, quando as há: 1X é Casa ou
    # Empate, e somar duas probabilidades já sem margem é exacto.
    if {"Casa", "Empate", "Fora"} <= set(out):
        out["1X"] = round(out["Casa"] + out["Empate"], 1)
        out["2X"] = round(out["Fora"] + out["Empate"], 1)

    for pair in (
        ("Mais de 2.5 Golos", "Menos de 2.5 Golos"),
        ("Mais de 3.5 Golos", "Menos de 3.5 Golos"),
    ):
        both = [prices.get(name) for name in pair]
        if all(isinstance(price, (int, float)) and price > 1 for price in both):
            overround = sum(100 / price for price in both)
            for name, price in zip(pair, both):
                out[name] = round((100 / price) / overround * 100, 1)

    for name, price in prices.items():
        if name not in out and isinstance(price, (int, float)) and price > 1:
            out[name] = round(100 / price, 1)

    return out


def match_context(
    league: str, home: str, away: str, kickoff: str
) -> Dict[str, Any]:
    """O que se sabe à volta de um jogo. Hoje, o preço do mercado.

    Teve lesões, árbitro e tempo enquanto a API-Football pareceu dar
    para isso. Não dá: o plano gratuito pára em 2024. Ficou o que
    funciona, e a resposta diz quando não há nada em vez de encher de
    campos vazios.
    """
    trace: Dict[str, Any] = {}
    prices = odds_for(league, home, away, kickoff, trace=trace)

    if not prices:
        return {
            "odds": None,
            "implied_pct": None,
            "detail": "Sem preço de mercado para este jogo.",
            "trace": trace,
        }

    return {
        "odds": prices,
        "implied_pct": implied_pct(prices),
        "detail": "",
    }
