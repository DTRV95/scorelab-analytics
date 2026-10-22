"""Tests for the news feeds and the absences source. No network access."""

import io
import json
import urllib.error
import urllib.request

import bzzoiro_data
import news_data


class _Answer(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.close()
        return False


# --- notícias -----------------------------------------------------------

def _rss(*titles, pub="Wed, 21 Oct 2026 10:00:00 +0000"):
    items = "".join(
        f"<item><title>{title}</title>"
        f"<link>https://exemplo.pt/{i}</link>"
        f"<pubDate>{pub}</pubDate></item>"
        for i, title in enumerate(titles)
    )
    return f"<?xml version='1.0' encoding='UTF-8'?><rss><channel>{items}</channel></rss>"


def _serving_feeds(by_url, calls=None):
    def fake_urlopen(request, timeout=None):
        url = request.full_url if hasattr(request, "full_url") else str(request)
        if calls is not None:
            calls.append(url)
        for fragment, body in by_url.items():
            if fragment in url:
                return _Answer(body.encode("utf-8"))
        raise urllib.error.HTTPError(url, 404, "no", None, None)

    return fake_urlopen


def _news(by_url, fn=None, calls=None):
    original = urllib.request.urlopen
    news_data.forget()
    urllib.request.urlopen = _serving_feeds(by_url, calls)
    try:
        return (fn or news_data.headlines)()
    finally:
        urllib.request.urlopen = original
        news_data.forget()


def test_le_a_primeira_pagina_do_jornal():
    got = _news({"record.pt": _rss("Notícia do Record")})

    assert [item["source"] for item in got] == ["Record"]


def test_tira_o_embrulho_do_cdata_ao_titulo():
    # Chegava ao ecrã como "<![CDATA[ Messi revela... ]]>".
    embrulhado = _rss("<![CDATA[ Messi revela os dois golos ]]>")
    got = _news({"record.pt": embrulhado})

    assert got[0]["title"] == "Messi revela os dois golos"


def test_procura_por_equipa_e_separa_o_jornal_do_titulo():
    # O Google põe o jornal no fim do título, a seguir a um travessão.
    got = _news(
        {
            "news.google.com": _rss("Porto prepara o clássico - Record"),
            "record.pt": _rss("Outra coisa qualquer"),
        },
        fn=lambda: news_data.about("FC Porto"),
    )

    assert got[0]["title"] == "Porto prepara o clássico"
    assert got[0]["source"] == "Record"


def test_a_pesquisa_leva_o_nome_da_equipa_e_a_janela():
    calls = []
    _news(
        {"news.google.com": _rss("Seja o que for")},
        fn=lambda: news_data.about("Gil Vicente"),
        calls=calls,
    )
    pedido = calls[0]

    assert "Gil+Vicente" in pedido
    assert "when%3A7d" in pedido
    assert "hl=pt-PT" in pedido


def test_a_primeira_pagina_entra_de_reforco_quando_a_pesquisa_falha():
    got = _news(
        {"record.pt": _rss("Benfica vence fora")},
        fn=lambda: news_data.for_teams("SL Benfica", "Gil Vicente"),
    )

    assert [i["title"] for i in got["SL Benfica"]] == ["Benfica vence fora"]
    assert got["Gil Vicente"] == []


def test_um_jornal_em_baixo_nao_leva_os_outros_atras():
    got = _news({"record.pt": _rss("Só o Record respondeu")})

    assert len(got) == 1
    assert got[0]["source"] == "Record"


def test_nao_repete_o_mesmo_titulo_de_dois_feeds():
    mesmo = _rss("A mesma notícia")
    got = _news({"record.pt": mesmo, "maisfutebol": mesmo})

    assert len(got) == 1


def test_deita_fora_o_que_e_mais_velho_que_uma_semana():
    got = _news(
        {"record.pt": _rss("Notícia velha", pub="Mon, 01 Jan 2024 10:00:00 +0000")}
    )

    assert got == []


def test_guarda_o_titulo_sem_data():
    # Quase sempre é de hoje, e perdê-lo era perder a notícia da véspera.
    sem_data = (
        "<rss><channel><item><title>Sem data</title>"
        "<link>https://exemplo.pt/x</link></item></channel></rss>"
    )
    got = _news({"record.pt": sem_data})

    assert [item["title"] for item in got] == ["Sem data"]


def test_separa_as_noticias_pelas_duas_equipas():
    got = _news(
        {
            "record.pt": _rss(
                "Benfica vence fora",
                "Porto prepara o clássico",
                "Notícia de ténis",
            )
        },
        fn=lambda: news_data.for_teams("SL Benfica", "FC Porto"),
    )

    assert [i["title"] for i in got["SL Benfica"]] == ["Benfica vence fora"]
    assert [i["title"] for i in got["FC Porto"]] == ["Porto prepara o clássico"]


def test_nao_apanha_a_equipa_dentro_de_outra_palavra():
    # "Porto" não está em "Portomosense", nem "Braga" em "Bragança".
    got = _news(
        {"record.pt": _rss("Portomosense sobe de divisão", "Bragança em festa")},
        fn=lambda: news_data.for_teams("FC Porto", "SC Braga"),
    )

    assert got["FC Porto"] == []
    assert got["SC Braga"] == []


def test_nao_le_nem_interpreta_o_titulo():
    # Só título, link, hora e jornal. Nada que se pareça com uma
    # conclusão sobre o jogo.
    got = _news({"record.pt": _rss("Lesão de um titular do Porto")})

    assert set(got[0]) == {"title", "link", "at", "source"}


# --- baixas (Bzzoiro) ---------------------------------------------------

def _serving_json(by_url, calls=None):
    def fake_urlopen(request, timeout=None):
        url = request.full_url
        if calls is not None:
            calls.append((url, dict(request.headers)))
        for fragment, payload in by_url.items():
            if fragment in url:
                return _Answer(json.dumps(payload).encode("utf-8"))
        raise urllib.error.HTTPError(url, 401, "no", None, None)

    return fake_urlopen


def _bzz(by_url, fn, key="chave", calls=None):
    original_open = urllib.request.urlopen
    original_key = bzzoiro_data.get_api_key
    bzzoiro_data.forget()
    bzzoiro_data.get_api_key = lambda: key
    urllib.request.urlopen = _serving_json(by_url, calls)
    try:
        return fn()
    finally:
        urllib.request.urlopen = original_open
        bzzoiro_data.get_api_key = original_key
        bzzoiro_data.forget()


def _event(home="FC Porto", away="Gil Vicente", when="2026-10-24T19:30:00Z"):
    return {
        "home_team": {"name": home},
        "away_team": {"name": away},
        "start_time": when,
        "unavailable_players": {
            "home": [
                {
                    "name": "Um",
                    "status": "out",
                    "reason": "hamstring",
                    "expected_return": "2026-12-01",
                }
            ],
            "away": [{"name": "Dois", "status": "suspended"}, "Três"],
        },
    }


EVENTS = {"results": [_event()]}


def test_bzzoiro_sem_chave_nao_toca_na_rede():
    original = bzzoiro_data.get_api_key
    bzzoiro_data.get_api_key = lambda: ""
    try:
        answer = bzzoiro_data.account_status()
    finally:
        bzzoiro_data.get_api_key = original

    assert answer["configured"] is False
    assert "BZZOIRO_API_KEY" in answer["detail"]


def test_bzzoiro_descobre_o_caminho_e_o_cabecalho():
    answer = _bzz({"/api/events/": EVENTS}, bzzoiro_data.account_status)

    assert answer["accepted"] is True
    assert answer["path"] == "/api/events/"
    assert answer["events_with_absences"] == 1


def test_bzzoiro_escolhe_o_caminho_que_traz_baixas_e_nao_o_primeiro():
    # Caso real: o /api/v2/events/ responde com cinquenta jogos e nenhum
    # traz indisponíveis, que é a única coisa por que viemos aqui.
    sem_baixas = {
        "results": [
            {k: v for k, v in _event().items() if k != "unavailable_players"}
        ]
    }
    answer = _bzz(
        {"/api/v2/events/": sem_baixas, "/api/events/": EVENTS},
        bzzoiro_data.account_status,
    )

    assert answer["path"] == "/api/events/"
    assert answer["events_with_absences"] == 1


def test_bzzoiro_fica_pelo_que_responde_quando_nenhum_traz_baixas():
    sem_baixas = {
        "results": [
            {k: v for k, v in _event().items() if k != "unavailable_players"}
        ]
    }
    answer = _bzz({"/api/v2/events/": sem_baixas}, bzzoiro_data.account_status)

    assert answer["accepted"] is True
    assert answer["events_with_absences"] == 0


def test_bzzoiro_diz_o_que_cada_caminho_respondeu():
    answer = _bzz({}, bzzoiro_data.account_status)

    assert answer["accepted"] is False
    # Dois caminhos x duas autenticações x três formas de pedir as
    # baixas, cada uma com a sua resposta.
    assert len(answer["attempts"]) == 12


def test_bzzoiro_separa_as_baixas_pelas_duas_equipas():
    got = _bzz(
        {"/api/v2/events/": EVENTS},
        lambda: bzzoiro_data.for_match("FC Porto", "Gil Vicente", "2026-10-24T19:30:00Z"),
    )

    assert [p["name"] for p in got["FC Porto"]] == ["Um"]
    assert [p["name"] for p in got["Gil Vicente"]] == ["Dois", "Três"]
    assert got["Gil Vicente"][0]["status"] == "suspended"
    # O motivo e o regresso não se perdem: "dúvida por uma pancada" não
    # é o mesmo que "fora até Dezembro".
    assert got["FC Porto"][0]["reason"] == "hamstring"
    assert got["FC Porto"][0]["back"] == "2026-12-01"


def test_bzzoiro_troca_os_lados_quando_o_jogo_vem_ao_contrario():
    # O nosso quadro diz Porto em casa; se a fonte o listar ao contrário,
    # as baixas do "home" deles são as do Gil Vicente.
    ao_contrario = {"results": [_event(home="Gil Vicente", away="FC Porto")]}
    got = _bzz(
        {"/api/v2/events/": ao_contrario},
        lambda: bzzoiro_data.for_match("FC Porto", "Gil Vicente", "2026-10-24T19:30:00Z"),
    )

    assert [p["name"] for p in got["FC Porto"]] == ["Dois", "Três"]
    assert [p["name"] for p in got["Gil Vicente"]] == ["Um"]


def test_bzzoiro_jogo_desconhecido_devolve_nada():
    rastreio = {}
    got = _bzz(
        {"/api/v2/events/": EVENTS},
        lambda: bzzoiro_data.for_match(
            "Arsenal", "Everton", "2026-10-24T19:30:00Z", trace=rastreio
        ),
    )

    assert got is None
    assert "Não encontrámos" in rastreio["reason"]


def test_bzzoiro_jogo_sem_lista_de_baixas_nao_vira_lista_vazia():
    sem = {"results": [{k: v for k, v in _event().items() if k != "unavailable_players"}]}
    rastreio = {}
    got = _bzz(
        {"/api/v2/events/": sem},
        lambda: bzzoiro_data.for_match(
            "FC Porto", "Gil Vicente", "2026-10-24T19:30:00Z", trace=rastreio
        ),
    )

    assert got is None
    assert "sem lista de indisponíveis" in rastreio["reason"]


def test_bzzoiro_pede_os_jogos_do_dia_do_jogo():
    # Sem data vêm os de hoje, e um jogo de sábado não está lá.
    calls = []
    _bzz(
        {"/api/events/": EVENTS},
        lambda: bzzoiro_data.for_match(
            "FC Porto", "Gil Vicente", "2026-10-24T19:30:00Z"
        ),
        calls=calls,
    )

    assert any("date=2026-10-24" in url for url, _ in calls)


def test_bzzoiro_volta_a_lista_de_sempre_se_o_filtro_nao_existir():
    chamadas = {"n": 0}

    def recusa_o_filtro(request, timeout=None):
        url = request.full_url
        if "date=" in url:
            raise urllib.error.HTTPError(url, 400, "sem filtro", None, None)
        chamadas["n"] += 1
        return _Answer(json.dumps(EVENTS).encode("utf-8"))

    original_open = urllib.request.urlopen
    original_key = bzzoiro_data.get_api_key
    bzzoiro_data.forget()
    bzzoiro_data.get_api_key = lambda: "chave"
    urllib.request.urlopen = recusa_o_filtro
    try:
        got = bzzoiro_data.for_match(
            "FC Porto", "Gil Vicente", "2026-10-24T19:30:00Z"
        )
    finally:
        urllib.request.urlopen = original_open
        bzzoiro_data.get_api_key = original_key
        bzzoiro_data.forget()

    assert got is not None
    assert [p["name"] for p in got["FC Porto"]] == ["Um"]
