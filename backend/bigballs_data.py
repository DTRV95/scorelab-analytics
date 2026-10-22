"""Quem está de fora (BigBalls).

A API-Football gratuita pára em 2024, por isso as lesões vêm daqui. A
cobertura é menor — as cinco grandes ligas — e isso diz-se: nas outras o
dossiê fica a cinzento em vez de dar a entender que a equipa está inteira.

A documentação deles mostra dois modos de autenticar, `x-api-key` num
sítio e `Authorization: Bearer` noutro, e não diz qual é o certo. Em vez
de escolher à sorte, tentam-se os dois e guarda-se o que responder.
"""

import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Dict, List, Optional, Tuple

# Com o "api." à frente. Sem ele não há sequer servidor, e as quatro
# tentativas de autenticação falhavam todas pela mesma razão errada —
# o que escondeu o problema atrás de "a chave não foi aceite".
BASE_URL = "https://api.bigballsdata.com/v1"
REQUEST_TIMEOUT = 15
INJURY_TTL = 2 * 60 * 60
PROBE_TTL = 12 * 60 * 60

AUTH_STYLES = ("x-api-key", "bearer")

# O nome do desporto no parâmetro deles. O changelog mostra "basketball" e
# "ice_hockey"; para futebol pode ser qualquer um destes, e a sonda diz
# qual é que responde.
SPORT_GUESSES = ("football", "soccer")

# Onde eles têm lesões, pelo que a própria página diz: as cinco grandes e
# a MLS. Confirmado pela sonda contra o que a resposta trouxer.
COVERED_LEAGUES = {
    "Premier League",
    "La Liga",
    "Serie A",
    "Bundesliga",
    "Ligue 1",
}

_cache: Dict[str, Tuple[float, Any]] = {}


def get_api_key() -> str:
    return (os.getenv("BIGBALLS_API_KEY") or "").strip()


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


def _fetch(style: str, path: str, params: Dict[str, Any]) -> Any:
    api_key = get_api_key()
    headers = (
        {"x-api-key": api_key}
        if style == "x-api-key"
        else {"Authorization": f"Bearer {api_key}"}
    )
    url = f"{BASE_URL}{path}"
    if params:
        url = f"{url}?{urllib.parse.urlencode(params)}"
    request = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT) as response:
        return json.loads(response.read().decode("utf-8"))


def _shape_of(payload: Any, depth: int = 2) -> str:
    """A forma de uma resposta, sem o seu conteúdo.

    Para quando o servidor responde mas não com o que esperávamos: saber
    que campos vieram resolve num minuto o que à distância são horas de
    tentativa e erro. Só nomes de campos e tamanhos — nenhum valor, que
    é o que podia trazer dados de conta para dentro de uma resposta
    pública.
    """
    if isinstance(payload, dict):
        if depth <= 0:
            return "{…}"
        inner = ", ".join(
            f"{name}: {_shape_of(value, depth - 1)}"
            for name, value in list(payload.items())[:12]
        )
        return "{" + inner + "}"
    if isinstance(payload, list):
        return f"[{len(payload)} × {_shape_of(payload[0], depth - 1)}]" if payload else "[]"
    return type(payload).__name__


def _rows_of(payload: Any) -> Optional[List[Dict[str, Any]]]:
    """A lista de lesões lá de dentro, seja como for que a embrulhem."""
    if isinstance(payload, list):
        return [row for row in payload if isinstance(row, dict)]
    if not isinstance(payload, dict):
        return None
    for place in (payload.get("data"), payload):
        if isinstance(place, dict):
            rows = place.get("injuries")
            if isinstance(rows, list):
                return [row for row in rows if isinstance(row, dict)]
    return None


