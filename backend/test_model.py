"""Statistical integrity tests for the analysis engine.

Run with `pytest` or directly: `python test_model.py`.

These lock in properties that are easy to break silently and expensive to
notice in production, because a biased model still returns confident-looking
numbers.
"""

import math

import pytest

from schemas import AnalyzeRequest
import model
from model import (
    CALIBRATION_INTERCEPT,
    CALIBRATION_SLOPE,
    MIN_HEADLINE_PCT,
    analisar_jogo,
    calibrate_distributions,
    calibrate_pct,
    estimate_lambdas,
    pair_shift,
    pick_headline_market,
    probabilidades_jogo,
    settle_markets,
)

LEAGUE_HOME = 1.49
LEAGUE_AWAY = 1.21
LEAGUE_TOTAL = LEAGUE_HOME + LEAGUE_AWAY

BASE_ODDS = dict(
    odd_mais_25=1.90,
    odd_menos_25=1.90,
    odd_mais_35=2.80,
    odd_menos_35=1.40,
    odd_ambas_marcam=1.80,
    odd_ambas_nao_marcam=1.95,
    odd_casa=2.00,
    odd_empate=3.40,
    odd_fora=3.80,
)


def average_match(games: int, **overrides) -> AnalyzeRequest:
    """Two teams performing exactly at the league baseline."""
    recent = min(games, 5)
    payload = dict(
        equipa_casa="A",
        equipa_fora="B",
        liga="L",
        jogos_casa=games,
        golos_marcados_casa=round(LEAGUE_HOME * games),
        golos_sofridos_casa=round(LEAGUE_AWAY * games),
        jogos_casa_rec=recent,
        golos_marcados_casa_rec=round(LEAGUE_HOME * recent),
        golos_sofridos_casa_rec=round(LEAGUE_AWAY * recent),
        jogos_fora=games,
        golos_marcados_fora=round(LEAGUE_AWAY * games),
        golos_sofridos_fora=round(LEAGUE_HOME * games),
        jogos_fora_rec=recent,
        golos_marcados_fora_rec=round(LEAGUE_AWAY * recent),
        golos_sofridos_fora_rec=round(LEAGUE_HOME * recent),
        banca=1000,
        fracao_kelly=0.25,
        league_home_goals_avg=LEAGUE_HOME,
        league_away_goals_avg=LEAGUE_AWAY,
        dixon_coles_rho=-0.08,
        shrinkage_matches=6,
        **BASE_ODDS,
    )
    payload.update(overrides)
    return AnalyzeRequest(**payload)


def test_average_teams_predict_an_average_scoreline():
    """The regression that shipped a -27% goals bias: a small sample must not
    drag expected goals towards zero, only towards the league average."""
    for games in (3, 5, 9, 12, 20, 30):
        home, away = estimate_lambdas(average_match(games))
        total = home + away
        deviation = abs(total / LEAGUE_TOTAL - 1)
        assert deviation < 0.06, (
            f"{games} games: expected ~{LEAGUE_TOTAL:.2f} goals, got {total:.2f} "
            f"({deviation * 100:.1f}% off)"
        )


def test_average_match_markets_are_not_skewed_to_unders():
    result = analisar_jogo(average_match(9))
    probs = {m["mercado"]: m["prob_usada_pct"] for m in result["mercados"]}

    assert 44 <= probs["Mais de 2.5 Golos"] <= 60, probs["Mais de 2.5 Golos"]
    assert 46 <= probs["Ambas Marcam"] <= 62, probs["Ambas Marcam"]


def test_complementary_markets_sum_to_one():
    result = analisar_jogo(average_match(9))
    probs = {m["mercado"]: m["prob_usada_pct"] for m in result["mercados"]}

    for a, b in (
        ("Mais de 2.5 Golos", "Menos de 2.5 Golos"),
        ("Mais de 3.5 Golos", "Menos de 3.5 Golos"),
        ("Ambas Marcam", "BTTS No"),
    ):
        assert abs(probs[a] + probs[b] - 100) < 0.5, (a, b)

    outcomes = probs["Casa"] + probs["Empate"] + probs["Fora"]
    assert abs(outcomes - 100) < 0.5, outcomes


