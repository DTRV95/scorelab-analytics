import json
import os
from typing import Any, Dict
from pathlib import Path
from urllib import error, request

from schemas import (
    AIBankrollReviewRequest,
    AIBankrollReviewResponse,
    AIDashboardSummaryRequest,
    AIDashboardSummaryResponse,
    AIHistoryReviewRequest,
    AIHistoryReviewResponse,
)


OPENAI_API_URL = "https://api.openai.com/v1/chat/completions"
BACKEND_DIR = Path(__file__).resolve().parent
LOCAL_ENV_PATH = BACKEND_DIR / ".env"


def _load_local_env() -> None:
    if not LOCAL_ENV_PATH.exists():
        return

    for raw_line in LOCAL_ENV_PATH.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")

        if key and key not in os.environ:
            os.environ[key] = value


def _fallback_dashboard_summary(
    data: AIDashboardSummaryRequest, configured: bool
) -> AIDashboardSummaryResponse:
    strengths = []
    risks = []
    next_actions = []

    if data.top_markets:
      best_market = data.top_markets[0]
      strengths.append(
          f"{best_market.market} is currently the strongest tracked market at {best_market.roi:.1f}% ROI over {best_market.bets} bets."
      )

    if data.top_value_today:
      strengths.append(
          f"Today's strongest live angle is {data.top_value_today.match} on {data.top_value_today.market} with {data.top_value_today.edge_pct:.1f}% edge."
      )

    if data.risk_level.lower() == "high":
      risks.append(
          f"Open exposure is high at EUR {data.open_exposure:.2f}, so new bets should stay selective."
      )
    else:
      risks.append(
          f"Open exposure is EUR {data.open_exposure:.2f}, which keeps live risk in a manageable zone."
      )

    if data.settled_bets < 40:
      risks.append(
          f"The sample is still early at {data.settled_bets} settled bets, so patterns should guide you but not fully dictate changes."
      )

    if not configured:
      next_actions.append("Add OPENAI_API_KEY to the backend environment to unlock AI-written summaries.")

    next_actions.extend(
        [
            "Keep prioritising the markets that are already validating with real settled volume.",
            "Avoid making aggressive model changes until the settled sample grows further.",
        ]
    )

    return AIDashboardSummaryResponse(
        configured=configured,
        summary=(
            f"ScoreLab is currently running at {data.roi_pct:.1f}% ROI with EUR {data.profit_loss:.2f} total profit "
            f"and EUR {data.current_bankroll:.2f} live bankroll."
        ),
        strengths=strengths[:3],
        risks=risks[:3],
        next_actions=next_actions[:3],
        disclaimer=(
            "This summary is interpretive guidance built on tracked results. It does not replace the statistical model."
        ),
    )


def _build_dashboard_prompt(data: AIDashboardSummaryRequest) -> list[dict[str, str]]:
    if hasattr(data, "model_dump_json"):
        payload_json = data.model_dump_json(indent=2)
    else:
        payload_json = data.json(indent=2)

    system_prompt = (
        "You are an elite football betting performance analyst embedded inside ScoreLab. "
        "Use only the structured data provided. Do not invent data, probabilities or results. "
        "Be practical, concise and disciplined. Focus on what is validating, what is fragile and what the user should do next. "
        "Never encourage reckless staking. Separate observation from action."
    )

    user_prompt = (
        "Analyse this ScoreLab dashboard snapshot and return a JSON object with keys: "
        "summary (string), strengths (array of max 3 strings), risks (array of max 3 strings), "
        "next_actions (array of max 3 strings), disclaimer (string). "
        "Keep every item short, direct and useful.\n\n"
        f"{payload_json}"
    )

    return [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]


