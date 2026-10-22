"""Quem está de fora (Bzzoiro).

Cada jogo deles traz um campo com os jogadores indisponíveis — lesionados,
suspensos e em dúvida — agrupados por equipa. É o que faltava, e ao
contrário das outras duas não pára numa época antiga nem deixa a Liga
Portugal de fora.

Como nas anteriores, a documentação não é clara sobre o caminho nem sobre
o cabeçalho: aparece `/api/events/` num sítio e `/api/v2/events/` noutro,
com `Token` ou `Bearer`. Tentam-se as combinações e guarda-se a que
responder — já aprendi o que custa adivinhar.
"""

import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Dict, List, Optional, Tuple

BASE = "https://sports.bzzoiro.com"
REQUEST_TIMEOUT = 15
EVENTS_TTL = 30 * 60
PROBE_TTL = 12 * 60 * 60

# Dois caminhos e duas maneiras de autenticar, porque a documentação
# mostra ambas. A ordem não decide nada — ver _working.
PATHS = ("/api/events/", "/api/v2/events/")
AUTH_STYLES = ("Token", "Bearer")

# E, para os caminhos que não as trazem de origem, as formas conhecidas
# de pedir as baixas à mistura.
INCLUDES = (None, "unavailable_players", "unavailable_players,lineups")

_cache: Dict[str, Tuple[float, Any]] = {}


def get_api_key() -> str:
    return (os.getenv("BZZOIRO_API_KEY") or "").strip()


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


def _fetch(path: str, style: str, params: Optional[Dict[str, Any]] = None) -> Any:
    url = f"{BASE}{path}"
    if params:
        url = f"{url}?{urllib.parse.urlencode(params)}"
    request = urllib.request.Request(
        url, headers={"Authorization": f"{style} {get_api_key()}"}
    )
    with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT) as response:
        return json.loads(response.read().decode("utf-8"))


# Quantas páginas se seguem, no máximo. Um dia de futebol no mundo
# inteiro passa das cinquenta de uma página; quatro chegam para os
# nossos jogos sem transformar isto numa raspagem.
MAX_PAGES = 4


def _next_of(payload: Any) -> Optional[str]:
    """O endereço da página seguinte, quando a resposta é paginada.

    O embrulho com "results" e "next" é o do Django REST Framework, que
    é o que esta fonte usa. Seguir o "next" é melhor do que inventar um
    "?page=2": se eles mudarem de maneira de paginar, o endereço deles
    continua certo e o nosso palpite não.
    """
    if isinstance(payload, dict):
        nxt = payload.get("next")
        if isinstance(nxt, str) and nxt.startswith("http"):
            return nxt
    return None


def _fetch_url(url: str, style: str) -> Any:
    request = urllib.request.Request(
        url, headers={"Authorization": f"{style} {get_api_key()}"}
    )
    with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT) as response:
        return json.loads(response.read().decode("utf-8"))


def _events_of(payload: Any) -> Optional[List[Dict[str, Any]]]:
    """A lista de jogos, seja como for que a embrulhem."""
    if isinstance(payload, list):
        return [row for row in payload if isinstance(row, dict)]
    if not isinstance(payload, dict):
        return None
    for name in ("results", "events", "data", "items"):
        inner = payload.get(name)
        if isinstance(inner, list):
            return [row for row in inner if isinstance(row, dict)]
        if isinstance(inner, dict):
            for deeper in inner.values():
                if isinstance(deeper, list):
                    return [row for row in deeper if isinstance(row, dict)]
    return None


def _shape_of(payload: Any, depth: int = 2) -> str:
    """A forma de uma resposta, sem o seu conteúdo. Só campos e tamanhos."""
    if isinstance(payload, dict):
        if depth <= 0:
            return "{…}"
        return (
            "{"
            + ", ".join(
                f"{name}: {_shape_of(value, depth - 1)}"
                for name, value in list(payload.items())[:14]
            )
            + "}"
        )
    if isinstance(payload, list):
        return f"[{len(payload)} × {_shape_of(payload[0], depth - 1)}]" if payload else "[]"
    return type(payload).__name__


