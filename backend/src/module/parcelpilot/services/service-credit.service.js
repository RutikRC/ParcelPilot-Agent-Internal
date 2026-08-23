const AppError = require("../../../utils/AppError");
const logger = require("../../../utils/logger");

const orderRepository = require("../repositories/order.repository");
const accountRepository = require("../repositories/account.repository");
const agreementRepository = require("../repositories/agreement.repository");

/**
 * Service credit service — deterministic service credit calculation.
 *
 * The service credit decision is calculated from:
 *   - order facts (pickup timing, carrier_fault, customer_fault, shipment_fee)
 *   - account facts (plan, premium_support)
 *   - applicable customer agreement (if any)
 *   - current service-credit policy/SOP
 *
 * The LLM should select/use this tool, not calculate the credit itself.
 */

// Default service credit policy (from the current SOP).
// These are the DEFAULT values; customer agreements may override them.
const DEFAULT_SERVICE_CREDIT_POLICY = {
  // Credit is only applicable when the carrier is at fault.
  requireCarrierFault: true,
  // Credit is not applicable when the customer is at fault.
  excludeCustomerFault: true,
  // Credit percentage of shipment fee for carrier-fault delays.
  creditPercentage: 0.1, // 10%
  // Maximum credit as a percentage of shipment fee.
  maxCreditPercentage: 0.5, // 50%
  // Minimum delay (in minutes) to qualify for a credit.
  minDelayMinutes: 60,
  // Manager approval threshold (INR).
  managerApprovalThresholdInr: 5000,
};

// Customer-specific service credit overrides keyed by account_id.
// These come from the customer agreements and are deterministic.
const CUSTOMER_SERVICE_CREDIT_OVERRIDES = {
  // Northstar Logistics Enterprise Agreement:
  //   - Higher credit percentage for carrier-fault delays
  "ACCT-001": {
    creditPercentage: 0.15, // 15%
    maxCreditPercentage: 0.75, // 75%
    minDelayMinutes: 30,
  },
};

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
  const override = CUSTOMER_SERVICE_CREDIT_OVERRIDES[order.account_id];
  const policy = {
    ...DEFAULT_SERVICE_CREDIT_POLICY,
    ...(override || {}),
  };

  // 5. Evaluate eligibility
  const refTime = referenceTime ? new Date(referenceTime) : new Date();
  const pickupWindowEnd = order.pickup_window_end ? new Date(order.pickup_window_end) : null;
  const pickupActualAt = order.pickup_actual_at ? new Date(order.pickup_actual_at) : null;

  // Calculate pickup delay in minutes
  let delayMinutes = null;
  if (pickupWindowEnd && pickupActualAt) {
    delayMinutes = Math.floor(
      (pickupActualAt.getTime() - pickupWindowEnd.getTime()) / (60 * 1000)
    );
  } else if (pickupWindowEnd && !pickupActualAt && refTime > pickupWindowEnd) {
    // Pickup hasn't occurred yet but window has passed
    delayMinutes = Math.floor(
      (refTime.getTime() - pickupWindowEnd.getTime()) / (60 * 1000)
    );
  }

  // Determine eligibility
  let eligible = false;
  let creditInr = 0;
  let reason = "";
  let requiresManagerApproval = false;

  if (order.carrier_fault && order.customer_fault) {
    eligible = false;
    reason = "Both carrier and customer are at fault; service credit is not applicable.";
  } else if (policy.excludeCustomerFault && order.customer_fault) {
    eligible = false;
    reason = "Customer is at fault; service credit is not applicable.";
  } else if (policy.requireCarrierFault && !order.carrier_fault) {
    eligible = false;
    reason = "Carrier is not at fault; service credit is not applicable.";
  } else if (delayMinutes === null) {
    eligible = false;
    reason = "Unable to determine pickup delay; service credit cannot be calculated.";
  } else if (delayMinutes < policy.minDelayMinutes) {
    eligible = false;
    reason = `Pickup delay of ${delayMinutes} minutes is below the minimum threshold of ${policy.minDelayMinutes} minutes.`;
  } else {
    // Eligible for service credit
    eligible = true;

    // Calculate credit amount
    const shipmentFee = Number(order.shipment_fee_inr) || 0;
    const rawCredit = shipmentFee * policy.creditPercentage;
    const maxCredit = shipmentFee * policy.maxCreditPercentage;
    creditInr = Math.min(rawCredit, maxCredit);

    // Round to 2 decimal places
    creditInr = Math.round(creditInr * 100) / 100;

    reason = `Carrier-fault pickup delay of ${delayMinutes} minutes qualifies for a service credit of INR ${creditInr}.`;

    // Check manager approval threshold
    requiresManagerApproval = creditInr > policy.managerApprovalThresholdInr;
    if (requiresManagerApproval) {
      reason += ` This credit exceeds the manager approval threshold of INR ${policy.managerApprovalThresholdInr} and requires manager approval.`;
    }
  }

  const result = {
    orderId: order.order_id,
    accountId: order.account_id,
    accountName: account.account_name,
    orderStatus: order.status,
    carrier: order.carrier,
    pickupWindowEnd: order.pickup_window_end,
    pickupActualAt: order.pickup_actual_at,
    delayMinutes,
    carrierFault: order.carrier_fault,
    customerFault: order.customer_fault,
    shipmentFeeInr: Number(order.shipment_fee_inr) || 0,
    eligible,
    creditInr,
    creditPercentage: policy.creditPercentage,
    reason,
    requiresManagerApproval,
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

  logger.info("Service credit calculated", {
    orderId: order.order_id,
    eligible,
    creditInr,
    requiresManagerApproval,
    customerOverride: !!override,
  });

  return result;
};

module.exports = {
  DEFAULT_SERVICE_CREDIT_POLICY,
  CUSTOMER_SERVICE_CREDIT_OVERRIDES,
  calculateServiceCredit,
};