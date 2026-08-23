"""
Ingest the ParcelPilot assessment workbook into PostgreSQL.

Pipeline:
    Excel
      ↓
    README
      ↓
    accounts
      ↓
    orders
      ↓
    tickets
      ↓
    validation
      ↓
    PostgreSQL

The ingestion is idempotent: running it multiple times does not create
duplicate records. It uses UPSERT (ON CONFLICT) semantics.

No record IDs are hard-coded. No assessment data is hard-coded. All values
come from the source workbook.
"""

from __future__ import annotations

import argparse
import sys
from datetime import date, datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

sys.path.insert(0, str(Path(__file__).resolve().parent))

from assessment.config import (  # noqa: E402
    DATASET_CURRENCY,
    DATASET_NAME,
    DATASET_SNAPSHOT_AT,
    get_documents_dir,
    get_workbook_path,
)
from assessment.db import close, commit, connect, execute, execute_many, rollback  # noqa: E402
from assessment.workbook import WorkbookError, read_sheet  # noqa: E402
from validate_assessment_data import validate_workbook  # noqa: E402

# ---------------------------------------------------------------------------
# Value coercion helpers
# ---------------------------------------------------------------------------


def _is_missing(value) -> bool:
    return value is None or (isinstance(value, str) and value.strip() == "")


def _clean_str(value) -> Optional[str]:
    if _is_missing(value):
        return None
    return str(value).strip()


def _parse_timestamp(value) -> Optional[str]:
    """Return an ISO-8601 string for a timestamp value, or None."""
    if _is_missing(value):
        return None
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, str):
        for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%d", "%d-%m-%Y %H:%M:%S", "%d-%m-%Y"):
            try:
                return datetime.strptime(value.strip(), fmt).isoformat()
            except ValueError:
                continue
        return None
    return None


def _parse_bool(value) -> bool:
    if _is_missing(value):
        return False
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)
    if isinstance(value, str):
        return value.strip().lower() in ("true", "yes", "y", "1")
    return False


def _parse_number(value) -> Optional[float]:
    if _is_missing(value):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        try:
            return float(value.strip().replace(",", ""))
        except ValueError:
            return None
    return None


# ---------------------------------------------------------------------------
# Ingestion
# ---------------------------------------------------------------------------


def ingest_metadata(conn, source_file: str) -> None:
    """Upsert the dataset metadata row (idempotent by dataset_name)."""
    query = """
        INSERT INTO assessment_dataset_metadata (dataset_name, snapshot_at, currency, source_file)
        VALUES (%s, %s, %s, %s)
        ON CONFLICT (dataset_name) DO UPDATE SET
            snapshot_at = EXCLUDED.snapshot_at,
            currency    = EXCLUDED.currency,
            source_file = EXCLUDED.source_file;
    """
    execute(conn, query, [DATASET_NAME, DATASET_SNAPSHOT_AT, DATASET_CURRENCY, source_file])


def ingest_accounts(conn, accounts: List[Dict[str, Any]]) -> None:
    query = """
        INSERT INTO accounts (
            account_id, account_name, plan, status, csm, contract_file,
            premium_support, notes, ingested_at, updated_at
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (account_id) DO UPDATE SET
            account_name    = EXCLUDED.account_name,
            plan            = EXCLUDED.plan,
            status          = EXCLUDED.status,
            csm             = EXCLUDED.csm,
            contract_file   = EXCLUDED.contract_file,
            premium_support = EXCLUDED.premium_support,
            notes           = EXCLUDED.notes,
            updated_at      = CURRENT_TIMESTAMP;
    """
    rows = [
        [
            _clean_str(r.get("account_id")),
            _clean_str(r.get("account_name")),
            _clean_str(r.get("plan")),
            _clean_str(r.get("status")),
            _clean_str(r.get("csm")),
            _clean_str(r.get("contract_file")),
            _parse_bool(r.get("premium_support")),
            _clean_str(r.get("notes")),
        ]
        for r in accounts
    ]
    execute_many(conn, query, rows)


def ingest_orders(conn, orders: List[Dict[str, Any]]) -> None:
    query = """
        INSERT INTO orders (
            order_id, account_id, carrier, status, booked_at,
            pickup_window_start, pickup_window_end, pickup_actual_at,
            shipment_fee_inr, carrier_fault, customer_fault,
            cancellation_requested_at, notes, ingested_at, updated_at
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (order_id) DO UPDATE SET
            account_id                = EXCLUDED.account_id,
            carrier                   = EXCLUDED.carrier,
            status                    = EXCLUDED.status,
            booked_at                 = EXCLUDED.booked_at,
            pickup_window_start       = EXCLUDED.pickup_window_start,
            pickup_window_end         = EXCLUDED.pickup_window_end,
            pickup_actual_at          = EXCLUDED.pickup_actual_at,
            shipment_fee_inr          = EXCLUDED.shipment_fee_inr,
            carrier_fault             = EXCLUDED.carrier_fault,
            customer_fault            = EXCLUDED.customer_fault,
            cancellation_requested_at = EXCLUDED.cancellation_requested_at,
            notes                     = EXCLUDED.notes,
            updated_at                = CURRENT_TIMESTAMP;
    """
    rows = [
        [
            _clean_str(r.get("order_id")),
            _clean_str(r.get("account_id")),
            _clean_str(r.get("carrier")),
            _clean_str(r.get("status")),
            _parse_timestamp(r.get("booked_at")),
            _parse_timestamp(r.get("pickup_window_start")),
            _parse_timestamp(r.get("pickup_window_end")),
            _parse_timestamp(r.get("pickup_actual_at")),
            _parse_number(r.get("shipment_fee_inr")),
            _parse_bool(r.get("carrier_fault")),
            _parse_bool(r.get("customer_fault")),
            _parse_timestamp(r.get("cancellation_requested_at")),
            _clean_str(r.get("notes")),
        ]
        for r in orders
    ]
    execute_many(conn, query, rows)


