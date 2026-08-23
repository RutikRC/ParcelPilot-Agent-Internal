"""
Shared workbook reading helpers for the ParcelPilot assessment scripts.

Provides deterministic loading of the source workbook sheets (README,
accounts, orders, tickets) without modifying the source file.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List

import openpyxl


class WorkbookError(Exception):
    """Raised when the workbook cannot be read or is malformed."""


def load_workbook(path: Path):
    """Load the workbook in read-only mode.

    Args:
        path: Path to the .xlsx workbook.

    Returns:
        An openpyxl Workbook object.

    Raises:
        WorkbookError: If the file does not exist or cannot be opened.
    """
    if not path.exists():
        raise WorkbookError(f"Workbook not found: {path}")

    try:
        return openpyxl.load_workbook(path, read_only=True, data_only=True)
    except Exception as exc:  # noqa: BLE001 - surface any openpyxl failure
        raise WorkbookError(f"Failed to open workbook {path}: {exc}") from exc


def get_sheet_names(path: Path) -> List[str]:
    """Return the sheet names in the workbook."""
    workbook = load_workbook(path)
    try:
        return list(workbook.sheetnames)
    finally:
        workbook.close()


def read_sheet(path: Path, sheet_name: str) -> List[Dict[str, Any]]:
    """Read a sheet into a list of row dicts keyed by the header row.

    The first non-empty row is treated as the header. Blank rows are skipped.
    Column names are used exactly as they appear in the source workbook.

    Args:
        path: Path to the .xlsx workbook.
        sheet_name: Name of the sheet to read.

    Returns:
        A list of dicts, one per data row.

    Raises:
        WorkbookError: If the sheet is missing or has no header row.
    """
    workbook = load_workbook(path)
    try:
        if sheet_name not in workbook.sheetnames:
            raise WorkbookError(
                f"Sheet '{sheet_name}' not found in workbook {path}"
            )

        sheet = workbook[sheet_name]
        rows = sheet.iter_rows(values_only=True)

        header = None
        records: List[Dict[str, Any]] = []

        for row in rows:
            if row is None:
                continue

            # Skip fully-empty rows
            if all(cell is None or str(cell).strip() == "" for cell in row):
                continue

            if header is None:
                header = [str(cell).strip() if cell is not None else "" for cell in row]
                continue

            record = {}
            for idx, column in enumerate(header):
                value = row[idx] if idx < len(row) else None
                record[column] = value
            records.append(record)

        if header is None:
            raise WorkbookError(f"Sheet '{sheet_name}' has no header row")

        return records
    finally:
        workbook.close()