def _working(attempts: Optional[List[str]] = None) -> Optional[Dict[str, Any]]:
    """O caminho que traz as baixas — e não só o primeiro que responde.

    Um caminho responder não chega. O /api/v2/events/ responde com
    cinquenta jogos e nenhum deles traz indisponíveis, que é a única
    coisa por que viemos aqui. Por isso prova-se cada combinação e
    guarda-se a que trouxer baixas; a que só responde fica como recurso,
    porque dela ainda sai o árbitro e o estádio.
    """
    remembered = _cached("probe", PROBE_TTL)
    if remembered is not None:
        return remembered or None

    fallback = None

    for path in PATHS:
        for style in AUTH_STYLES:
            for include in INCLUDES:
                params = {"include": include} if include else None
                rotulo = f"{path} {style}" + (f" +{include}" if include else "")
                try:
                    payload = _fetch(path, style, params)
                except urllib.error.HTTPError as exc:
                    if attempts is not None:
                        attempts.append(f"{rotulo}: respondeu {exc.code}")
                    continue
                except Exception as exc:
                    if attempts is not None:
                        attempts.append(f"{rotulo}: {type(exc).__name__}")
                    continue

                events = _events_of(payload)
                if events is None:
                    if attempts is not None:
                        attempts.append(
                            f"{rotulo}: sem lista de jogos, trouxe "
                            f"{_shape_of(payload)}"
                        )
                    continue

                com_baixas = sum(
                    1 for event in events if _unavailable_of(event) is not None
                )
                if attempts is not None:
                    attempts.append(
                        f"{rotulo}: {len(events)} jogos, {com_baixas} com baixas"
                    )

                answer = {"path": path, "style": style, "include": include}
                if com_baixas:
                    _store("probe", answer)
                    return answer
                if fallback is None:
                    fallback = answer

    if fallback is not None:
        _store("probe", fallback)
    return fallback


def account_status() -> Dict[str, Any]:
    """Se a fonte de lesões serve, e se os jogos dela trazem as baixas."""
    if not is_configured():
        return {
            "configured": False,
            "accepted": False,
            "detail": "Sem chave. Falta a variável BZZOIRO_API_KEY no servidor.",
        }

    attempts: List[str] = []
    found = _working(attempts)
    if not found:
        return {
            "configured": True,
            "accepted": False,
            "detail": "A Bzzoiro não respondeu por nenhum dos caminhos conhecidos.",
            "attempts": attempts,
        }

    events = all_events() or []
    com_baixas = [event for event in events if _unavailable_of(event) is not None]

    return {
        "configured": True,
        "accepted": True,
        "detail": "Ligada.",
        "path": found["path"],
        "auth": found["style"],
        "include": found.get("include"),
        "attempts": attempts,
        "events": len(events),
        "events_with_absences": len(com_baixas),
        # A forma de um jogo, para se confirmar de onde saem os nomes sem
        # precisar de outra ida ao ar.
        "event_shape": _shape_of(events[0], depth=2) if events else "[]",
        "absence_shape": (
            _shape_of(_unavailable_of(com_baixas[0]), depth=3)
            if com_baixas
            else "nenhum jogo trouxe baixas"
        ),
    }


