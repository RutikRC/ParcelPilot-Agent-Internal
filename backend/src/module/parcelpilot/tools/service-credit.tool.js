const serviceCreditService = require("../services/service-credit.service");
const AppError = require("../../../utils/AppError");

/**
 * Service credit tool — agent-facing service credit calculation.
 */

/**
 * Calculate service credit eligibility for an order.
 *
 * @param {object} params
 * @param {string} params.orderId - The order identifier.
 * @param {string|Date} [params.referenceTime] - The reference time (defaults to now).
 * @returns {Promise<object>} Service credit evaluation result.
 */
const calculateServiceCredit = async ({ orderId, referenceTime }) => {
  if (!orderId || typeof orderId !== "string" || orderId.trim().length === 0) {
    throw new AppError("orderId is required for service credit calculation", 400);
  }

  return serviceCreditService.calculateServiceCredit({ orderId, referenceTime });
};

module.exports = {
  calculateServiceCredit,
};