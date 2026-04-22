import os

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from schemas import (
    AnalyzeRequest,
    AnalyzeResponse,
    AnalysisDeleteResponse,
    AnalysisRecord,
    AnalysisRecordListResponse,
    AnalysisRecordResponse,
    AIBankrollReviewRequest,
    AIBankrollReviewResponse,
    AIDashboardSummaryRequest,
    AIDashboardSummaryResponse,
    AIHistoryReviewRequest,
    AIHistoryReviewResponse,
    EntityState,
    EntityStateResponse,
    EntityStatesResponse,
    MultipleDeleteResponse,
    MultipleRecord,
    MultipleRecordListResponse,
    MultipleRecordResponse,
    StorageSnapshot,
    StorageSnapshotResponse,
)
from model import analisar_jogo
from ai_service import (
    generate_bankroll_ai_review,
    generate_dashboard_ai_summary,
    generate_history_ai_review,
)
from storage_service import (
    delete_analysis_record,
    delete_multiple_record,
    get_analysis_record,
    get_multiple_record,
    init_storage_db,
    list_analysis_records,
    list_multiple_records,
    load_all_entity_states,
    load_entity_state,
    load_storage_snapshot,
    save_analysis_record,
    save_multiple_record,
    save_entity_state,
    save_storage_snapshot,
)

app = FastAPI(title="ScoreLab API")
init_storage_db()


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
    snapshot, ignored_due_to_staleness = save_storage_snapshot(payload)
    return {
        "snapshot": snapshot,
        "ignored_due_to_staleness": ignored_due_to_staleness,
    }


@app.get("/storage/entities", response_model=EntityStatesResponse)
def get_storage_entities():
    return {"entities": load_all_entity_states()}


@app.get("/storage/entities/{entity_key}", response_model=EntityStateResponse)
def get_storage_entity(entity_key: str):
    return {"entity": load_entity_state(entity_key)}


@app.put("/storage/entities/{entity_key}", response_model=EntityStateResponse)
def put_storage_entity(entity_key: str, data: EntityState):
    payload = data.model_dump() if hasattr(data, "model_dump") else data.dict()
    entity, ignored_due_to_staleness = save_entity_state(entity_key, payload)
    return {
        "entity": entity,
        "ignored_due_to_staleness": ignored_due_to_staleness,
    }


@app.get("/storage/analyses", response_model=AnalysisRecordListResponse)
def get_storage_analyses():
    return {"analyses": list_analysis_records()}


@app.get("/storage/analyses/{analysis_id}", response_model=AnalysisRecordResponse)
def get_storage_analysis(analysis_id: str):
    analysis = get_analysis_record(analysis_id)
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")
    return {"analysis": analysis}


@app.put("/storage/analyses/{analysis_id}", response_model=AnalysisRecordResponse)
def put_storage_analysis(analysis_id: str, data: AnalysisRecord):
    payload = data.model_dump() if hasattr(data, "model_dump") else data.dict()
    if payload.get("id") != analysis_id:
        raise HTTPException(status_code=400, detail="Analysis id mismatch")

    stored, ignored_due_to_staleness = save_analysis_record(payload)
    return {
        "analysis": stored,
        "ignored_due_to_staleness": ignored_due_to_staleness,
    }


@app.delete("/storage/analyses/{analysis_id}", response_model=AnalysisDeleteResponse)
def delete_storage_analysis(analysis_id: str):
    return {"deleted": delete_analysis_record(analysis_id)}


@app.get("/storage/multiples", response_model=MultipleRecordListResponse)
def get_storage_multiples():
    return {"multiples": list_multiple_records()}


@app.get("/storage/multiples/{multiple_id}", response_model=MultipleRecordResponse)
def get_storage_multiple(multiple_id: str):
    multiple = get_multiple_record(multiple_id)
    if not multiple:
        raise HTTPException(status_code=404, detail="Multiple not found")
    return {"multiple": multiple}


@app.put("/storage/multiples/{multiple_id}", response_model=MultipleRecordResponse)
def put_storage_multiple(multiple_id: str, data: MultipleRecord):
    payload = data.model_dump() if hasattr(data, "model_dump") else data.dict()
    if payload.get("id") != multiple_id:
        raise HTTPException(status_code=400, detail="Multiple id mismatch")

    stored, ignored_due_to_staleness = save_multiple_record(payload)
    return {
        "multiple": stored,
        "ignored_due_to_staleness": ignored_due_to_staleness,
    }


@app.delete("/storage/multiples/{multiple_id}", response_model=MultipleDeleteResponse)
def delete_storage_multiple(multiple_id: str):
    return {"deleted": delete_multiple_record(multiple_id)}
