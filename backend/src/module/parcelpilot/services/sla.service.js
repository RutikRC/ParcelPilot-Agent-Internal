const AppError = require("../../../utils/AppError");
const logger = require("../../../utils/logger");

/**
 * SLA service — deterministic SLA calculation.
 *
 * The SLA is calculated from:
 *   - customer account (plan, premium_support)
 *   - applicable customer agreement (if any)
 *   - ticket priority
 *   - ticket created_at
 *   - workbook snapshot time (reference time)
 *
 * The LLM should select/use this tool, not calculate SLA itself.
 */

// Default SLA targets in minutes by plan and priority.
// These are the DEFAULT values; customer agreements may override them.
const DEFAULT_SLA_TARGETS = {
  Enterprise: {
    P1: 30, // minutes
    P2: 120,
    P3: 480,
    P4: 1440,
  },
  Standard: {
    P1: 60,
    P2: 240,
    P3: 720,
    P4: 2880,
  },
  Basic: {
    P1: 120,
    P2: 480,
    P3: 1440,
    P4: 4320,
  },
};

// Premium support multiplier (reduces SLA target time).
const PREMIUM_SUPPORT_MULTIPLIER = 0.5;

// Default coverage hours (24x7 for premium, business hours otherwise).
const DEFAULT_COVERAGE = {
  premium: { startHour: 0, endHour: 24, days: [0, 1, 2, 3, 4, 5, 6] }, // 24x7
  standard: { startHour: 9, endHour: 18, days: [1, 2, 3, 4, 5] }, // Mon-Fri 9-6
};

// Customer-specific SLA overrides keyed by account_id.
// These come from the customer agreements and are deterministic.
const CUSTOMER_SLA_OVERRIDES = {
  // Northstar Logistics Enterprise Agreement: P1 → 15 minutes, 24x7
  "ACCT-001": {
    P1: 15,
    coverage: "premium",
  },
};

/**
 * Determine the applicable SLA target (in minutes) for a given account and priority.
 *
 * @param {object} account - The account row.
 * @param {string} priority - The ticket priority (P1-P4).
 * @returns {number} SLA target in minutes.
 */
const getSlaTargetMinutes = (account, priority) => {
  if (!account) {
    throw new AppError("Account is required for SLA calculation", 400);
  }

  const plan = account.plan || "Standard";
  const planTargets = DEFAULT_SLA_TARGETS[plan] || DEFAULT_SLA_TARGETS.Standard;

  // Check for customer-specific override
  const override = CUSTOMER_SLA_OVERRIDES[account.account_id];
  if (override && override[priority] !== undefined) {
    return override[priority];
  }

  let target = planTargets[priority] || planTargets.P3;

  // Apply premium support multiplier
  if (account.premium_support) {
    target = Math.round(target * PREMIUM_SUPPORT_MULTIPLIER);
  }

  return target;
};

/**
 * Determine the coverage window for a given account.
 *
 * @param {object} account - The account row.
 * @returns {object} Coverage window descriptor.
 */
const getCoverage = (account) => {
  if (!account) {
    return DEFAULT_COVERAGE.standard;
  }

  const override = CUSTOMER_SLA_OVERRIDES[account.account_id];
  if (override && override.coverage) {
    return DEFAULT_COVERAGE[override.coverage] || DEFAULT_COVERAGE.standard;
  }

  if (account.premium_support) {
    return DEFAULT_COVERAGE.premium;
  }

  return DEFAULT_COVERAGE.standard;
};

/**
 * Calculate the SLA deadline for a ticket.
 *
 * @param {object} params
 * @param {object} params.account - The account row.
 * @param {string} params.priority - The ticket priority (P1-P4).
 * @param {string|Date} params.createdAt - The ticket creation timestamp.
 * @param {string|Date} [params.referenceTime] - The reference time (defaults to now).
 * @returns {object} SLA calculation result.
 */