def test_a_fair_book_leaves_no_edge():
    """Priced against its own probabilities, the model must find nothing."""
    result = analisar_jogo(average_match(9))
    probs = {m["mercado"]: m["prob_usada_pct"] / 100 for m in result["mercados"]}

    priced = analisar_jogo(
        average_match(
            9,
            odd_mais_25=1 / probs["Mais de 2.5 Golos"],
            odd_menos_25=1 / probs["Menos de 2.5 Golos"],
            odd_mais_35=1 / probs["Mais de 3.5 Golos"],
            odd_menos_35=1 / probs["Menos de 3.5 Golos"],
            odd_ambas_marcam=1 / probs["Ambas Marcam"],
            odd_ambas_nao_marcam=1 / probs["BTTS No"],
            odd_casa=1 / probs["Casa"],
            odd_empate=1 / probs["Empate"],
            odd_fora=1 / probs["Fora"],
        )
    )

    for market in priced["mercados"]:
        if market["odd"] <= 1:
            continue
        assert abs(market["value_bet_pct"]) < 1.5, market
        assert market["decisao"] != "Apostar", market


def test_an_efficient_book_with_margin_is_never_bet_into():
    result = analisar_jogo(average_match(9))
    probs = {m["mercado"]: m["prob_usada_pct"] / 100 for m in result["mercados"]}

    for margin in (0.03, 0.05, 0.08):
        price = lambda p: round((1 / p) / (1 + margin), 2)  # noqa: E731
        priced = analisar_jogo(
            average_match(
                9,
                odd_mais_25=price(probs["Mais de 2.5 Golos"]),
                odd_menos_25=price(probs["Menos de 2.5 Golos"]),
                odd_mais_35=price(probs["Mais de 3.5 Golos"]),
                odd_menos_35=price(probs["Menos de 3.5 Golos"]),
                odd_ambas_marcam=price(probs["Ambas Marcam"]),
                odd_ambas_nao_marcam=price(probs["BTTS No"]),
                odd_casa=price(probs["Casa"]),
                odd_empate=price(probs["Empate"]),
                odd_fora=price(probs["Fora"]),
            )
        )
        bets = [m for m in priced["mercados"] if m["decisao"] == "Apostar"]
        assert not bets, (margin, bets)


def test_thin_samples_are_not_bet_on():
    for games in (0, 2, 4):
        result = analisar_jogo(average_match(games))
        bets = [m for m in result["mercados"] if m["decisao"] == "Apostar"]
        assert not bets, (games, bets)


def test_heuristic_nudges_fade_at_the_extremes():
    """The nudge must shrink as a market approaches certainty.

    Unchecked, a +10 point nudge once turned a 90% market into 99%, i.e. odds
    of 1.01. Near the extremes the underlying estimate is least reliable, so
    that is exactly where a heuristic should hold back.
    """
    big_nudge = 0.10

    coin_flip = pair_shift(0.50, big_nudge) - 0.50
    near_certain = pair_shift(0.95, big_nudge) - 0.95

    assert coin_flip > 0.08, coin_flip
    assert near_certain < 0.02, near_certain
    assert pair_shift(0.97, big_nudge) <= 0.98
    assert pair_shift(0.03, -big_nudge) >= 0.02


def test_recent_form_moves_the_forecast_without_dominating_it():
    """Five games are mostly noise: they may tilt the forecast, not rewrite it."""
    normal = estimate_lambdas(average_match(12))[0]

    hot = estimate_lambdas(average_match(12, golos_marcados_casa_rec=15))[0]
    cold = estimate_lambdas(average_match(12, golos_marcados_casa_rec=0))[0]

    assert hot > normal > cold, (cold, normal, hot)
    assert hot / normal < 1.30, f"hot streak moved the forecast {hot / normal:.2f}x"
    assert cold / normal > 0.75, f"cold streak moved the forecast {cold / normal:.2f}x"


