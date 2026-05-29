import json
import os
import sqlite3
from pathlib import Path
from datetime import datetime, timezone
from typing import Any, Dict, Iterator
from contextlib import contextmanager


BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "scorelab_storage.db"
POSTGRES_URL = os.getenv("DATABASE_URL") or os.getenv("DATABASE_URL_UNPOOLED")
USING_POSTGRES = bool(POSTGRES_URL)
ENTITY_DEFAULTS: Dict[str, Any] = {
    "analyses": [],
    "multiples": [],
    "multiple_draft": [],
    "bankroll_settings": {},
    "roadmap_settings": {},
    "roadmap_day_memories": [],
    "roadmap_missions": [],
}


def _get_sqlite_connection() -> sqlite3.Connection:
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    return connection


@contextmanager
def _get_connection() -> Iterator[Any]:
    if USING_POSTGRES:
        try:
            import psycopg
            from psycopg.rows import dict_row
        except ImportError as exc:
            raise RuntimeError(
                "DATABASE_URL is set, but psycopg is not installed. "
                "Run `pip install -r requirements.txt`."
            ) from exc

        with psycopg.connect(POSTGRES_URL, row_factory=dict_row) as connection:
            yield connection
        return

    with _get_sqlite_connection() as connection:
        yield connection


def _param() -> str:
    return "%s" if USING_POSTGRES else "?"


def _now_sql() -> str:
    return "CURRENT_TIMESTAMP::text" if USING_POSTGRES else "CURRENT_TIMESTAMP"


def _created_at_order_sql() -> str:
    return "created_at DESC, id DESC" if USING_POSTGRES else "datetime(created_at) DESC, id DESC"


def init_storage_db() -> None:
    with _get_connection() as connection:
        connection.execute(
            f"""
            CREATE TABLE IF NOT EXISTS app_state (
              id INTEGER PRIMARY KEY CHECK (id = 1),
              payload TEXT NOT NULL,
              updated_at TEXT NOT NULL DEFAULT {_now_sql()}
            )
            """
        )
        connection.execute(
            f"""
            CREATE TABLE IF NOT EXISTS entity_state (
              entity_key TEXT PRIMARY KEY,
              payload TEXT NOT NULL,
              updated_at TEXT NOT NULL DEFAULT {_now_sql()}
            )
            """
        )
        connection.execute(
            f"""
            CREATE TABLE IF NOT EXISTS analyses (
              id TEXT PRIMARY KEY,
              payload TEXT NOT NULL,
              created_at TEXT NOT NULL DEFAULT {_now_sql()},
              updated_at TEXT NOT NULL DEFAULT {_now_sql()}
            )
            """
        )
        connection.execute(
            f"""
            CREATE TABLE IF NOT EXISTS multiples (
              id TEXT PRIMARY KEY,
              payload TEXT NOT NULL,
              created_at TEXT NOT NULL DEFAULT {_now_sql()},
              updated_at TEXT NOT NULL DEFAULT {_now_sql()}
            )
            """
        )
        connection.commit()


def get_empty_snapshot() -> Dict[str, Any]:
    return {
        "metadata": {
            "schema_version": 1,
            "updated_at": datetime.fromtimestamp(0, tz=timezone.utc).isoformat(),
            "client_id": None,
        },
        "analyses": [],
        "multiples": [],
        "multiple_draft": [],
        "bankroll_settings": {},
        "roadmap_settings": {},
        "roadmap_day_memories": [],
        "roadmap_missions": [],
    }


