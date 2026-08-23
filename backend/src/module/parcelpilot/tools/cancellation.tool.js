const cancellationService = require("../services/cancellation.service");
const AppError = require("../../../utils/AppError");

/**
 * Cancellation tool — agent-facing cancellation evaluation.
 */

/**
 * Evaluate cancellation eligibility for an order.
 *
 * @param {object} params
 * @param {string} params.orderId - The order identifier.
 * @param {string|Date} [params.referenceTime] - The reference time (defaults to now).
 * @returns {Promise<object>} Cancellation evaluation result.
 */
const evaluateCancellation = async ({ orderId, referenceTime }) => {
  if (!orderId || typeof orderId !== "string" || orderId.trim().length === 0) {
    throw new AppError("orderId is required for cancellation evaluation", 400);
  }

  return cancellationService.evaluateCancellation({ orderId, referenceTime });
};

module.exports = {
  evaluateCancellation,
};