def test_book_margin_is_measured():
    cheap = analisar_jogo(
        average_match(9, odd_casa=2.10, odd_empate=3.60, odd_fora=4.05)
    )
    expensive = analisar_jogo(
        average_match(
            9,
            odd_casa=1.85,
            odd_empate=3.10,
            odd_fora=3.40,
            odd_mais_25=1.75,
            odd_menos_25=1.80,
            odd_ambas_marcam=1.70,
            odd_ambas_nao_marcam=1.85,
        )
    )
    assert cheap["margem_casa_pct"] < expensive["margem_casa_pct"]
    assert expensive["margem_casa_pct"] > 6


def test_probability_view_needs_no_odds_and_manufactures_no_decision():
    """The odds-free view must never carry a value, a stake or a decision —
    only what the model expects to happen."""
    result = probabilidades_jogo(average_match(9))

    assert result["mercados"], "expected at least one market"
    for market in result["mercados"]:
        assert set(market.keys()) == {"mercado", "grupo", "probabilidade_pct", "min_pct", "max_pct"}
        assert market["min_pct"] <= market["probabilidade_pct"] <= market["max_pct"]


def test_probability_view_markets_sum_to_one():
    probs = {
        m["mercado"]: m["probabilidade_pct"] for m in probabilidades_jogo(average_match(9))["mercados"]
    }

    for a, b in (
        ("Mais de 2.5 Golos", "Menos de 2.5 Golos"),
        ("Mais de 3.5 Golos", "Menos de 3.5 Golos"),
        ("Ambas Marcam", "BTTS No"),
    ):
        assert abs(probs[a] + probs[b] - 100) < 0.5, (a, b)

    assert abs(probs["Casa"] + probs["Empate"] + probs["Fora"] - 100) < 0.5


def test_probability_view_agrees_with_the_priced_analysis():
    """Both views are built on the same forecast, so a shared market must read
    the same whether or not odds were ever supplied."""
    priced = {m["mercado"]: m["prob_usada_pct"] for m in analisar_jogo(average_match(9))["mercados"]}
    pure = {m["mercado"]: m["probabilidade_pct"] for m in probabilidades_jogo(average_match(9))["mercados"]}

    for market in pure:
        assert abs(pure[market] - priced[market]) < 3.0, (market, pure[market], priced[market])


def test_probability_view_sample_confidence_reflects_the_evidence():
    thin = probabilidades_jogo(average_match(2))
    solid = probabilidades_jogo(average_match(20))

    assert thin["amostra_pct"] < solid["amostra_pct"]
    assert thin["amostra_label"] == "Baixa"
    assert solid["amostra_label"] == "Alta"


def test_probability_view_includes_the_double_chance_and_goals_combos():
    """Same combos analisar_jogo prices for a bookmaker's combo market —
    the odds-free view should read them too, not just the base markets."""
    mercados = {m["mercado"]: m for m in probabilidades_jogo(average_match(9))["mercados"]}
    combos = (
        "1X e Menos de 3.5 Golos",
        "2X e Menos de 3.5 Golos",
        "1X e Mais de 1.5 Golos",
        "2X e Mais de 1.5 Golos",
    )

    for market in combos:
        assert market in mercados, market
        assert mercados[market]["grupo"] == "Combinados"
        assert 0 <= mercados[market]["probabilidade_pct"] <= 100