def get_empty_entity_state(entity_key: str) -> Dict[str, Any]:
    return {
        "metadata": {
            "schema_version": 1,
            "updated_at": datetime.fromtimestamp(0, tz=timezone.utc).isoformat(),
            "client_id": None,
            "entity_key": entity_key,
        },
        "data": ENTITY_DEFAULTS.get(entity_key),
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
    if "metadata" not in empty or not isinstance(empty["metadata"], dict):
        empty["metadata"] = get_empty_snapshot()["metadata"]
    return empty


def _normalize_entity_state(entity_key: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    state = get_empty_entity_state(entity_key)
    if isinstance(payload, dict):
        state.update(payload)

    if "metadata" not in state or not isinstance(state["metadata"], dict):
        state["metadata"] = get_empty_entity_state(entity_key)["metadata"]

    state["metadata"]["entity_key"] = entity_key
    if state.get("data") is None:
        state["data"] = ENTITY_DEFAULTS.get(entity_key)

    return state


def load_entity_state(entity_key: str) -> Dict[str, Any]:
    init_storage_db()

    with _get_connection() as connection:
        row = connection.execute(
            f"SELECT payload FROM entity_state WHERE entity_key = {_param()}",
            (entity_key,),
        ).fetchone()

    if row:
        try:
            payload = json.loads(row["payload"])
        except json.JSONDecodeError:
            payload = {}
        return _normalize_entity_state(entity_key, payload if isinstance(payload, dict) else {})

    snapshot = load_storage_snapshot()
    if entity_key in snapshot:
        return _normalize_entity_state(
            entity_key,
            {
                "metadata": snapshot.get("metadata", {}),
                "data": snapshot.get(entity_key, ENTITY_DEFAULTS.get(entity_key)),
            },
        )

    return get_empty_entity_state(entity_key)


def load_all_entity_states() -> Dict[str, Dict[str, Any]]:
    return {
        entity_key: load_entity_state(entity_key)
        for entity_key in ENTITY_DEFAULTS.keys()
    }


def _parse_updated_at(snapshot: Dict[str, Any]) -> datetime:
    metadata = snapshot.get("metadata", {}) if isinstance(snapshot, dict) else {}
    updated_at = metadata.get("updated_at")
    if not isinstance(updated_at, str):
      return datetime.fromtimestamp(0, tz=timezone.utc)

    try:
        normalized = updated_at.replace("Z", "+00:00")
        parsed = datetime.fromisoformat(normalized)
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    except ValueError:
        return datetime.fromtimestamp(0, tz=timezone.utc)


def _parse_record_updated_at(updated_at: Any) -> datetime:
    if not isinstance(updated_at, str):
        return datetime.fromtimestamp(0, tz=timezone.utc)

    try:
        normalized = updated_at.replace("Z", "+00:00")
        parsed = datetime.fromisoformat(normalized)
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    except ValueError:
        return datetime.fromtimestamp(0, tz=timezone.utc)


def save_storage_snapshot(snapshot: Dict[str, Any]) -> tuple[Dict[str, Any], bool]:
    init_storage_db()
    merged_snapshot = get_empty_snapshot()
    if isinstance(snapshot, dict):
        merged_snapshot.update(snapshot)

    existing_snapshot = load_storage_snapshot()
    incoming_updated_at = _parse_updated_at(merged_snapshot)
    existing_updated_at = _parse_updated_at(existing_snapshot)

    if existing_updated_at > incoming_updated_at:
        return existing_snapshot, True

    payload = json.dumps(merged_snapshot, ensure_ascii=False)

    with _get_connection() as connection:
        connection.execute(
            f"""
            INSERT INTO app_state (id, payload, updated_at)
            VALUES (1, {_param()}, {_now_sql()})
            ON CONFLICT(id) DO UPDATE SET
              payload = excluded.payload,
              updated_at = {_now_sql()}
            """,
            (payload,),
        )
        connection.commit()

    return merged_snapshot, False


def save_entity_state(entity_key: str, state: Dict[str, Any]) -> tuple[Dict[str, Any], bool]:
    init_storage_db()
    merged_state = _normalize_entity_state(entity_key, state if isinstance(state, dict) else {})

    existing_state = load_entity_state(entity_key)
    incoming_updated_at = _parse_updated_at(merged_state)
    existing_updated_at = _parse_updated_at(existing_state)

    if existing_updated_at > incoming_updated_at:
        return existing_state, True

    payload = json.dumps(merged_state, ensure_ascii=False)

    with _get_connection() as connection:
        connection.execute(
            f"""
            INSERT INTO entity_state (entity_key, payload, updated_at)
            VALUES ({_param()}, {_param()}, {_now_sql()})
            ON CONFLICT(entity_key) DO UPDATE SET
              payload = excluded.payload,
              updated_at = {_now_sql()}
            """,
            (entity_key, payload),
        )
        connection.commit()

    return merged_state, False


def list_analysis_records() -> list[Dict[str, Any]]:
    init_storage_db()

    with _get_connection() as connection:
        rows = connection.execute(
            f"""
            SELECT id, payload, created_at, updated_at
            FROM analyses
            ORDER BY {_created_at_order_sql()}
            """
        ).fetchall()

    records: list[Dict[str, Any]] = []
    for row in rows:
        try:
            payload = json.loads(row["payload"])
        except json.JSONDecodeError:
            payload = {}

        records.append(
            {
                "id": row["id"],
                "payload": payload if isinstance(payload, dict) else {},
                "created_at": row["created_at"],
                "updated_at": row["updated_at"],
            }
        )

    return records


def get_analysis_record(analysis_id: str) -> Dict[str, Any] | None:
    init_storage_db()

    with _get_connection() as connection:
        row = connection.execute(
            f"""
            SELECT id, payload, created_at, updated_at
            FROM analyses
            WHERE id = {_param()}
            """,
            (analysis_id,),
        ).fetchone()

    if not row:
        return None

    try:
        payload = json.loads(row["payload"])
    except json.JSONDecodeError:
        payload = {}

    return {
        "id": row["id"],
        "payload": payload if isinstance(payload, dict) else {},
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def save_analysis_record(record: Dict[str, Any]) -> tuple[Dict[str, Any], bool]:
    init_storage_db()

    analysis_id = record.get("id") if isinstance(record, dict) else None
    if not isinstance(analysis_id, str) or not analysis_id.strip():
        raise ValueError("Analysis id is required")

    analysis = record.get("payload", {}) if isinstance(record, dict) else {}
    incoming_updated_at = _parse_record_updated_at(record.get("updated_at"))
    payload = json.dumps(analysis, ensure_ascii=False)

    with _get_connection() as connection:
        existing = connection.execute(
            f"SELECT created_at, updated_at FROM analyses WHERE id = {_param()}",
            (analysis_id,),
        ).fetchone()

        if existing:
            existing_updated_at = _parse_record_updated_at(existing["updated_at"])
            if existing_updated_at > incoming_updated_at:
                stored = get_analysis_record(analysis_id)
                if stored:
                    return stored, True
                return {
                    "id": analysis_id,
                    "payload": analysis if isinstance(analysis, dict) else {},
                    "created_at": existing["created_at"],
                    "updated_at": existing["updated_at"],
                }, True

            connection.execute(
                f"""
                UPDATE analyses
                SET payload = {_param()}, updated_at = {_now_sql()}
                WHERE id = {_param()}
                """,
                (payload, analysis_id),
            )
            created_at = existing["created_at"]
        else:
            connection.execute(
                f"""
                INSERT INTO analyses (id, payload)
                VALUES ({_param()}, {_param()})
                """,
                (analysis_id, payload),
            )
            created_at = connection.execute(
                f"SELECT created_at FROM analyses WHERE id = {_param()}",
                (analysis_id,),
            ).fetchone()["created_at"]

        connection.commit()

    stored = get_analysis_record(analysis_id)
    if stored:
        return stored, False

    return {
        "id": analysis_id,
        "payload": analysis,
        "created_at": created_at,
        "updated_at": created_at,
    }, False


def delete_analysis_record(analysis_id: str) -> bool:
    init_storage_db()

    with _get_connection() as connection:
        cursor = connection.execute(
            f"DELETE FROM analyses WHERE id = {_param()}",
            (analysis_id,),
        )
        connection.commit()

    return cursor.rowcount > 0


def list_multiple_records() -> list[Dict[str, Any]]:
    init_storage_db()

    with _get_connection() as connection:
        rows = connection.execute(
            f"""
            SELECT id, payload, created_at, updated_at
            FROM multiples
            ORDER BY {_created_at_order_sql()}
            """
        ).fetchall()

    records: list[Dict[str, Any]] = []
    for row in rows:
        try:
            payload = json.loads(row["payload"])
        except json.JSONDecodeError:
            payload = {}

        records.append(
            {
                "id": row["id"],
                "payload": payload if isinstance(payload, dict) else {},
                "created_at": row["created_at"],
                "updated_at": row["updated_at"],
            }
        )

    return records


def get_multiple_record(multiple_id: str) -> Dict[str, Any] | None:
    init_storage_db()

    with _get_connection() as connection:
        row = connection.execute(
            f"""
            SELECT id, payload, created_at, updated_at
            FROM multiples
            WHERE id = {_param()}
            """,
            (multiple_id,),
        ).fetchone()

    if not row:
        return None

    try:
        payload = json.loads(row["payload"])
    except json.JSONDecodeError:
        payload = {}

    return {
        "id": row["id"],
        "payload": payload if isinstance(payload, dict) else {},
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def save_multiple_record(record: Dict[str, Any]) -> tuple[Dict[str, Any], bool]:
    init_storage_db()

    multiple_id = record.get("id") if isinstance(record, dict) else None
    if not isinstance(multiple_id, str) or not multiple_id.strip():
        raise ValueError("Multiple id is required")

    multiple = record.get("payload", {}) if isinstance(record, dict) else {}
    incoming_updated_at = _parse_record_updated_at(record.get("updated_at"))
    payload = json.dumps(multiple, ensure_ascii=False)

    with _get_connection() as connection:
        existing = connection.execute(
            f"SELECT created_at, updated_at FROM multiples WHERE id = {_param()}",
            (multiple_id,),
        ).fetchone()

        if existing:
            existing_updated_at = _parse_record_updated_at(existing["updated_at"])
            if existing_updated_at > incoming_updated_at:
                stored = get_multiple_record(multiple_id)
                if stored:
                    return stored, True
                return {
                    "id": multiple_id,
                    "payload": multiple if isinstance(multiple, dict) else {},
                    "created_at": existing["created_at"],
                    "updated_at": existing["updated_at"],
                }, True

            connection.execute(
                f"""
                UPDATE multiples
                SET payload = {_param()}, updated_at = {_now_sql()}
                WHERE id = {_param()}
                """,
                (payload, multiple_id),
            )
            created_at = existing["created_at"]
        else:
            connection.execute(
                f"""
                INSERT INTO multiples (id, payload)
                VALUES ({_param()}, {_param()})
                """,
                (multiple_id, payload),
            )
            created_at = connection.execute(
                f"SELECT created_at FROM multiples WHERE id = {_param()}",
                (multiple_id,),
            ).fetchone()["created_at"]

        connection.commit()

    stored = get_multiple_record(multiple_id)
    if stored:
        return stored, False

    return {
        "id": multiple_id,
        "payload": multiple,
        "created_at": created_at,
        "updated_at": created_at,
    }, False


def delete_multiple_record(multiple_id: str) -> bool:
    init_storage_db()

    with _get_connection() as connection:
        cursor = connection.execute(
            f"DELETE FROM multiples WHERE id = {_param()}",
            (multiple_id,),
        )
        connection.commit()

    return cursor.rowcount > 0


def reset_all_storage() -> None:
    init_storage_db()

    with _get_connection() as connection:
        connection.execute("DELETE FROM app_state")
        connection.execute("DELETE FROM entity_state")
        connection.execute("DELETE FROM analyses")
        connection.execute("DELETE FROM multiples")
        connection.commit()
