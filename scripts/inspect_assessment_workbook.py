"""
Inspect the ParcelPilot assessment workbook.

Reads the source workbook and reports:
  - workbook path
  - sheet names
  - row counts
  - column names
  - missing values
  - duplicate IDs
  - basic data types

This script NEVER modifies the workbook. It is read-only.
"""

from __future__ import annotations

import argparse
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from assessment.config import (  # noqa: E402
    ACCOUNTS_COLUMNS,
    ORDERS_COLUMNS,
    REQUIRED_SHEETS,
    TICKETS_COLUMNS,
    get_workbook_path,
)
from assessment.workbook import WorkbookError, get_sheet_names, read_sheet  # noqa: E402

PRIMARY_IDS = {
    "accounts": "account_id",
    "orders": "order_id",
    "tickets": "ticket_id",
}

EXPECTED_COLUMNS = {
    "accounts": ACCOUNTS_COLUMNS,
    "orders": ORDERS_COLUMNS,
    "tickets": TICKETS_COLUMNS,
}


def _is_missing(value) -> bool:
    return value is None or (isinstance(value, str) and value.strip() == "")


def _basic_type(value) -> str:
    if value is None:
        return "None"
    if isinstance(value, bool):
        return "bool"
    if isinstance(value, int):
        return "int"
    if isinstance(value, float):
        return "float"
    if isinstance(value, str):
        return "str"
    return type(value).__name__


def inspect_workbook(path: Path) -> None:
    print("=" * 70)
    print("ParcelPilot Assessment Workbook Inspection")
    print("=" * 70)
    print(f"Workbook path : {path}")
    print(f"Exists        : {path.exists()}")

    if not path.exists():
        print("\nERROR: Workbook not found. Place ParcelPilot_Assessment_Data.xlsx")
        print("       in data/assessment/workbook/ or set ASSESSMENT_WORKBOOK.")
        sys.exit(1)

    try:
        sheet_names = get_sheet_names(path)
    except WorkbookError as exc:
        print(f"\nERROR: {exc}")
        sys.exit(1)

    print(f"Sheet names   : {', '.join(sheet_names)}")
    print()

    missing_sheets = [s for s in REQUIRED_SHEETS if s not in sheet_names]
    if missing_sheets:
        print(f"WARNING: Missing required sheets: {', '.join(missing_sheets)}")
        print()

    for sheet_name in sheet_names:
        print("-" * 70)
        print(f"Sheet: {sheet_name}")
        print("-" * 70)

        try:
            records = read_sheet(path, sheet_name)
        except WorkbookError as exc:
            print(f"  ERROR: {exc}")
            continue

        print(f"  Row count (data rows): {len(records)}")

        if not records:
            print("  (no data rows)")
            continue

        # Column names from the first record
        columns = list(records[0].keys())
        print(f"  Columns ({len(columns)}): {', '.join(columns)}")

        # Missing values per column
        print("  Missing values per column:")
        for col in columns:
            missing = sum(1 for r in records if _is_missing(r.get(col)))
            print(f"    {col}: {missing}")

        # Duplicate IDs
        id_col = PRIMARY_IDS.get(sheet_name)
        if id_col and id_col in columns:
            ids = [str(r.get(id_col)) for r in records if not _is_missing(r.get(id_col))]
            dupes = {k: v for k, v in Counter(ids).items() if v > 1}
            if dupes:
                print(f"  Duplicate {id_col}:")
                for dup_id, count in dupes.items():
                    print(f"    {dup_id}: {count} occurrences")
            else:
                print(f"  Duplicate {id_col}: none")

        # Basic data types (from first non-missing value per column)
        print("  Basic data types (first non-missing value):")
        for col in columns:
            sample = next((r.get(col) for r in records if not _is_missing(r.get(col))), None)
            print(f"    {col}: {_basic_type(sample)}")

        # Expected columns check
        expected = EXPECTED_COLUMNS.get(sheet_name)
        if expected:
            missing_cols = [c for c in expected if c not in columns]
            extra_cols = [c for c in columns if c not in expected]
            if missing_cols:
                print(f"  WARNING: Missing expected columns: {', '.join(missing_cols)}")
            if extra_cols:
                print(f"  NOTE: Extra columns present: {', '.join(extra_cols)}")

        print()

    print("=" * 70)
    print("Inspection complete. The workbook was NOT modified.")
    print("=" * 70)


def main() -> None:
    parser = argparse.ArgumentParser(description="Inspect the ParcelPilot assessment workbook.")
    parser.add_argument(
        "--workbook",
        type=Path,
        default=None,
        help="Path to the workbook (default: data/assessment/workbook/ParcelPilot_Assessment_Data.xlsx)",
    )
    args = parser.parse_args()

    path = args.workbook or get_workbook_path()
    inspect_workbook(path)


if __name__ == "__main__":
    main()