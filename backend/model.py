import math
from dataclasses import dataclass
from typing import Dict, List, Tuple

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

    recent_weight = clamp(0.45 + (recent_games / max(total_games, 1)) * 0.25, 0.45, 0.72)
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
    strengths = get_attack_defense_strengths(data)
    context = get_league_context(data)

    sample_factor_home = clamp(effective_sample(data.jogos_casa, data.jogos_casa_rec) / 12.0, 0.75, 1.1)
    sample_factor_away = clamp(effective_sample(data.jogos_fora, data.jogos_fora_rec) / 12.0, 0.75, 1.1)

    lambda_home = context.home_goals_avg * strengths["home_attack_strength"] * strengths["away_defense_weakness"]
    lambda_away = context.away_goals_avg * strengths["away_attack_strength"] * strengths["home_defense_weakness"]

    lambda_home *= sample_factor_home
    lambda_away *= sample_factor_away

    return clamp(lambda_home, 0.15, 3.8), clamp(lambda_away, 0.15, 3.4)


def poisson_prob(lmbda: float, goals: int) -> float:
    return math.exp(-lmbda) * (lmbda ** goals) / math.factorial(goals)


def dixon_coles_tau(i: int, j: int, lambda_home: float, lambda_away: float, rho: float) -> float:
    if i == 0 and j == 0:
        return 1 - (lambda_home * lambda_away * rho)
    if i == 0 and j == 1:
        return 1 + (lambda_home * rho)
    if i == 1 and j == 0:
        return 1 + (lambda_away * rho)
    if i == 1 and j == 1:
        return 1 - rho
    return 1.0


def score_matrix(lambda_home: float, lambda_away: float, rho: float = DEFAULT_RHO, max_goals: int = MAX_GOALS) -> np.ndarray:
    matrix = np.zeros((max_goals + 1, max_goals + 1))
    for i in range(max_goals + 1):
        for j in range(max_goals + 1):
            base = poisson_prob(lambda_home, i) * poisson_prob(lambda_away, j)
            tau = dixon_coles_tau(i, j, lambda_home, lambda_away, rho)
            matrix[i, j] = max(base * tau, 0.0)

    total = matrix.sum()
    if total <= 0:
        return matrix
    return matrix / total


def market_probabilities_from_matrix(matrix: np.ndarray) -> Dict[str, float]:
    home = 0.0
    draw = 0.0
    away = 0.0
    over25 = 0.0
    over35 = 0.0
    btts_yes = 0.0
    one_x_under35 = 0.0
    two_x_under35 = 0.0
    one_x_over15 = 0.0
    two_x_over15 = 0.0

    size = matrix.shape[0]
    for i in range(size):
        for j in range(size):
            p = matrix[i, j]
            total_goals = i + j
            if i > j:
                home += p
            elif i == j:
                draw += p
            else:
                away += p

            if total_goals >= 3:
                over25 += p
            if total_goals >= 4:
                over35 += p
            if i >= 1 and j >= 1:
                btts_yes += p
            if total_goals <= 3 and i >= j:
                one_x_under35 += p
            if total_goals <= 3 and j >= i:
                two_x_under35 += p
            if total_goals >= 2 and i >= j:
                one_x_over15 += p
            if total_goals >= 2 and j >= i:
                two_x_over15 += p

    return {
        "Mais de 2.5 Golos": over25,
        "Menos de 2.5 Golos": max(0.0, 1 - over25),
        "Mais de 3.5 Golos": over35,
        "Menos de 3.5 Golos": max(0.0, 1 - over35),
        "Ambas Marcam": btts_yes,
        "BTTS No": max(0.0, 1 - btts_yes),
        "Casa": home,
        "Empate": draw,
        "Fora": away,
        "1X": home + draw,
        "2X": away + draw,
        "1X e Menos de 3.5 Golos": one_x_under35,
        "2X e Menos de 3.5 Golos": two_x_under35,
        "1X e Mais de 1.5 Golos": one_x_over15,
        "2X e Mais de 1.5 Golos": two_x_over15,
    }


def pair_shift(probability: float, shift: float) -> float:
    return clamp(probability + shift, 0.01, 0.99)