def _fallback_bankroll_review(
    data: AIBankrollReviewRequest, configured: bool
) -> AIBankrollReviewResponse:
    strengths = []
    risks = []
    next_actions = []

    if data.strongest_market:
        strengths.append(
            f"{data.strongest_market} is currently the strongest market, with EUR {data.strongest_market_profit or 0:.2f} profit."
        )

    if data.best_confidence_bucket:
        strengths.append(
            f"Confidence bucket {data.best_confidence_bucket} is the strongest validation zone right now."
        )

    if data.open_exposure_pct >= 10:
        risks.append(
            f"Open exposure is high at {data.open_exposure_pct:.1f}% of live bankroll, so discipline matters more on new positions."
        )
    else:
        strengths.append(
            f"Open exposure is controlled at {data.open_exposure_pct:.1f}% of live bankroll."
        )

    if data.max_drawdown_pct <= -20:
        risks.append(
            f"Max drawdown is {data.max_drawdown_pct:.1f}%, which suggests the bankroll path is still volatile."
        )

    if data.multiple_settled > 0 and data.multiple_roi_pct < 0:
        risks.append(
            f"Multiples are currently negative at {data.multiple_roi_pct:.1f}% ROI, so they should stay secondary."
        )

    if not configured:
        next_actions.append(
            "Add OPENAI_API_KEY to the backend environment to unlock AI-written bankroll reviews."
        )

    next_actions.extend(
        [
            "Keep using bankroll tools to protect capital before increasing exposure.",
            "Use the strongest validated zones as the base of the next decisions.",
        ]
    )

    return AIBankrollReviewResponse(
        configured=configured,
        summary=(
            f"Your bankroll is at EUR {data.current_bankroll:.2f}, up {data.bankroll_growth_pct:.1f}% from the starting point, "
            f"with {data.roi_pct:.1f}% ROI across EUR {data.total_staked:.2f} staked."
        ),
        strengths=strengths[:3],
        risks=risks[:3],
        next_actions=next_actions[:3],
        disclaimer=(
            "This review interprets tracked bankroll data. It supports discipline, but it does not replace the betting model."
        ),
    )


def _build_bankroll_prompt(data: AIBankrollReviewRequest) -> list[dict[str, str]]:
    if hasattr(data, "model_dump_json"):
        payload_json = data.model_dump_json(indent=2)
    else:
        payload_json = data.json(indent=2)

    system_prompt = (
        "You are an elite football bankroll coach embedded inside ScoreLab. "
        "Use only the bankroll and tracking data provided. Do not invent figures. "
        "Be concise, disciplined and practical. Focus on capital protection, what is working, what looks fragile and what the user should do next."
    )

    user_prompt = (
        "Analyse this ScoreLab bankroll snapshot and return a JSON object with keys: "
        "summary (string), strengths (array of max 3 strings), risks (array of max 3 strings), "
        "next_actions (array of max 3 strings), disclaimer (string). "
        "Keep every item short, direct and operational.\n\n"
        f"{payload_json}"
    )

    return [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]


def _fallback_history_review(
    data: AIHistoryReviewRequest, configured: bool
) -> AIHistoryReviewResponse:
    strengths = []
    risks = []
    next_actions = []

    if data.strongest_market:
        strengths.append(
            f"{data.strongest_market} is the strongest visible market inside the current history view."
        )

    if data.settled_bets > 0:
        strengths.append(
            f"The current view contains {data.settled_bets} settled tracked bets, which is enough to start spotting repeatable patterns."
        )

    if data.needs_update > 0:
        risks.append(
            f"{data.needs_update} tracked bets still need details or cleanup, so the history read is not fully clean yet."
        )

    if data.weakest_market:
        risks.append(
            f"{data.weakest_market} is the weakest visible market right now, so it deserves more caution."
        )

    if data.pending_bets > data.settled_bets and data.pending_bets > 0:
        risks.append(
            f"There are more pending bets than settled ones in this filtered view, so recent conclusions are still fragile."
        )

    if data.multiple_draft_legs > 0:
        next_actions.append(
            f"You already have {data.multiple_draft_legs} legs in the multiple builder, so make sure they still fit the strongest zones in history."
        )

    if not configured:
        next_actions.append(
            "Add OPENAI_API_KEY to the backend environment to unlock AI-written history reviews."
        )

    next_actions.extend(
        [
            "Keep cleaning tracked bets first so the history view reflects the real decision quality.",
            "Use the strongest visible market zones as the base for the next selections.",
        ]
    )

    return AIHistoryReviewResponse(
        configured=configured,
        summary=(
            f"This history view shows {data.visible_analyses} analyses, {data.placed_bets} tracked bets and "
            f"{data.settled_bets} settled results, with {data.avg_confidence:.1f} average confidence and {data.avg_edge:.1f}% average edge."
        ),
        strengths=strengths[:3],
        risks=risks[:3],
        next_actions=next_actions[:3],
        disclaimer=(
            "This review interprets the visible history and tracking data. It supports review discipline, but it does not replace the betting model."
        ),
    )


