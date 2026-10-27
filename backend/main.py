import os
from typing import List, Optional

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
import injury_data
import bigballs_data
import bzzoiro_data
import news_data
import odds_api

MAX_RESULT_LOOKUPS = 200
# Uma semana cheia das onze competições dá à volta de cem jogos analisáveis.
# O tecto estava em oitenta, e os vinte que sobravam saíam todos do fim: no
# dia 13/10 a Championship tinha quatro jogos no dia seguinte e o quadro
# mostrava um. Cento e quarenta cobre uma semana sem cortar nada, e o corte
# que resta é a rede para uma semana fora do normal.
MAX_BOARD_MATCHES = 140

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
            # Só a presença, que é o que se vê sem gastar um pedido. Se a
            # fonte aceita a chave diz-se em /data/injury-source.
            "injury_data_key_configured": injury_data.is_configured(),
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


@app.get("/data/injury-source")
@limiter.limit("6/minute")
def data_injury_source(request: Request, force: bool = False):
    """Se a fonte de lesões está mesmo ligada, e quanto resta do dia.

    Responde sempre 200, mesmo sem chave: é uma luz para se olhar, e uma
    luz que rebenta a página não é luz nenhuma. Não devolve nada da conta
    de quem é a chave — só o plano, a quota e se foi aceite.
    """
    return injury_data.account_status(force=force)


@app.get("/data/sources")
@limiter.limit("6/minute")
def data_sources(request: Request):
    """O estado de todas as fontes de contexto, num endereço só.

    Para a pergunta "já está a funcionar?" ter uma resposta que se abre
    no telemóvel em vez de precisar de alguém a investigar. Nenhuma das
    respostas traz chaves nem dados de conta — só se a porta abre.
    """
    return {
        "odds": odds_api.account_status(),
        "baixas_bzzoiro": bzzoiro_data.account_status(),
        "lesoes_bigballs": bigballs_data.account_status(),
        "lesoes_api_football": injury_data.account_status(),
        "noticias": news_data.probe(),
    }


@app.get("/data/bzzoiro-probe")
@limiter.limit("4/minute")
def data_bzzoiro_probe(request: Request, day: str):
    """Qual é o parâmetro que filtra os jogos por data nesta fonte.

    Diagnóstico, não funcionalidade: daqui não se fala com a fonte, só
    através deste servidor, e uma pergunta mal feita custa um deploy.
    """
    return bzzoiro_data.date_probe(day)


@app.get("/data/squad-probe")
@limiter.limit("4/minute")
def data_squad_probe(request: Request):
    """Se a fonte dá convocatórias — para se saber quem é titular."""
    return bzzoiro_data.squad_probe()


@app.get("/data/injury-coverage")
@limiter.limit("4/minute")
def data_injury_coverage(request: Request, force: bool = False):
    """Quais das nossas onze competições é que a fonte de lesões cobre.

    O que decide se o dossiê de um jogo pode falar de lesões ou se tem de
    as deixar a cinzento: zero lesionados numa liga que eles não seguem
    lê-se como "estão todos bons", que é a pior coisa que podíamos dizer.
    """
    return injury_data.league_coverage(force=force)


@app.get("/data/match-context")
@limiter.limit("20/minute")
def data_match_context(
    request: Request,
    league: str,
    home: str,
    away: str,
    kickoff: str,
    odds: bool = True,
):
    """O que se sabe à volta de um jogo: quem falta, o árbitro, odds, tempo.

    A pedido e não em lote: o plano gratuito da fonte dá cem chamadas por
    dia, e enchê-las a pré-carregar um quadro de cem jogos que ninguém
    abriu era ficar sem nenhuma para os que se abrem mesmo.

    `odds=0` deixa o preço de fora. Quem já o foi buscar à liga inteira
    não tem de o pedir outra vez jogo a jogo — e cada pedido repetido é
    saldo mensal gasto a saber o mesmo.
    """
    market = (
        odds_api.priced(league, home, away, kickoff)
        if odds
        else {"odds": None, "implied_pct": None, "derived": [], "blocked": False}
    )
    baixas_trace: dict = {}
    baixas = bzzoiro_data.for_match(home, away, kickoff, trace=baixas_trace)

    return {
        **market,
        # Nada e lista vazia não são a mesma coisa: a primeira diz que
        # ninguém olhou, a segunda que estão todos bons.
        "absences": baixas,
        "absences_trace": None if baixas else baixas_trace,
        "news": news_data.for_teams(home, away),
    }


