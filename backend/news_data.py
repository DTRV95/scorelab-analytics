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
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from typing import Any, Dict, List, Optional, Tuple

REQUEST_TIMEOUT = 10
FEED_TTL = 30 * 60
# Uma semana: o que interessa é o que mudou desde o último jogo.
WINDOW_DAYS = 7
PER_TEAM = 6

# A primeira página do Record, que serve de pano de fundo. Os feeds do
# Maisfutebol saíram: vinham onze e oito títulos, velhos e alguns sem
# sentido ("Tamagnini", "ffgg"), que é um feed abandonado.
FEEDS = (("Record", "https://www.record.pt/rss/"),)

# E, por equipa, a pesquisa do Google Notícias — sem chave e sem conta.
#
# Esperar que uma equipa concreta apareça nos vinte títulos da primeira
# página de um jornal é esperar sentado: num jogo do Gil Vicente não
# aparece nenhum. Procurar pelo nome dela resolve isso num pedido.
SEARCH_URL = "https://news.google.com/rss/search"

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
    """O texto de um nó, já sem o embrulho.

    Alguns feeds entregam o título dentro de um CDATA que chega aqui como
    texto literal, "<![CDATA[ Messi revela... ]]>", e era assim que ele
    ia parar ao ecrã.
    """
    if node is None:
        return ""
    raw = (node.text or "").strip()
    match = re.fullmatch(r"<!\[CDATA\[(.*)\]\]>", raw, re.DOTALL)
    if match:
        raw = match.group(1)
    return raw.strip()


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


# Sítios que não escrevem notícias: guias de transmissão, agregadores de
# resultados e casas de apostas. O que eles publicam sobre um jogo é
# sempre a mesma página gerada, e ela nunca diz nada sobre a equipa.
LIXO_FONTES = (
    "dazn", "disney", "sofascore", "flashscore", "fotmob", "365scores",
    "bet365", "betano", "placard", "betclic", "solverde", "esc online",
    "onefootball", "livescore", "scores24", "footystats",
)

# E os títulos que essas páginas usam, para quando a fonte vem noutro
# nome. "H2H e escalações" nunca foi uma notícia.
LIXO_TITULOS = (
    "placar ao vivo", "h2h", "assistir", "onde ver", "onde assistir",
    "transmissão", "em direto online", "ao vivo e online", "resumos da",
    "palpites", "prognóstico", "prognósticos", "dicas de aposta",
    "melhores odds", "apostar em", "escalações", "classificação",
    "tabela da", "calendário completo",
)

# O que faz de um título uma informação para quem vai apostar: alguma
# coisa que muda quem joga. Tudo o resto — declarações, bilheteira,
# aniversários do clube — é texto bonito que não move uma probabilidade.
# Afinadas contra o que elas deixaram passar à primeira.
#
# Saíram "volta a" ("Técnico volta a falar sobre Richarlison"), "dúvida"
# solta ("Tottenham ainda deixa dúvidas") e "titular" ("Tottenham de
# olho em titular das águias" — mercado de transferências, não baixas).
# Ficam as que só aparecem quando alguém entra ou sai mesmo.
RELEVANTE = (
    "lesão", "lesao", "lesionado", "lesionada", "lesionados", "lesionadas",
    "baixa", "baixas", "desfalque", "desfalques",
    "ausência", "ausencia", "ausente", "ausentes",
    "castigo", "castigado", "suspenso", "suspensa", "suspensão", "suspensao",
    "expulso", "convocados", "convocatória", "convocatoria",
    "cirurgia", "operado", "contratempo",
    "regressa", "recupera", "recuperado", "recuperada", "poupado",
    "em dúvida", "em duvida", "onze provável", "onze provavel",
    "problema físico", "problema fisico", "fora dos convocados",
    "treino condicionado",
)


def _junk(item: Dict[str, Any]) -> bool:
    """Se isto é uma página gerada em vez de uma notícia."""
    fonte = (item.get("source") or "").lower()
    if any(nome in fonte for nome in LIXO_FONTES):
        return True
    titulo = (item.get("title") or "").lower()
    return any(marca in titulo for marca in LIXO_TITULOS)


def _useful(title: str) -> bool:
    """Se o título fala de alguém entrar ou sair da equipa.

    Por palavra inteira, que é o que faltava: "baixa" apanhada dentro de
    "rebaixamento" meteu cá dentro "Tottenham vence o Coventry e sai da
    zona de rebaixamento", que não é uma baixa de ninguém.
    """
    lowered = title.lower()
    return any(
        re.search(rf"(?<![0-9a-zà-ÿ]){re.escape(palavra)}(?![0-9a-zà-ÿ])", lowered)
        for palavra in RELEVANTE
    )


def _mentions(title: str, words: set) -> bool:
    """Se o título fala desta equipa.

    Por palavra inteira: "Porto" não pode ser apanhado dentro de
    "Portomosense", e "Braga" dentro de "Bragança".
    """
    lowered = f" {title.lower()} "
    return any(
        re.search(rf"\b{re.escape(word)}\b", lowered) for word in words
    )


def about(team: str) -> List[Dict[str, Any]]:
    """O que se escreveu sobre esta equipa nos últimos sete dias."""
    if not team.strip():
        return []

    key = f"team:{team.lower()}"
    remembered = _cached(key, FEED_TTL)
    if remembered is not None:
        return remembered

    params = urllib.parse.urlencode(
        {
            "q": f'"{team}" futebol when:{WINDOW_DAYS}d',
            "hl": "pt-PT",
            "gl": "PT",
            "ceid": "PT:pt",
        }
    )
    try:
        items = _fetch(f"{SEARCH_URL}?{params}")
    except Exception:
        return []

    out = []
    for item in items:
        if len(out) >= PER_TEAM:
            break
        title, _, source = item["title"].rpartition(" - ")
        # O Google põe o jornal no fim do título, a seguir a um travessão.
        candidato = {
            "title": title or item["title"],
            "link": item["link"],
            "at": item["at"],
            "source": source.strip() if title else "Google Notícias",
        }
        # Dois crivos, e são apertados de propósito.
        #
        # Sem eles, um jogo do Go Ahead Eagles trazia "Portugal: Go-ahead
        # given for Sines hydrogen projects" e três guias de transmissão.
        # Ruído com ar de informação é pior do que não ter nada: ocupa o
        # ecrã e ensina a não ler a secção.
        if _junk(candidato) or not _useful(candidato["title"]):
            continue
        out.append(candidato)

    _store(key, out)
    return out


def for_teams(home: str, away: str) -> Dict[str, List[Dict[str, Any]]]:
    """Os títulos da semana sobre cada uma das duas equipas.

    Procurados pelo nome de cada uma. A primeira página do Record entra
    como reforço, para o caso de a pesquisa não trazer nada.
    """
    from injury_data import _words

    out: Dict[str, List[Dict[str, Any]]] = {}
    todos = headlines()

    for team in (home, away):
        encontrados = about(team)
        vistos = {item["title"].lower() for item in encontrados}

        if len(encontrados) < PER_TEAM:
            words = {word for word in _words(team) if len(word) > 3}
            for item in todos:
                if len(encontrados) >= PER_TEAM:
                    break
                if item["title"].lower() in vistos:
                    continue
                if _junk(item) or not _useful(item["title"]):
                    continue
                if words and _mentions(item["title"], words):
                    encontrados.append(item)
                    vistos.add(item["title"].lower())

        out[team] = encontrados

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
