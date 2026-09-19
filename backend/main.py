import os
from typing import List

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from schemas import (
    AnalyzeRequest,
    AnalyzeResponse,
    ProbabilityBoardResponse,
    ProbabilityRequest,
    ProbabilityResponse,
)
from model import analisar_jogo, model_self_check, probabilidades_jogo
import football_data

MAX_RESULT_LOOKUPS = 200
MAX_BOARD_MATCHES = 80

app = FastAPI(title="ScoreLab API")
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


def get_allowed_origins():
    raw = os.getenv("SCORELAB_ALLOWED_ORIGINS", "http://localhost:8080")
    origins = [origin.strip() for origin in raw.split(",") if origin.strip()]
    return origins or ["http://localhost:8080"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_allowed_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    """Health check that also reports which features this build actually has,
    so a stale deploy or a missing key is visible from a single URL."""
    return {
        "message": "ScoreLab API is running",
        "features": {
            "analyze": True,
            "analyze_probabilities": True,
            "probability_board": True,
            "match_data": True,
            "match_results": True,
            "match_data_key_configured": football_data.is_configured(),
            "leagues": football_data.supported_leagues(),
        },
        "model": model_self_check(),
    }

@app.post("/analyze", response_model=AnalyzeResponse)
@limiter.limit("30/minute")
def analyze(request: Request, data: AnalyzeRequest):
    return analisar_jogo(data)


@app.post("/analyze/probabilities", response_model=ProbabilityResponse)
@limiter.limit("30/minute")
def analyze_probabilities(request: Request, data: ProbabilityRequest):
    """The odds-free read of a match: what the model expects to happen."""
    return probabilidades_jogo(data)


@app.get("/data/status")
def data_status():
    """Frontend uses this to decide which leagues can offer auto-fill."""
    configured = football_data.is_configured()
    return {
        "configured": configured,
        "leagues": football_data.supported_leagues() if configured else [],
    }


@app.get("/data/fixtures")
@limiter.limit("20/minute")
def data_fixtures(request: Request, league: str):
    try:
        fixtures = football_data.upcoming_fixtures(league)
    except football_data.ProviderUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    return {"league": league, "fixtures": fixtures}


@app.get("/data/today")
@limiter.limit("10/minute")
def data_today(request: Request, days: int = 7):
    if not football_data.is_configured():
        raise HTTPException(status_code=503, detail="Fonte de dados não configurada.")

    try:
        return football_data.matches_for_days(days)
    except football_data.ProviderUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.get("/data/probability-board", response_model=ProbabilityBoardResponse)
@limiter.limit("10/minute")
def data_probability_board(request: Request, days: int = 7):
    """Every analysable fixture, forecast automatically and ranked by the
    model's strongest single signal — no picking a match required.

    Runs entirely on data the season cache already holds, so it costs no
    extra requests to the data provider beyond what /data/today already
    triggers. A fixture with too little history to forecast is skipped,
    never guessed at.
    """
    if not football_data.is_configured():
        raise HTTPException(status_code=503, detail="Fonte de dados não configurada.")

    try:
        return football_data.probability_board(days, limit=MAX_BOARD_MATCHES)
    except football_data.ProviderUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.get("/data/calibration")
@limiter.limit("10/minute")
def data_calibration(request: Request):
    """Live league baselines, so presets never silently go stale."""
    if not football_data.is_configured():
        raise HTTPException(status_code=503, detail="Fonte de dados não configurada.")

    try:
        return football_data.calibration()
    except football_data.ProviderUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.get("/data/results")
@limiter.limit("20/minute")
def data_results(request: Request, league: str, fixture_ids: str):
    """Final scores for fixtures the user already analysed.

    Takes a comma-separated list so a whole history settles in one call per
    competition, all of it served from the cached season.
    """
    ids: List[int] = []
    for chunk in fixture_ids.split(","):
        chunk = chunk.strip()
        if not chunk:
            continue
        try:
            ids.append(int(chunk))
        except ValueError:
            raise HTTPException(status_code=400, detail="fixture_ids inválido.")

    if not ids:
        raise HTTPException(status_code=400, detail="Indica pelo menos um jogo.")
    if len(ids) > MAX_RESULT_LOOKUPS:
        raise HTTPException(
            status_code=400,
            detail=f"Máximo de {MAX_RESULT_LOOKUPS} jogos por pedido.",
        )

    try:
        results = football_data.results_for_fixtures(league, ids)
    except football_data.ProviderUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    return {"league": league, "results": results}


@app.get("/data/prefill")
@limiter.limit("20/minute")
def data_prefill(request: Request, league: str, fixture_id: int):
    try:
        return football_data.build_prefill(league, fixture_id)
    except football_data.ProviderUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