@app.get("/data/league-odds")
@limiter.limit("10/minute")
def data_league_odds(request: Request, league: str, days: int = 3):
    """O preço de todos os jogos de uma liga, de uma vez só.

    Esta é a chamada que o saldo mensal suporta. A fonte cobra por
    listagem de liga, não por jogo: pedir trinta jogos um a um e pedir a
    liga inteira custam o mesmo se forem na mesma visita, e custam
    trinta vezes mais se forem em trinta. Como o motor dorme entre
    visitas e acorda sem memória, era o segundo caso que estava a
    acontecer — e o mês acabou a meio.

    Aqui a listagem é buscada uma vez e serve todos os jogos da liga,
    porque o que está em memória durante este pedido chega para todos
    eles. Quem chama guarda o resultado e volta amanhã.
    """
    if not football_data.is_configured():
        raise HTTPException(status_code=503, detail="Fonte de dados não configurada.")

    try:
        board = football_data.probability_board(days, limit=MAX_BOARD_MATCHES)
    except football_data.ProviderUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    nossos = [
        match
        for match in (board.get("matches") or [])
        if str(match.get("league")) == league
    ]

    precos: dict = {}
    for match in nossos:
        found = odds_api.priced(
            league,
            str(match.get("home_name")),
            str(match.get("away_name")),
            str(match.get("kickoff")),
        )
        if found.get("odds"):
            precos[str(match.get("fixture_id"))] = {
                "odds": found["odds"],
                "implied_pct": found["implied_pct"],
                "derived": found.get("derived") or [],
                "home_away_disagrees": found.get("home_away_disagrees", False),
                "matched": found.get("matched"),
            }

    gasto = odds_api.meter()
    return {
        "league": league,
        "matches": precos,
        "asked": len(nossos),
        "priced": len(precos),
        "blocked": gasto.get("ok") is False,
        "quota": gasto or None,
    }


@app.get("/data/leagues")
@limiter.limit("6/minute")
def data_leagues(request: Request, days: int = 7):
    """Why a competition is missing from the board.

    The board swallows a competition's failure on purpose, so this is the only
    place that says what the provider actually answered for each one.
    """
    if not football_data.is_configured():
        raise HTTPException(status_code=503, detail="Fonte de dados não configurada.")

    return football_data.league_diagnostics(days=days)


@app.get("/data/competitions")
@limiter.limit("4/minute")
def data_competitions(request: Request):
    """What the API key actually covers, asked of the provider itself.

    The board only shows competitions somebody wired into it, so one that was
    never wired is indistinguishable from one the provider refuses. This is the
    page that tells them apart.
    """
    if not football_data.is_configured():
        raise HTTPException(status_code=503, detail="Fonte de dados não configurada.")

    try:
        return football_data.available_competitions()
    except football_data.ProviderUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


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


@app.get("/data/board-results")
@limiter.limit("10/minute")
def data_board_results(request: Request, days: int = 7):
    """The board, after the fact: what the model said on games already played.

    Each played fixture is forecast again from the league as it stood before
    its own kickoff, then the market the board led with is marked against the
    final score. Costs no extra requests to the data provider — the season is
    already cached for the board itself — and the answer is cached for hours,
    because a result does not change.
    """
    if not football_data.is_configured():
        raise HTTPException(status_code=503, detail="Fonte de dados não configurada.")

    try:
        return football_data.board_results(days)
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


@app.get("/data/league-report")
@limiter.limit("10/minute")
def data_league_report(request: Request, league: str, season: Optional[int] = None):
    """How often each market has landed in a competition, and who is in form.

    Arithmetic over the season already cached for the board and the forecasts,
    so it costs nothing at the provider however often it is asked for.
    """
    if not football_data.is_configured():
        raise HTTPException(status_code=503, detail="Fonte de dados não configurada.")

    if league not in football_data.supported_leagues():
        raise HTTPException(status_code=404, detail="Competição não coberta.")

    try:
        return football_data.league_report(league, season=season)
    except football_data.ProviderUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.get("/data/leagues-health")
@limiter.limit("10/minute")
def data_leagues_health(request: Request, probe: bool = False):
    """Whether each wired competition is actually answering.

    Free by default — it reports what is already in hand. With `probe=true` it
    asks for the competitions not yet read, which is the only way to tell one
    nobody has needed yet from one the provider refuses.
    """
    if not football_data.is_configured():
        raise HTTPException(status_code=503, detail="Fonte de dados não configurada.")

    return football_data.leagues_health(probe=probe)


@app.get("/data/league-rates")
@limiter.limit("10/minute")
def data_league_rates(request: Request):
    """Every covered competition's market rates, in one answer.

    What the board needs to say how a game compares with its own league: one
    request for the lot, because a board holds a dozen competitions at once.
    """
    if not football_data.is_configured():
        raise HTTPException(status_code=503, detail="Fonte de dados não configurada.")

    try:
        return football_data.league_rates()
    except football_data.ProviderUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.get("/data/model-accuracy")
@limiter.limit("10/minute")
def data_model_accuracy(request: Request, league: str, season: Optional[int] = None):
    """How the model did against the results, one competition at a time.

    Every played fixture is forecast again from the league as it stood before
    its own kickoff and scored against the final result, so the numbers say
    what the model would have called, not what it can see in hindsight.

    One competition per call on purpose: a season is a simulation per fixture,
    which is seconds of work, and the answer is cached for as long as the
    season itself is. Asking for all eight at once would be one slow request
    that times out instead of eight quick ones that do not.
    """
    if not football_data.is_configured():
        raise HTTPException(status_code=503, detail="Fonte de dados não configurada.")

    try:
        return football_data.model_accuracy(league, season)
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
