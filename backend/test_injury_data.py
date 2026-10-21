"""Tests for the injury-source probe. No network access.

Run with `pytest`.
"""

import io
import json
import urllib.error
import urllib.request

import injury_data


class _Answer(io.BytesIO):
    """Just enough of a urlopen result to be read inside a `with`."""

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.close()
        return False


def _serving(payload, captured=None):
    def fake_urlopen(request, timeout=None):
        if captured is not None:
            captured.append(request)
        return _Answer(json.dumps(payload).encode("utf-8"))

    return fake_urlopen


def _run(payload_or_error, key="chave-de-teste", captured=None, force=False):
    original_open = urllib.request.urlopen
    original_key = injury_data.get_api_key
    injury_data.forget()
    injury_data.get_api_key = lambda: key

    if isinstance(payload_or_error, Exception):
        def fake_urlopen(request, timeout=None):
            raise payload_or_error

        urllib.request.urlopen = fake_urlopen
    else:
        urllib.request.urlopen = _serving(payload_or_error, captured)

    try:
        return injury_data.account_status(force=force)
    finally:
        urllib.request.urlopen = original_open
        injury_data.get_api_key = original_key
        injury_data.forget()


OK = {
    "response": {
        "account": {"firstname": "David", "email": "quem@exemplo.pt"},
        "subscription": {"plan": "Free", "active": True},
        "requests": {"current": 12, "limit_day": 100},
    }
}


def test_sem_chave_nao_toca_na_rede():
    original = injury_data.get_api_key
    injury_data.get_api_key = lambda: ""
    try:
        answer = injury_data.account_status()
    finally:
        injury_data.get_api_key = original

    assert answer["configured"] is False
    assert answer["accepted"] is False
    assert "API_FOOTBALL_KEY" in answer["detail"]


def test_chave_aceite_traz_plano_e_quota():
    answer = _run(OK)

    assert answer == {
        "configured": True,
        "accepted": True,
        "detail": "Ligada.",
        "plan": "Free",
        "active": True,
        "requests_today": 12,
        "daily_limit": 100,
    }


def test_nao_devolve_nada_da_conta_de_quem_e_a_chave():
    answer = _run(OK)
    escrito = json.dumps(answer)

    assert "David" not in escrito
    assert "quem@exemplo.pt" not in escrito


def test_manda_a_chave_no_cabecalho_certo():
    captured = []
    _run(OK, key="abc123", captured=captured)

    assert captured[0].get_header("X-apisports-key") == "abc123"


def test_erro_devolvido_com_200_conta_como_recusa():
    # A fonte responde 200 com um objecto `errors` quando a chave está
    # errada, por isso quem só olhar para o código julga que correu bem.
    answer = _run({"errors": {"token": "Error/Missing application key."}})

    assert answer["accepted"] is False
    assert "Error/Missing application key." in answer["detail"]


def test_lista_de_erros_tambem_conta():
    answer = _run({"errors": ["limite atingido"], "response": {}})

    assert answer["accepted"] is False
    assert "limite atingido" in answer["detail"]


def test_401_diz_que_a_chave_foi_recusada():
    erro = urllib.error.HTTPError("u", 401, "nao", None, None)
    answer = _run(erro)

    assert answer["accepted"] is False
    assert "recusada" in answer["detail"]


def test_outro_codigo_diz_qual_foi():
    erro = urllib.error.HTTPError("u", 500, "boom", None, None)
    answer = _run(erro)

    assert answer["accepted"] is False
    assert "500" in answer["detail"]


def test_falha_de_rede_nao_rebenta_nem_fica_guardada():
    original_open = urllib.request.urlopen
    original_key = injury_data.get_api_key
    injury_data.forget()
    injury_data.get_api_key = lambda: "chave"

    def exploding(request, timeout=None):
        raise OSError("sem rede")

    urllib.request.urlopen = exploding
    try:
        answer = injury_data.account_status()
        assert answer["accepted"] is False
        assert "contactar" in answer["detail"]
        # Uma falha passageira não pode fazer a chave parecer morta durante
        # o próximo quarto de hora.
        assert injury_data._cached("status", injury_data.STATUS_TTL) is None
    finally:
        urllib.request.urlopen = original_open
        injury_data.get_api_key = original_key
        injury_data.forget()


