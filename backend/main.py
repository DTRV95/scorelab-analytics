import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from schemas import AnalyzeRequest, AnalyzeResponse
from model import analisar_jogo

app = FastAPI(title="ScoreLab API")


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
