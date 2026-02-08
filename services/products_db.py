import json
import sqlite3
from contextlib import contextmanager
from pathlib import Path

ADMIN_CONFIG_PATH = Path("config/admin_config.json")
ADMIN_PRODUCTS_PATH = Path("static/data/products.json")
PRODUCTS_DB_PATH = Path("static/data/products.db")


@contextmanager
def get_products_connection() -> sqlite3.Connection:
    PRODUCTS_DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(PRODUCTS_DB_PATH)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    try:
        yield connection
    finally:
        connection.close()


def normalize_group_list(values: object) -> list[str]:
    if not isinstance(values, list):
        return []
    groups = []
    for item in values:
        if isinstance(item, str):
            normalized = item.strip()
            if normalized and normalized not in groups:
                groups.append(normalized)
    return groups


def ensure_products_db() -> None:
    with get_products_connection() as connection:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS product_groups (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL
            );
            CREATE TABLE IF NOT EXISTS products (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                group_name TEXT,
                kcal REAL,
                protein_g REAL,
                fat_g REAL,
                carbs_g REAL,
                carbs_simple_g REAL,
                carbs_complex_g REAL,
                fiber_g REAL,
                tags TEXT,
                health_level TEXT
            );
            """
        )
        columns = {
            row["name"] for row in connection.execute("PRAGMA table_info(products)").fetchall()
        }
        if "carbs_g" not in columns:
            connection.execute("ALTER TABLE products ADD COLUMN carbs_g REAL")
        products_count = connection.execute("SELECT COUNT(*) FROM products").fetchone()[0]
        groups_count = connection.execute("SELECT COUNT(*) FROM product_groups").fetchone()[0]
        if products_count or groups_count:
            return
        legacy_products = []
        if ADMIN_PRODUCTS_PATH.exists():
            try:
                legacy_products = json.loads(ADMIN_PRODUCTS_PATH.read_text(encoding="utf-8"))
            except json.JSONDecodeError:
                legacy_products = []
        if not isinstance(legacy_products, list):
            legacy_products = []
        legacy_groups = []
        if ADMIN_CONFIG_PATH.exists():
            try:
                config = json.loads(ADMIN_CONFIG_PATH.read_text(encoding="utf-8"))
            except json.JSONDecodeError:
                config = {}
            legacy_groups = normalize_group_list(
                config.get("product_groups") if isinstance(config, dict) else []
            )
        for item in legacy_products:
            group = item.get("group") if isinstance(item, dict) else None
            if isinstance(group, str):
                normalized = group.strip()
                if normalized and normalized not in legacy_groups:
                    legacy_groups.append(normalized)
        for group in sorted(legacy_groups):
            connection.execute(
                "INSERT OR IGNORE INTO product_groups (name) VALUES (?)",
                (group,),
            )
        for item in legacy_products:
            if not isinstance(item, dict):
                continue
            tags = item.get("tags")
            tags_payload = json.dumps(tags, ensure_ascii=False) if isinstance(tags, list) else None
            connection.execute(
                """
                INSERT INTO products (
                    id, name, group_name, kcal, protein_g, fat_g, carbs_g,
                    carbs_simple_g, carbs_complex_g, fiber_g, tags, health_level
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    item.get("id"),
                    item.get("name"),
                    item.get("group"),
                    item.get("kcal"),
                    item.get("protein_g"),
                    item.get("fat_g"),
                    item.get("carbs_g"),
                    item.get("carbs_simple_g"),
                    item.get("carbs_complex_g"),
                    item.get("fiber_g"),
                    tags_payload,
                    item.get("health_level"),
                ),
            )
        connection.commit()


def load_admin_products() -> list[dict[str, object]]:
    """Загрузить список продуктов из SQLite."""
    ensure_products_db()
    with get_products_connection() as connection:
        rows = connection.execute(
            """
            SELECT id, name, group_name, kcal, protein_g, fat_g, carbs_g,
                   carbs_simple_g, carbs_complex_g, fiber_g, tags, health_level
            FROM products
            ORDER BY id
            """
        ).fetchall()
    products: list[dict[str, object]] = []
    for row in rows:
        tags_value = row["tags"]
        tags = []
        if isinstance(tags_value, str):
            try:
                parsed = json.loads(tags_value)
            except json.JSONDecodeError:
                parsed = []
            if isinstance(parsed, list):
                tags = parsed
        products.append(
            {
                "id": row["id"],
                "name": row["name"],
                "group": row["group_name"],
                "kcal": row["kcal"],
                "protein_g": row["protein_g"],
                "fat_g": row["fat_g"],
                "carbs_g": row["carbs_g"],
                "carbs_simple_g": row["carbs_simple_g"],
                "carbs_complex_g": row["carbs_complex_g"],
                "fiber_g": row["fiber_g"],
                "tags": tags,
                "health_level": row["health_level"],
            }
        )
    return products


def save_admin_products(products: list[dict[str, object]]) -> None:
    """Сохранить список продуктов в SQLite."""
    ensure_products_db()
    with get_products_connection() as connection:
        connection.execute("DELETE FROM products")
        for item in products:
            if not isinstance(item, dict):
                continue
            tags = item.get("tags")
            tags_payload = json.dumps(tags, ensure_ascii=False) if isinstance(tags, list) else None
            connection.execute(
                """
                INSERT INTO products (
                    id, name, group_name, kcal, protein_g, fat_g, carbs_g,
                    carbs_simple_g, carbs_complex_g, fiber_g, tags, health_level
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    item.get("id"),
                    item.get("name"),
                    item.get("group"),
                    item.get("kcal"),
                    item.get("protein_g"),
                    item.get("fat_g"),
                    item.get("carbs_g"),
                    item.get("carbs_simple_g"),
                    item.get("carbs_complex_g"),
                    item.get("fiber_g"),
                    tags_payload,
                    item.get("health_level"),
                ),
            )
        connection.commit()
    ADMIN_PRODUCTS_PATH.write_text(
        json.dumps(products, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def load_admin_groups() -> list[str]:
    ensure_products_db()
    with get_products_connection() as connection:
        rows = connection.execute(
            "SELECT name FROM product_groups ORDER BY name"
        ).fetchall()
    return [row["name"] for row in rows]


def save_admin_groups(groups: list[str]) -> None:
    ensure_products_db()
    with get_products_connection() as connection:
        connection.execute("DELETE FROM product_groups")
        for group in groups:
            connection.execute(
                "INSERT OR IGNORE INTO product_groups (name) VALUES (?)",
                (group,),
            )
        connection.commit()


def collect_product_groups(
    products: list[dict[str, object]],
    groups: list[str],
) -> list[str]:
    collected = normalize_group_list(groups)
    for item in products:
        group = item.get("group")
        if isinstance(group, str):
            normalized = group.strip()
            if normalized and normalized not in collected:
                collected.append(normalized)
    return sorted(collected)