def test_resposta_estranha_nao_passa_por_boa():
    answer = _run({"response": "nada disto"})

    assert answer["accepted"] is False
    assert "inesperada" in answer["detail"]


def test_a_segunda_pergunta_nao_gasta_pedido():
    original_open = urllib.request.urlopen
    original_key = injury_data.get_api_key
    injury_data.forget()
    injury_data.get_api_key = lambda: "chave"
    chamadas = []

    urllib.request.urlopen = _serving(OK, chamadas)
    try:
        injury_data.account_status()
        injury_data.account_status()
        assert len(chamadas) == 1

        # Com force=True pergunta-se à mesma, que é como se confere depois
        # de mexer na chave.
        injury_data.account_status(force=True)
        assert len(chamadas) == 2
    finally:
        urllib.request.urlopen = original_open
        injury_data.get_api_key = original_key
        injury_data.forget()


def _league(name, country, season=2026, current=True, injuries=True, lid=1):
    return {
        "league": {"id": lid, "name": name, "type": "League"},
        "country": {"name": country},
        "seasons": [
            {
                "year": season,
                "current": current,
                "coverage": {"injuries": injuries, "odds": False},
            }
        ],
    }


def _coverage(payload, key="chave"):
    original_open = urllib.request.urlopen
    original_key = injury_data.get_api_key
    injury_data.forget()
    injury_data.get_api_key = lambda: key
    urllib.request.urlopen = _serving(payload)
    try:
        return injury_data.league_coverage()
    finally:
        urllib.request.urlopen = original_open
        injury_data.get_api_key = original_key
        injury_data.forget()


def test_cobertura_sem_chave_nao_toca_na_rede():
    original = injury_data.get_api_key
    injury_data.get_api_key = lambda: ""
    try:
        answer = injury_data.league_coverage()
    finally:
        injury_data.get_api_key = original

    assert answer["configured"] is False
    assert answer["leagues"] == []


def test_cobertura_encontra_a_liga_pelo_nome_e_pais():
    answer = _coverage(
        {"response": [_league("Primeira Liga", "Portugal", lid=94)]}
    )
    linha = next(r for r in answer["leagues"] if r["scorelab"] == "Liga Portugal")

    assert linha["found"] is True
    assert linha["api_id"] == 94
    assert linha["injuries"] is True
    assert linha["season"] == 2026


def test_cobertura_nao_confunde_ligas_com_o_mesmo_nome():
    # "Serie A" existe em Itália e no Brasil. Pelo nome só, o Brasileirão
    # apanhava a italiana.
    answer = _coverage(
        {
            "response": [
                _league("Serie A", "Italy", lid=135),
                _league("Serie A", "Brazil", lid=71),
            ]
        }
    )
    italia = next(r for r in answer["leagues"] if r["scorelab"] == "Serie A")
    brasil = next(r for r in answer["leagues"] if r["scorelab"] == "Brasileirão")

    assert italia["api_id"] == 135
    assert brasil["api_id"] == 71


def test_cobertura_marca_as_que_faltam():
    answer = _coverage({"response": []})

    assert all(row["found"] is False for row in answer["leagues"])
    assert answer["with_injuries"] == 0
    assert answer["total"] == len(injury_data.LEAGUE_NAMES)


def test_cobertura_distingue_liga_sem_lesoes():
    answer = _coverage(
        {"response": [_league("Championship", "England", injuries=False, lid=40)]}
    )
    linha = next(r for r in answer["leagues"] if r["scorelab"] == "Championship")

    assert linha["found"] is True
    assert linha["injuries"] is False
    assert answer["with_injuries"] == 0


def test_cobertura_usa_a_epoca_mais_recente_quando_nenhuma_e_corrente():
    # Entre épocas nenhuma traz `current`, e isso não torna a liga
    # inexistente.
    entry = _league("Eredivisie", "Netherlands", season=2025, current=False, lid=88)
    entry["seasons"].append(
        {"year": 2026, "current": False, "coverage": {"injuries": True}}
    )
    answer = _coverage({"response": [entry]})
    linha = next(r for r in answer["leagues"] if r["scorelab"] == "Eredivisie")

    assert linha["season"] == 2026
    assert linha["season_is_current"] is False


def test_cobertura_aguenta_resposta_estranha():
    answer = _coverage({"response": "nada disto"})

    assert answer["leagues"] == []
    assert "inesperada" in answer["detail"]