def apply_goal_pressure_adjustments(
    market_probs: Dict[str, float],
    lambda_home: float,
    lambda_away: float,
    data,
) -> Dict[str, float]:
    adjusted = dict(market_probs)
    strengths = get_attack_defense_strengths(data)
    total_xg = lambda_home + lambda_away
    lower_team_xg = min(lambda_home, lambda_away)
    balance = lower_team_xg / max(max(lambda_home, lambda_away), 0.01)
    mutual_scoring_pressure = clamp((lower_team_xg - 0.65) / 0.75, 0.0, 1.0)
    open_game_pressure = clamp((total_xg - 2.35) / 1.1, 0.0, 1.0)
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
    low_goal_pressure = clamp((2.25 - total_xg) / 0.8, 0.0, 1.0)

    btts_shift = (
        0.075 * mutual_scoring_pressure * open_game_pressure * clamp(balance, 0.35, 1.0)
        + 0.035 * defensive_fragility * mutual_scoring_pressure
        - 0.055 * low_goal_pressure
    )
    over25_shift = (
        0.065 * open_game_pressure
        + 0.035 * defensive_fragility
        - 0.045 * low_goal_pressure
    )
    over35_shift = (
        0.035 * clamp((total_xg - 2.75) / 1.0, 0.0, 1.0)
        + 0.018 * defensive_fragility
        - 0.035 * low_goal_pressure
    )

    adjusted["Ambas Marcam"] = pair_shift(adjusted["Ambas Marcam"], btts_shift)
    adjusted["BTTS No"] = 1 - adjusted["Ambas Marcam"]
    adjusted["Mais de 2.5 Golos"] = pair_shift(adjusted["Mais de 2.5 Golos"], over25_shift)
    adjusted["Menos de 2.5 Golos"] = 1 - adjusted["Mais de 2.5 Golos"]
    adjusted["Mais de 3.5 Golos"] = pair_shift(adjusted["Mais de 3.5 Golos"], over35_shift)
    adjusted["Menos de 3.5 Golos"] = 1 - adjusted["Mais de 3.5 Golos"]

    return adjusted


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


def fair_prob_single_market(odd: float) -> float:
    return safe_div(1.0, odd, 0.0)


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


def estimate_market_distributions(lambda_home: float, lambda_away: float, data) -> Dict[str, Tuple[float, float, float]]:
    """Simulate the match BOOTSTRAP_ITERATIONS times and derive every market's
    mean probability and 5%-95% interval from the same set of simulations."""
    home_sample = effective_sample(data.jogos_casa, data.jogos_casa_rec)
    away_sample = effective_sample(data.jogos_fora, data.jogos_fora_rec)
    joint_sample = (home_sample + away_sample) / 2
    context = get_league_context(data)

    sigma_home = clamp(0.28 / math.sqrt(joint_sample), 0.03, 0.16)
    sigma_away = clamp(0.30 / math.sqrt(joint_sample), 0.03, 0.16)

    perturbed_home = np.clip(
        np.random.normal(lambda_home, sigma_home, BOOTSTRAP_ITERATIONS), 0.05, 4.5
    )
    perturbed_away = np.clip(
        np.random.normal(lambda_away, sigma_away, BOOTSTRAP_ITERATIONS), 0.05, 4.0
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


def analisar_jogo(data):
    lambda_casa, lambda_fora = estimate_lambdas(data)
    total_golos_esperados = lambda_casa + lambda_fora
    context = get_league_context(data)

    base_matrix = score_matrix(lambda_casa, lambda_fora, rho=context.rho)
    model_probs = apply_goal_pressure_adjustments(
        market_probabilities_from_matrix(base_matrix),
        lambda_casa,
        lambda_fora,
        data,
    )

    fair_over25, fair_under25 = fair_probs_two_way(data.odd_mais_25, data.odd_menos_25)
    fair_over35, fair_under35 = fair_probs_two_way(data.odd_mais_35, data.odd_menos_35)
    fair_btts_yes, fair_btts_no = fair_probs_two_way(data.odd_ambas_marcam, data.odd_ambas_nao_marcam)
    fair_home, fair_draw, fair_away = fair_probs_three_way(data.odd_casa, data.odd_empate, data.odd_fora)
    fair_1x = fair_prob_single_market(data.odd_1x)
    fair_2x = fair_prob_single_market(data.odd_2x)
    fair_1x_under35 = fair_prob_single_market(data.odd_1x_menos_35)
    fair_2x_under35 = fair_prob_single_market(data.odd_2x_menos_35)
    fair_1x_over15 = fair_prob_single_market(data.odd_1x_mais_15)
    fair_2x_over15 = fair_prob_single_market(data.odd_2x_mais_15)

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

    distributions = estimate_market_distributions(lambda_casa, lambda_fora, data)

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
        "mercados": markets,
    }