def _working(attempts: Optional[List[str]] = None) -> Optional[Dict[str, str]]:
    """Que maneira de autenticar e que nome de desporto é que respondem.

    `attempts` recolhe o que cada tentativa respondeu. Sem isso, quatro
    falhas por razões diferentes — servidor inexistente, chave recusada,
    desporto desconhecido — saem todas como "a chave não foi aceite", e
    foi assim que um domínio mal escrito passou por chave inválida.
    """
    remembered = _cached("probe", PROBE_TTL)
    if remembered is not None:
        return remembered or None

    for style in AUTH_STYLES:
        for sport in SPORT_GUESSES:
            try:
                payload = _fetch(style, "/injuries", {"sport": sport})
            except urllib.error.HTTPError as exc:
                if attempts is not None:
                    attempts.append(f"{style}/{sport}: respondeu {exc.code}")
                continue
            except Exception as exc:
                if attempts is not None:
                    attempts.append(f"{style}/{sport}: {type(exc).__name__} {exc}")
                continue
            if _rows_of(payload) is None:
                if attempts is not None:
                    attempts.append(
                        f"{style}/{sport}: respondeu sem lista de lesões, "
                        f"trouxe {_shape_of(payload)}"
                    )
                continue
            answer = {"auth": style, "sport": sport}
            _store("probe", answer)
            return answer

    return None


def account_status() -> Dict[str, Any]:
    """Se a chave das lesões serve, e por que porta é que entrou."""
    if not is_configured():
        return {
            "configured": False,
            "accepted": False,
            "detail": "Sem chave. Falta a variável BIGBALLS_API_KEY no servidor.",
        }

    attempts: List[str] = []
    found = _working(attempts)
    if not found:
        return {
            "configured": True,
            "accepted": False,
            "detail": (
                "A BigBalls não aceitou esta chave por nenhuma das formas "
                "conhecidas, nem para 'football' nem para 'soccer'."
            ),
            "attempts": attempts,
        }

    rows = all_injuries() or []
    teams = sorted({_team_of(row) for row in rows if _team_of(row)})
    return {
        "configured": True,
        "accepted": True,
        "detail": "Ligada.",
        "auth": found["auth"],
        "sport": found["sport"],
        "rows": len(rows),
        "teams_listed": len(teams),
        "sample_teams": teams[:15],
        "covered_leagues": sorted(COVERED_LEAGUES),
    }


def _team_of(row: Dict[str, Any]) -> str:
    player = row.get("player")
    if isinstance(player, dict):
        team = player.get("team")
        if isinstance(team, dict):
            return str(team.get("name") or "")
        if isinstance(team, str):
            return team
    team = row.get("team")
    if isinstance(team, dict):
        return str(team.get("name") or "")
    return str(team or "")


def all_injuries() -> Optional[List[Dict[str, Any]]]:
    """Toda a tabela de lesionados do futebol, como eles a dão.

    Uma chamada só, guardada duas horas: eles dão isto por desporto e não
    por jogo, e pedir por equipa seria gastar duas chamadas para ver o
    mesmo que uma já traz.
    """
    if not is_configured():
        return None

    remembered = _cached("rows", INJURY_TTL)
    if remembered is not None:
        return remembered

    found = _working()
    if not found:
        return None

    try:
        payload = _fetch(found["auth"], "/injuries", {"sport": found["sport"]})
    except Exception:
        return None

    rows = _rows_of(payload)
    if rows is None:
        return None

    _store("rows", rows)
    return rows


def for_teams(
    league: str, home: str, away: str
) -> Optional[Dict[str, List[Dict[str, Any]]]]:
    """Quem falta a estas duas equipas. Nada quando não sabemos.

    Numa liga que eles não cobrem devolve-se nada em vez de uma lista
    vazia: "não há lesionados" e "ninguém olhou" não são a mesma coisa, e
    a segunda não pode passar pela primeira.
    """
    if league not in COVERED_LEAGUES:
        return None

    rows = all_injuries()
    if rows is None:
        return None

    from injury_data import NAME_MATCH_FLOOR, _similar

    out: Dict[str, List[Dict[str, Any]]] = {home: [], away: []}
    for row in rows:
        team = _team_of(row)
        if not team:
            continue
        for ours in (home, away):
            if _similar(ours, team) >= NAME_MATCH_FLOOR:
                player = row.get("player") if isinstance(row.get("player"), dict) else {}
                out[ours].append(
                    {
                        "name": player.get("name") or row.get("name") or "?",
                        "status": row.get("status") or "",
                        "reason": row.get("injury_type") or row.get("reason") or "",
                        "updated_at": row.get("updated_at") or "",
                    }
                )
                break

    return out