# --- emparelhar nomes ---------------------------------------------------

def test_nomes_iguais_na_pratica_emparelham():
    assert injury_data._similar("Sporting CP", "Sporting Lisbon") >= injury_data.NAME_MATCH_FLOOR
    assert injury_data._similar("Wolverhampton Wanderers FC", "Wolves") >= injury_data.NAME_MATCH_FLOOR
    assert injury_data._similar("Paris Saint-Germain FC", "Paris Saint Germain") >= injury_data.NAME_MATCH_FLOOR
    assert injury_data._similar("FC Bayern München", "Bayern Munich") >= injury_data.NAME_MATCH_FLOOR


def test_equipas_diferentes_nao_emparelham():
    assert injury_data._similar("Nottingham Forest", "Northampton Town") < injury_data.NAME_MATCH_FLOOR
    assert injury_data._similar("Real Madrid", "Real Sociedad") < injury_data.NAME_MATCH_FLOOR
    assert injury_data._similar("Manchester United", "Manchester City") < injury_data.NAME_MATCH_FLOOR


def _fixture_listing(league_id, home, away, fid=900):
    return {
        "response": [
            {
                "fixture": {
                    "id": fid,
                    "referee": "A. Árbitro",
                    "venue": {"name": "Estádio", "city": "Lisboa"},
                },
                "league": {"id": league_id},
                "teams": {"home": {"name": home}, "away": {"name": away}},
            }
        ]
    }


def _with_api(payloads, key="chave"):
    """Serve respostas por ordem de chamada."""
    original_open = urllib.request.urlopen
    original_key = injury_data.get_api_key
    injury_data.forget()
    injury_data.get_api_key = lambda: key
    pedidos = []

    def fake_urlopen(request, timeout=None):
        pedidos.append(request.full_url)
        return _Answer(json.dumps(payloads.pop(0)).encode("utf-8"))

    urllib.request.urlopen = fake_urlopen
    return original_open, original_key, pedidos


def test_encontra_o_jogo_e_traz_arbitro_e_cidade():
    jogos = _fixture_listing(94, "Sporting Lisbon", "Benfica")
    original_open, original_key, _ = _with_api([jogos])
    try:
        found = injury_data.find_fixture(
            "Liga Portugal", "Sporting CP", "SL Benfica", "2026-10-25"
        )
    finally:
        urllib.request.urlopen = original_open
        injury_data.get_api_key = original_key
        injury_data.forget()

    assert found["id"] == 900
    assert found["referee"] == "A. Árbitro"
    assert found["city"] == "Lisboa"


def test_nao_serve_o_jogo_errado_quando_os_nomes_nao_batem():
    jogos = _fixture_listing(94, "Rio Ave", "Arouca")
    original_open, original_key, _ = _with_api([jogos])
    try:
        found = injury_data.find_fixture(
            "Liga Portugal", "Sporting CP", "SL Benfica", "2026-10-25"
        )
    finally:
        urllib.request.urlopen = original_open
        injury_data.get_api_key = original_key
        injury_data.forget()

    assert found is None


def test_pede_os_jogos_da_liga_e_da_epoca_certas():
    # Por competição e não pelo dia do mundo inteiro: a resposta global
    # vem paginada e os nossos jogos ficavam fora da primeira página.
    jogos = _fixture_listing(94, "Sporting Lisbon", "Benfica")
    original_open, original_key, pedidos = _with_api([jogos])
    try:
        injury_data.find_fixture(
            "Liga Portugal", "Sporting CP", "SL Benfica", "2026-10-25"
        )
    finally:
        urllib.request.urlopen = original_open
        injury_data.get_api_key = original_key
        injury_data.forget()

    pedido = pedidos[-1]
    assert "league=94" in pedido
    assert "season=2026" in pedido
    assert "date=2026-10-25" in pedido


def test_diz_porque_e_que_nao_encontrou():
    jogos = _fixture_listing(94, "Rio Ave", "Arouca")
    original_open, original_key, _ = _with_api([jogos])
    rastreio = {}
    try:
        injury_data.find_fixture(
            "Liga Portugal", "Sporting CP", "SL Benfica", "2026-10-25",
            trace=rastreio,
        )
    finally:
        urllib.request.urlopen = original_open
        injury_data.get_api_key = original_key
        injury_data.forget()

    assert rastreio["fixtures_seen"] == 1
    assert "Rio Ave vs Arouca" in rastreio["names"]
    assert "parece" in rastreio["reason"]


