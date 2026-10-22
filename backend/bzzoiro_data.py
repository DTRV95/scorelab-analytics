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
        params["date"] = day

    try:
        payload = _fetch(found["path"], found["style"], params or None)
    except Exception:
        payload = None

    events = _events_of(payload) if payload is not None else None
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
    return {
        home: _side_names(block.get(first)),
        away: _side_names(block.get(second)),
    }
