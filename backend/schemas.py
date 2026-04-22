from pydantic import BaseModel, Field
from typing import Any, Dict, List, Optional


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


class AITopValueSnapshot(BaseModel):
    match: str
    market: str
    edge_pct: float
    confidence: float
    odds: float
    decision: str


class AIMarketSnapshot(BaseModel):
    market: str
    bets: int
    roi: float
    hit_rate: float
    profit_loss: float


class AITierSnapshot(BaseModel):
    tier: str
    bets: int
    roi: float
    hit_rate: float


class AIDashboardSummaryRequest(BaseModel):
    current_bankroll: float
    bankroll_growth_pct: float
    open_exposure: float
    risk_level: str
    settled_bets: int
    roi_pct: float
    profit_loss: float
    avg_confidence: float
    analyses_today: int
    value_bets_found: int
    auto_insights: List[str] = Field(default_factory=list)
    top_markets: List[AIMarketSnapshot] = Field(default_factory=list)
    tier_performance: List[AITierSnapshot] = Field(default_factory=list)
    top_value_today: Optional[AITopValueSnapshot] = None


class AIDashboardSummaryResponse(BaseModel):
    configured: bool
    summary: str
    strengths: List[str]
    risks: List[str]
    next_actions: List[str]
    disclaimer: str


class AIBankrollMetricSnapshot(BaseModel):
    label: str
    value: float
    context: str


class AIBankrollReviewRequest(BaseModel):
    current_bankroll: float
    initial_bankroll: float
    bankroll_growth_pct: float
    open_exposure: float
    open_exposure_pct: float
    potential_profit: float
    total_profit_loss: float
    total_staked: float
    roi_pct: float
    hit_rate: float
    total_bets_placed: int
    total_pending: int
    total_greens: int
    total_reds: int
    max_drawdown_pct: float
    current_drawdown_pct: float
    strongest_market: Optional[str] = None
    strongest_market_profit: Optional[float] = None
    strongest_zone: Optional[str] = None
    best_confidence_bucket: Optional[str] = None
    multiple_roi_pct: float
    multiple_hit_rate: float
    multiple_settled: int
    recent_metrics: List[AIBankrollMetricSnapshot] = Field(default_factory=list)


class AIBankrollReviewResponse(BaseModel):
    configured: bool
    summary: str
    strengths: List[str]
    risks: List[str]
    next_actions: List[str]
    disclaimer: str


class AIHistoryReviewRequest(BaseModel):
    visible_analyses: int
    placed_bets: int
    settled_bets: int
    pending_bets: int
    greens: int
    reds: int
    needs_update: int
    avg_confidence: float
    avg_edge: float
    filter_summary: str
    strongest_market: Optional[str] = None
    weakest_market: Optional[str] = None
    top_markets: List[AIMarketSnapshot] = Field(default_factory=list)
    recent_matches: List[str] = Field(default_factory=list)
    multiple_draft_legs: int
    pending_multiples: int
    settled_multiples: int


class AIHistoryReviewResponse(BaseModel):
    configured: bool
    summary: str
    strengths: List[str]
    risks: List[str]
    next_actions: List[str]
    disclaimer: str


class StorageSnapshotMetadata(BaseModel):
    schema_version: int = 1
    updated_at: str
    client_id: Optional[str] = None


class StorageSnapshot(BaseModel):
    metadata: StorageSnapshotMetadata
    analyses: List[Dict[str, Any]] = Field(default_factory=list)
    multiples: List[Dict[str, Any]] = Field(default_factory=list)
    multiple_draft: List[Dict[str, Any]] = Field(default_factory=list)
    bankroll_settings: Dict[str, Any] = Field(default_factory=dict)
    roadmap_settings: Dict[str, Any] = Field(default_factory=dict)
    roadmap_day_memories: List[Dict[str, Any]] = Field(default_factory=list)


class StorageSnapshotResponse(BaseModel):
    snapshot: StorageSnapshot
    ignored_due_to_staleness: bool = False


class EntityStateMetadata(BaseModel):
    schema_version: int = 1
    updated_at: str
    client_id: Optional[str] = None
    entity_key: str


class EntityState(BaseModel):
    metadata: EntityStateMetadata
    data: Any


class EntityStateResponse(BaseModel):
    entity: EntityState
    ignored_due_to_staleness: bool = False


class EntityStatesResponse(BaseModel):
    entities: Dict[str, EntityState]


class AnalysisRecord(BaseModel):
    id: str
    payload: Dict[str, Any]
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class AnalysisRecordListResponse(BaseModel):
    analyses: List[AnalysisRecord]


class AnalysisRecordResponse(BaseModel):
    analysis: AnalysisRecord
    ignored_due_to_staleness: bool = False


class AnalysisDeleteResponse(BaseModel):
    deleted: bool


class MultipleRecord(BaseModel):
    id: str
    payload: Dict[str, Any]
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class MultipleRecordListResponse(BaseModel):
    multiples: List[MultipleRecord]


class MultipleRecordResponse(BaseModel):
    multiple: MultipleRecord
    ignored_due_to_staleness: bool = False


class MultipleDeleteResponse(BaseModel):
    deleted: bool