def test_headline_market_is_the_single_highest_probability():
    """The headline is simply whichever market is most likely to happen —
    1X/2X and the double-chance-plus-goals combos are eligible too, since
    they're real markets a bettor can back like any other."""
    mercados = probabilidades_jogo(average_match(9))["mercados"]
    headline = pick_headline_market(mercados)

    assert headline["probabilidade_pct"] == max(
        m["probabilidade_pct"] for m in mercados
    )


def test_headline_market_is_the_strongest_real_signal():
    lopsided = average_match(
        12,
        golos_marcados_casa=40,
        golos_sofridos_casa=2,
        golos_marcados_casa_rec=18,
        golos_sofridos_casa_rec=0,
    )
    mercados = probabilidades_jogo(lopsided)["mercados"]
    headline = pick_headline_market(mercados)

    assert headline["probabilidade_pct"] == max(
        m["probabilidade_pct"] for m in mercados
    )


def test_settlement_reads_a_home_win():
    settled = settle_markets(2, 0)

    assert settled["Casa"] is True
    assert settled["Empate"] is False
    assert settled["Fora"] is False
    assert settled["1X"] is True
    assert settled["2X"] is False
    assert settled["Ambas Marcam"] is False
    assert settled["BTTS No"] is True
    assert settled["Menos de 2.5 Golos"] is True
    assert settled["Mais de 2.5 Golos"] is False


def test_settlement_needs_both_halves_of_a_combo():
    # 0-1: under 3.5 landed, but the 1X half did not.
    assert settle_markets(0, 1)["1X e Menos de 3.5 Golos"] is False
    assert settle_markets(0, 1)["2X e Menos de 3.5 Golos"] is True
    # 3-2: the 1X half landed, but five goals is over the line.
    assert settle_markets(3, 2)["1X e Menos de 3.5 Golos"] is False
    assert settle_markets(3, 2)["1X e Mais de 1.5 Golos"] is True


def test_settlement_covers_every_market_the_model_forecasts():
    settled = settle_markets(1, 1)

    for market_name, _group in model.PROBABILITY_MARKETS:
        assert market_name in settled, market_name


def test_settlement_survives_a_score_off_the_grid():
    """A freak result must not be folded back onto the simulation grid: 12-11
    clamped to 10-10 would turn a home win into a draw."""
    settled = settle_markets(model.MAX_GOALS + 2, model.MAX_GOALS + 1)

    assert settled["Casa"] is True
    assert settled["Empate"] is False
    assert settled["Mais de 3.5 Golos"] is True


def test_a_cheaper_simulation_lands_on_the_same_forecast():
    """Scoring a season runs fewer iterations per match. The means it reports
    have to be the same forecast, only rougher, or the measurement would be of
    a different model than the one the board shows."""
    data = average_match(9)

    full = probabilidades_jogo(data)
    cheap = probabilidades_jogo(data, iterations=2_000)

    full_by_market = {m["mercado"]: m["probabilidade_pct"] for m in full["mercados"]}
    for market in cheap["mercados"]:
        assert abs(market["probabilidade_pct"] - full_by_market[market["mercado"]]) < 3.0


def test_calibration_pulls_a_forecast_back_to_what_it_delivered():
    """Measured over 1 109 forecasts: what the model called at 84% landed 63%
    of the time, and what it called at 26% landed 30%."""
    assert calibrate_pct(84) < 84
    assert calibrate_pct(90) < calibrate_pct(95) < 90
    # Under a half it was the other way round: too shy, not too bold.
    assert calibrate_pct(25) > 25
    assert calibrate_pct(17) > 17
    # Order is never touched: a surer market stays the surer market.
    assert calibrate_pct(60) < calibrate_pct(70) < calibrate_pct(80)


def test_calibration_never_manufactures_certainty():
    assert 0 < calibrate_pct(0) < 5
    assert 95 < calibrate_pct(100) < 100


