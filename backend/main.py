import os

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from schemas import AnalyzeRequest, AnalyzeResponse
from model import analisar_jogo
import football_data

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
    return {"message": "ScoreLab API is running"}

@app.post("/analyze", response_model=AnalyzeResponse)
@limiter.limit("30/minute")
def analyze(request: Request, data: AnalyzeRequest):
    return analisar_jogo(data)


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


@app.get("/data/prefill")
@limiter.limit("20/minute")
def data_prefill(request: Request, league: str, fixture_id: int):
    try:
        return football_data.build_prefill(league, fixture_id)
    except football_data.ProviderUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
