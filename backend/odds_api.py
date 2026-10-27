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


# O que a fonte respondeu da última vez a uma chamada que gasta saldo.
#
# Isto existe porque o estado da ligação estava a ser medido no sítio
# errado. A lista de desportos é gratuita e continua a responder depois
# de o saldo acabar, por isso o painel dizia "Ligada" enquanto todos os
# pedidos de preço levavam 401 — e ninguém viu o mês acabar.
_meter: Dict[str, Any] = {}


def meter() -> Dict[str, Any]:
    """Quantas chamadas restam no mês, e como correu a última."""
    return dict(_meter)


def _fetch(flavour: Dict[str, str], path: str, params: Dict[str, Any]) -> Any:
    api_key = get_api_key()
    query = dict(params)
    headers = {}
    if flavour["auth"] == "query":
        query["apiKey"] = api_key
    else:
        headers["x-api-key"] = api_key

    # Só as chamadas de preço gastam saldo; a lista de desportos é de
    # graça e não tem nada a dizer sobre o mês.
    metered = "/odds" in path

    url = f"{flavour['base']}{path}?{urllib.parse.urlencode(query)}"
    request = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT) as response:
            # Contar chamadas nunca pode estragar uma chamada que
            # correu bem: a conta é um acessório e o preço é o que ali
            # se foi buscar.
            if metered:
                cabecas = getattr(response, "headers", None)
                leitura = (
                    (lambda nome: cabecas.get(nome))
                    if hasattr(cabecas, "get")
                    else (lambda _nome: None)
                )
                _meter.update(
                    {
                        "remaining": _number(leitura("x-requests-remaining")),
                        "used": _number(leitura("x-requests-used")),
                        "last_cost": _number(leitura("x-requests-last")),
                        "ok": True,
                        "at": time.time(),
                    }
                )
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        if metered:
            # 401 numa chamada de preço com uma chave que a lista de
            # desportos aceita quer dizer uma coisa só: o mês acabou.
            _meter.update(
                {
                    "ok": False,
                    "status": exc.code,
                    "detail": (
                        "O saldo mensal de chamadas acabou."
                        if exc.code == 401
                        else f"A fonte respondeu {exc.code}."
                    ),
                    "at": time.time(),
                }
            )
        raise


def _number(value: Optional[str]) -> Optional[int]:
    try:
        return int(str(value).strip())
    except (TypeError, ValueError):
        return None


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

    # A chave ser aceite pela lista de desportos não quer dizer que
    # sirva para pedir preços: a lista é gratuita e continua a
    # responder depois de o saldo do mês acabar. Quem manda aqui é a
    # última chamada que gastou saldo.
    gasto = meter()
    travado = gasto.get("ok") is False

    return {
        "configured": True,
        "accepted": not travado,
        "detail": (
            gasto.get("detail") or "A fonte recusou o último pedido de preço."
            if travado
            else "Ligada."
        ),
        "service": found["flavour"]["name"],
        "our_leagues": sorted(ours),
        "missing_leagues": missing,
        "sports_listed": len(available),
        "quota": gasto or None,
    }


# Os mercados deles com os nomes que nós usamos.
_OUTCOME_NAMES = {"Draw": "Empate"}


def _ours(market: str, outcome: str, home: str, away: str) -> Optional[str]:
    """A que mercado nosso é que este resultado deles corresponde.

    Pelo nome da equipa e não pela posição em que ela aparece. As duas
    fontes chegam a discordar sobre quem joga em casa — no Porto–Gil
    Vicente de 24/10 o nosso quadro diz uma coisa e as casas dizem a
    outra — e aí ler "Casa" como "a nossa casa" dava o preço de uma
    equipa à outra. Pelo nome, uma troca de posição deixa de importar.
    """
    from injury_data import NAME_MATCH_FLOOR, _similar

    if market != "h2h":
        return None
    if outcome in ("Draw", "draw"):
        return "Empate"

    como_casa = _similar(home, outcome)
    como_fora = _similar(away, outcome)
    if max(como_casa, como_fora) < NAME_MATCH_FLOOR:
        return None
    return "Casa" if como_casa >= como_fora else "Fora"


def _median(values: List[float]) -> float:
    ordered = sorted(values)
    middle = len(ordered) // 2
    if len(ordered) % 2:
        return ordered[middle]
    return (ordered[middle - 1] + ordered[middle]) / 2


