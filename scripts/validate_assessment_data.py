"""
Validate the ParcelPilot assessment workbook.

Checks:
  - Required sheets: README, accounts, orders, tickets
  - Required columns per sheet
  - Primary IDs: accounts.account_id, orders.order_id, tickets.ticket_id
  - Foreign keys: orders.account_id -> accounts.account_id,
                  tickets.account_id -> accounts.account_id
  - Contract files: accounts.contract_file -> supplied PDF files
  - Timestamp fields
  - Boolean fields
  - Numeric fields

The validator FAILS clearly when invalid data is found. It never silently
drops invalid records.
"""

from __future__ import annotations

import argparse
import sys
from datetime import date, datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

sys.path.insert(0, str(Path(__file__).resolve().parent))

from assessment.config import (  # noqa: E402
    ACCOUNTS_COLUMNS,
    DOCUMENT_CLASSIFICATIONS,
    ORDERS_COLUMNS,
    REQUIRED_SHEETS,
    TICKETS_COLUMNS,
    get_documents_dir,
    get_workbook_path,
)
from assessment.workbook import WorkbookError, get_sheet_names, read_sheet  # noqa: E402

# ---------------------------------------------------------------------------
# Field type definitions
# ---------------------------------------------------------------------------

TIMESTAMP_FIELDS = {
    "orders": ["booked_at", "pickup_window_start", "pickup_window_end", "pickup_actual_at", "cancellation_requested_at"],
    "tickets": ["created_at", "last_customer_message_at"],
}

BOOLEAN_FIELDS = {
    "accounts": ["premium_support"],
    "orders": ["carrier_fault", "customer_fault"],
}

NUMERIC_FIELDS = {
    "orders": ["shipment_fee_inr"],
}

PRIMARY_IDS = {
    "accounts": "account_id",
    "orders": "order_id",
    "tickets": "ticket_id",
}

FOREIGN_KEYS = {
    "orders": ("account_id", "accounts", "account_id"),
    "tickets": ("account_id", "accounts", "account_id"),
}

EXPECTED_COLUMNS = {
    "accounts": ACCOUNTS_COLUMNS,
    "orders": ORDERS_COLUMNS,
    "tickets": TICKETS_COLUMNS,
}


# ---------------------------------------------------------------------------
# Validation helpers
# ---------------------------------------------------------------------------


class ValidationError(Exception):
    """Raised when the workbook fails validation."""


def _is_missing(value) -> bool:
    return value is None or (isinstance(value, str) and value.strip() == "")


def _parse_timestamp(value) -> Optional[datetime]:
    """Try to parse a timestamp value from Excel (datetime, date, or string)."""
    if _is_missing(value):
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, date):
        return datetime.combine(value, datetime.min.time())
    if isinstance(value, str):
        for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%d", "%d-%m-%Y %H:%M:%S", "%d-%m-%Y"):
            try:
                return datetime.strptime(value.strip(), fmt)
            except ValueError:
                continue
        return None
    return None


def _parse_bool(value) -> Optional[bool]:
    if _is_missing(value):
        return None
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)) and value in (0, 1):
        return bool(value)
    if isinstance(value, str):
        lowered = value.strip().lower()
        if lowered in ("true", "yes", "y", "1"):
            return True
        if lowered in ("false", "no", "n", "0"):
            return False
        return None
    return None


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


def _check_required_sheets(path: Path) -> List[str]:
    sheet_names = get_sheet_names(path)
    missing = [s for s in REQUIRED_SHEETS if s not in sheet_names]
    return missing


def _check_columns(records: List[Dict[str, Any]], sheet_name: str) -> List[str]:
    columns = list(records[0].keys()) if records else []
    expected = EXPECTED_COLUMNS.get(sheet_name, [])
    return [c for c in expected if c not in columns]


def _check_duplicate_ids(records: List[Dict[str, Any]], sheet_name: str) -> List[str]:
    id_col = PRIMARY_IDS.get(sheet_name)
    if not id_col:
        return []
    seen = set()
    dupes = []
    for record in records:
        value = record.get(id_col)
        if _is_missing(value):
            continue
        key = str(value).strip()
        if key in seen:
            dupes.append(key)
        seen.add(key)
    return dupes


def _check_missing_required(records: List[Dict[str, Any]], sheet_name: str) -> List[str]:
    """Check that primary IDs and foreign keys are not missing."""
    problems = []
    id_col = PRIMARY_IDS.get(sheet_name)
    for idx, record in enumerate(records, start=2):  # +1 for header, +1 for 1-based
        if id_col and _is_missing(record.get(id_col)):
            problems.append(f"{sheet_name} row {idx}: missing {id_col}")
        fk = FOREIGN_KEYS.get(sheet_name)
        if fk and _is_missing(record.get(fk[0])):
            problems.append(f"{sheet_name} row {idx}: missing {fk[0]}")
    return problems


def _check_timestamps(records: List[Dict[str, Any]], sheet_name: str) -> List[str]:
    problems = []
    fields = TIMESTAMP_FIELDS.get(sheet_name, [])
    for idx, record in enumerate(records, start=2):
        for field in fields:
            value = record.get(field)
            if _is_missing(value):
                continue
            if _parse_timestamp(value) is None:
                problems.append(f"{sheet_name} row {idx}: {field} is not a valid timestamp: {value!r}")
    return problems


