"""Tests for the odds and BigBalls clients. No network access."""

import io
import json
import urllib.error
import urllib.request

import bigballs_data
import odds_api


class _Answer(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.close()
        return False


def _serving(by_url, calls=None):
    """Responde conforme o endereço pedido; 401 ao que não estiver na lista."""

    def fake_urlopen(request, timeout=None):
        url = request.full_url
        if calls is not None:
            calls.append((url, dict(request.headers)))
        for fragment, payload in by_url.items():
            if fragment in url:
                return _Answer(json.dumps(payload).encode("utf-8"))
        raise urllib.error.HTTPError(url, 401, "no", None, None)

    return fake_urlopen


def _run(module, fn, by_url, key="chave", calls=None):
    original_open = urllib.request.urlopen
    original_key = module.get_api_key
    module.forget()
    module.get_api_key = lambda: key
    urllib.request.urlopen = _serving(by_url, calls)
    try:
        return fn()
    finally:
        urllib.request.urlopen = original_open
        module.get_api_key = original_key
        module.forget()


# --- odds ---------------------------------------------------------------

SPORTS = [
    {"key": "soccer_epl", "title": "EPL"},
    {"key": "soccer_portugal_primeira_liga", "title": "Primeira Liga"},
    {"key": "basketball_nba", "title": "NBA"},
]


def test_odds_sem_chave_nao_toca_na_rede():
    original = odds_api.get_api_key
    odds_api.get_api_key = lambda: ""
    try:
        answer = odds_api.account_status()
    finally:
        odds_api.get_api_key = original

    assert answer["configured"] is False
    assert "ODDS_API_KEY" in answer["detail"]


def test_odds_descobre_o_servico_que_aceita_a_chave():
    # Só o segundo serviço responde: o cliente tem de lá chegar sozinho.
    answer = _run(
        odds_api,
        odds_api.account_status,
        {"api.theoddsapi.com/sports": SPORTS},
    )

    assert answer["accepted"] is True
    assert answer["service"] == "theoddsapi.com"


def test_odds_manda_a_chave_como_cada_servico_a_quer():
    calls = []
    _run(
        odds_api,
        odds_api.account_status,
        {"api.the-odds-api.com/v4/sports": SPORTS},
        key="abc",
        calls=calls,
    )
    url, headers = calls[0]
    assert "apiKey=abc" in url
    assert "X-api-key" not in headers


def test_odds_diz_que_competicoes_nossas_estao_la():
    answer = _run(
        odds_api,
        odds_api.account_status,
        {"api.the-odds-api.com/v4/sports": SPORTS},
    )

    assert answer["our_leagues"] == ["Liga Portugal", "Premier League"]
    assert "Bundesliga" in answer["missing_leagues"]


def test_odds_nenhum_servico_aceita():
    answer = _run(odds_api, odds_api.account_status, {})

    assert answer["configured"] is True
    assert answer["accepted"] is False


def _game(home, away, when="2026-10-24T16:30:00Z", *prices):
    return {
        "home_team": home,
        "away_team": away,
        "commence_time": when,
        "bookmakers": [
            {
                "key": f"casa{i}",
                "markets": [
                    {
                        "key": "h2h",
                        "outcomes": [
                            {"name": home, "price": price},
                            {"name": "Draw", "price": 3.4},
                            {"name": away, "price": 4.0},
                        ],
                    },
                    {
                        "key": "totals",
                        "outcomes": [
                            {"name": "Over", "price": 1.9, "point": 2.5},
                            {"name": "Under", "price": 1.95, "point": 2.5},
                        ],
                    },
                ],
            }
            for i, price in enumerate(prices)
        ],
    }


def test_odds_do_jogo_vem_pela_mediana_e_com_os_nossos_nomes():
    got = _run(
        odds_api,
        lambda: odds_api.odds_for(
            "Premier League", "Chelsea FC", "Tottenham Hotspur", "2026-10-24T16:30:00Z"
        ),
        {
            "/v4/sports?": SPORTS,
            "/v4/sports/soccer_epl/odds": [
                _game("Chelsea", "Tottenham Hotspur", "2026-10-24T16:30:00Z", 1.70, 1.90, 5.00)
            ],
        },
    )

    assert got["Casa"] == 1.90
    assert got["Empate"] == 3.4
    assert got["Mais de 2.5 Golos"] == 1.9
    assert got["Menos de 2.5 Golos"] == 1.95


def test_odds_nao_servem_o_jogo_errado():
    rastreio = {}
    got = _run(
        odds_api,
        lambda: odds_api.odds_for(
            "Premier League", "Arsenal", "Everton", "2026-10-24T16:30:00Z",
            trace=rastreio,
        ),
        {
            "/v4/sports?": SPORTS,
            "/v4/sports/soccer_epl/odds": [
                _game("Chelsea", "Tottenham Hotspur", "2026-10-24T16:30:00Z", 1.90)
            ],
        },
    )

    assert got is None
    assert "parece" in rastreio["reason"]


def test_odds_ignoram_jogo_noutro_dia():
    got = _run(
        odds_api,
        lambda: odds_api.odds_for(
            "Premier League", "Chelsea", "Tottenham", "2026-10-24T16:30:00Z"
        ),
        {
            "/v4/sports?": SPORTS,
            "/v4/sports/soccer_epl/odds": [
                _game("Chelsea", "Tottenham", "2026-10-30T16:30:00Z", 1.90)
            ],
        },
    )

    assert got is None


def test_odds_liga_que_a_fonte_nao_conhece():
    rastreio = {}
    _run(
        odds_api,
        lambda: odds_api.odds_for(
            "Liga Inventada", "A", "B", "2026-10-24T16:30:00Z", trace=rastreio
        ),
        {"/v4/sports?": SPORTS},
    )
    assert "não tem chave nesta fonte" in rastreio["reason"]


# --- lesões (BigBalls) --------------------------------------------------

INJURIES = {
    "data": {
        "sport": "football",
        "injuries": [
            {
                "player": {"name": "Alguém", "team": {"name": "Chelsea"}},
                "status": "out",
                "injury_type": "hamstring",
                "updated_at": "2026-10-20",
            },
            {
                "player": {"name": "Outro", "team": {"name": "Arsenal"}},
                "status": "doubtful",
                "injury_type": "knock",
                "updated_at": "2026-10-21",
            },
        ],
    }
}


def test_bigballs_sem_chave_nao_toca_na_rede():
    original = bigballs_data.get_api_key
    bigballs_data.get_api_key = lambda: ""
    try:
        answer = bigballs_data.account_status()
    finally:
        bigballs_data.get_api_key = original

    assert answer["configured"] is False
    assert "BIGBALLS_API_KEY" in answer["detail"]


def test_bigballs_descobre_sozinho_como_autenticar():
    calls = []
    answer = _run(
        bigballs_data,
        bigballs_data.account_status,
        {"sport=football": INJURIES},
        calls=calls,
    )

    assert answer["accepted"] is True
    assert answer["auth"] in bigballs_data.AUTH_STYLES
    assert answer["sport"] == "football"
    assert answer["rows"] == 2


def test_bigballs_tenta_o_outro_nome_do_desporto():
    answer = _run(
        bigballs_data,
        bigballs_data.account_status,
        {"sport=soccer": INJURIES},
    )

    assert answer["accepted"] is True
    assert answer["sport"] == "soccer"


def test_bigballs_chave_recusada():
    answer = _run(bigballs_data, bigballs_data.account_status, {})

    assert answer["configured"] is True
    assert answer["accepted"] is False


def test_bigballs_separa_as_lesoes_pelas_duas_equipas():
    got = _run(
        bigballs_data,
        lambda: bigballs_data.for_teams("Premier League", "Chelsea FC", "Arsenal FC"),
        {"sport=football": INJURIES},
    )

    assert [p["name"] for p in got["Chelsea FC"]] == ["Alguém"]
    assert got["Arsenal FC"][0]["status"] == "doubtful"


def test_bigballs_liga_nao_coberta_devolve_nada_e_nao_lista_vazia():
    # Uma lista vazia aqui lia-se como "não há lesionados na Liga
    # Portugal", que é falso: é que eles não a seguem.
    got = _run(
        bigballs_data,
        lambda: bigballs_data.for_teams("Liga Portugal", "Sporting CP", "Benfica"),
        {"sport=football": INJURIES},
    )

    assert got is None


def test_bigballs_aguenta_a_lista_embrulhada_de_outra_maneira():
    plano = {"injuries": [{"player": {"name": "X", "team": {"name": "Chelsea"}}}]}
    got = _run(
        bigballs_data,
        bigballs_data.all_injuries,
        {"sport=football": plano},
    )

    assert len(got) == 1


def test_bigballs_usa_o_dominio_da_api():
    # O domínio sem "api." não tem servidor nenhum, e as quatro
    # tentativas falhavam todas pela razão errada.
    assert bigballs_data.BASE_URL.startswith("https://api.bigballsdata.com/")


def test_bigballs_diz_o_que_cada_tentativa_respondeu():
    answer = _run(bigballs_data, bigballs_data.account_status, {})

    assert answer["accepted"] is False
    # Quatro combinações: duas formas de autenticar vezes dois nomes de
    # desporto, cada uma com a sua resposta.
    assert len(answer["attempts"]) == 4
    assert all("401" in linha for linha in answer["attempts"])


def test_a_forma_mostra_campos_e_nao_valores():
    forma = bigballs_data._shape_of(
        {
            "meta": {"as_of": "2026-10-21", "count": 3},
            "results": [{"player": "Segredo", "status": "out"}],
        }
    )

    assert "meta" in forma and "results" in forma
    assert "1 ×" in forma
    # Nenhum valor passa: é a forma que se quer, não o conteúdo.
    assert "Segredo" not in forma
    assert "2026-10-21" not in forma


def test_a_forma_aguenta_o_que_lhe_derem():
    assert bigballs_data._shape_of([]) == "[]"
    assert bigballs_data._shape_of(None) == "NoneType"
    assert bigballs_data._shape_of(7) == "int"


def test_bigballs_acha_a_lista_mesmo_embrulhada_em_objectos():
    # É assim que a resposta deles vem: data.injuries é um objecto, e a
    # lista está lá dentro com outro nome.
    plano = {
        "data": {"injuries": {"count": 1, "items": [
            {"player": {"name": "Y", "team": {"name": "Arsenal"}}}
        ]}},
        "meta": {"as_of": "2026-10-21"},
        "error": None,
    }
    got = _run(bigballs_data, bigballs_data.all_injuries, {"sport=football": plano})

    assert len(got) == 1
    assert got[0]["player"]["name"] == "Y"


def test_bigballs_nao_confunde_outra_lista_qualquer_com_lesoes():
    # A lista de lesionados vem primeiro no sítio certo; uma lista de
    # avisos noutro canto não pode tomar-lhe o lugar.
    plano = {
        "warnings": [{"code": "x"}],
        "data": {"injuries": {"items": [{"player": {"name": "Certo"}}]}},
    }
    got = _run(bigballs_data, bigballs_data.all_injuries, {"sport=football": plano})

    assert got[0]["player"]["name"] == "Certo"


# --- probabilidade implícita --------------------------------------------

def test_tira_a_margem_da_casa_aos_tres_resultados():
    # 2,00 / 3,50 / 4,00 somam 110,7% de probabilidade "bruta": os 10,7
    # são a margem da casa e não podem contar como certeza dela.
    got = odds_api.implied_pct({"Casa": 2.00, "Empate": 3.50, "Fora": 4.00})

    assert abs(sum(got[n] for n in ("Casa", "Empate", "Fora")) - 100) < 0.3
    assert got["Casa"] > got["Empate"] > got["Fora"]


def test_as_duplas_saem_das_simples_ja_sem_margem():
    got = odds_api.implied_pct({"Casa": 2.00, "Empate": 3.50, "Fora": 4.00})

    assert got["1X"] == round(got["Casa"] + got["Empate"], 1)
    assert got["2X"] == round(got["Fora"] + got["Empate"], 1)


def test_duplas_hipoteses_ganham_preco_tirado_das_simples():
    # A fonte só dá 1X2 e totais, e o 1X e o 2X são os dois mercados
    # que esta casa joga: sem preço, nunca podiam ser sugeridos nem
    # recusados. Repartir o dinheiro por Casa e Empate a 2,00 e 3,50
    # paga 1/(0,5 + 0,2857) = 1,27.
    got = odds_api.with_doubles({"Casa": 2.00, "Empate": 3.50, "Fora": 4.00})

    assert got["1X"] == 1.27
    assert got["2X"] == round(1 / (1 / 4.00 + 1 / 3.50), 2)
    # E as simples ficam exactamente como estavam.
    assert got["Casa"] == 2.00


def test_sem_os_tres_resultados_nao_se_inventa_dupla():
    got = odds_api.with_doubles({"Casa": 2.00, "Mais de 2.5 Golos": 1.90})

    assert "1X" not in got
    assert "2X" not in got


def test_uma_dupla_cotada_a_serio_manda_sobre_a_deduzida():
    got = odds_api.with_doubles(
        {"Casa": 2.00, "Empate": 3.50, "Fora": 4.00, "1X": 1.30}
    )

    assert got["1X"] == 1.30


def test_mais_e_menos_de_golos_normalizam_entre_si():
    got = odds_api.implied_pct(
        {"Mais de 2.5 Golos": 1.90, "Menos de 2.5 Golos": 1.95}
    )

    assert abs(got["Mais de 2.5 Golos"] + got["Menos de 2.5 Golos"] - 100) < 0.3


def test_sem_o_outro_lado_fica_a_leitura_directa():
    got = odds_api.implied_pct({"Mais de 2.5 Golos": 2.00})

    # 50% em bruto: peca por excesso, e o excesso nunca nos favorece.
    assert got["Mais de 2.5 Golos"] == 50.0


def test_contexto_diz_quando_nao_ha_preco():
    answer = _run(
        odds_api,
        lambda: odds_api.priced(
            "Premier League", "Arsenal", "Everton", "2026-10-24T16:30:00Z"
        ),
        {"/v4/sports?": SPORTS, "/v4/sports/soccer_epl/odds": []},
    )

    assert answer["odds"] is None
    assert "Sem preço" in answer["detail"]
    assert "trace" in answer


def test_odds_aceitam_o_jogo_que_a_fonte_poe_no_dia_seguinte():
    # 23:00 de sábado em Lisboa é domingo noutros fusos, e cada fonte
    # arredonda a data à sua maneira.
    got = _run(
        odds_api,
        lambda: odds_api.odds_for(
            "Premier League", "Chelsea", "Tottenham", "2026-10-24T23:00:00Z"
        ),
        {
            "/v4/sports?": SPORTS,
            "/v4/sports/soccer_epl/odds": [
                _game("Chelsea", "Tottenham", "2026-10-25T00:00:00Z", 1.90)
            ],
        },
    )

    assert got is not None
    assert got["Casa"] == 1.90


def test_odds_continuam_a_ignorar_outra_jornada():
    # Três dias de margem seria apanhar o jogo da semana seguinte.
    got = _run(
        odds_api,
        lambda: odds_api.odds_for(
            "Premier League", "Chelsea", "Tottenham", "2026-10-24T16:30:00Z"
        ),
        {
            "/v4/sports?": SPORTS,
            "/v4/sports/soccer_epl/odds": [
                _game("Chelsea", "Tottenham", "2026-10-27T16:30:00Z", 1.90)
            ],
        },
    )

    assert got is None


def test_o_rastreio_mostra_os_jogos_que_foram_considerados():
    rastreio = {}
    _run(
        odds_api,
        lambda: odds_api.odds_for(
            "Premier League", "Arsenal", "Everton", "2026-10-24T16:30:00Z",
            trace=rastreio,
        ),
        {
            "/v4/sports?": SPORTS,
            "/v4/sports/soccer_epl/odds": [
                _game("Chelsea", "Tottenham", "2026-10-24T16:30:00Z", 1.90)
            ],
        },
    )

    assert "Chelsea vs Tottenham" in rastreio["considered"][0]


def _swapped_game(home, away, when, price_home, price_away):
    """O jogo como a outra fonte o vê: as mesmas equipas, trocadas."""
    return {
        "home_team": away,
        "away_team": home,
        "commence_time": when,
        "bookmakers": [
            {
                "key": "casa",
                "markets": [
                    {
                        "key": "h2h",
                        "outcomes": [
                            {"name": away, "price": price_away},
                            {"name": "Draw", "price": 3.4},
                            {"name": home, "price": price_home},
                        ],
                    }
                ],
            }
        ],
    }


def test_apanha_o_jogo_com_as_equipas_trocadas():
    # Caso real: o nosso quadro diz Porto em casa, as casas dizem Gil
    # Vicente em casa. É o mesmo jogo.
    got = _run(
        odds_api,
        lambda: odds_api.odds_for(
            "Liga Portugal", "Porto", "Gil Vicente", "2026-10-24T19:30:00Z"
        ),
        {
            "/v4/sports?": [{"key": "soccer_portugal_primeira_liga"}],
            "/v4/sports/soccer_portugal_primeira_liga/odds": [
                _swapped_game(
                    "FC Porto", "Gil Vicente", "2026-10-24T19:30:00Z", 1.40, 7.00
                )
            ],
        },
    )

    assert got is not None
    # E o preço vai para a equipa certa: 1,40 é do Porto, que para nós é
    # a casa. Ler pela posição deles dava-lhe 7,00.
    assert got["Casa"] == 1.40
    assert got["Fora"] == 7.00


def test_avisa_quando_as_fontes_discordam_de_quem_joga_em_casa():
    answer = _run(
        odds_api,
        lambda: odds_api.priced(
            "Liga Portugal", "Porto", "Gil Vicente", "2026-10-24T19:30:00Z"
        ),
        {
            "/v4/sports?": [{"key": "soccer_portugal_primeira_liga"}],
            "/v4/sports/soccer_portugal_primeira_liga/odds": [
                _swapped_game(
                    "FC Porto", "Gil Vicente", "2026-10-24T19:30:00Z", 1.40, 7.00
                )
            ],
        },
    )

    assert answer["home_away_disagrees"] is True


def test_nao_avisa_quando_as_fontes_concordam():
    answer = _run(
        odds_api,
        lambda: odds_api.priced(
            "Premier League", "Chelsea", "Tottenham", "2026-10-24T16:30:00Z"
        ),
        {
            "/v4/sports?": SPORTS,
            "/v4/sports/soccer_epl/odds": [
                _game("Chelsea", "Tottenham", "2026-10-24T16:30:00Z", 1.90)
            ],
        },
    )

    assert answer["home_away_disagrees"] is False