def all_events(day: Optional[str] = None) -> Optional[List[Dict[str, Any]]]:
    """Os jogos de um dia, ou os que eles derem por omissão.

    Sem data vêm os de hoje — cinquenta — e um jogo de sábado não está
    lá. Pede-se pelo dia; se eles não souberem filtrar, fica a lista de
    sempre, que é melhor do que nada.
    """
    if not is_configured():
        return None

    key = f"events:{day or 'hoje'}"
    remembered = _cached(key, EVENTS_TTL)
    if remembered is not None:
        return remembered

    found = _working()
    if not found:
        return None

    params: Dict[str, Any] = {}
    if found.get("include"):
        params["include"] = found["include"]
    if day:
        # date_from+date_to e mais nenhum. Perguntei-lhes as seis
        # grafias habituais: "date", "event_date", "day",
        # "start_date+end_date" e "from+to" foram todas aceites sem se
        # queixarem e todas devolveram a mesma página de sempre. Só este
        # par mudou a resposta.
        params["date_from"] = day
        params["date_to"] = day
    # A lista vem em páginas de cinquenta, e um sábado de futebol no
    # mundo inteiro são muito mais do que isso.
    params["limit"] = 200

    try:
        payload = _fetch(found["path"], found["style"], params or None)
    except Exception:
        payload = None

    events = _events_of(payload) if payload is not None else None

    # E as páginas seguintes, enquanto as houver: a Liga Portugal fica
    # para lá das primeiras cinquenta num sábado.
    pages = 1
    while events is not None and pages < MAX_PAGES:
        seguinte = _next_of(payload)
        if not seguinte:
            break
        try:
            payload = _fetch_url(seguinte, found["style"])
        except Exception:
            break
        mais = _events_of(payload)
        if not mais:
            break
        events = events + mais
        pages += 1
    if events is None and day:
        # O filtro pode não existir. A lista de sempre ainda pode ter o
        # jogo, e a comparação de nomes é que decide.
        return all_events()
    if events is None:
        return None

    _store(key, events)
    return events


