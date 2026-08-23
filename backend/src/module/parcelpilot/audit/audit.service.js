const pool = require("../../../config/db");

/**
 * Audit service — records action lifecycle events.
 */
const ensureTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS action_audit_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      conversation_id VARCHAR(100),
      action_type VARCHAR(100) NOT NULL,
      target_type VARCHAR(100),
      target_id VARCHAR(100),
      requested_by VARCHAR(100),
      status VARCHAR(50) NOT NULL,
      before_state JSONB,
      after_state JSONB,
      reason TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      completed_at TIMESTAMP WITH TIME ZONE,
      trace_id VARCHAR(100)
    );
  `);
};

const record = async ({
  conversationId,
  actionType,
  targetId,
  status,
  reason,
  traceId,
}) => {
  await ensureTable();
  await pool.query(
    `INSERT INTO action_audit_logs
      (conversation_id, action_type, target_id, status, reason, trace_id, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
    [conversationId || null, actionType, targetId || null, status, reason || null, traceId || null]
  );
};

module.exports = { record, ensureTable };