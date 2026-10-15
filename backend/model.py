import math
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

import numpy as np


LEAGUE_HOME_GOALS_AVG = 1.45
LEAGUE_AWAY_GOALS_AVG = 1.15
MIN_ODDS = 1.3
MAX_ODDS = 6.0
MAX_GOALS = 10
BOOTSTRAP_ITERATIONS = 10_000
DEFAULT_RHO = -0.08
DEFAULT_SHRINKAGE_MATCHES = 6.0


@dataclass(frozen=True)
class LeagueContext:
    home_goals_avg: float
    away_goals_avg: float
    rho: float
    shrinkage_matches: float


def clamp(value: float, lower: float, upper: float) -> float:
    return max(lower, min(upper, value))


def safe_div(numerator: float, denominator: float, fallback: float = 0.0) -> float:
    if denominator == 0:
        return fallback
    return numerator / denominator


def weighted_rate(total_value: int, total_games: int, recent_value: int, recent_games: int) -> float:
    total_rate = safe_div(total_value, total_games, 0.0)
    recent_rate = safe_div(recent_value, recent_games, total_rate)

    if total_games <= 0 and recent_games <= 0:
        return 0.0
    if recent_games <= 0:
        return total_rate
    if total_games <= 0:
        return recent_rate

    # Recent form deserves weight in proportion to how much evidence it carries.
    # A five game streak inside a twelve game season is mostly noise: letting it
    # dominate makes the model chase hot and cold runs that regress anyway.
    recent_weight = clamp(recent_games / max(total_games + recent_games, 1), 0.0, 0.35)
    return recent_rate * recent_weight + total_rate * (1 - recent_weight)


def effective_sample(total_games: int, recent_games: int) -> float:
    return max(1.0, total_games * 0.55 + recent_games * 0.45)


def get_league_context(data) -> LeagueContext:
    return LeagueContext(
        home_goals_avg=clamp(getattr(data, "league_home_goals_avg", LEAGUE_HOME_GOALS_AVG), 0.5, 3.5),
        away_goals_avg=clamp(getattr(data, "league_away_goals_avg", LEAGUE_AWAY_GOALS_AVG), 0.4, 3.0),
        rho=clamp(getattr(data, "dixon_coles_rho", DEFAULT_RHO), -0.5, 0.5),
        shrinkage_matches=clamp(getattr(data, "shrinkage_matches", DEFAULT_SHRINKAGE_MATCHES), 0.0, 30.0),
    )


def shrink_rate(observed_rate: float, games: int, prior_rate: float, shrinkage_matches: float) -> float:
    if games <= 0:
        return prior_rate
    if shrinkage_matches <= 0:
        return observed_rate

    weight = games / (games + shrinkage_matches)
    return observed_rate * weight + prior_rate * (1 - weight)


def get_attack_defense_strengths(data) -> Dict[str, float]:
    context = get_league_context(data)

    raw_home_attack_rate = weighted_rate(
        data.golos_marcados_casa,
        data.jogos_casa,
        data.golos_marcados_casa_rec,
        data.jogos_casa_rec,
    )
    raw_home_defense_concede_rate = weighted_rate(
        data.golos_sofridos_casa,
        data.jogos_casa,
        data.golos_sofridos_casa_rec,
        data.jogos_casa_rec,
    )
    raw_away_attack_rate = weighted_rate(
        data.golos_marcados_fora,
        data.jogos_fora,
        data.golos_marcados_fora_rec,
        data.jogos_fora_rec,
    )
    raw_away_defense_concede_rate = weighted_rate(
        data.golos_sofridos_fora,
        data.jogos_fora,
        data.golos_sofridos_fora_rec,
        data.jogos_fora_rec,
    )

    effective_home_games = max(data.jogos_casa, data.jogos_casa_rec)
    effective_away_games = max(data.jogos_fora, data.jogos_fora_rec)

    home_attack_rate = shrink_rate(
        raw_home_attack_rate,
        effective_home_games,
        context.home_goals_avg,
        context.shrinkage_matches,
    )
    home_defense_concede_rate = shrink_rate(
        raw_home_defense_concede_rate,
        effective_home_games,
        context.away_goals_avg,
        context.shrinkage_matches,
    )
    away_attack_rate = shrink_rate(
        raw_away_attack_rate,
        effective_away_games,
        context.away_goals_avg,
        context.shrinkage_matches,
    )
    away_defense_concede_rate = shrink_rate(
        raw_away_defense_concede_rate,
        effective_away_games,
        context.home_goals_avg,
        context.shrinkage_matches,
    )

    home_attack_strength = clamp(home_attack_rate / context.home_goals_avg if context.home_goals_avg else 1.0, 0.45, 2.2)
    home_defense_weakness = clamp(home_defense_concede_rate / context.away_goals_avg if context.away_goals_avg else 1.0, 0.45, 2.2)
    away_attack_strength = clamp(away_attack_rate / context.away_goals_avg if context.away_goals_avg else 1.0, 0.45, 2.2)
    away_defense_weakness = clamp(away_defense_concede_rate / context.home_goals_avg if context.home_goals_avg else 1.0, 0.45, 2.2)

    return {
        "league_home_goals_avg": context.home_goals_avg,
        "league_away_goals_avg": context.away_goals_avg,
        "home_attack_rate": home_attack_rate,
        "home_defense_concede_rate": home_defense_concede_rate,
        "away_attack_rate": away_attack_rate,
        "away_defense_concede_rate": away_defense_concede_rate,
        "home_attack_strength": home_attack_strength,
        "home_defense_weakness": home_defense_weakness,
        "away_attack_strength": away_attack_strength,
        "away_defense_weakness": away_defense_weakness,
    }


