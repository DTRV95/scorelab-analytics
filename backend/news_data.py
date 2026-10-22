"""As notícias da semana sobre as duas equipas, pelos feeds RSS.

Sem chave e sem conta: os jornais publicam isto aberto. É a única fonte
de contexto desta casa que não depende de ninguém nos deixar entrar.

O que daqui sai são títulos com a hora e o link, e mais nada. Não se lê o
que eles dizem nem se decide que um título sobre uma lesão é uma lesão:
quem lê és tu. Um modelo a resumir manchetes inventaria baixas que não
existem, e é precisamente nesta secção que se acredita.
"""

import re
import time
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from typing import Any, Dict, List, Optional, Tuple

REQUEST_TIMEOUT = 10
FEED_TTL = 30 * 60
# Uma semana: o que interessa é o que mudou desde o último jogo.
WINDOW_DAYS = 7
PER_TEAM = 6

FEEDS = (
    ("Record", "https://www.record.pt/rss/"),
    ("Maisfutebol", "https://www.maisfutebol.com.pt/rss/all.xml"),
    ("Maisfutebol", "https://www.maisfutebol.com.pt/rss/noticias.xml"),
)

_cache: Dict[str, Tuple[float, Any]] = {}


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


def _text(node: Optional[ET.Element]) -> str:
    return (node.text or "").strip() if node is not None else ""


def _when(raw: str) -> Optional[float]:
    """A hora de publicação, nos formatos que os feeds usam."""
    raw = (raw or "").strip()
    if not raw:
        return None
    for shape in (
        "%a, %d %b %Y %H:%M:%S %z",
        "%a, %d %b %Y %H:%M:%S %Z",
        "%Y-%m-%dT%H:%M:%S%z",
        "%Y-%m-%d %H:%M:%S",
    ):
        try:
            parsed = time.strptime(raw, shape)
        except ValueError:
            continue
        try:
            return time.mktime(parsed)
        except (OverflowError, ValueError):
            return None
    return None


def _fetch(url: str) -> List[Dict[str, Any]]:
    request = urllib.request.Request(
        url,
        # Alguns jornais recusam um pedido sem identificação nenhuma.
        headers={"User-Agent": "ScoreLab/1.0 (+leitor de RSS)"},
    )
    with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT) as response:
        raw = response.read()

    root = ET.fromstring(raw)
    items = []
    for item in root.iter("item"):
        title = _text(item.find("title"))
        if not title:
            continue
        items.append(
            {
                "title": title,
                "link": _text(item.find("link")),
                "at": _when(_text(item.find("pubDate"))),
            }
        )
    return items


def headlines() -> List[Dict[str, Any]]:
    """Tudo o que os feeds trouxeram, dos mais recentes para trás.

    Um jornal em baixo não leva os outros atrás: cada feed falha por si e
    o que vier serve.
    """
    remembered = _cached("headlines", FEED_TTL)
    if remembered is not None:
        return remembered

    floor = time.time() - WINDOW_DAYS * 86400
    gathered: List[Dict[str, Any]] = []
    seen = set()

    for source, url in FEEDS:
        try:
            items = _fetch(url)
        except Exception:
            continue
        for item in items:
            # Sem data não se deita fora: um título sem pubDate é quase
            # sempre de hoje, e perdê-lo era perder a notícia da véspera
            # do jogo, que é a que conta.
            if item["at"] is not None and item["at"] < floor:
                continue
            key = item["title"].lower()
            if key in seen:
                continue
            seen.add(key)
            gathered.append({**item, "source": source})

    gathered.sort(key=lambda item: item["at"] or 0, reverse=True)
    _store("headlines", gathered)
    return gathered


def _mentions(title: str, words: set) -> bool:
    """Se o título fala desta equipa.

    Por palavra inteira: "Porto" não pode ser apanhado dentro de
    "Portomosense", e "Braga" dentro de "Bragança".
    """
    lowered = f" {title.lower()} "
    return any(
        re.search(rf"\b{re.escape(word)}\b", lowered) for word in words
    )


def for_teams(home: str, away: str) -> Dict[str, List[Dict[str, Any]]]:
    """Os títulos da semana sobre cada uma das duas equipas."""
    from injury_data import _words

    out: Dict[str, List[Dict[str, Any]]] = {home: [], away: []}
    todos = headlines()

    for team in (home, away):
        words = {word for word in _words(team) if len(word) > 3}
        if not words:
            continue
        for item in todos:
            if len(out[team]) >= PER_TEAM:
                break
            if _mentions(item["title"], words):
                out[team].append(item)

    return out


def probe() -> Dict[str, Any]:
    """Que jornais respondem, com quantos títulos e quais.

    Os feeds vêm vazios na página do jogo e daqui não se chega a eles,
    por isso a pergunta — "é o jornal que não responde ao servidor, ou
    somos nós que não reconhecemos a equipa no título?" — só se responde
    de lá.
    """
    feeds = []
    for source, url in FEEDS:
        try:
            items = _fetch(url)
        except urllib.error.HTTPError as exc:
            feeds.append({"source": source, "url": url, "error": f"HTTP {exc.code}"})
            continue
        except Exception as exc:
            feeds.append(
                {"source": source, "url": url, "error": f"{type(exc).__name__}: {exc}"}
            )
            continue
        feeds.append(
            {
                "source": source,
                "url": url,
                "items": len(items),
                "sample": [item["title"] for item in items[:4]],
                "dated": sum(1 for item in items if item["at"] is not None),
            }
        )

    forget()
    kept = headlines()
    return {
        "feeds": feeds,
        "kept_after_window": len(kept),
        "sample_kept": [item["title"] for item in kept[:6]],
    }
