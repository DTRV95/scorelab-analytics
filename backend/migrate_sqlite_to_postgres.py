import os
import sqlite3
from pathlib import Path
from typing import Iterable

import psycopg


BASE_DIR = Path(__file__).resolve().parent
SQLITE_DB_PATH = BASE_DIR / "scorelab_storage.db"


def load_local_env() -> None:
    env_path = BASE_DIR / ".env"
    if not env_path.exists():
        return

    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


def get_postgres_url() -> str:
    load_local_env()
    postgres_url = os.getenv("DATABASE_URL") or os.getenv("DATABASE_URL_UNPOOLED")
    if not postgres_url:
        raise RuntimeError(
            "Set DATABASE_URL or DATABASE_URL_UNPOOLED before running the migration."
        )
    return postgres_url


def sqlite_rows(connection: sqlite3.Connection, table: str) -> Iterable[sqlite3.Row]:
    return connection.execute(f"SELECT * FROM {table}").fetchall()


def init_postgres(connection: psycopg.Connection) -> None:
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS app_state (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          payload TEXT NOT NULL,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP::text
        )
        """
    )
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS entity_state (
          entity_key TEXT PRIMARY KEY,
          payload TEXT NOT NULL,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP::text
        )
        """
    )
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS analyses (
          id TEXT PRIMARY KEY,
          payload TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP::text,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP::text
        )
        """
    )
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS multiples (
          id TEXT PRIMARY KEY,
          payload TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP::text,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP::text
        )
        """
    )
    connection.commit()


def migrate() -> None:
    if not SQLITE_DB_PATH.exists():
        raise RuntimeError(f"SQLite database not found: {SQLITE_DB_PATH}")

    sqlite_connection = sqlite3.connect(SQLITE_DB_PATH)
    sqlite_connection.row_factory = sqlite3.Row

    postgres_url = get_postgres_url()
    with psycopg.connect(postgres_url) as postgres_connection:
        init_postgres(postgres_connection)

        app_state_count = 0
        for row in sqlite_rows(sqlite_connection, "app_state"):
            postgres_connection.execute(
                """
                INSERT INTO app_state (id, payload, updated_at)
                VALUES (%s, %s, %s)
                ON CONFLICT(id) DO UPDATE SET
                  payload = excluded.payload,
                  updated_at = excluded.updated_at
                """,
                (row["id"], row["payload"], row["updated_at"]),
            )
            app_state_count += 1

        entity_count = 0
        for row in sqlite_rows(sqlite_connection, "entity_state"):
            postgres_connection.execute(
                """
                INSERT INTO entity_state (entity_key, payload, updated_at)
                VALUES (%s, %s, %s)
                ON CONFLICT(entity_key) DO UPDATE SET
                  payload = excluded.payload,
                  updated_at = excluded.updated_at
                """,
                (row["entity_key"], row["payload"], row["updated_at"]),
            )
            entity_count += 1

        analyses_count = 0
        for row in sqlite_rows(sqlite_connection, "analyses"):
            postgres_connection.execute(
                """
                INSERT INTO analyses (id, payload, created_at, updated_at)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT(id) DO UPDATE SET
                  payload = excluded.payload,
                  created_at = excluded.created_at,
                  updated_at = excluded.updated_at
                """,
                (row["id"], row["payload"], row["created_at"], row["updated_at"]),
            )
            analyses_count += 1

        multiples_count = 0
        for row in sqlite_rows(sqlite_connection, "multiples"):
            postgres_connection.execute(
                """
                INSERT INTO multiples (id, payload, created_at, updated_at)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT(id) DO UPDATE SET
                  payload = excluded.payload,
                  created_at = excluded.created_at,
                  updated_at = excluded.updated_at
                """,
                (row["id"], row["payload"], row["created_at"], row["updated_at"]),
            )
            multiples_count += 1

        postgres_connection.commit()

    sqlite_connection.close()
    print("Migration complete")
    print(f"app_state: {app_state_count}")
    print(f"entity_state: {entity_count}")
    print(f"analyses: {analyses_count}")
    print(f"multiples: {multiples_count}")


if __name__ == "__main__":
    migrate()
