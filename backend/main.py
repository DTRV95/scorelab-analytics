from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from schemas import (
    AnalyzeRequest,
    AnalyzeResponse,
    AIBankrollReviewRequest,
    AIBankrollReviewResponse,
    AIDashboardSummaryRequest,
    AIDashboardSummaryResponse,
    AIHistoryReviewRequest,
    AIHistoryReviewResponse,
    StorageSnapshot,
    StorageSnapshotResponse,
)
from model import analisar_jogo
from ai_service import (
    generate_bankroll_ai_review,
    generate_dashboard_ai_summary,
    generate_history_ai_review,
)
from storage_service import init_storage_db, load_storage_snapshot, save_storage_snapshot

app = FastAPI(title="ScoreLab API")
init_storage_db()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8080"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"message": "ScoreLab API is running"}

@app.post("/analyze", response_model=AnalyzeResponse)
def analyze(data: AnalyzeRequest):
    return analisar_jogo(data)


@app.post("/ai/dashboard-summary", response_model=AIDashboardSummaryResponse)
def ai_dashboard_summary(data: AIDashboardSummaryRequest):
    return generate_dashboard_ai_summary(data)


@app.post("/ai/bankroll-review", response_model=AIBankrollReviewResponse)
def ai_bankroll_review(data: AIBankrollReviewRequest):
    return generate_bankroll_ai_review(data)


@app.post("/ai/history-review", response_model=AIHistoryReviewResponse)
def ai_history_review(data: AIHistoryReviewRequest):
    return generate_history_ai_review(data)


@app.get("/storage/snapshot", response_model=StorageSnapshotResponse)
def get_storage_snapshot():
    return {"snapshot": load_storage_snapshot()}


@app.put("/storage/snapshot", response_model=StorageSnapshotResponse)
def put_storage_snapshot(data: StorageSnapshot):
    payload = data.model_dump() if hasattr(data, "model_dump") else data.dict()
    return {"snapshot": save_storage_snapshot(payload)}
