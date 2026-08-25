"""Statistical integrity tests for the analysis engine.

Run with `pytest` or directly: `python test_model.py`.

These lock in properties that are easy to break silently and expensive to
notice in production, because a biased model still returns confident-looking
numbers.
"""

from schemas import AnalyzeRequest
from model import analisar_jogo, estimate_lambdas, pair_shift

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


if __name__ == "__main__":
    checks = [value for name, value in sorted(globals().items()) if name.startswith("test_")]
    for check in checks:
        check()
        print(f"ok  {check.__name__}")
    print(f"\n{len(checks)} verificações passaram")
