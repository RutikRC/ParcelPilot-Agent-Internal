const pool = require("../../../config/db");
const cancellationService = require("../services/cancellation.service");
const { ACTION_TYPES } = require("./action.types");

/**
 * CANCEL_ORDER action — deterministic mutation of an order to CANCELLED.
 */
module.exports = {
  type: ACTION_TYPES.CANCEL_ORDER,
  metadata: {
    name: "CANCEL_ORDER",
    description: "Cancel an eligible order",
    requiresConfirmation: true,
  },
  validate: async (params) => {
    if (!params || !params.orderId) {
      return { valid: false, reason: "orderId is required" };
    }
    const decision = await cancellationService.evaluateCancellation({ orderId: params.orderId });
    if (!decision.eligible) {
      return { valid: false, reason: decision.reason, decision };
    }
    return { valid: true, decision };
  },
  execute: async (params) => {
    const orderId = params.orderId;
    // Idempotency: if already cancelled, return early.
    const existing = await pool.query(
      "SELECT status FROM orders WHERE order_id = $1", [orderId]
    );
    if (existing.rows[0] && existing.rows[0].status === "CANCELLED") {
      return { orderId, alreadyCompleted: true, status: "CANCELLED" };
    }
    const result = await pool.query(
      `UPDATE orders SET status = 'CANCELLED', updated_at = CURRENT_TIMESTAMP
       WHERE order_id = $1 RETURNING *`, [orderId]
    );
    return { orderId, alreadyCompleted: false, order: result.rows[0] };
  },
};