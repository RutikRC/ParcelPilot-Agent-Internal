const ticketRepository = require("../repositories/ticket.repository");
const AppError = require("../../../utils/AppError");

/**
 * Ticket tool — agent-facing ticket lookup.
 */

/**
 * Get a ticket by ID.
 *
 * @param {object} params
 * @param {string} params.ticketId - The ticket identifier.
 * @returns {Promise<object>} The ticket record.
 */
const getTicket = async ({ ticketId }) => {
  if (!ticketId || typeof ticketId !== "string" || ticketId.trim().length === 0) {
    throw new AppError("ticketId is required", 400);
  }

  const ticket = await ticketRepository.getTicketById(ticketId);

  if (!ticket) {
    throw new AppError(`Ticket ${ticketId} not found`, 404);
  }

  return {
    ticketId: ticket.ticket_id,
    accountId: ticket.account_id,
    createdAt: ticket.created_at,
    status: ticket.status,
    subject: ticket.subject,
    description: ticket.description,
    channel: ticket.channel,
    assignedTo: ticket.assigned_to,
    lastCustomerMessageAt: ticket.last_customer_message_at,
    historicalResolution: ticket.historical_resolution,
  };
};

/**
 * Search tickets with optional filters.
 *
 * @param {object} params
 * @param {string} [params.accountId] - Filter by owning account.
 * @param {string} [params.status] - Filter by ticket status.
 * @param {string} [params.channel] - Filter by support channel.
 * @param {string} [params.assignedTo] - Filter by assigned support person.
 * @param {string} [params.search] - Free-text search on subject/description.
 * @param {number} [params.limit] - Maximum results (default: 20).
 * @returns {Promise<Array<object>>} Array of ticket records.
 */
const searchTickets = async ({
  accountId,
  status,
  channel,
  assignedTo,
  search,
  limit = 20,
} = {}) => {
  const tickets = await ticketRepository.searchTickets({
    accountId,
    status,
    channel,
    assignedTo,
    search,
    limit,
  });

  return tickets.map((ticket) => ({
    ticketId: ticket.ticket_id,
    accountId: ticket.account_id,
    createdAt: ticket.created_at,
    status: ticket.status,
    subject: ticket.subject,
    description: ticket.description,
    channel: ticket.channel,
    assignedTo: ticket.assigned_to,
    lastCustomerMessageAt: ticket.last_customer_message_at,
    historicalResolution: ticket.historical_resolution,
  }));
};

module.exports = {
  getTicket,
  searchTickets,
};