def estimate_lambdas(data) -> Tuple[float, float]:
    """Expected goals for each side.

    Small samples are handled by shrink_rate, which pulls the observed scoring
    rates towards the league baseline. They must NOT also scale the expected
    goals down: doing so regresses the forecast towards zero instead of towards
    the average match, and systematically understates goals, BTTS and overs.
    """
    strengths = get_attack_defense_strengths(data)
    context = get_league_context(data)

    lambda_home = context.home_goals_avg * strengths["home_attack_strength"] * strengths["away_defense_weakness"]
    lambda_away = context.away_goals_avg * strengths["away_attack_strength"] * strengths["home_defense_weakness"]

    return clamp(lambda_home, 0.15, 3.8), clamp(lambda_away, 0.15, 3.4)


def pair_shift(probability: float, shift: float) -> float:
    """Apply a heuristic nudge, damped towards the extremes.

    The 4p(1-p) factor is 1 for a coin-flip market and fades to 0 as the
    probability approaches 0 or 1, where the estimate is least reliable and an
    unchecked nudge would manufacture near-certainties.
    """
    damping = 4.0 * probability * (1.0 - probability)
    return clamp(probability + shift * damping, 0.02, 0.98)


def fair_probs_two_way(odd_a: float, odd_b: float) -> Tuple[float, float]:
    inv_a = safe_div(1.0, odd_a, 0.0)
    inv_b = safe_div(1.0, odd_b, 0.0)
    total = inv_a + inv_b
    if total <= 0:
        return 0.0, 0.0
    return inv_a / total, inv_b / total


def fair_probs_three_way(home_odd: float, draw_odd: float, away_odd: float) -> Tuple[float, float, float]:
    invs = [safe_div(1.0, x, 0.0) for x in [home_odd, draw_odd, away_odd]]
    total = sum(invs)
    if total <= 0:
        return 0.0, 0.0, 0.0
    return tuple(inv / total for inv in invs)


def book_overround(data) -> float:
    """Average bookmaker margin measured on the markets that come in complete
    sets. Used to strip the same margin from markets priced alone (double
    chance and combos), which otherwise look worse than they really are."""
    books = [
        (data.odd_casa, data.odd_empate, data.odd_fora),
        (data.odd_mais_25, data.odd_menos_25),
        (data.odd_mais_35, data.odd_menos_35),
        (data.odd_ambas_marcam, data.odd_ambas_nao_marcam),
    ]

    overrounds = []
    for book in books:
        if any(odd <= 1 for odd in book):
            continue
        total = sum(1.0 / odd for odd in book)
        if 1.0 < total < 1.5:
            overrounds.append(total)

    if not overrounds:
        return 1.0
    return sum(overrounds) / len(overrounds)


def fair_prob_single_market(odd: float, overround: float = 1.0) -> float:
    return safe_div(1.0, odd, 0.0) / max(overround, 1.0)


def _base_market_masks(max_goals: int = MAX_GOALS) -> Dict[str, np.ndarray]:
    i = np.arange(max_goals + 1)[:, None]
    j = np.arange(max_goals + 1)[None, :]
    total = i + j
    return {
        "Casa": i > j,
        "Empate": i == j,
        "Fora": i < j,
        "Mais de 2.5 Golos": total >= 3,
        "Mais de 3.5 Golos": total >= 4,
        "Ambas Marcam": (i >= 1) & (j >= 1),
        "1X e Menos de 3.5 Golos": (total <= 3) & (i >= j),
        "2X e Menos de 3.5 Golos": (total <= 3) & (j >= i),
        "1X e Mais de 1.5 Golos": (total >= 2) & (i >= j),
        "2X e Mais de 1.5 Golos": (total >= 2) & (j >= i),
    }


def settle_markets(home_goals: int, away_goals: int) -> Dict[str, bool]:
    """Did each market land, given the final score?

    This reads the very masks the simulation sums over, and derives the rest
    exactly as the forecast does, so a market cannot mean one thing when it is
    predicted and another when it is scored. Scoring a forecast against the
    result is only worth anything if both sides agree on what was forecast.

    The mask grid is stretched to the actual score when a freak result lands
    outside it: clamping 12-11 down to the grid would turn a home win into a
    draw and settle four markets the wrong way.
    """
    home = max(int(home_goals), 0)
    away = max(int(away_goals), 0)
    masks = _base_market_masks(max(MAX_GOALS, home, away))

    settled = {name: bool(mask[home, away]) for name, mask in masks.items()}
    settled["Menos de 2.5 Golos"] = not settled["Mais de 2.5 Golos"]
    settled["Menos de 3.5 Golos"] = not settled["Mais de 3.5 Golos"]
    settled["BTTS No"] = not settled["Ambas Marcam"]
    settled["1X"] = settled["Casa"] or settled["Empate"]
    settled["2X"] = settled["Fora"] or settled["Empate"]
    return settled


