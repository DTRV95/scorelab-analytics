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