# --- lesões -------------------------------------------------------------

def test_lesoes_agrupadas_por_equipa_com_a_duvida_marcada():
    payload = {
        "response": [
            {
                "team": {"name": "Benfica"},
                "player": {"name": "Um", "type": "Missing Fixture", "reason": "Injury"},
            },
            {
                "team": {"name": "Benfica"},
                "player": {"name": "Dois", "type": "Questionable", "reason": "Knock"},
            },
        ]
    }
    original_open, original_key, _ = _with_api([payload])
    try:
        got = injury_data.injuries_for(900)
    finally:
        urllib.request.urlopen = original_open
        injury_data.get_api_key = original_key
        injury_data.forget()

    assert got["Benfica"][0] == {"name": "Um", "certain": True, "reason": "Injury"}
    assert got["Benfica"][1]["certain"] is False


def test_lesoes_sem_resposta_devolvem_nada_e_nao_lista_vazia():
    # "Não sabemos" não pode passar por "não há lesionados".
    original_open = urllib.request.urlopen
    original_key = injury_data.get_api_key
    injury_data.forget()
    injury_data.get_api_key = lambda: "chave"

    def exploding(request, timeout=None):
        raise OSError("sem rede")

    urllib.request.urlopen = exploding
    try:
        assert injury_data.injuries_for(900) is None
    finally:
        urllib.request.urlopen = original_open
        injury_data.get_api_key = original_key
        injury_data.forget()


# --- odds ---------------------------------------------------------------

def _odds_payload(*prices):
    return {
        "response": [
            {
                "bookmakers": [
                    {
                        "name": f"Casa {i}",
                        "bets": [
                            {
                                "name": "Match Winner",
                                "values": [{"value": "Home", "odd": str(price)}],
                            },
                            {
                                "name": "Double Chance",
                                "values": [{"value": "Home/Draw", "odd": "1.25"}],
                            },
                        ],
                    }
                    for i, price in enumerate(prices)
                ]
            }
        ]
    }


def test_odds_vem_a_mediana_das_casas():
    original_open, original_key, _ = _with_api([_odds_payload(1.80, 2.00, 5.00)])
    try:
        got = injury_data.odds_for(900)
    finally:
        urllib.request.urlopen = original_open
        injury_data.get_api_key = original_key
        injury_data.forget()

    # Mediana e não média nem a melhor: os 5.00 de uma casa distraída não
    # podem puxar o preço do mercado.
    assert got["Casa"] == 2.00
    assert got["1X"] == 1.25


def test_odds_ignora_mercados_que_nao_sabemos_traduzir():
    payload = {
        "response": [
            {
                "bookmakers": [
                    {
                        "name": "X",
                        "bets": [
                            {
                                "name": "Exact Score",
                                "values": [{"value": "2:1", "odd": "9.00"}],
                            }
                        ],
                    }
                ]
            }
        ]
    }
    original_open, original_key, _ = _with_api([payload])
    try:
        got = injury_data.odds_for(900)
    finally:
        urllib.request.urlopen = original_open
        injury_data.get_api_key = original_key
        injury_data.forget()

    assert got is None


def test_nao_confunde_clubes_que_partilham_a_primeira_palavra():
    # Casos reais que a semelhança de texto bruta dava por iguais.
    for ours, theirs in [
        ("Manchester United", "Manchester City"),
        ("Atlético Madrid", "Athletic Bilbao"),
        ("Real Madrid", "Real Betis"),
        ("Borussia Dortmund", "Borussia Mönchengladbach"),
    ]:
        assert injury_data._similar(ours, theirs) < injury_data.NAME_MATCH_FLOOR, (
            f"{ours} não é {theirs}"
        )


def test_reconhece_os_mesmos_clubes_escritos_de_outra_maneira():
    for ours, theirs in [
        ("Sporting CP", "Sporting Lisbon"),
        ("Wolverhampton Wanderers FC", "Wolves"),
        ("Paris Saint-Germain FC", "Paris Saint Germain"),
        ("FC Bayern München", "Bayern Munich"),
        ("Tottenham Hotspur FC", "Tottenham"),
        ("FC Internazionale Milano", "Inter"),
        ("RB Leipzig", "RB Leipzig"),
    ]:
        assert injury_data._similar(ours, theirs) >= injury_data.NAME_MATCH_FLOOR, (
            f"{ours} é {theirs}"
        )


