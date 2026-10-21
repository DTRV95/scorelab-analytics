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