def _build_history_prompt(data: AIHistoryReviewRequest) -> list[dict[str, str]]:
    if hasattr(data, "model_dump_json"):
        payload_json = data.model_dump_json(indent=2)
    else:
        payload_json = data.json(indent=2)

    system_prompt = (
        "You are an elite football betting review analyst embedded inside ScoreLab. "
        "Use only the visible history and tracking data provided. Do not invent results or patterns. "
        "Be concise, practical and disciplined. Focus on what the visible history says, what still looks fragile and what should happen next."
    )

    user_prompt = (
        "Analyse this ScoreLab history snapshot and return a JSON object with keys: "
        "summary (string), strengths (array of max 3 strings), risks (array of max 3 strings), "
        "next_actions (array of max 3 strings), disclaimer (string). "
        "Keep every item short, direct and operational.\n\n"
        f"{payload_json}"
    )

    return [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]


def _call_openai_dashboard_summary(
    api_key: str, model: str, data: AIDashboardSummaryRequest
) -> Dict[str, Any]:
    json_schema = {
        "name": "scorelab_dashboard_summary",
        "schema": {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "summary": {"type": "string"},
                "strengths": {
                    "type": "array",
                    "items": {"type": "string"},
                    "maxItems": 3,
                },
                "risks": {
                    "type": "array",
                    "items": {"type": "string"},
                    "maxItems": 3,
                },
                "next_actions": {
                    "type": "array",
                    "items": {"type": "string"},
                    "maxItems": 3,
                },
                "disclaimer": {"type": "string"},
            },
            "required": ["summary", "strengths", "risks", "next_actions", "disclaimer"],
        },
    }

    payload = {
        "model": model,
        "messages": _build_dashboard_prompt(data),
        "response_format": {
            "type": "json_schema",
            "json_schema": json_schema,
        },
        "temperature": 0.3,
    }

    req = request.Request(
        OPENAI_API_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
        method="POST",
    )

    with request.urlopen(req, timeout=25) as response:
        raw = response.read().decode("utf-8")
        parsed = json.loads(raw)
        content = parsed["choices"][0]["message"]["content"]
        return json.loads(content)


def _call_openai_bankroll_review(
    api_key: str, model: str, data: AIBankrollReviewRequest
) -> Dict[str, Any]:
    json_schema = {
        "name": "scorelab_bankroll_review",
        "schema": {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "summary": {"type": "string"},
                "strengths": {
                    "type": "array",
                    "items": {"type": "string"},
                    "maxItems": 3,
                },
                "risks": {
                    "type": "array",
                    "items": {"type": "string"},
                    "maxItems": 3,
                },
                "next_actions": {
                    "type": "array",
                    "items": {"type": "string"},
                    "maxItems": 3,
                },
                "disclaimer": {"type": "string"},
            },
            "required": ["summary", "strengths", "risks", "next_actions", "disclaimer"],
        },
    }

    payload = {
        "model": model,
        "messages": _build_bankroll_prompt(data),
        "response_format": {
            "type": "json_schema",
            "json_schema": json_schema,
        },
        "temperature": 0.3,
    }

    req = request.Request(
        OPENAI_API_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
        method="POST",
    )

    with request.urlopen(req, timeout=25) as response:
        raw = response.read().decode("utf-8")
        parsed = json.loads(raw)
        content = parsed["choices"][0]["message"]["content"]
        return json.loads(content)