def _score_matrices_vector(lambda_home: np.ndarray, lambda_away: np.ndarray, rho: float, max_goals: int = MAX_GOALS) -> np.ndarray:
    goals = np.arange(max_goals + 1)
    factorials = np.array([math.factorial(g) for g in goals], dtype=float)

    ph = np.exp(-lambda_home)[:, None] * np.power(lambda_home[:, None], goals[None, :]) / factorials[None, :]
    pa = np.exp(-lambda_away)[:, None] * np.power(lambda_away[:, None], goals[None, :]) / factorials[None, :]
    matrices = ph[:, :, None] * pa[:, None, :]

    matrices[:, 0, 0] *= 1 - (lambda_home * lambda_away * rho)
    matrices[:, 0, 1] *= 1 + (lambda_home * rho)
    matrices[:, 1, 0] *= 1 + (lambda_away * rho)
    matrices[:, 1, 1] *= 1 - rho

    np.maximum(matrices, 0.0, out=matrices)
    matrices /= matrices.sum(axis=(1, 2), keepdims=True)
    return matrices


def _market_probs_vector(matrices: np.ndarray) -> Dict[str, np.ndarray]:
    masks = _base_market_masks()
    probs = {name: matrices[:, mask].sum(axis=1) for name, mask in masks.items()}

    probs["Menos de 2.5 Golos"] = np.maximum(0.0, 1 - probs["Mais de 2.5 Golos"])
    probs["Menos de 3.5 Golos"] = np.maximum(0.0, 1 - probs["Mais de 3.5 Golos"])
    probs["BTTS No"] = np.maximum(0.0, 1 - probs["Ambas Marcam"])
    probs["1X"] = probs["Casa"] + probs["Empate"]
    probs["2X"] = probs["Fora"] + probs["Empate"]
    return probs


def _apply_goal_pressure_vector(
    probs: Dict[str, np.ndarray],
    lambda_home: np.ndarray,
    lambda_away: np.ndarray,
    data,
) -> Dict[str, np.ndarray]:
    strengths = get_attack_defense_strengths(data)
    total_xg = lambda_home + lambda_away
    lower = np.minimum(lambda_home, lambda_away)
    upper = np.maximum(lambda_home, lambda_away)
    balance = lower / np.maximum(upper, 0.01)
    mutual_scoring_pressure = np.clip((lower - 0.65) / 0.75, 0.0, 1.0)
    open_game_pressure = np.clip((total_xg - 2.35) / 1.1, 0.0, 1.0)
    defensive_fragility = clamp(
        (
            strengths["home_defense_weakness"]
            + strengths["away_defense_weakness"]
            - 1.85
        )
        / 1.15,
        0.0,
        1.0,
    )
    low_goal_pressure = np.clip((2.25 - total_xg) / 0.8, 0.0, 1.0)

    btts_shift = (
        0.075 * mutual_scoring_pressure * open_game_pressure * np.clip(balance, 0.35, 1.0)
        + 0.035 * defensive_fragility * mutual_scoring_pressure
        - 0.055 * low_goal_pressure
    )
    over25_shift = (
        0.065 * open_game_pressure
        + 0.035 * defensive_fragility
        - 0.045 * low_goal_pressure
    )
    over35_shift = (
        0.035 * np.clip((total_xg - 2.75) / 1.0, 0.0, 1.0)
        + 0.018 * defensive_fragility
        - 0.035 * low_goal_pressure
    )

    probs["Ambas Marcam"] = np.clip(probs["Ambas Marcam"] + btts_shift, 0.01, 0.99)
    probs["BTTS No"] = 1 - probs["Ambas Marcam"]
    probs["Mais de 2.5 Golos"] = np.clip(probs["Mais de 2.5 Golos"] + over25_shift, 0.01, 0.99)
    probs["Menos de 2.5 Golos"] = 1 - probs["Mais de 2.5 Golos"]
    probs["Mais de 3.5 Golos"] = np.clip(probs["Mais de 3.5 Golos"] + over35_shift, 0.01, 0.99)
    probs["Menos de 3.5 Golos"] = 1 - probs["Mais de 3.5 Golos"]
    return probs


def estimate_market_distributions(
    lambda_home: float,
    lambda_away: float,
    data,
    iterations: int = BOOTSTRAP_ITERATIONS,
) -> Dict[str, Tuple[float, float, float]]:
    """Simulate the match `iterations` times and derive every market's mean
    probability and 5%-95% interval from the same set of simulations.

    Scoring a whole season passes a smaller count: the intervals get rougher,
    but the means are what calibration is measured on and their noise averages
    out over hundreds of matches, where a full-precision run each would cost
    minutes instead of seconds.
    """
    home_sample = effective_sample(data.jogos_casa, data.jogos_casa_rec)
    away_sample = effective_sample(data.jogos_fora, data.jogos_fora_rec)
    joint_sample = (home_sample + away_sample) / 2
    context = get_league_context(data)

    sigma_home = clamp(0.28 / math.sqrt(joint_sample), 0.03, 0.16)
    sigma_away = clamp(0.30 / math.sqrt(joint_sample), 0.03, 0.16)

    perturbed_home = np.clip(
        np.random.normal(lambda_home, sigma_home, iterations), 0.05, 4.5
    )
    perturbed_away = np.clip(
        np.random.normal(lambda_away, sigma_away, iterations), 0.05, 4.0
    )

    matrices = _score_matrices_vector(perturbed_home, perturbed_away, context.rho)
    probs = _apply_goal_pressure_vector(
        _market_probs_vector(matrices), perturbed_home, perturbed_away, data
    )

    return {
        name: (
            float(np.mean(values)),
            float(np.quantile(values, 0.05)),
            float(np.quantile(values, 0.95)),
        )
        for name, values in probs.items()
    }


