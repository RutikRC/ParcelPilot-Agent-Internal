"""
Shared configuration for the ParcelPilot assessment scripts.

Centralises the paths to the source workbook, the supplied PDFs, and the
PostgreSQL connection parameters so that the inspection, validation and
ingestion scripts stay deterministic and environment-driven.
"""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

# Repository root: <repo>/scripts/assessment/config.py -> <repo>
REPO_ROOT = Path(__file__).resolve().parents[2]

# Reuse the backend connection configuration when scripts are run from WSL.
# Existing shell variables take precedence because override remains false.
load_dotenv(REPO_ROOT / "backend" / ".env", override=False)

DATA_DIR = REPO_ROOT / "data"
ASSESSMENT_DIR = DATA_DIR / "assessment"
WORKBOOK_DIR = ASSESSMENT_DIR / "workbook"
DOCUMENTS_DIR = ASSESSMENT_DIR / "documents"

DEFAULT_WORKBOOK_PATH = WORKBOOK_DIR / "ParcelPilot_Assessment_Data.xlsx"
DEFAULT_DOCUMENTS_DIR = DOCUMENTS_DIR

# ---------------------------------------------------------------------------
# Dataset metadata (stored as data, not scattered through the application)
# ---------------------------------------------------------------------------

DATASET_NAME = "ParcelPilot Assessment Data"
DATASET_SNAPSHOT_AT = "2026-08-16 11:00 Asia/Kolkata"
DATASET_CURRENCY = "INR"

# ---------------------------------------------------------------------------
# Expected workbook sheets and columns
# ---------------------------------------------------------------------------

REQUIRED_SHEETS = ["README", "accounts", "orders", "tickets"]

ACCOUNTS_COLUMNS = [
    "account_id",
    "account_name",
    "plan",
    "status",
    "csm",
    "contract_file",
    "premium_support",
    "notes",
]

ORDERS_COLUMNS = [
    "order_id",
    "account_id",
    "carrier",
    "status",
    "booked_at",
    "pickup_window_start",
    "pickup_window_end",
    "pickup_actual_at",
    "shipment_fee_inr",
    "carrier_fault",
    "customer_fault",
    "cancellation_requested_at",
    "notes",
]

TICKETS_COLUMNS = [
    "ticket_id",
    "account_id",
    "created_at",
    "status",
    "subject",
    "description",
    "channel",
    "assigned_to",
    "last_customer_message_at",
    "historical_resolution",
]

# ---------------------------------------------------------------------------
# Supplied PDF documents and their classification
# ---------------------------------------------------------------------------

# document_type / document_status classification for the six supplied PDFs.
# account_id is intentionally NOT hard-coded here; it is resolved from the
# workbook's accounts sheet via the contract_file column.
DOCUMENT_CLASSIFICATIONS = {
    "01_Support_Policy_v3_CURRENT.pdf": {
        "document_type": "support_policy",
        "document_status": "current",
    },
    "02_Support_Policy_v2_DEPRECATED.pdf": {
        "document_type": "support_policy",
        "document_status": "deprecated",
    },
    "03_Cancellation_and_Service_Credit_SOP_v4.pdf": {
        "document_type": "operational_sop",
        "document_status": "current",
    },
    "04_Product_Operations_Guide_and_Known_Issues.pdf": {
        "document_type": "product_operations",
        "document_status": "current",
    },
    "05_Northstar_Logistics_Enterprise_Agreement.pdf": {
        "document_type": "customer_agreement",
        "document_status": "current",
    },
    "06_LumenWorks_Service_Agreement.pdf": {
        "document_type": "customer_agreement",
        "document_status": "current",
    },
}

# ---------------------------------------------------------------------------
# PostgreSQL connection (environment-driven, no hard-coded credentials)
# ---------------------------------------------------------------------------


def get_db_config() -> dict:
    """Return the PostgreSQL connection parameters from the environment.

    Supports either a full DATABASE_URL or individual DB_* variables,
    mirroring the backend's db.js configuration.
    """
    return {
        "database_url": os.getenv("DATABASE_URL"),
        "host": os.getenv("DB_HOST", "localhost"),
        "port": int(os.getenv("DB_PORT", "5432")),
        "database": os.getenv("DB_NAME", "postgres"),
        "user": os.getenv("DB_USER", "postgres"),
        "password": os.getenv("DB_PASSWORD"),
    }


def get_workbook_path() -> Path:
    """Return the workbook path, overridable via ASSESSMENT_WORKBOOK env var."""
    override = os.getenv("ASSESSMENT_WORKBOOK")
    if override:
        return Path(override)
    return DEFAULT_WORKBOOK_PATH


def get_documents_dir() -> Path:
    """Return the documents directory, overridable via ASSESSMENT_DOCUMENTS env var."""
    override = os.getenv("ASSESSMENT_DOCUMENTS")
    if override:
        return Path(override)
    return DEFAULT_DOCUMENTS_DIR