def ingest_tickets(conn, tickets: List[Dict[str, Any]]) -> None:
    query = """
        INSERT INTO tickets (
            ticket_id, account_id, created_at, status, subject, description,
            channel, assigned_to, last_customer_message_at, historical_resolution,
            ingested_at, updated_at
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (ticket_id) DO UPDATE SET
            account_id                = EXCLUDED.account_id,
            created_at                = EXCLUDED.created_at,
            status                    = EXCLUDED.status,
            subject                   = EXCLUDED.subject,
            description               = EXCLUDED.description,
            channel                   = EXCLUDED.channel,
            assigned_to               = EXCLUDED.assigned_to,
            last_customer_message_at  = EXCLUDED.last_customer_message_at,
            historical_resolution     = EXCLUDED.historical_resolution,
            updated_at                = CURRENT_TIMESTAMP;
    """
    rows = [
        [
            _clean_str(r.get("ticket_id")),
            _clean_str(r.get("account_id")),
            _parse_timestamp(r.get("created_at")),
            _clean_str(r.get("status")),
            _clean_str(r.get("subject")),
            _clean_str(r.get("description")),
            _clean_str(r.get("channel")),
            _clean_str(r.get("assigned_to")),
            _parse_timestamp(r.get("last_customer_message_at")),
            _clean_str(r.get("historical_resolution")),
        ]
        for r in tickets
    ]
    execute_many(conn, query, rows)


def ingest_workbook(path: Path, documents_dir: Path) -> None:
    print("=" * 70)
    print("ParcelPilot Assessment Workbook Ingestion")
    print("=" * 70)
    print(f"Workbook  : {path}")
    print(f"Documents : {documents_dir}")
    print()

    # 1. Validate first — never ingest invalid data
    print("Validating workbook...")
    problems = validate_workbook(path, documents_dir)
    if problems:
        print(f"VALIDATION FAILED: {len(problems)} problem(s) found")
        for problem in problems:
            print(f"  - {problem}")
        sys.exit(1)
    print("Validation passed.")

    # 2. Read README first to preserve the workbook's documented source order.
    try:
        read_sheet(path, "README")
        accounts = read_sheet(path, "accounts")
        orders = read_sheet(path, "orders")
        tickets = read_sheet(path, "tickets")
    except WorkbookError as exc:
        print(f"ERROR: {exc}")
        sys.exit(1)

    print(f"Read accounts: {len(accounts)} rows")
    print(f"Read orders  : {len(orders)} rows")
    print(f"Read tickets : {len(tickets)} rows")

    # 3. Connect to PostgreSQL
    conn = connect()
    try:
        # 4. Ingest metadata
        print("Ingesting dataset metadata...")
        ingest_metadata(conn, str(path))

        # 5. Ingest accounts (must come first due to FK)
        print("Ingesting accounts...")
        ingest_accounts(conn, accounts)

        # 6. Ingest orders
        print("Ingesting orders...")
        ingest_orders(conn, orders)

        # 7. Ingest tickets
        print("Ingesting tickets...")
        ingest_tickets(conn, tickets)

        commit(conn)
        print("Ingestion committed successfully.")
    except Exception as exc:  # noqa: BLE001
        rollback(conn)
        print(f"ERROR: Ingestion failed and was rolled back: {exc}")
        sys.exit(1)
    finally:
        close(conn)

    print("=" * 70)
    print("Ingestion complete. The workbook was NOT modified.")
    print("=" * 70)


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest the ParcelPilot assessment workbook into PostgreSQL.")
    parser.add_argument(
        "--workbook",
        type=Path,
        default=None,
        help="Path to the workbook (default: data/assessment/workbook/ParcelPilot_Assessment_Data.xlsx)",
    )
    parser.add_argument(
        "--documents",
        type=Path,
        default=None,
        help="Path to the supplied PDFs directory (default: data/assessment/documents)",
    )
    args = parser.parse_args()

    path = args.workbook or get_workbook_path()
    documents_dir = args.documents or get_documents_dir()

    ingest_workbook(path, documents_dir)


if __name__ == "__main__":
    main()