def calculate_kelly(probability: float, odd: float) -> float:
    if odd <= 1:
        return 0.0
    value = (odd * probability - 1) / (odd - 1)
    return max(0.0, value)


def market_structure_score(market_name: str, odds: float, total_xg: float) -> float:
    market = market_name.lower()
    score = 0.6

    if "empate" in market:
        score -= 0.08
    if "menos de 3.5" in market and total_xg > 2.65:
        score -= 0.12
    if "ambas" in market and total_xg > 2.35:
        score += 0.06
    if "mais de 2.5" in market and total_xg > 2.45:
        score += 0.05
    if "menos de 2.5" in market and total_xg > 2.45:
        score -= 0.07
    if "mais de 3.5" in market and total_xg < 2.4:
        score -= 0.12
    if odds < 1.55 or odds > 4.5:
        score -= 0.12
    if "casa" in market or "fora" in market:
        score += 0.04
    if "ambas" in market:
        score += 0.02

    return clamp(score, 0.2, 0.85)


def market_calibration_proxy(probability: float, odds: float, market_name: str) -> float:
    base = 0.62
    if 1.65 <= odds <= 2.6:
        base += 0.10
    elif odds > 3.6:
        base -= 0.08

    if probability < 0.43 or probability > 0.72:
        base -= 0.05

    if market_name.lower() == "empate":
        base -= 0.06

    return clamp(base, 0.25, 0.9)


def build_confidence(sample_quality: float, robustness: float, uncertainty_width: float, calibration: float, structure: float) -> float:
    uncertainty_score = clamp(1 - (uncertainty_width / 0.20), 0.0, 1.0)
    raw = (
        sample_quality * 0.25
        + robustness * 0.25
        + calibration * 0.20
        + uncertainty_score * 0.20
        + structure * 0.10
    )
    return round(clamp(raw * 10, 1.0, 9.9), 1)


def classify_market(edge_lb_pct: float, confidence: float, robustness: float, odds: float, adjusted_kelly_pct: float, risk_label: str) -> str:
    if (
        edge_lb_pct >= 2.5
        and confidence >= 8.0
        and robustness >= 0.80
        and adjusted_kelly_pct >= 0.50
        and 1.55 <= odds <= 3.4
        and risk_label != "High"
    ):
        return "Premium"

    if (
        edge_lb_pct >= 1.8
        and confidence >= 7.0
        and robustness >= 0.72
        and adjusted_kelly_pct >= 0.30
        and 1.5 <= odds <= 4.0
    ):
        return "Elite"

    if edge_lb_pct >= 1.0 and confidence >= 6.5 and robustness >= 0.65:
        return "Bet"

    if edge_lb_pct > -0.2 and confidence >= 5.5 and robustness >= 0.58:
        return "Watchlist"

    return "Discard"


def decision_from_metrics(edge_pct: float, edge_lb_pct: float, confidence: float, robustness: float, adjusted_kelly_pct: float, odds: float, risk_label: str, sample_quality: float) -> str:
    if sample_quality < 0.45:
        return "Não apostar"
    if odds < MIN_ODDS or odds > MAX_ODDS:
        return "Não apostar"
    if edge_pct <= 0 or edge_lb_pct <= 0:
        return "Não apostar"
    if confidence >= 6.5 and robustness >= 0.70 and adjusted_kelly_pct >= 0.30 and risk_label != "High":
        return "Apostar"
    if confidence >= 5.5 and robustness >= 0.58:
        return "Cautela"
    return "Não apostar"


def risk_bucket(uncertainty_width: float, odds: float, robustness: float, adjusted_kelly_pct: float) -> Tuple[int, str]:
    risk_score = 0
    if uncertainty_width > 0.12:
        risk_score += 2
    elif uncertainty_width > 0.08:
        risk_score += 1

    if robustness < 0.62:
        risk_score += 2
    elif robustness < 0.72:
        risk_score += 1

    if odds >= 3.6:
        risk_score += 1
    if adjusted_kelly_pct >= 1.2:
        risk_score += 1

    if risk_score <= 1:
        return 2, "Low"
    if risk_score <= 3:
        return 3, "Medium"
    return 5, "High"