def test_calibrated_markets_still_agree_with_each_other():
    """Fifteen markets put through the curve one by one come out incoherent:
    the three results stop adding to one and the halves of a two-way market
    stop being each other's remainder."""
    probs = {
        m["mercado"]: m["probabilidade_pct"]
        for m in probabilidades_jogo(average_match(12))["mercados"]
    }

    assert abs(probs["Casa"] + probs["Empate"] + probs["Fora"] - 100) < 0.5
    assert abs(probs["1X"] - (probs["Casa"] + probs["Empate"])) < 0.5
    assert abs(probs["2X"] - (probs["Fora"] + probs["Empate"])) < 0.5
    assert abs(probs["Mais de 2.5 Golos"] + probs["Menos de 2.5 Golos"] - 100) < 0.5
    assert abs(probs["Ambas Marcam"] + probs["BTTS No"] - 100) < 0.5

    # A combination can never be likelier than the halves it is made of.
    assert probs["1X e Menos de 3.5 Golos"] <= probs["1X"] + 0.5
    assert probs["1X e Menos de 3.5 Golos"] <= probs["Menos de 3.5 Golos"] + 0.5
    assert probs["2X e Mais de 1.5 Golos"] <= probs["2X"] + 0.5


def test_calibration_moves_the_interval_with_the_middle():
    for market in probabilidades_jogo(average_match(12))["mercados"]:
        assert market["min_pct"] <= market["probabilidade_pct"] <= market["max_pct"]


def test_calibration_leaves_a_forecast_it_has_nothing_to_say_about():
    """The curve crosses the diagonal where the model was right: around there
    a forecast comes out as it went in."""
    distributions = {"X": (0.46, 0.40, 0.52)}
    moved = calibrate_distributions(distributions)["X"]

    assert abs(moved[0] - 0.46) < 0.02


def test_each_market_carries_its_own_measured_bias():
    """Measured on 692 fixtures of nine competitions: the simulation makes
    matches too one-sided. Both teams scoring landed 61% of the times it was
    called at 52%, more than 2.5 landed 58% against 52% — and more than 3.5,
    the blowout it pays for those with, landed slightly less than it said."""
    # O valor cru que a curva global transforma em cada média medida.
    def raw(target: float) -> float:
        z = math.log(target / (1 - target))
        return 100 / (1 + math.exp(-((z - CALIBRATION_INTERCEPT) / CALIBRATION_SLOPE)))

    assert calibrate_pct(raw(0.524), "Ambas Marcam") == pytest.approx(61.0, abs=0.2)
    assert calibrate_pct(raw(0.520), "Mais de 2.5 Golos") == pytest.approx(57.8, abs=0.2)
    assert calibrate_pct(raw(0.394), "Casa") == pytest.approx(44.1, abs=0.2)
    assert calibrate_pct(raw(0.320), "Fora") == pytest.approx(28.7, abs=0.2)
    # Mais de 3.5 é o único mercado de golos que o modelo exagerava.
    assert calibrate_pct(raw(0.361), "Mais de 3.5 Golos") < 36.1
    # Um mercado sem viés medido continua só com a curva de todos.
    assert calibrate_pct(60, "Mercado que não existe") == calibrate_pct(60)


def test_the_mirror_of_an_understated_market_stops_being_a_tip():
    """A correção não é cosmética: "Menos de 2.5" e "BTTS No" são o espelho
    dos dois mercados mais subestimados, e eram precisamente os que o quadro
    escolhia e perdia. Corrigidos, deixam quase sempre de passar os 55%."""
    probs = {
        m["mercado"]: m["probabilidade_pct"]
        for m in probabilidades_jogo(average_match(12))["mercados"]
    }

    assert probs["Menos de 2.5 Golos"] == pytest.approx(
        100 - probs["Mais de 2.5 Golos"], abs=0.5
    )
    assert probs["BTTS No"] == pytest.approx(100 - probs["Ambas Marcam"], abs=0.5)
    # Num jogo médio nenhum dos dois chega ao mínimo para liderar um jogo.
    assert probs["Menos de 2.5 Golos"] < MIN_HEADLINE_PCT
    assert probs["BTTS No"] < MIN_HEADLINE_PCT


