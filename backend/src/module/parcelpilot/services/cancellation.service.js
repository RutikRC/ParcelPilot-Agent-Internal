const AppError = require("../../../utils/AppError");
const logger = require("../../../utils/logger");

const orderRepository = require("../repositories/order.repository");
const accountRepository = require("../repositories/account.repository");
const agreementRepository = require("../repositories/agreement.repository");

/**
 * Cancellation service — deterministic cancellation evaluation.
 *
 * The cancellation decision is calculated from:
 *   - order facts (status, pickup window, cancellation_requested_at)
 *   - account facts (plan, premium_support)
 *   - applicable customer agreement (if any)
 *   - current cancellation policy/SOP
 *
 * The LLM should select/use this tool, not calculate the fee itself.
 */

// Default cancellation policy (from the current SOP).
// These are the DEFAULT values; customer agreements may override them.
const DEFAULT_CANCELLATION_POLICY = {
  // Cancellation after 30 minutes from booking incurs a fee.
  freeCancellationWindowMinutes: 30,
  cancellationFeeInr: 250,
  // Cancellation is only allowed before pickup.
  allowedStatuses: ["BOOKED", "SCHEDULED", "PENDING"],
};

// Customer-specific cancellation overrides keyed by account_id.
// These come from the customer agreements and are deterministic.
const CUSTOMER_CANCELLATION_OVERRIDES = {
  // Northstar Logistics Enterprise Agreement:
  //   - BOOKED + before pickup → no cancellation fee
  "ACCT-001": {
    freeCancellationWindowMinutes: null, // no time-based fee for booked orders
    cancellationFeeInr: 0,
    allowedStatuses: ["BOOKED", "SCHEDULED", "PENDING"],
    noFeeBeforePickup: true,
  },
};

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

  // 1. Fetch the order
  const order = await orderRepository.getOrderById(orderId);
  if (!order) {
    throw new AppError(`Order ${orderId} not found`, 404);
  }

  // 2. Fetch the account
  const account = await accountRepository.getAccountById(order.account_id);
  if (!account) {
    throw new AppError(`Account ${order.account_id} not found`, 404);
  }

  // 3. Fetch the customer agreement (if any)
  const agreement = await agreementRepository.getAgreementByAccountId(order.account_id);

  // 4. Determine applicable policy
  const override = CUSTOMER_CANCELLATION_OVERRIDES[order.account_id];
  const policy = override || DEFAULT_CANCELLATION_POLICY;

  // 5. Evaluate eligibility
  const refTime = referenceTime ? new Date(referenceTime) : new Date();
  const bookedAt = order.booked_at ? new Date(order.booked_at) : null;
  const pickupWindowEnd = order.pickup_window_end ? new Date(order.pickup_window_end) : null;
  const cancellationRequestedAt = order.cancellation_requested_at
    ? new Date(order.cancellation_requested_at)
    : null;

  // Check if order status allows cancellation
  const statusAllowed = policy.allowedStatuses.includes(order.status);

  // Check if pickup has already occurred
  const pickupOccurred = !!order.pickup_actual_at;

  // Check if pickup window has passed
  const pickupWindowPassed = pickupWindowEnd && refTime > pickupWindowEnd;

  // Check if cancellation was already requested
  const alreadyRequested = !!cancellationRequestedAt;

  // Calculate time since booking
  let minutesSinceBooking = null;
  if (bookedAt) {
    minutesSinceBooking = Math.floor((refTime.getTime() - bookedAt.getTime()) / (60 * 1000));
  }

  // Determine eligibility
  let eligible = false;
  let feeInr = 0;
  let reason = "";

  if (alreadyRequested) {
    eligible = false;
    reason = "Cancellation has already been requested for this order.";
  } else if (pickupOccurred) {
    eligible = false;
    reason = "Pickup has already occurred; cancellation is not permitted.";
  } else if (pickupWindowPassed) {
    eligible = false;
    reason = "The pickup window has already passed; cancellation is not permitted.";
  } else if (!statusAllowed) {
    eligible = false;
    reason = `Order status '${order.status}' does not permit cancellation.`;
  } else {
    // Order is eligible for cancellation
    eligible = true;

    // Determine fee
    if (override && override.noFeeBeforePickup) {
      // Customer agreement: no fee before pickup
      feeInr = 0;
      reason = "Customer agreement waives cancellation fees for booked orders before pickup.";
    } else if (
      policy.freeCancellationWindowMinutes !== null &&
      minutesSinceBooking !== null &&
      minutesSinceBooking <= policy.freeCancellationWindowMinutes
    ) {
      // Within free cancellation window
      feeInr = 0;
      reason = `Cancellation within ${policy.freeCancellationWindowMinutes} minutes of booking is free.`;
    } else {
      // Standard cancellation fee applies
      feeInr = policy.cancellationFeeInr;
      reason = `Cancellation after ${policy.freeCancellationWindowMinutes} minutes incurs a fee of INR ${policy.cancellationFeeInr}.`;
    }
  }

  const result = {
    orderId: order.order_id,
    accountId: order.account_id,
    accountName: account.account_name,
    orderStatus: order.status,
    carrier: order.carrier,
    bookedAt: order.booked_at,
    pickupWindowStart: order.pickup_window_start,
    pickupWindowEnd: order.pickup_window_end,
    pickupActualAt: order.pickup_actual_at,
    cancellationRequestedAt: order.cancellation_requested_at,
    eligible,
    feeInr,
    reason,
    requiresConfirmation: eligible,
    customerOverride: !!override,
    agreementDocumentId: agreement ? agreement.documentId : null,
    agreementFilename: agreement ? agreement.filename : null,
    sources: [
      {
        type: "order",
        id: order.order_id,
      },
      {
        type: "account",
        id: account.account_id,
      },
      ...(agreement
        ? [
            {
              type: "customer_agreement",
              id: agreement.documentId,
              filename: agreement.filename,
            },
          ]
        : []),
    ],
  };

  logger.info("Cancellation evaluated", {
    orderId: order.order_id,
    eligible,
    feeInr,
    customerOverride: !!override,
  });

  return result;
};

module.exports = {
  DEFAULT_CANCELLATION_POLICY,
  CUSTOMER_CANCELLATION_OVERRIDES,
  evaluateCancellation,
};