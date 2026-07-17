from pydantic import BaseModel, Field
from typing import List


class AnalyzeRequest(BaseModel):
    equipa_casa: str
    equipa_fora: str
    liga: str = "default"

    jogos_casa: int
    golos_marcados_casa: int
    golos_sofridos_casa: int
    jogos_casa_rec: int
    golos_marcados_casa_rec: int
    golos_sofridos_casa_rec: int

    jogos_fora: int
    golos_marcados_fora: int
    golos_sofridos_fora: int
    jogos_fora_rec: int
    golos_marcados_fora_rec: int
    golos_sofridos_fora_rec: int

    odd_mais_25: float
    odd_menos_25: float
    odd_mais_35: float
    odd_menos_35: float
    odd_ambas_marcam: float
    odd_ambas_nao_marcam: float
    odd_casa: float
    odd_empate: float
    odd_fora: float
    odd_1x: float = 0
    odd_2x: float = 0
    odd_1x_menos_35: float = 0
    odd_2x_menos_35: float = 0
    odd_1x_mais_15: float = 0
    odd_2x_mais_15: float = 0

    banca: float
    fracao_kelly: float
    league_home_goals_avg: float = Field(default=1.45, gt=0)
    league_away_goals_avg: float = Field(default=1.15, gt=0)
    dixon_coles_rho: float = Field(default=-0.08, ge=-0.5, le=0.5)
    shrinkage_matches: float = Field(default=6.0, ge=0.0, le=30.0)


class MarketResult(BaseModel):
    mercado: str
    odd: float
    prob_usada_pct: float
    prob_implicita_pct: float
    value_bet_pct: float
    edge_lb_pct: float
    robustness_pct: float
    uncertainty_pct: float
    kelly_pct: float
    stake_sugerida: float
    risco: int
    confianca: float
    classificacao: str
    decisao: str


class AnalyzeResponse(BaseModel):
    lambda_casa: float
    lambda_fora: float
    total_golos_esperados: float
    mercados: List[MarketResult]
