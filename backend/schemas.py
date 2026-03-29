from pydantic import BaseModel
from typing import List


class AnalyzeRequest(BaseModel):
    equipa_casa: str
    equipa_fora: str

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

    banca: float
    fracao_kelly: float


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