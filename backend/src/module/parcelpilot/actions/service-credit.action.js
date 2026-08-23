const pool = require("../../../config/db");
const serviceCreditService = require("../services/service-credit.service");
const { ACTION_TYPES } = require("./action.types");

/**
 * ISSUE_SERVICE_CREDIT action — deterministic service-credit mutation.
 * Uses the deterministic service-credit result as authoritative. Never
 * accepts an arbitrary credit amount from the LLM/user.
 */
module.exports = {
  type: ACTION_TYPES.ISSUE_SERVICE_CREDIT,
  metadata: {
    name: "ISSUE_SERVICE_CREDIT",
    description: "Issue a service credit for an eligible order",
    requiresConfirmation: true,
  },
  validate: async (params) => {
    if (!params || !params.orderId) {
      return { valid: false, reason: "orderId is required" };
    }
    const decision = await serviceCreditService.calculateServiceCredit({ orderId: params.orderId });
    if (!decision.eligible) {
      return { valid: false, reason: decision.reason, decision };
    }
    if (decision.requiresManagerApproval) {
      return { valid: false, reason: decision.reason, requiresManagerApproval: true, decision };
    }
    return { valid: true, decision };
  },
  execute: async (params) => {
    const orderId = params.orderId;
    // Re-run deterministic evaluation immediately before mutation.
    const decision = await serviceCreditService.calculateServiceCredit({ orderId: params.orderId });
    if (!decision.eligible) {
      return { orderId, rejected: true, reason: decision.reason };
    }
    if (decision.requiresManagerApproval) {
      return { orderId, requiresManagerApproval: true, reason: decision.reason };
    }
    // Idempotency: if a credit has already been recorded, do not issue again.
    const existing = await pool.query(
      `SELECT 1 FROM service_credits WHERE order_id = $1 LIMIT 1`, [orderId]
    );
    if (existing.rows.length > 0) {
      return { orderId, alreadyCompleted: true, creditAmount: decision.creditInr, currency: "INR" };
    }
    // Insert the credit record.
    await pool.query(
      `INSERT INTO service_credits (order_id, credit_amount_inr, status, created_at)
       VALUES ($1, $2, 'ISSUED', CURRENT_TIMESTAMP)`,
      [orderId, decision.creditInr]
    );
    return {
      success: true,
      orderId,
      alreadyCompleted: false,
      creditAmount: decision.creditInr,
      currency: "INR",
    };
  },
};