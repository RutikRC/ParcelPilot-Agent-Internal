const pool = require("../../../config/db");
const AppError = require("../../../utils/AppError");

/**
 * Order repository — deterministic access to the orders table.
 */

/**
 * Fetch a single order by order_id.
 *
 * @param {string} orderId - The order identifier (e.g. "ORD-1001").
 * @returns {Promise<object|null>} The order row, or null if not found.
 */
const getOrderById = async (orderId) => {
  if (!orderId || typeof orderId !== "string" || orderId.trim().length === 0) {
    throw new AppError("orderId is required", 400);
  }

  const query = `
    SELECT
      order_id,
      account_id,
      carrier,
      status,
      booked_at,
      pickup_window_start,
      pickup_window_end,
      pickup_actual_at,
      shipment_fee_inr,
      carrier_fault,
      customer_fault,
      cancellation_requested_at,
      notes,
      ingested_at,
      updated_at
    FROM orders
    WHERE order_id = $1;
  `;

  const { rows } = await pool.query(query, [orderId]);
  return rows[0] || null;
};

/**
 * List orders, optionally filtered by account and/or status.
 *
 * @param {object} filters
 * @param {string} [filters.accountId] - Filter by owning account.
 * @param {string} [filters.status] - Filter by order status.
 * @param {string} [filters.carrier] - Filter by carrier.
 * @returns {Promise<Array<object>>} Array of order rows.
 */
const listOrders = async ({ accountId, status, carrier } = {}) => {
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

  if (carrier) {
    values.push(carrier);
    where.push(`carrier = $${values.length}`);
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

  const query = `
    SELECT
      order_id,
      account_id,
      carrier,
      status,
      booked_at,
      pickup_window_start,
      pickup_window_end,
      pickup_actual_at,
      shipment_fee_inr,
      carrier_fault,
      customer_fault,
      cancellation_requested_at,
      notes,
      ingested_at,
      updated_at
    FROM orders
    ${whereClause}
    ORDER BY order_id;
  `;

  const { rows } = await pool.query(query, values);
  return rows;
};

module.exports = {
  getOrderById,
  listOrders,
};