def _days_around(day: str) -> set:
    """O dia pedido, o anterior e o seguinte.

    Um jogo às 23:00 de sábado em Lisboa é domingo em metade do mundo, e
    cada fonte arredonda a data por fuso seu. Aceitar os três dias custa
    uma comparação a mais e evita perder os jogos da noite; o nome das
    duas equipas continua a ser quem decide.
    """
    if len(day) != 10:
        return set()
    import datetime

    try:
        base = datetime.date.fromisoformat(day)
    except ValueError:
        return set()
    return {
        (base + datetime.timedelta(days=offset)).isoformat()
        for offset in (-1, 0, 1)
    }


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
                    # Uma região e não duas. Cada região é uma chamada
                    # cobrada, e a casa europeia cobre estas ligas — o
                    # que se perde é uma ou outra casa inglesa a entrar
                    # na mediana, o que a mexe aos cêntimos. Pagar o
                    # dobro do saldo por isso era trocar o mês por
                    # cêntimos.
                    "regions": "eu",
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

    # O dia do pontapé de saída, com o anterior e o seguinte.
    #
    # A hora deles é UTC e a nossa também, mas um jogo às 19:30 de sábado
    # em Lisboa é 23:30 de sábado em São Paulo e 02:30 de domingo em
    # Tóquio — e cada fonte arredonda a data à sua maneira. Exigir o dia
    # exacto deixava de fora jogos à noite, que é quando eles são.
    day = (kickoff or "")[:10]
    nearby = _days_around(day)

    best, best_score = None, 0.0
    considered = []
    for game in listing:
        if not isinstance(game, dict):
            continue
        when = str(game.get("commence_time", ""))
        if nearby and when[:10] not in nearby:
            continue
        considered.append(
            f"{game.get('home_team')} vs {game.get('away_team')} ({when[:16]})"
        )
        theirs_home = game.get("home_team") or ""
        theirs_away = game.get("away_team") or ""
        # Nas duas orientações: o que identifica o jogo é o par de
        # equipas, e qual delas recebe é coisa em que as fontes
        # discordam. O preço vai pelo nome, por isso a troca não
        # estraga nada — e recusar o jogo por causa dela era deitar
        # fora o preço por uma discórdia que não nos diz respeito.
        direct = min(_similar(home, theirs_home), _similar(away, theirs_away))
        swapped = min(_similar(home, theirs_away), _similar(away, theirs_home))
        score = max(direct, swapped)
        if score > best_score:
            best, best_score = game, score
            if trace is not None:
                trace["swapped"] = swapped > direct

    if trace is not None:
        trace["games_seen"] = len(listing)
        trace["considered"] = considered[:12]
        trace["best_score"] = round(best_score, 3)

    if trace is not None and best is not None:
        trace["matched"] = (
            f"{best.get('home_team')} vs {best.get('away_team')}"
            f" ({str(best.get('commence_time', ''))[:16]})"
        )
        trace["books"] = len(best.get("bookmakers") or [])

    if best is None or best_score < NAME_MATCH_FLOOR:
        if trace is not None:
            trace["reason"] = "Nenhum jogo deles se parece o suficiente com este."
        return None

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
                    ours = _ours("h2h", label, home, away)
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


def with_doubles(prices: Dict[str, float]) -> Dict[str, float]:
    """As duplas hipóteses, tiradas das três simples.

    A fonte só dá 1X2 e totais, por isso o 1X e o 2X chegavam cá sem
    preço nenhum — e são precisamente os dois mercados que esta casa
    joga. Sem preço, nunca podiam ser sugeridos nem recusados: ficavam
    de fora da conversa, que é a pior das três coisas.

    Saem exactos das simples. Apostar ao mesmo tempo em Casa e em
    Empate, repartindo o dinheiro para receber o mesmo seja qual for o
    que entra, paga 1/(1/Casa + 1/Empate) — e é isso que uma dupla
    hipótese é. O preço traz a mesma margem que as três trazem, que é a
    margem a que esta pessoa tem acesso.

    Não é uma cotação: é o que as cotações desta casa obrigam. Quem o
    usar fica a saber, pelo campo `derived`.
    """
    out = dict(prices)
    trio = [prices.get(name) for name in _ONE_X_TWO]
    if not all(isinstance(price, (int, float)) and price > 1 for price in trio):
        return out

    casa, empate, fora = trio
    for name, pair in (("1X", (casa, empate)), ("2X", (fora, empate))):
        if name not in out:
            out[name] = round(1 / sum(1 / price for price in pair), 2)

    return out


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


def priced(
    league: str, home: str, away: str, kickoff: str
) -> Dict[str, Any]:
    """O preço do mercado para este jogo, já sem a margem da casa."""
    trace: Dict[str, Any] = {}
    prices = odds_for(league, home, away, kickoff, trace=trace)

    if not prices:
        # Não é a mesma coisa este jogo não ter preço e nós não termos
        # conseguido perguntar. Dizer "as casas ainda não abriram"
        # quando o que houve foi um 401 é pôr a culpa em quem não a
        # tem, e esconde um saldo esgotado atrás de uma frase que
        # parece normal.
        travado = meter().get("ok") is False
        return {
            "odds": None,
            "implied_pct": None,
            "derived": [],
            "home_away_disagrees": False,
            "blocked": travado,
            "detail": (
                meter().get("detail") or "A fonte recusou o pedido."
                if travado
                else "Sem preço de mercado para este jogo."
            ),
            "trace": trace,
        }

    completo = with_doubles(prices)

    return {
        "odds": completo,
        "implied_pct": implied_pct(completo),
        # Quais destes preços ninguém cotou e nós deduzimos. Quem lê
        # tem direito a saber a diferença.
        "derived": sorted(set(completo) - set(prices)),
        # De que jogo deles veio este preço, e de quantas casas.
        #
        # Isto faltava, e a falta custou caro: durante um dia a mesma
        # previsão saiu com preços que não podiam ser do mesmo jogo —
        # um 1,67 em casa que no dia seguinte era 4,45 — e não havia
        # maneira de saber se o motor tinha casado o jogo errado ou se
        # era o mercado a mexer. Um preço sem proveniência não se pode
        # defender nem desmentir.
        "matched": trace.get("matched"),
        "match_score": trace.get("best_score"),
        "books": trace.get("books"),
        # As duas fontes discordarem sobre quem joga em casa não estraga
        # o preço, que vai pelo nome. Fica guardado, sem alarido: medido
        # em jogos reais, acontece em dois terços deles.
        "home_away_disagrees": bool(trace.get("swapped")),
        "detail": "",
    }
