const slaService = require("../services/sla.service");
const accountRepository = require("../repositories/account.repository");
const ticketRepository = require("../repositories/ticket.repository");
const AppError = require("../../../utils/AppError");

/**
 * SLA tool — agent-facing SLA calculation.
 */

/**
 * Calculate SLA status for a ticket.
 *
 * @param {object} params
 * @param {string} params.ticketId - The ticket identifier.
 * @param {string} [params.priority] - The ticket priority (P1-P4). If not provided, inferred.
 * @param {string|Date} [params.referenceTime] - The reference time (defaults to now).
 * @returns {Promise<object>} SLA calculation result.
 */
const calculateSlaStatus = async ({ ticketId, priority, referenceTime }) => {
  if (!ticketId || typeof ticketId !== "string" || ticketId.trim().length === 0) {
    throw new AppError("ticketId is required for SLA calculation", 400);
  }

  // 1. Fetch the ticket
  const ticket = await ticketRepository.getTicketById(ticketId);
  if (!ticket) {
    throw new AppError(`Ticket ${ticketId} not found`, 404);
  }

  // 2. Fetch the account
  const account = await accountRepository.getAccountById(ticket.account_id);
  if (!account) {
    throw new AppError(`Account ${ticket.account_id} not found`, 404);
  }

  // 3. Determine priority (explicit or inferred)
  const effectivePriority = priority || slaService.inferPriority(ticket);

  // 4. Calculate SLA
  const sla = await slaService.calculateSla({
    account,
    priority: effectivePriority,
    createdAt: ticket.created_at,
    referenceTime,
  });

  return {
    ticketId: ticket.ticket_id,
    subject: ticket.subject,
    status: ticket.status,
    ...sla,
  };
};

/**
 * Evaluate SLA risk for a list of tickets.
 *
 * @param {object} params
 * @param {string} [params.accountId] - Filter by account.
 * @param {string} [params.status] - Filter by ticket status.
 * @param {string|Date} [params.referenceTime] - The reference time.
 * @param {number} [params.limit] - Maximum results (default: 20).
 * @returns {Promise<Array<object>>} Array of SLA evaluation results.
 */
const evaluateSlaRisk = async ({ accountId, status, referenceTime, limit = 20 } = {}) => {
  const tickets = await ticketRepository.searchTickets({
    accountId,
    status,
    limit,
  });

  if (tickets.length === 0) {
    return [];
  }

  // Group tickets by account for SLA calculation
  const results = [];
  const accountCache = {};

  for (const ticket of tickets) {
    let account = accountCache[ticket.account_id];
    if (!account) {
      account = await accountRepository.getAccountById(ticket.account_id);
      accountCache[ticket.account_id] = account;
    }

    if (!account) {
      continue;
    }

    const priority = slaService.inferPriority(ticket);
    const sla = await slaService.calculateSla({
      account,
      priority,
      createdAt: ticket.created_at,
      referenceTime,
    });

    results.push({
      ticketId: ticket.ticket_id,
      subject: ticket.subject,
      status: ticket.status,
      accountId: ticket.account_id,
      ...sla,
    });
  }

  return results;
};

module.exports = {
  calculateSlaStatus,
  evaluateSlaRisk,
};