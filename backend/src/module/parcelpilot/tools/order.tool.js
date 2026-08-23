const orderRepository = require("../repositories/order.repository");
const AppError = require("../../../utils/AppError");

/**
 * Order tool — agent-facing order lookup.
 */

/**
 * Get an order by ID.
 *
 * @param {object} params
 * @param {string} params.orderId - The order identifier.
 * @returns {Promise<object>} The order record.
 */
const getOrder = async ({ orderId }) => {
  if (!orderId || typeof orderId !== "string" || orderId.trim().length === 0) {
    throw new AppError("orderId is required", 400);
  }

  const order = await orderRepository.getOrderById(orderId);

  if (!order) {
    throw new AppError(`Order ${orderId} not found`, 404);
  }

  return {
    orderId: order.order_id,
    accountId: order.account_id,
    carrier: order.carrier,
    status: order.status,
    bookedAt: order.booked_at,
    pickupWindowStart: order.pickup_window_start,
    pickupWindowEnd: order.pickup_window_end,
    pickupActualAt: order.pickup_actual_at,
    shipmentFeeInr: Number(order.shipment_fee_inr) || 0,
    carrierFault: order.carrier_fault,
    customerFault: order.customer_fault,
    cancellationRequestedAt: order.cancellation_requested_at,
    notes: order.notes,
  };
};

/**
 * List orders with optional filters.
 *
 * @param {object} params
 * @param {string} [params.accountId] - Filter by owning account.
 * @param {string} [params.status] - Filter by order status.
 * @param {string} [params.carrier] - Filter by carrier.
 * @returns {Promise<Array<object>>} Array of order records.
 */
const listOrders = async ({ accountId, status, carrier } = {}) => {
  const orders = await orderRepository.listOrders({
    accountId,
    status,
    carrier,
  });

  return orders.map((order) => ({
    orderId: order.order_id,
    accountId: order.account_id,
    carrier: order.carrier,
    status: order.status,
    bookedAt: order.booked_at,
    pickupWindowStart: order.pickup_window_start,
    pickupWindowEnd: order.pickup_window_end,
    pickupActualAt: order.pickup_actual_at,
    shipmentFeeInr: Number(order.shipment_fee_inr) || 0,
    carrierFault: order.carrier_fault,
    customerFault: order.customer_fault,
    cancellationRequestedAt: order.cancellation_requested_at,
    notes: order.notes,
  }));
};

module.exports = {
  getOrder,
  listOrders,
};