def test_a_side_not_losing_at_seventy_beats_any_advertised_edge():
    """Medido no registo do próprio quadro, duas vezes: a dupla hipótese a
    70%+ entrou 87.5% das vezes (24 jogos), os golos e combinados 53.8% (65
    jogos). A folga sobre a liga, que é por onde o resto desta função
    ordena, não tem valor medido nenhum — com dez pontos ou mais de folga o
    quadro acertou 64%, com menos de cinco acertou 74%."""
    mercados = [
        {"mercado": "Menos de 3.5 Golos", "grupo": "Golos", "probabilidade_pct": 84.0},
        {"mercado": "1X", "grupo": "Resultado", "probabilidade_pct": 71.0},
    ]
    # A liga dá 60% de "menos de 3.5" e 50% de 1X: a folga é toda do mercado
    # de golos, e mesmo assim não é ele que lidera.
    rates = {"Menos de 3.5 Golos": 60.0, "1X": 50.0}

    assert pick_headline_market(mercados, rates)["mercado"] == "1X"
    # Sem as taxas da liga é igual: a regra não depende de as ter.
    assert pick_headline_market(mercados)["mercado"] == "1X"


def test_below_seventy_the_double_chance_has_no_claim():
    """Abaixo de setenta não é uma lista curta, é o quadro todo: o 2X abaixo
    de 70% entrou 46% das vezes, pior do que os golos."""
    mercados = [
        {"mercado": "Mais de 2.5 Golos", "grupo": "Golos", "probabilidade_pct": 72.0},
        {"mercado": "2X", "grupo": "Resultado", "probabilidade_pct": 69.0},
    ]
    rates = {"Mais de 2.5 Golos": 55.0, "2X": 60.0}

    assert pick_headline_market(mercados, rates)["mercado"] == "Mais de 2.5 Golos"


def test_headline_is_the_market_the_league_does_not_already_give_you():
    """"Menos de 3.5 a 78%" in a league where it lands 77% of the time is
    one point of opinion dressed as a near certainty."""
    mercados = [
        {"mercado": "Menos de 3.5 Golos", "grupo": "Golos", "probabilidade_pct": 78.0},
        {"mercado": "1X", "grupo": "Resultado", "probabilidade_pct": 66.0},
    ]
    rates = {"Menos de 3.5 Golos": 77.0, "1X": 48.0}

    assert pick_headline_market(mercados, rates)["mercado"] == "1X"
    # Without the league's own rates there is no scale, and the strongest
    # number is all there is to go on.
    assert pick_headline_market(mercados)["mercado"] == "Menos de 3.5 Golos"


def test_headline_never_leads_with_a_market_nobody_would_back():
    """A draw eight points above its league rate is still a bet on the least
    likely outcome of the three."""
    mercados = [
        {"mercado": "Empate", "grupo": "Resultado", "probabilidade_pct": 34.0},
        {"mercado": "1X", "grupo": "Resultado", "probabilidade_pct": 62.0},
    ]
    rates = {"Empate": 24.0, "1X": 58.0}

    assert pick_headline_market(mercados, rates)["mercado"] == "1X"


def test_headline_falls_back_when_the_league_has_no_rate_for_a_market():
    mercados = [
        {"mercado": "Casa", "grupo": "Resultado", "probabilidade_pct": 71.0},
        {"mercado": "1X", "grupo": "Resultado", "probabilidade_pct": 80.0},
    ]

    assert pick_headline_market(mercados, {"Fora": 30.0})["mercado"] == "1X"


if __name__ == "__main__":
    checks = [value for name, value in sorted(globals().items()) if name.startswith("test_")]
    for check in checks:
        check()
        print(f"ok  {check.__name__}")
    print(f"\n{len(checks)} verificações passaram")
