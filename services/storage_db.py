import json
import sqlite3
import uuid
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
    "user_settings": """
        CREATE TABLE IF NOT EXISTS user_settings (
            telegram_user_id INTEGER PRIMARY KEY,
            tz_name TEXT,
            tz_offset_minutes INTEGER,
            write_access_allowed INTEGER,
            write_access_updated_at TEXT,
            updated_at TEXT NOT NULL
        )
    """,
    "reminders": """
        CREATE TABLE IF NOT EXISTS reminders (
            id TEXT PRIMARY KEY,
            telegram_user_id INTEGER NOT NULL,
            type TEXT NOT NULL,
            enabled INTEGER NOT NULL DEFAULT 1,
            time_local TEXT NOT NULL,
            frequency TEXT NOT NULL DEFAULT 'daily',
            timezone TEXT,
            next_run_at_utc TEXT,
            last_sent_at_utc TEXT,
            fail_count INTEGER NOT NULL DEFAULT 0,
            last_error TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    """,
    "telegram_users": """
        CREATE TABLE IF NOT EXISTS telegram_users (
            telegram_user_id INTEGER PRIMARY KEY,
            first_name TEXT,
            last_name TEXT,
            username TEXT,
            photo_url TEXT,
            updated_at TEXT NOT NULL
        )
    """,
    "sessions": """
        CREATE TABLE IF NOT EXISTS sessions (
            session_id TEXT PRIMARY KEY,
            telegram_user_id INTEGER NOT NULL,
            created_at TEXT NOT NULL,
            last_seen_at TEXT NOT NULL
        )
    """,
    "payments": """
        CREATE TABLE IF NOT EXISTS payments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            telegram_user_id INTEGER NOT NULL,
            created_at TEXT NOT NULL,
            amount_rub INTEGER NOT NULL DEFAULT 0,
            duration_days INTEGER NOT NULL DEFAULT 0,
            status TEXT NOT NULL DEFAULT 'success',
            meta_json TEXT
        )
    """,
    "meal_plan_cache": """
        CREATE TABLE IF NOT EXISTS meal_plan_cache (
            cache_key TEXT PRIMARY KEY,
            payload TEXT NOT NULL,
            expires_at INTEGER NOT NULL,
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
        connection.execute(
            "CREATE INDEX IF NOT EXISTS idx_telegram_users_username ON telegram_users(username)"
        )
        connection.execute(
            "CREATE INDEX IF NOT EXISTS idx_telegram_users_updated_at ON telegram_users(updated_at)"
        )
        connection.execute(
            "CREATE INDEX IF NOT EXISTS idx_sessions_user_created ON sessions(telegram_user_id, created_at)"
        )
        connection.execute(
            "CREATE INDEX IF NOT EXISTS idx_profiles_user ON profiles(telegram_user_id)"
        )
        try:
            connection.execute(
                "CREATE INDEX IF NOT EXISTS idx_profiles_subscription_until ON profiles(json_extract(data, '$.subscription_until'))"
            )
            connection.execute(
                "CREATE INDEX IF NOT EXISTS idx_profiles_subscription_status ON profiles(lower(json_extract(data, '$.subscription_status')))"
            )
        except sqlite3.OperationalError:
            # JSON expression indexes may be unavailable on older SQLite builds.
            pass
        connection.execute(
            "CREATE INDEX IF NOT EXISTS idx_payments_user_created ON payments(telegram_user_id, created_at)"
        )
        connection.execute(
            "CREATE INDEX IF NOT EXISTS idx_payments_status_created ON payments(status, created_at)"
        )
        connection.execute(
            "CREATE INDEX IF NOT EXISTS idx_user_settings_user ON user_settings(telegram_user_id)"
        )
        connection.execute(
            "CREATE INDEX IF NOT EXISTS idx_reminders_user ON reminders(telegram_user_id)"
        )
        connection.execute(
            "CREATE INDEX IF NOT EXISTS idx_reminders_next_run ON reminders(next_run_at_utc)"
        )
        user_settings_columns = {
            row[1] for row in connection.execute("PRAGMA table_info(user_settings)").fetchall()
        }
        if "write_access_allowed" not in user_settings_columns:
            connection.execute("ALTER TABLE user_settings ADD COLUMN write_access_allowed INTEGER")
        if "write_access_updated_at" not in user_settings_columns:
            connection.execute("ALTER TABLE user_settings ADD COLUMN write_access_updated_at TEXT")


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


def upsert_telegram_user(
    telegram_user_id: int,
    first_name: str | None = None,
    last_name: str | None = None,
    username: str | None = None,
    photo_url: str | None = None,
) -> None:
    """Обновить персональные данные пользователя из Telegram."""
    updated_at = datetime.now(timezone.utc).isoformat()
    with sqlite3.connect(DB_PATH) as connection:
        connection.execute(
            """
            INSERT INTO telegram_users (telegram_user_id, first_name, last_name, username, photo_url, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(telegram_user_id)
            DO UPDATE SET
                first_name = excluded.first_name,
                last_name = excluded.last_name,
                username = excluded.username,
                photo_url = excluded.photo_url,
                updated_at = excluded.updated_at
            """,
            (telegram_user_id, first_name, last_name, username, photo_url, updated_at),
        )
        connection.commit()


def create_session(
    telegram_user_id: int,
    telegram_username: str | None = None,
    telegram_name: str | None = None,
    telegram_last_name: str | None = None,
    telegram_photo_url: str | None = None,
) -> dict[str, object]:
    """Создать сессию пользователя и вернуть её данные."""
    session_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    upsert_telegram_user(
        telegram_user_id=telegram_user_id,
        first_name=telegram_name,
        last_name=telegram_last_name,
        username=telegram_username,
        photo_url=telegram_photo_url,
    )

    with sqlite3.connect(DB_PATH) as connection:
        connection.execute(
            """
            INSERT INTO sessions (session_id, telegram_user_id, created_at, last_seen_at)
            VALUES (?, ?, ?, ?)
            """,
            (session_id, telegram_user_id, now, now),
        )
        connection.commit()

    return {
        "token": session_id,
        "telegram_user_id": telegram_user_id,
        "first_name": telegram_name,
        "last_name": telegram_last_name,
        "username": telegram_username,
        "photo_url": telegram_photo_url,
    }


def get_session_user(session_id: str) -> dict[str, object] | None:
    """Получить данные пользователя по session_id и обновить last_seen_at."""
    if not session_id:
        return None
    now = datetime.now(timezone.utc).isoformat()
    with sqlite3.connect(DB_PATH) as connection:
        connection.row_factory = sqlite3.Row
        cursor = connection.execute(
            """
            SELECT
                s.telegram_user_id,
                u.first_name,
                u.last_name,
                u.username,
                u.photo_url
            FROM sessions s
            LEFT JOIN telegram_users u ON u.telegram_user_id = s.telegram_user_id
            WHERE s.session_id = ?
            """,
            (session_id,),
        )
        row = cursor.fetchone()
        if not row:
            return None
        connection.execute(
            "UPDATE sessions SET last_seen_at = ? WHERE session_id = ?",
            (now, session_id),
        )
        connection.commit()

    return {
        "telegram_user_id": int(row["telegram_user_id"]),
        "first_name": row["first_name"],
        "last_name": row["last_name"],
        "username": row["username"],
        "photo_url": row["photo_url"],
    }



def read_cache_payload(cache_key: str) -> dict | None:
    """Прочитать payload из кэша по ключу, если он не просрочен."""
    now_ts = int(datetime.now(timezone.utc).timestamp())
    with sqlite3.connect(DB_PATH) as connection:
        connection.row_factory = sqlite3.Row
        cursor = connection.execute(
            "SELECT payload, expires_at FROM meal_plan_cache WHERE cache_key = ?",
            (cache_key,),
        )
        row = cursor.fetchone()

        if not row:
            return None

        expires_at = int(row["expires_at"])
        if expires_at <= now_ts:
            connection.execute("DELETE FROM meal_plan_cache WHERE cache_key = ?", (cache_key,))
            connection.commit()
            return None

    try:
        payload = json.loads(row["payload"])
    except (TypeError, ValueError, json.JSONDecodeError):
        return None

    return payload if isinstance(payload, dict) else None


def write_cache_payload(cache_key: str, payload: dict[str, object], ttl_seconds: int) -> None:
    """Сохранить payload в SQLite-кэш с TTL в секундах."""
    if ttl_seconds <= 0:
        return

    now = datetime.now(timezone.utc)
    expires_at = int(now.timestamp()) + int(ttl_seconds)
    serialized = json.dumps(payload, ensure_ascii=False)

    with sqlite3.connect(DB_PATH) as connection:
        connection.execute(
            """
            INSERT INTO meal_plan_cache (cache_key, payload, expires_at, updated_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(cache_key)
            DO UPDATE SET
                payload = excluded.payload,
                expires_at = excluded.expires_at,
                updated_at = excluded.updated_at
            """,
            (cache_key, serialized, expires_at, now.isoformat()),
        )
        connection.commit()


def delete_cache_keys(cache_keys: list[str]) -> None:
    """Удалить набор ключей из SQLite-кэша."""
    keys = [key for key in cache_keys if isinstance(key, str) and key]
    if not keys:
        return

    placeholders = ",".join("?" for _ in keys)
    query = f"DELETE FROM meal_plan_cache WHERE cache_key IN ({placeholders})"
    with sqlite3.connect(DB_PATH) as connection:
        connection.execute(query, keys)
        connection.commit()
