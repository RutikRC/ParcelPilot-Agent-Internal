/**
 * ParcelPilot Assessment Data Repository
 *
 * Creates and manages the Phase 1 structured-data tables:
 *   - accounts
 *   - orders
 *   - tickets
 *   - assessment_dataset_metadata
 *
 * Follows the existing repository migration convention (MIGRATIONS array +
 * ensureTable) used by the document repositories.
 */

const pool = require("../../config/db");

const MIGRATIONS = [
  // -------------------------------------------------------------------------
  // accounts
  // -------------------------------------------------------------------------
  `CREATE TABLE IF NOT EXISTS accounts (
    account_id      VARCHAR(100) PRIMARY KEY,
    account_name    VARCHAR(500) NOT NULL,
    plan            VARCHAR(100),
    status          VARCHAR(50),
    csm             VARCHAR(200),
    contract_file   VARCHAR(500),
    premium_support BOOLEAN NOT NULL DEFAULT false,
    notes           TEXT,
    ingested_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
  );`,

  // -------------------------------------------------------------------------
  // orders
  // -------------------------------------------------------------------------
  `CREATE TABLE IF NOT EXISTS orders (
    order_id                 VARCHAR(100) PRIMARY KEY,
    account_id               VARCHAR(100) NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
    carrier                  VARCHAR(200),
    status                   VARCHAR(50),
    booked_at                TIMESTAMP WITH TIME ZONE,
    pickup_window_start      TIMESTAMP WITH TIME ZONE,
    pickup_window_end        TIMESTAMP WITH TIME ZONE,
    pickup_actual_at         TIMESTAMP WITH TIME ZONE,
    shipment_fee_inr         NUMERIC(14, 2),
    carrier_fault            BOOLEAN NOT NULL DEFAULT false,
    customer_fault           BOOLEAN NOT NULL DEFAULT false,
    cancellation_requested_at TIMESTAMP WITH TIME ZONE,
    notes                    TEXT,
    ingested_at              TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at               TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
  );`,

  // -------------------------------------------------------------------------
  // tickets
  // -------------------------------------------------------------------------
  `CREATE TABLE IF NOT EXISTS tickets (
    ticket_id                VARCHAR(100) PRIMARY KEY,
    account_id               VARCHAR(100) NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
    created_at               TIMESTAMP WITH TIME ZONE,
    status                   VARCHAR(50),
    subject                  VARCHAR(1000),
    description              TEXT,
    channel                  VARCHAR(100),
    assigned_to              VARCHAR(200),
    last_customer_message_at TIMESTAMP WITH TIME ZONE,
    historical_resolution    TEXT,
    ingested_at              TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at               TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
  );`,

  // -------------------------------------------------------------------------
  // assessment_dataset_metadata
  // -------------------------------------------------------------------------
  `CREATE TABLE IF NOT EXISTS assessment_dataset_metadata (
    id            SERIAL PRIMARY KEY,
    dataset_name  VARCHAR(500) NOT NULL,
    snapshot_at   TIMESTAMP WITH TIME ZONE NOT NULL,
    currency      VARCHAR(10) NOT NULL,
    source_file   VARCHAR(500) NOT NULL,
    created_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_assessment_dataset_name UNIQUE(dataset_name)
  );`,
  `ALTER TABLE assessment_dataset_metadata
    ALTER COLUMN snapshot_at TYPE TIMESTAMP WITH TIME ZONE
    USING snapshot_at::TIMESTAMP WITH TIME ZONE;`,

  // -------------------------------------------------------------------------
  // Indexes
  // -------------------------------------------------------------------------
  `CREATE INDEX IF NOT EXISTS idx_orders_account_id ON orders (account_id);`,
  `CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status);`,
  `CREATE INDEX IF NOT EXISTS idx_orders_pickup_window_end ON orders (pickup_window_end);`,
  `CREATE INDEX IF NOT EXISTS idx_tickets_account_id ON tickets (account_id);`,
  `CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets (status);`,
  `CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON tickets (created_at);`,
];

const ensureTable = async () => {
  for (const sql of MIGRATIONS) {
    await pool.query(sql);
  }
};

module.exports = {
  MIGRATIONS,
  ensureTable,
};