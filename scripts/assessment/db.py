"""
Shared PostgreSQL helpers for the ParcelPilot assessment scripts.

Provides a thin wrapper around psycopg2 for deterministic, environment-driven
database access. No credentials are hard-coded; all connection parameters come
from the environment (see config.get_db_config).
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

import psycopg2
import psycopg2.extras

from .config import get_db_config


class DatabaseError(Exception):
    """Raised when a database operation fails."""


def connect():
    """Create a PostgreSQL connection from environment configuration."""
    cfg = get_db_config()

    if cfg["database_url"]:
        conn = psycopg2.connect(cfg["database_url"])
    else:
        conn = psycopg2.connect(
            host=cfg["host"],
            port=cfg["port"],
            dbname=cfg["database"],
            user=cfg["user"],
            password=cfg["password"],
        )

    conn.autocommit = False
    return conn


def execute(conn, query: str, params: Optional[List[Any]] = None) -> List[Dict[str, Any]]:
    """Execute a query and return all rows as dicts."""
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(query, params or [])
            if cur.description is None:
                return []
            return cur.fetchall()
    except Exception as exc:  # noqa: BLE001
        raise DatabaseError(f"Query failed: {exc}") from exc


def execute_many(conn, query: str, rows: List[List[Any]]) -> None:
    """Execute a parameterised query for many rows."""
    try:
        with conn.cursor() as cur:
            cur.executemany(query, rows)
    except Exception as exc:  # noqa: BLE001
        raise DatabaseError(f"Bulk query failed: {exc}") from exc


def commit(conn) -> None:
    """Commit the current transaction."""
    conn.commit()


def rollback(conn) -> None:
    """Roll back the current transaction."""
    conn.rollback()


def close(conn) -> None:
    """Close the connection."""
    try:
        conn.close()
    except Exception:  # noqa: BLE001
        pass