def analyze_market(market_name: str, odd: float, fair_prob: float, model_prob: float, p05: float, p95: float, total_xg: float, data) -> Dict[str, float]:
    if odd <= 1:
        fair_prob = 0.0

    edge = model_prob - fair_prob
    edge_lb = p05 - fair_prob
    uncertainty_width = max(0.0, p95 - p05)
    robustness = clamp(sum(1 for p in [model_prob, p05, (model_prob + p05) / 2] if p > fair_prob) / 3.0, 0.0, 1.0)

    home_sample = effective_sample(data.jogos_casa, data.jogos_casa_rec)
    away_sample = effective_sample(data.jogos_fora, data.jogos_fora_rec)
    sample_quality = clamp(min(home_sample, away_sample) / 12.0, 0.0, 1.0)

    calibration = market_calibration_proxy(model_prob, odd, market_name)
    structure = market_structure_score(market_name, odd, total_xg)
    confidence = build_confidence(sample_quality, robustness, uncertainty_width, calibration, structure)

    kelly_raw = calculate_kelly(model_prob, odd)
    adjusted_kelly = kelly_raw * 0.25 * robustness

    risk_number, risk_label = risk_bucket(uncertainty_width, odd, robustness, adjusted_kelly * 100)
    classification = classify_market(edge_lb * 100, confidence, robustness, odd, adjusted_kelly * 100, risk_label)
    decision = decision_from_metrics(edge * 100, edge_lb * 100, confidence, robustness, adjusted_kelly * 100, odd, risk_label, sample_quality)

    return {
        "mercado": market_name,
        "odd": round(odd, 2),
        "prob_usada_pct": round(model_prob * 100, 2),
        "prob_implicita_pct": round(fair_prob * 100, 2),
        "value_bet_pct": round(edge * 100, 2),
        "edge_lb_pct": round(edge_lb * 100, 2),
        "robustness_pct": round(robustness * 100, 2),
        "uncertainty_pct": round(uncertainty_width * 100, 2),
        "kelly_pct": round(adjusted_kelly * 100, 2),
        "stake_sugerida": round(data.banca * adjusted_kelly * clamp(data.fracao_kelly, 0.05, 1.0), 2),
        "risco": risk_number,
        "confianca": confidence,
        "classificacao": classification,
        "decisao": decision,
    }


def forecast(
    data, iterations: int = BOOTSTRAP_ITERATIONS
) -> Tuple[float, float, Dict[str, Tuple[float, float, float]]]:
    """The odds-free half of an analysis: expected goals and the market
    probability distributions derived purely from team form and the league
    context. Both the priced analysis and the probability-only view build on
    exactly this, so a fix here can never leave the two disagreeing."""
    lambda_home, lambda_away = estimate_lambdas(data)
    distributions = estimate_market_distributions(
        lambda_home, lambda_away, data, iterations
    )
    # Calibrated here, where both views read it, so the odds-free page and
    # the priced one can never quote the same market differently.
    return lambda_home, lambda_away, calibrate_distributions(distributions)


def sample_confidence(data) -> Tuple[float, str]:
    """How much evidence backs this forecast, independent of any market price."""
    home_sample = effective_sample(data.jogos_casa, data.jogos_casa_rec)
    away_sample = effective_sample(data.jogos_fora, data.jogos_fora_rec)
    quality = clamp(min(home_sample, away_sample) / 12.0, 0.0, 1.0)

    if quality >= 0.75:
        label = "Alta"
    elif quality >= 0.45:
        label = "Média"
    else:
        label = "Baixa"

    return round(quality * 100, 1), label


# Core markets a bettor can reason about from a final score alone, grouped for
# display, including the double-chance + goals combos analisar_jogo also
# prices — same distributions either way, so the two views can never disagree
# about what one of these markets is worth.
PROBABILITY_MARKETS: List[Tuple[str, str]] = [
    ("Casa", "Resultado"),
    ("Empate", "Resultado"),
    ("Fora", "Resultado"),
    ("1X", "Resultado"),
    ("2X", "Resultado"),
    ("Mais de 2.5 Golos", "Golos"),
    ("Menos de 2.5 Golos", "Golos"),
    ("Mais de 3.5 Golos", "Golos"),
    ("Menos de 3.5 Golos", "Golos"),
    ("Ambas Marcam", "Ambas Marcam"),
    ("BTTS No", "Ambas Marcam"),
    ("1X e Menos de 3.5 Golos", "Combinados"),
    ("2X e Menos de 3.5 Golos", "Combinados"),
    ("1X e Mais de 1.5 Golos", "Combinados"),
    ("2X e Mais de 1.5 Golos", "Combinados"),
]


# What the model said against what happened, measured on 1 109 forecasts over
# 111 played fixtures of three competitions, each one forecast again from the
# league as it stood before its own kickoff (2026-10-11). Read as a curve, the
# numbers were stretched: everything under a half landed more often than it
# said, everything over a half landed less.
#
#     dizia 25.6% -> 30.3%      dizia 64.2% -> 53.0%
#     dizia 35.2% -> 40.4%      dizia 75.3% -> 65.9%
#     dizia 45.0% -> 45.7%      dizia 84.0% -> 62.5%
#
# A straight line through that, on the log-odds, is these two numbers. It cuts
# the calibration error across the bands by a factor of five, and it is the
# whole of the fix: it makes no forecast better, it stops them overstating.
#
# Refitting is the job of the same backtest, run again: it now measures the
# forecasts as they come out of here, so what it finds is the correction still
# missing, to be composed with this one rather than to replace it.
CALIBRATION_INTERCEPT = -0.1346
CALIBRATION_SLOPE = 0.6427