def _unavailable_of(event: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    for name in ("unavailable_players", "unavailablePlayers", "absences"):
        value = event.get(name)
        if isinstance(value, dict) and value:
            return value
    return None


def _side_names(block: Any) -> List[Dict[str, str]]:
    """Os jogadores de um lado, venham eles como vierem.

    Eles dão quatro coisas por jogador — nome, estado, motivo e data
    prevista de regresso — e as três últimas não são a mesma. "Dúvida"
    por causa de uma pancada não vale o mesmo que "fora" com regresso
    marcado para Dezembro, e quem decide a aposta precisa da diferença.
    """
    out: List[Dict[str, str]] = []
    if not isinstance(block, list):
        return out
    for entry in block:
        if isinstance(entry, str):
            out.append({"name": entry, "status": "", "reason": "", "back": ""})
        elif isinstance(entry, dict):
            name = entry.get("name") or entry.get("player") or ""
            if name:
                out.append(
                    {
                        "name": str(name),
                        "status": str(entry.get("status") or ""),
                        "reason": str(entry.get("reason") or ""),
                        "back": str(entry.get("expected_return") or ""),
                    }
                )
    return out


def _teams_of(event: Dict[str, Any]) -> Tuple[str, str]:
    for pair in (("home_team", "away_team"), ("home", "away"), ("local", "visitor")):
        first, second = event.get(pair[0]), event.get(pair[1])
        if isinstance(first, dict):
            first = first.get("name")
        if isinstance(second, dict):
            second = second.get("name")
        if first and second:
            return str(first), str(second)
    return "", ""


def for_match(
    home: str, away: str, kickoff: str, trace: Optional[Dict] = None
) -> Optional[Dict[str, List[Dict[str, str]]]]:
    """Quem falta a este jogo, por equipa. Nada quando não se sabe.

    Como em toda esta casa: nada e lista vazia não são a mesma coisa. Uma
    lista vazia diz "estão todos bons"; nada diz "ninguém olhou".
    """
    day = (kickoff or "")[:10]
    events = all_events(day or None)
    if events is None:
        if trace is not None:
            trace["reason"] = "A fonte de baixas não respondeu."
        return None

    from injury_data import NAME_MATCH_FLOOR, _similar
    from odds_api import _days_around

    nearby = _days_around(day)
    best, best_score, swapped_at_best = None, 0.0, False

    for event in events:
        theirs_home, theirs_away = _teams_of(event)
        if not theirs_home or not theirs_away:
            continue
        when = str(
            event.get("start_time") or event.get("date") or event.get("commence_time") or ""
        )
        if nearby and when[:10] and when[:10] not in nearby:
            continue

        direct = min(_similar(home, theirs_home), _similar(away, theirs_away))
        swap = min(_similar(home, theirs_away), _similar(away, theirs_home))
        score = max(direct, swap)
        if score > best_score:
            best, best_score, swapped_at_best = event, score, swap > direct

    if trace is not None:
        trace["events_seen"] = len(events)
        trace["best_score"] = round(best_score, 3)
        trace["considered"] = [
            f"{_teams_of(e)[0]} vs {_teams_of(e)[1]}"
            for e in events
            if _teams_of(e)[0]
        ][:10]

    if best is None or best_score < NAME_MATCH_FLOOR:
        if trace is not None:
            trace["reason"] = "Não encontrámos este jogo na fonte de baixas."
        return None

    block = _unavailable_of(best)
    if block is None:
        if trace is not None:
            trace["reason"] = "Este jogo veio sem lista de indisponíveis."
        return None

    # As chaves deles são "home"/"away"; as nossas são os nomes das
    # equipas. Se o jogo veio ao contrário, os lados trocam com ele.
    first, second = ("away", "home") if swapped_at_best else ("home", "away")

    def team_id(side: str) -> Any:
        obj = best.get(f"{side}_team_obj")
        return obj.get("id") if isinstance(obj, dict) else None

    return {
        home: _with_positions(_side_names(block.get(first)), team_id(first)),
        away: _with_positions(_side_names(block.get(second)), team_id(second)),
    }


# As grafias por que uma API costuma aceitar uma data. Qual delas esta
# entende, descobre-se perguntando — adivinhar já me custou caro.
DATE_PARAMS = (
    ("date",),
    ("event_date",),
    ("day",),
    ("date_from", "date_to"),
    ("start_date", "end_date"),
    ("from", "to"),
)


def date_probe(day: str) -> Dict[str, Any]:
    """Que parâmetro é que filtra mesmo por data, se algum.

    Sem data vêm sempre os mesmos cinquenta jogos — Al-Hazem, Kairat
    Almaty — que é uma página fixa de uma lista enorme. Por isso a
    pergunta não é "respondeu?", é "mudou?": compara-se cada tentativa
    com a resposta sem filtro nenhum.
    """
    if not is_configured():
        return {"configured": False}

    found = _working()
    if not found:
        return {"configured": True, "accepted": False}

    def datas(events: List[Dict[str, Any]]) -> List[str]:
        vistos = []
        for event in events:
            when = str(
                event.get("event_date") or event.get("start_time") or ""
            )[:10]
            if when and when not in vistos:
                vistos.append(when)
        return vistos[:4]

    base = _events_of(_fetch(found["path"], found["style"])) or []
    out: Dict[str, Any] = {
        "sem_filtro": {"events": len(base), "dates": datas(base)},
        "tentativas": [],
    }

    for names in DATE_PARAMS:
        params = {name: day for name in names}
        rotulo = "+".join(names)
        try:
            events = _events_of(_fetch(found["path"], found["style"], params))
        except urllib.error.HTTPError as exc:
            out["tentativas"].append({"params": rotulo, "erro": f"HTTP {exc.code}"})
            continue
        except Exception as exc:
            out["tentativas"].append({"params": rotulo, "erro": type(exc).__name__})
            continue

        if events is None:
            out["tentativas"].append({"params": rotulo, "erro": "sem lista"})
            continue

        out["tentativas"].append(
            {
                "params": rotulo,
                "events": len(events),
                "dates": datas(events),
                # O que interessa: mudou alguma coisa, ou devolveu a
                # mesma página de sempre?
                "mudou": datas(events) != datas(base),
            }
        )

    return out


# Os sítios onde uma fonte destas costuma guardar quem jogou. Saber que
# um ausente foi titular nos últimos dez jogos é a diferença entre "falta
# um jogador" e "falta o jogador" — e é a pergunta que o utilizador faz.
SQUAD_PATHS = (
    "/api/lineups/",
    "/api/events/{event}/lineups/",
    "/api/events/{event}/",
    "/api/teams/{team}/players/",
    "/api/players/",
)


def squad_probe(event_id: Any = None, team_id: Any = None) -> Dict[str, Any]:
    """Se há maneira de saber quem costuma ser titular.

    Diagnóstico. Lista o que cada caminho responde, para se decidir com
    dados em vez de com palpites — que nesta fonte já me custaram cinco.
    """
    if not is_configured():
        return {"configured": False}

    found = _working()
    if not found:
        return {"configured": True, "accepted": False}

    # Sem ids à mão, tira-se um jogo da lista para ter por onde pegar.
    if event_id is None or team_id is None:
        events = all_events() or []
        if events:
            event_id = event_id or events[0].get("id")
            casa = events[0].get("home_team_obj")
            if isinstance(casa, dict):
                team_id = team_id or casa.get("id")

    out: Dict[str, Any] = {
        "event_id": event_id,
        "team_id": team_id,
        "tentativas": [],
    }

    for template in SQUAD_PATHS:
        path = template.format(event=event_id, team=team_id)
        if "{" in path or "None" in path:
            out["tentativas"].append({"path": template, "erro": "sem id"})
            continue
        params = {"event": event_id} if path == "/api/lineups/" else None
        if path == "/api/players/":
            params = {"team": team_id}
        try:
            payload = _fetch(path, found["style"], params)
        except urllib.error.HTTPError as exc:
            out["tentativas"].append({"path": path, "erro": f"HTTP {exc.code}"})
            continue
        except Exception as exc:
            out["tentativas"].append({"path": path, "erro": type(exc).__name__})
            continue

        out["tentativas"].append({"path": path, "forma": _shape_of(payload, depth=3)})

    return out


SQUAD_TTL = 24 * 60 * 60

# A posição como eles a escrevem, em português.
POSITIONS = {
    "goalkeeper": "guarda-redes",
    "defender": "defesa",
    "midfielder": "médio",
    "attacker": "avançado",
    "forward": "avançado",
    "striker": "avançado",
}


def squad(team_id: Any) -> Dict[str, str]:
    """O plantel de uma equipa: nome -> posição.

    É o que esta fonte dá sobre jogadores, e é menos do que se queria:
    não há minutos jogados nem jogos feitos, por isso daqui não sai
    nenhuma medida de quem é importante. Sai a posição, que já é
    bastante — faltar o guarda-redes não é faltar um extremo.
    """
    if not is_configured() or not team_id:
        return {}

    key = f"squad:{team_id}"
    remembered = _cached(key, SQUAD_TTL)
    if remembered is not None:
        return remembered

    found = _working()
    if not found:
        return {}

    try:
        payload = _fetch("/api/players/", found["style"], {"team": team_id})
    except Exception:
        return {}

    rows = payload.get("results") if isinstance(payload, dict) else None
    if not isinstance(rows, list):
        return {}

    out: Dict[str, str] = {}
    for row in rows:
        if not isinstance(row, dict):
            continue
        name = str(row.get("name") or "").strip()
        if not name:
            continue
        raw = str(row.get("position") or "").strip().lower()
        out[name] = POSITIONS.get(raw, raw)

    _store(key, out)
    return out


def _with_positions(
    players: List[Dict[str, str]], team_id: Any
) -> List[Dict[str, str]]:
    """A posição de cada ausente, quando o plantel a souber."""
    if not players or not team_id:
        return players

    plantel = squad(team_id)
    if not plantel:
        return players

    from injury_data import NAME_MATCH_FLOOR, _similar

    for player in players:
        posicao = plantel.get(player["name"])
        if posicao is None:
            # O nome na ficha de lesões nem sempre é o do plantel:
            # "Sávio" contra "Sávio Moreira de Oliveira".
            melhor, nota = "", 0.0
            for nome, pos in plantel.items():
                parecenca = _similar(player["name"], nome)
                if parecenca > nota:
                    melhor, nota = pos, parecenca
            posicao = melhor if nota >= NAME_MATCH_FLOOR else ""
        player["position"] = posicao or ""

    return players
