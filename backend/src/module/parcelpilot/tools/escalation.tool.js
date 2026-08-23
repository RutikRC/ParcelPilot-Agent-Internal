const escalationService = require("../services/escalation.service");
const AppError = require("../../../utils/AppError");

/**
 * Escalation tool — agent-facing escalation evaluation.
 */

/**
 * Evaluate escalation requirements for a ticket.
 *
 * @param {object} params
 * @param {string} params.ticketId - The ticket identifier.
 * @param {string} [params.priority] - The ticket priority (P1-P4). If not provided, inferred.
 * @param {string|Date} [params.referenceTime] - The reference time (defaults to now).
 * @returns {Promise<object>} Escalation evaluation result.
 */
const evaluateEscalation = async ({ ticketId, priority, referenceTime }) => {
  if (!ticketId || typeof ticketId !== "string" || ticketId.trim().length === 0) {
    throw new AppError("ticketId is required for escalation evaluation", 400);
  }

  return escalationService.evaluateEscalation({ ticketId, priority, referenceTime });
};

module.exports = {
  evaluateEscalation,
};