# The same backtest, run again on what comes out of the curve above: 692
# fixtures of nine competitions, every one forecast from the league as it
# stood before its own kickoff (2026-10-15). The curve straightened the
# overall stretch; what it left behind is not spread evenly, it belongs to
# particular markets, and always in the same direction:
#
#     Casa            dizia 39.4%  ->  aconteceu 44.1%
#     Empate          dizia 28.6%  ->  aconteceu 27.2%
#     Fora            dizia 32.0%  ->  aconteceu 28.7%
#     Mais de 2.5     dizia 52.0%  ->  aconteceu 57.8%
#     Mais de 3.5     dizia 36.1%  ->  aconteceu 34.8%
#     Ambas Marcam    dizia 52.4%  ->  aconteceu 61.0%
#
# Read together they say one thing about the simulation: it makes matches
# too one-sided. The underdog scores more often than it thinks — hence both
# teams scoring eight and a half points low, and more than 2.5 goals six
# points low — while the blowouts it pays for with that never arrive, which
# is why more than 3.5 is the one goal market it overstates. The home side,
# meanwhile, wins almost five points more often than it is given.
#
# These are the shifts, on the log-odds, that put each of those six back
# where the results are. Everything else on the board is derived from them,
# so nothing is corrected twice. The three-way sums to one before and after,
# because the measured rates do.
#
# This matters beyond the number printed next to a game: the market the
# board leads with is whichever clears 55% by the widest margin over its
# league, and an overstated "Menos de 2.5" or "BTTS No" — the mirror of the
# two most understated markets here — is exactly what kept being chosen, and
# kept losing. Corrected, they mostly stop clearing the bar at all.
MARKET_CALIBRATION: Dict[str, float] = {
    "Casa": 0.1934,
    "Empate": -0.0696,
    "Fora": -0.1562,
    "Mais de 2.5 Golos": 0.2345,
    "Mais de 3.5 Golos": -0.0568,
    "Ambas Marcam": 0.3512,
    # Os quatro combinados são simulados, não derivados, por isso o acerto
    # dos seis de cima não lhes chega: a mesma medição, feita outra vez com
    # os seis já corrigidos, encontrou-os onde estavam.
    #
    #     1X e Mais de 1.5     dizia 48.7%  ->  aconteceu 56.5%
    #     1X e Menos de 3.5    dizia 44.5%  ->  aconteceu 47.1%
    #     2X e Mais de 1.5     dizia 42.2%  ->  aconteceu 43.7%
    #     2X e Menos de 3.5    dizia 39.7%  ->  aconteceu 36.5%
    #
    # É a mesma história dos golos, vista de outro lado: "1X e mais de 1.5"
    # é o jogo em que a casa não perde e alguém marca dois, e era o mais
    # subestimado de todo o quadro depois de "ambas marcam".
    "1X e Mais de 1.5 Golos": 0.3127,
    "1X e Menos de 3.5 Golos": 0.1040,
    "2X e Mais de 1.5 Golos": 0.0633,
    "2X e Menos de 3.5 Golos": -0.1370,
}

# Never shown as certainty or impossibility: a forecast of exactly 0 or 100 is
# a claim no model built from a few dozen matches can make.
_CALIBRATION_EDGE = 0.001


def calibrate(probability: float, market: Optional[str] = None) -> float:
    """A forecast, brought back to what forecasts like it actually did.

    Named, it also carries that market's own measured bias; unnamed, only the
    curve everything shares.
    """
    bounded = min(max(probability, _CALIBRATION_EDGE), 1 - _CALIBRATION_EDGE)
    odds = math.log(bounded / (1 - bounded))
    moved = (
        CALIBRATION_INTERCEPT
        + CALIBRATION_SLOPE * odds
        + MARKET_CALIBRATION.get(market or "", 0.0)
    )
    return 1 / (1 + math.exp(-moved))


def calibrate_pct(raw_pct: float, market: Optional[str] = None) -> float:
    """The same, for a number already in percent."""
    return round(calibrate(raw_pct / 100, market) * 100, 1)


