const pool = require("../../../config/db");
const AppError = require("../../../utils/AppError");

/**
 * Ticket repository — deterministic access to the tickets table.
 */

/**
 * Fetch a single ticket by ticket_id.
 *
 * @param {string} ticketId - The ticket identifier (e.g. "TICKET-1001").
 * @returns {Promise<object|null>} The ticket row, or null if not found.
 */
const getTicketById = async (ticketId) => {
  if (!ticketId || typeof ticketId !== "string" || ticketId.trim().length === 0) {
    throw new AppError("ticketId is required", 400);
  }

  const query = `
    SELECT
      ticket_id,
      account_id,
      created_at,
      status,
      subject,
      description,
      channel,
      assigned_to,
      last_customer_message_at,
      historical_resolution,
      ingested_at,
      updated_at
    FROM tickets
    WHERE ticket_id = $1;
  `;

  const { rows } = await pool.query(query, [ticketId]);
  return rows[0] || null;
};

/**
 * Search tickets with optional filters.
 *
 * @param {object} filters
 * @param {string} [filters.accountId] - Filter by owning account.
 * @param {string} [filters.status] - Filter by ticket status.
 * @param {string} [filters.channel] - Filter by support channel.
 * @param {string} [filters.assignedTo] - Filter by assigned support person.
 * @param {string} [filters.search] - Free-text search on subject/description.
 * @param {number} [filters.limit] - Maximum results (default: 20).
 * @returns {Promise<Array<object>>} Array of ticket rows.
 */
const searchTickets = async ({
  accountId,
  status,
  channel,
  assignedTo,
  search,
  limit = 20,
} = {}) => {
  const where = [];
  const values = [];

  if (accountId) {
    values.push(accountId);
    where.push(`account_id = $${values.length}`);
  }

  if (status) {
    values.push(status);
    where.push(`status = $${values.length}`);
  }

  if (channel) {
    values.push(channel);
    where.push(`channel = $${values.length}`);
  }

  if (assignedTo) {
    values.push(assignedTo);
    where.push(`assigned_to = $${values.length}`);
  }

  if (search) {
    const searchTerm = `%${search}%`;
    values.push(searchTerm, searchTerm);
    where.push(`(subject ILIKE $${values.length - 1} OR description ILIKE $${values.length})`);
  }

  const safeLimit = Math.min(Math.max(1, limit), 100);
  values.push(safeLimit);

  const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

  const query = `
    SELECT
      ticket_id,
      account_id,
      created_at,
      status,
      subject,
      description,
      channel,
      assigned_to,
      last_customer_message_at,
      historical_resolution,
      ingested_at,
      updated_at
    FROM tickets
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT $${values.length};
  `;

  const { rows } = await pool.query(query, values);
  return rows;
};

module.exports = {
  getTicketById,
  searchTickets,
};