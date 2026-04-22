import json
import sqlite3
from pathlib import Path
from typing import Any, Dict


BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "scorelab_storage.db"


def _get_connection() -> sqlite3.Connection:
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def init_storage_db() -> None:
    with _get_connection() as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS app_state (
              id INTEGER PRIMARY KEY CHECK (id = 1),
              payload TEXT NOT NULL,
              updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        connection.commit()


def get_empty_snapshot() -> Dict[str, Any]:
    return {
        "analyses": [],
        "multiples": [],
        "multiple_draft": [],
        "bankroll_settings": {},
        "roadmap_settings": {},
        "roadmap_day_memories": [],
    }


def load_storage_snapshot() -> Dict[str, Any]:
    init_storage_db()

    with _get_connection() as connection:
        row = connection.execute(
            "SELECT payload FROM app_state WHERE id = 1"
        ).fetchone()

    if not row:
        return get_empty_snapshot()

    try:
        payload = json.loads(row["payload"])
    except json.JSONDecodeError:
        return get_empty_snapshot()

    empty = get_empty_snapshot()
    empty.update(payload if isinstance(payload, dict) else {})
    return empty


def save_storage_snapshot(snapshot: Dict[str, Any]) -> Dict[str, Any]:
    init_storage_db()
    merged_snapshot = get_empty_snapshot()
    if isinstance(snapshot, dict):
        merged_snapshot.update(snapshot)

    payload = json.dumps(merged_snapshot, ensure_ascii=False)

    with _get_connection() as connection:
        connection.execute(
            """
            INSERT INTO app_state (id, payload, updated_at)
            VALUES (1, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(id) DO UPDATE SET
              payload = excluded.payload,
              updated_at = CURRENT_TIMESTAMP
            """,
            (payload,),
        )
        connection.commit()

    return merged_snapshot
