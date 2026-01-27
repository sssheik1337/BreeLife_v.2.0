import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

from config import DB_PATH

TABLES = {
    "profiles": """
        CREATE TABLE IF NOT EXISTS profiles (
            telegram_user_id INTEGER PRIMARY KEY,
            data TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    """,
    "subscriptions": """
        CREATE TABLE IF NOT EXISTS subscriptions (
            telegram_user_id INTEGER PRIMARY KEY,
            data TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    """,
    "food_diary_entries": """
        CREATE TABLE IF NOT EXISTS food_diary_entries (
            telegram_user_id INTEGER PRIMARY KEY,
            data TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    """,
    "diary_entries": """
        CREATE TABLE IF NOT EXISTS diary_entries (
            telegram_user_id INTEGER PRIMARY KEY,
            data TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    """,
    "water_entries": """
        CREATE TABLE IF NOT EXISTS water_entries (
            telegram_user_id INTEGER PRIMARY KEY,
            data TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    """,
    "sleep_entries": """
        CREATE TABLE IF NOT EXISTS sleep_entries (
            telegram_user_id INTEGER PRIMARY KEY,
            data TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    """,
    "habit_entries": """
        CREATE TABLE IF NOT EXISTS habit_entries (
            telegram_user_id INTEGER PRIMARY KEY,
            data TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    """,
    "reminder_entries": """
        CREATE TABLE IF NOT EXISTS reminder_entries (
            telegram_user_id INTEGER PRIMARY KEY,
            data TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    """,
}


def init_db() -> None:
    """Инициализировать базу данных и таблицы."""
    db_path = Path(DB_PATH)
    db_path.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(DB_PATH) as connection:
        connection.execute("PRAGMA journal_mode=WAL;")
        for statement in TABLES.values():
            connection.execute(statement)


def read_payload(table: str, telegram_user_id: int) -> dict | list | None:
    """Прочитать JSON-данные пользователя из таблицы."""
    if table not in TABLES:
        raise ValueError("Неизвестная таблица для чтения данных.")
    with sqlite3.connect(DB_PATH) as connection:
        connection.row_factory = sqlite3.Row
        cursor = connection.execute(
            f"SELECT data FROM {table} WHERE telegram_user_id = ?",
            (telegram_user_id,),
        )
        row = cursor.fetchone()
    if not row:
        return None
    try:
        return json.loads(row["data"])
    except json.JSONDecodeError:
        return None


def write_payload(table: str, telegram_user_id: int, payload: dict | list) -> None:
    """Сохранить JSON-данные пользователя в таблицу."""
    if table not in TABLES:
        raise ValueError("Неизвестная таблица для сохранения данных.")
    updated_at = datetime.now(timezone.utc).isoformat()
    serialized = json.dumps(payload, ensure_ascii=False)
    with sqlite3.connect(DB_PATH) as connection:
        connection.execute(
            f"""
            INSERT INTO {table} (telegram_user_id, data, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(telegram_user_id)
            DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at
            """,
            (telegram_user_id, serialized, updated_at),
        )
        connection.commit()