def _call_openai_history_review(
    api_key: str, model: str, data: AIHistoryReviewRequest
) -> Dict[str, Any]:
    json_schema = {
        "name": "scorelab_history_review",
        "schema": {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "summary": {"type": "string"},
                "strengths": {
                    "type": "array",
                    "items": {"type": "string"},
                    "maxItems": 3,
                },
                "risks": {
                    "type": "array",
                    "items": {"type": "string"},
                    "maxItems": 3,
                },
                "next_actions": {
                    "type": "array",
                    "items": {"type": "string"},
                    "maxItems": 3,
                },
                "disclaimer": {"type": "string"},
            },
            "required": ["summary", "strengths", "risks", "next_actions", "disclaimer"],
        },
    }

    payload = {
        "model": model,
        "messages": _build_history_prompt(data),
        "response_format": {
            "type": "json_schema",
            "json_schema": json_schema,
        },
        "temperature": 0.3,
    }

    req = request.Request(
        OPENAI_API_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
        method="POST",
    )

    with request.urlopen(req, timeout=25) as response:
        raw = response.read().decode("utf-8")
        parsed = json.loads(raw)
        content = parsed["choices"][0]["message"]["content"]
        return json.loads(content)


def generate_dashboard_ai_summary(
    data: AIDashboardSummaryRequest,
) -> AIDashboardSummaryResponse:
    _load_local_env()
    api_key = os.getenv("OPENAI_API_KEY")
    model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

    if not api_key:
        return _fallback_dashboard_summary(data, configured=False)

    try:
        ai_payload = _call_openai_dashboard_summary(api_key, model, data)
        return AIDashboardSummaryResponse(
            configured=True,
            summary=ai_payload["summary"],
            strengths=ai_payload["strengths"][:3],
            risks=ai_payload["risks"][:3],
            next_actions=ai_payload["next_actions"][:3],
            disclaimer=ai_payload["disclaimer"],
        )
    except Exception:
        return _fallback_dashboard_summary(data, configured=True)


def generate_bankroll_ai_review(
    data: AIBankrollReviewRequest,
) -> AIBankrollReviewResponse:
    _load_local_env()
    api_key = os.getenv("OPENAI_API_KEY")
    model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

    if not api_key:
        return _fallback_bankroll_review(data, configured=False)

    try:
        ai_payload = _call_openai_bankroll_review(api_key, model, data)
        return AIBankrollReviewResponse(
            configured=True,
            summary=ai_payload["summary"],
            strengths=ai_payload["strengths"][:3],
            risks=ai_payload["risks"][:3],
            next_actions=ai_payload["next_actions"][:3],
            disclaimer=ai_payload["disclaimer"],
        )
    except Exception:
        return _fallback_bankroll_review(data, configured=True)


def generate_history_ai_review(
    data: AIHistoryReviewRequest,
) -> AIHistoryReviewResponse:
    _load_local_env()
    api_key = os.getenv("OPENAI_API_KEY")
    model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

    if not api_key:
        return _fallback_history_review(data, configured=False)

    try:
        ai_payload = _call_openai_history_review(api_key, model, data)
        return AIHistoryReviewResponse(
            configured=True,
            summary=ai_payload["summary"],
            strengths=ai_payload["strengths"][:3],
            risks=ai_payload["risks"][:3],
            next_actions=ai_payload["next_actions"][:3],
            disclaimer=ai_payload["disclaimer"],
        )
    except Exception:
        return _fallback_history_review(data, configured=True)