def _check_booleans(records: List[Dict[str, Any]], sheet_name: str) -> List[str]:
    problems = []
    fields = BOOLEAN_FIELDS.get(sheet_name, [])
    for idx, record in enumerate(records, start=2):
        for field in fields:
            value = record.get(field)
            if _is_missing(value):
                continue
            if _parse_bool(value) is None:
                problems.append(f"{sheet_name} row {idx}: {field} is not a valid boolean: {value!r}")
    return problems


def _check_numbers(records: List[Dict[str, Any]], sheet_name: str) -> List[str]:
    problems = []
    fields = NUMERIC_FIELDS.get(sheet_name, [])
    for idx, record in enumerate(records, start=2):
        for field in fields:
            value = record.get(field)
            if _is_missing(value):
                continue
            if _parse_number(value) is None:
                problems.append(f"{sheet_name} row {idx}: {field} is not a valid number: {value!r}")
    return problems


def _check_foreign_keys(records: List[Dict[str, Any]], sheet_name: str, account_ids: set) -> List[str]:
    problems = []
    fk = FOREIGN_KEYS.get(sheet_name)
    if not fk:
        return problems
    fk_col, _, target_col = fk
    for idx, record in enumerate(records, start=2):
        value = record.get(fk_col)
        if _is_missing(value):
            continue
        if str(value).strip() not in account_ids:
            problems.append(
                f"{sheet_name} row {idx}: {fk_col} '{value}' does not reference a valid {target_col}"
            )
    return problems


def _check_contract_files(records: List[Dict[str, Any]], documents_dir: Path) -> List[str]:
    problems = []
    for idx, record in enumerate(records, start=2):
        contract_file = record.get("contract_file")
        if _is_missing(contract_file):
            continue
        filename = Path(str(contract_file).strip()).name
        if filename not in DOCUMENT_CLASSIFICATIONS:
            problems.append(
                f"accounts row {idx}: contract_file '{contract_file}' is not a known supplied PDF"
            )
            continue
        pdf_path = documents_dir / filename
        if not pdf_path.exists():
            problems.append(
                f"accounts row {idx}: contract_file '{filename}' not found in {documents_dir}"
            )
    return problems


# ---------------------------------------------------------------------------
# Main validation
# ---------------------------------------------------------------------------


def validate_workbook(path: Path, documents_dir: Path) -> List[str]:
    """Run all validation checks and return a list of problems (empty = valid)."""
    problems: List[str] = []

    if not path.exists():
        return [f"Workbook not found: {path}"]

    # 1. Required sheets
    missing_sheets = _check_required_sheets(path)
    for sheet in missing_sheets:
        problems.append(f"Missing required sheet: {sheet}")

    # If sheets are missing, we cannot validate further
    if missing_sheets:
        return problems

    # 2. Read sheets
    try:
        read_sheet(path, "README")
        accounts = read_sheet(path, "accounts")
        orders = read_sheet(path, "orders")
        tickets = read_sheet(path, "tickets")
    except WorkbookError as exc:
        return [str(exc)]

    # 3. Columns
    for sheet_name, records in (("accounts", accounts), ("orders", orders), ("tickets", tickets)):
        missing_cols = _check_columns(records, sheet_name)
        for col in missing_cols:
            problems.append(f"{sheet_name}: missing required column: {col}")

    # 4. Duplicate IDs
    for sheet_name, records in (("accounts", accounts), ("orders", orders), ("tickets", tickets)):
        dupes = _check_duplicate_ids(records, sheet_name)
        for dup in dupes:
            problems.append(f"{sheet_name}: duplicate {PRIMARY_IDS[sheet_name]}: {dup}")

    # 5. Missing required values (primary IDs + foreign keys)
    for sheet_name, records in (("accounts", accounts), ("orders", orders), ("tickets", tickets)):
        problems.extend(_check_missing_required(records, sheet_name))

    # 6. Timestamps
    for sheet_name, records in (("orders", orders), ("tickets", tickets)):
        problems.extend(_check_timestamps(records, sheet_name))

    # 7. Booleans
    for sheet_name, records in (("accounts", accounts), ("orders", orders)):
        problems.extend(_check_booleans(records, sheet_name))

    # 8. Numeric
    for sheet_name, records in (("orders", orders),):
        problems.extend(_check_numbers(records, sheet_name))

    # 9. Foreign keys
    account_ids = {str(r.get("account_id")).strip() for r in accounts if not _is_missing(r.get("account_id"))}
    problems.extend(_check_foreign_keys(orders, "orders", account_ids))
    problems.extend(_check_foreign_keys(tickets, "tickets", account_ids))

    # 10. Contract files
    problems.extend(_check_contract_files(accounts, documents_dir))

    return problems


def main() -> None:
    parser = argparse.ArgumentParser(description="Validate the ParcelPilot assessment workbook.")
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

    print("=" * 70)
    print("ParcelPilot Assessment Data Validation")
    print("=" * 70)
    print(f"Workbook  : {path}")
    print(f"Documents : {documents_dir}")
    print()

    problems = validate_workbook(path, documents_dir)

    if problems:
        print(f"VALIDATION FAILED: {len(problems)} problem(s) found")
        print("-" * 70)
        for problem in problems:
            print(f"  - {problem}")
        print("-" * 70)
        sys.exit(1)

    print("VALIDATION PASSED: all checks succeeded")
    print("=" * 70)


if __name__ == "__main__":
    main()