def test_dois_jogos_igualmente_parecidos_nao_escolhem_nenhum():
    jogos = {
        "response": [
            {
                "fixture": {"id": 1, "referee": None, "venue": {}},
                "league": {"id": 39},
                "teams": {
                    "home": {"name": "Tottenham"},
                    "away": {"name": "Chelsea"},
                },
            },
            {
                "fixture": {"id": 2, "referee": None, "venue": {}},
                "league": {"id": 39},
                "teams": {
                    "home": {"name": "Tottenham Hotspur"},
                    "away": {"name": "Chelsea FC"},
                },
            },
        ]
    }
    original_open, original_key, _ = _with_api([jogos])
    try:
        found = injury_data.find_fixture(
            "Premier League", "Tottenham Hotspur FC", "Chelsea FC", "2026-10-25"
        )
    finally:
        urllib.request.urlopen = original_open
        injury_data.get_api_key = original_key
        injury_data.forget()

    assert found is None


def test_o_nome_sozinho_nao_chega_mas_o_jogo_inteiro_chega():
    """"AC Milan" reduz-se a "milan", que está dentro de "Inter Milan".

    Pelo nome não há como decidir. Quem decide é o jogo todo: a equipa de
    fora não bate, e o jogo do vizinho fica de fora.
    """
    assert injury_data._similar("AC Milan", "Inter Milan") >= injury_data.NAME_MATCH_FLOOR

    jogos = {
        "response": [
            {
                "fixture": {"id": 7, "referee": None, "venue": {}},
                "league": {"id": 135},
                "teams": {
                    "home": {"name": "Inter Milan"},
                    "away": {"name": "AS Roma"},
                },
            }
        ]
    }
    original_open, original_key, _ = _with_api([jogos])
    try:
        found = injury_data.find_fixture(
            "Serie A", "AC Milan", "Lazio", "2026-10-25"
        )
    finally:
        urllib.request.urlopen = original_open
        injury_data.get_api_key = original_key
        injury_data.forget()

    assert found is None


def test_a_tabela_fixa_de_ligas_bate_com_as_nossas_onze():
    assert set(injury_data.LEAGUE_IDS) == set(injury_data.LEAGUE_NAMES)
    # Ids distintos: dois nomes no mesmo número era servir sempre a
    # mesma liga.
    ids = [row["id"] for row in injury_data.LEAGUE_IDS.values()]
    assert len(set(ids)) == len(ids)


def test_a_liga_resolve_se_sem_ir_buscar_o_catalogo():
    original = injury_data.get_api_key
    injury_data.forget()
    injury_data.get_api_key = lambda: "chave"
    original_open = urllib.request.urlopen

    def nunca(request, timeout=None):
        raise AssertionError("não devia ir à rede para saber o id da liga")

    urllib.request.urlopen = nunca
    try:
        row = injury_data._league_row("Premier League")
    finally:
        urllib.request.urlopen = original_open
        injury_data.get_api_key = original
        injury_data.forget()

    assert row["api_id"] == 39
    assert row["injuries"] is True


def test_a_liga_portugal_fica_marcada_como_sem_lesoes():
    assert injury_data._league_row("Liga Portugal")["injuries"] is False


def test_a_epoca_conta_se_pelo_ano_em_que_comeca():
    import time as _t

    real = _t.gmtime
    try:
        _t.gmtime = lambda *a: real(_t.mktime((2027, 1, 15, 12, 0, 0, 0, 0, 0)))
        # Janeiro: a europeia ainda é a época que começou em Agosto,
        # a brasileira já é a do ano novo.
        assert injury_data._season_for("Premier League") == 2026
        assert injury_data._season_for("Brasileirão") == 2027

        _t.gmtime = lambda *a: real(_t.mktime((2026, 10, 21, 12, 0, 0, 0, 0, 0)))
        assert injury_data._season_for("Premier League") == 2026
        assert injury_data._season_for("Brasileirão") == 2026
    finally:
        _t.gmtime = real