def calibrate_distributions(
    distributions: Dict[str, Tuple[float, float, float]],
) -> Dict[str, Tuple[float, float, float]]:
    """Every market of a forecast, calibrated, and still agreeing with itself.

    Fifteen markets put through the curve one by one come out incoherent:
    home, draw and away stop adding up to one, and "Menos de 2.5" stops being
    what is left of "Mais de 2.5". So only the markets a score decides on its
    own are calibrated — the result, the two goal lines, both teams scoring —
    and everything else is derived from those exactly as the simulation
    derives it. A combination can never be likelier than its own halves, so
    the four combined markets are held to that.
    """
    moved = {
        name: tuple(calibrate(value, name) for value in triple)
        for name, triple in distributions.items()
    }

    def at(name: str, index: int) -> float:
        return moved[name][index] if name in moved else 0.0

    coherent: Dict[str, List[float]] = {
        name: list(triple) for name, triple in moved.items()
    }

    for index in range(3):
        three_way = at("Casa", index) + at("Empate", index) + at("Fora", index)
        if three_way > 0:
            for name in ("Casa", "Empate", "Fora"):
                if name in coherent:
                    coherent[name][index] = moved[name][index] / three_way

        home = coherent.get("Casa", [0, 0, 0])[index]
        draw = coherent.get("Empate", [0, 0, 0])[index]
        away = coherent.get("Fora", [0, 0, 0])[index]

        for name, value in (
            ("1X", home + draw),
            ("2X", away + draw),
            ("Menos de 2.5 Golos", 1 - at("Mais de 2.5 Golos", index)),
            ("Menos de 3.5 Golos", 1 - at("Mais de 3.5 Golos", index)),
            ("BTTS No", 1 - at("Ambas Marcam", index)),
        ):
            if name in coherent:
                coherent[name][index] = max(0.0, min(1.0, value))

        for name, parts in (
            ("1X e Menos de 3.5 Golos", ("1X", "Menos de 3.5 Golos")),
            ("2X e Menos de 3.5 Golos", ("2X", "Menos de 3.5 Golos")),
            ("1X e Mais de 1.5 Golos", ("1X",)),
            ("2X e Mais de 1.5 Golos", ("2X",)),
        ):
            if name not in coherent:
                continue
            ceiling = min(coherent[part][index] for part in parts if part in coherent)
            coherent[name][index] = min(coherent[name][index], ceiling)

    return {name: tuple(values) for name, values in coherent.items()}


# Below this, a market is not a tip whatever its edge: "Fora 34%, e a liga dá
# 28%" is a true statement about a game nobody is backing.
MIN_HEADLINE_PCT = 55.0

# O que uma época de resultados consegue medir: um lado não perder. Os mesmos
# dois números que a lista curta usa no ecrã, aqui porque é aqui que a escolha
# se faz — não adianta destacar um mercado e a aplicação dizer a seguir que a
# escolha não presta.
SHORTLIST_MARKETS = ("1X", "2X")
SHORTLIST_MIN_PCT = 70.0


def pick_headline_market(
    mercados: List[Dict[str, Any]],
    base_rates: Optional[Dict[str, float]] = None,
) -> Dict[str, Any]:
    """The one market worth leading a game with.

    Not the highest number. "Mais de 2.5 Golos" at 84% in a league where it
    lands 77% of the time anyway is seven points of opinion dressed as
    certainty — and a board ranked on the raw number fills up with exactly
    those, because the markets that are high by default are high in every
    game. What is worth showing is the gap between what the model says about
    this game and what that competition does without being asked.

    Before any of that, though: a side not losing, at seventy or more.
    Measured on the board's own record, twice over and on both models, that
    is the only thing it says that is worth acting on —

        dupla hipótese a 70%+     24 jogos   entraram 87.5%
        2X abaixo de 70%          13 jogos   entraram 46.2%
        golos / ambas / combinados 65 jogos  entraram 53.8%

    — and the gap over the league, which is what the rest of this function
    ranks by, has no measured value at all: the picks with ten points or more
    of edge landed 64% of the time, the ones with under five landed 74%. A
    season of results measures whether a side loses; a scoreline is the one
    thing the model has to invent, and it shows.

    So when the double chance clears seventy, that is the headline, whatever
    edge some goals market is advertising. On the board of the day that is
    sixty-four games in a hundred, thirty-nine of which were being led by
    something from the family that lands barely more often than a coin.
    """
    standing = [
        market
        for market in mercados
        if market["mercado"] in SHORTLIST_MARKETS
        and market["probabilidade_pct"] >= SHORTLIST_MIN_PCT
    ]
    if standing:
        return max(standing, key=lambda m: m["probabilidade_pct"])

    if not base_rates:
        return max(mercados, key=lambda m: m["probabilidade_pct"])

    worth_backing = [
        market
        for market in mercados
        if market["probabilidade_pct"] >= MIN_HEADLINE_PCT
        and base_rates.get(market["mercado"]) is not None
    ]
    if not worth_backing:
        return max(mercados, key=lambda m: m["probabilidade_pct"])

    return max(
        worth_backing,
        key=lambda m: (
            m["probabilidade_pct"] - base_rates[m["mercado"]],
            m["probabilidade_pct"],
        ),
    )


def probabilidades_jogo(data, iterations: int = BOOTSTRAP_ITERATIONS) -> Dict[str, Any]:
    """What the model thinks will happen — nothing about whether to bet on it.

    No odds go in, so nothing here can be an edge, a stake or a decision:
    those only mean something once a real price is on the table. This is
    meant to be read first, before ever looking at a bookmaker's odds.
    """
    lambda_home, lambda_away, distributions = forecast(data, iterations)
    sample_pct, sample_label = sample_confidence(data)

    mercados = []
    for market_name, grupo in PROBABILITY_MARKETS:
        mean_prob, p05, p95 = distributions[market_name]
        mercados.append(
            {
                "mercado": market_name,
                "grupo": grupo,
                "probabilidade_pct": round(mean_prob * 100, 1),
                "min_pct": round(min(p05, p95) * 100, 1),
                "max_pct": round(max(p05, p95) * 100, 1),
            }
        )

    return {
        "lambda_casa": round(lambda_home, 3),
        "lambda_fora": round(lambda_away, 3),
        "total_golos_esperados": round(lambda_home + lambda_away, 3),
        "amostra_pct": sample_pct,
        "amostra_label": sample_label,
        "mercados": mercados,
    }