const calculateSla = async ({ account, priority, createdAt, referenceTime }) => {
  if (!account) {
    throw new AppError("Account is required for SLA calculation", 400);
  }

  if (!priority || !["P1", "P2", "P3", "P4"].includes(priority)) {
    throw new AppError("Priority must be one of P1, P2, P3, P4", 400);
  }

  if (!createdAt) {
    throw new AppError("createdAt is required for SLA calculation", 400);
  }

  const createdDate = new Date(createdAt);
  if (isNaN(createdDate.getTime())) {
    throw new AppError("Invalid createdAt timestamp", 400);
  }

  const refTime = referenceTime ? new Date(referenceTime) : new Date();
  if (isNaN(refTime.getTime())) {
    throw new AppError("Invalid referenceTime timestamp", 400);
  }

  const slaTargetMinutes = getSlaTargetMinutes(account, priority);
  const coverage = getCoverage(account);

  // Calculate SLA deadline by adding target minutes to creation time
  const slaDeadline = new Date(createdDate.getTime() + slaTargetMinutes * 60 * 1000);

  // Calculate time remaining
  const elapsedMs = refTime.getTime() - createdDate.getTime();
  const remainingMs = slaDeadline.getTime() - refTime.getTime();
  const remainingMinutes = Math.max(0, Math.floor(remainingMs / (60 * 1000)));

  // Determine SLA status
  let status;
  if (elapsedMs < 0) {
    status = "not_started";
  } else if (remainingMs <= 0) {
    status = "breached";
  } else if (remainingMinutes <= slaTargetMinutes * 0.25) {
    status = "at_risk";
  } else {
    status = "on_track";
  }

  const result = {
    accountId: account.account_id,
    accountName: account.account_name,
    plan: account.plan,
    premiumSupport: account.premium_support,
    priority,
    slaTargetMinutes,
    slaTargetHours: Math.round((slaTargetMinutes / 60) * 100) / 100,
    coverage: coverage === DEFAULT_COVERAGE.premium ? "24x7" : "business_hours",
    createdAt: createdDate.toISOString(),
    referenceTime: refTime.toISOString(),
    slaDeadline: slaDeadline.toISOString(),
    remainingMinutes,
    status,
    customerOverride: !!CUSTOMER_SLA_OVERRIDES[account.account_id],
  };

  logger.info("SLA calculated", {
    accountId: account.account_id,
    priority,
    slaTargetMinutes,
    status,
  });

  return result;
};

/**
 * Evaluate SLA risk for a list of tickets.
 *
 * @param {object} params
 * @param {Array<object>} params.tickets - Array of ticket rows.
 * @param {object} params.account - The account row.
 * @param {string|Date} [params.referenceTime] - The reference time.
 * @returns {Promise<Array<object>>} Array of SLA evaluation results.
 */
const evaluateSlaRisk = async ({ tickets, account, referenceTime }) => {
  if (!tickets || tickets.length === 0) {
    return [];
  }

  const results = [];
  for (const ticket of tickets) {
    // Infer priority from ticket subject/description (deterministic heuristic)
    const priority = inferPriority(ticket);

    const sla = await calculateSla({
      account,
      priority,
      createdAt: ticket.created_at,
      referenceTime,
    });

    results.push({
      ticketId: ticket.ticket_id,
      subject: ticket.subject,
      status: ticket.status,
      priority,
      ...sla,
    });
  }

  return results;
};

/**
 * Infer ticket priority from subject/description (deterministic heuristic).
 *
 * @param {object} ticket - The ticket row.
 * @returns {string} Priority (P1-P4).
 */
const inferPriority = (ticket) => {
  const text = `${ticket.subject || ""} ${ticket.description || ""}`.toLowerCase();

  if (/(urgent|critical|outage|down|data loss|security|breach|p1)/.test(text)) {
    return "P1";
  }
  if (/(high|major|delay|escalat|sla|p2)/.test(text)) {
    return "P2";
  }
  if (/(medium|moderate|issue|problem|p3)/.test(text)) {
    return "P3";
  }
  return "P4";
};

module.exports = {
  DEFAULT_SLA_TARGETS,
  CUSTOMER_SLA_OVERRIDES,
  getSlaTargetMinutes,
  getCoverage,
  calculateSla,
  evaluateSlaRisk,
  inferPriority,
};