def analisar_jogo(data):
    lambda_casa, lambda_fora, distributions = forecast(data)
    total_golos_esperados = lambda_casa + lambda_fora

    fair_over25, fair_under25 = fair_probs_two_way(data.odd_mais_25, data.odd_menos_25)
    fair_over35, fair_under35 = fair_probs_two_way(data.odd_mais_35, data.odd_menos_35)
    fair_btts_yes, fair_btts_no = fair_probs_two_way(data.odd_ambas_marcam, data.odd_ambas_nao_marcam)
    fair_home, fair_draw, fair_away = fair_probs_three_way(data.odd_casa, data.odd_empate, data.odd_fora)
    overround = book_overround(data)
    fair_1x = fair_prob_single_market(data.odd_1x, overround)
    fair_2x = fair_prob_single_market(data.odd_2x, overround)
    fair_1x_under35 = fair_prob_single_market(data.odd_1x_menos_35, overround)
    fair_2x_under35 = fair_prob_single_market(data.odd_2x_menos_35, overround)
    fair_1x_over15 = fair_prob_single_market(data.odd_1x_mais_15, overround)
    fair_2x_over15 = fair_prob_single_market(data.odd_2x_mais_15, overround)

    market_definitions = [
        ("Mais de 2.5 Golos", data.odd_mais_25, fair_over25),
        ("Menos de 2.5 Golos", data.odd_menos_25, fair_under25),
        ("Mais de 3.5 Golos", data.odd_mais_35, fair_over35),
        ("Menos de 3.5 Golos", data.odd_menos_35, fair_under35),
        ("Ambas Marcam", data.odd_ambas_marcam, fair_btts_yes),
        ("BTTS No", data.odd_ambas_nao_marcam, fair_btts_no),
        ("Casa", data.odd_casa, fair_home),
        ("Empate", data.odd_empate, fair_draw),
        ("Fora", data.odd_fora, fair_away),
        ("1X", data.odd_1x, fair_1x),
        ("2X", data.odd_2x, fair_2x),
        ("1X e Menos de 3.5 Golos", data.odd_1x_menos_35, fair_1x_under35),
        ("2X e Menos de 3.5 Golos", data.odd_2x_menos_35, fair_2x_under35),
        ("1X e Mais de 1.5 Golos", data.odd_1x_mais_15, fair_1x_over15),
        ("2X e Mais de 1.5 Golos", data.odd_2x_mais_15, fair_2x_over15),
    ]

    markets = []
    for market_name, odd, fair_prob in market_definitions:
        mean_prob, p05, p95 = distributions[market_name]
        markets.append(
            analyze_market(
                market_name=market_name,
                odd=odd,
                fair_prob=fair_prob,
                model_prob=mean_prob,
                p05=p05,
                p95=p95,
                total_xg=total_golos_esperados,
                data=data,
            )
        )

    return {
        "lambda_casa": round(lambda_casa, 3),
        "lambda_fora": round(lambda_fora, 3),
        "total_golos_esperados": round(total_golos_esperados, 3),
        "margem_casa_pct": round((overround - 1) * 100, 2),
        "mercados": markets,
    }


def model_self_check() -> Dict[str, Any]:
    """Cheap proof of which model is actually running.

    Two teams performing exactly at the league baseline must produce the
    league's own average scoreline. A build still carrying the old sample
    factor returns roughly 1.96 goals instead of ~2.6, so this one number tells
    a stale deploy apart from a current one without reading any code.
    """

    class _Average:
        jogos_casa = jogos_fora = 12
        jogos_casa_rec = jogos_fora_rec = 5
        golos_marcados_casa = round(LEAGUE_HOME_GOALS_AVG * 12)
        golos_sofridos_casa = round(LEAGUE_AWAY_GOALS_AVG * 12)
        golos_marcados_casa_rec = round(LEAGUE_HOME_GOALS_AVG * 5)
        golos_sofridos_casa_rec = round(LEAGUE_AWAY_GOALS_AVG * 5)
        golos_marcados_fora = round(LEAGUE_AWAY_GOALS_AVG * 12)
        golos_sofridos_fora = round(LEAGUE_HOME_GOALS_AVG * 12)
        golos_marcados_fora_rec = round(LEAGUE_AWAY_GOALS_AVG * 5)
        golos_sofridos_fora_rec = round(LEAGUE_HOME_GOALS_AVG * 5)
        league_home_goals_avg = LEAGUE_HOME_GOALS_AVG
        league_away_goals_avg = LEAGUE_AWAY_GOALS_AVG
        dixon_coles_rho = DEFAULT_RHO
        shrinkage_matches = DEFAULT_SHRINKAGE_MATCHES

    home, away = estimate_lambdas(_Average())
    total = home + away
    expected = LEAGUE_HOME_GOALS_AVG + LEAGUE_AWAY_GOALS_AVG

    return {
        "average_match_goals": round(total, 2),
        "league_baseline_goals": round(expected, 2),
        "unbiased": abs(total / expected - 1) < 0.08,
        "simulations_per_analysis": BOOTSTRAP_ITERATIONS,
    }
