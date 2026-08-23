const AppError = require("../../../utils/AppError");
const logger = require("../../../utils/logger");

const ticketRepository = require("../repositories/ticket.repository");
const accountRepository = require("../repositories/account.repository");
const slaService = require("./sla.service");

/**
 * Escalation service — deterministic escalation evaluation.
 *
 * The escalation decision is calculated from:
 *   - ticket facts (priority, status, created_at)
 *   - account facts (plan, premium_support)
 *   - SLA status (breached / at risk)
 *   - applicable customer agreement (if any)
 *
 * The LLM should select/use this tool, not decide escalation itself.
 */

// Escalation rules by priority.
const ESCALATION_RULES = {
  P1: {
    targetTeam: "Operations",
    slaRiskThreshold: "at_risk",
    requiresManager: true,
  },
  P2: {
    targetTeam: "Operations",
    slaRiskThreshold: "at_risk",
    requiresManager: false,
  },
  P3: {
    targetTeam: "Support",
    slaRiskThreshold: "breached",
    requiresManager: false,
  },
  P4: {
    targetTeam: "Support",
    slaRiskThreshold: "breached",
    requiresManager: false,
  },
};

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

  // 4. Calculate SLA status
  const sla = await slaService.calculateSla({
    account,
    priority: effectivePriority,
    createdAt: ticket.created_at,
    referenceTime,
  });

  // 5. Determine escalation requirement
  const rules = ESCALATION_RULES[effectivePriority] || ESCALATION_RULES.P3;
  const slaRiskThreshold = rules.slaRiskThreshold;

  let shouldEscalate = false;
  let reason = "";

  if (ticket.status === "RESOLVED" || ticket.status === "CLOSED") {
    shouldEscalate = false;
    reason = `Ticket is already ${ticket.status}; escalation is not required.`;
  } else if (sla.status === "breached") {
    shouldEscalate = true;
    reason = `SLA has been breached for ${effectivePriority} ticket.`;
  } else if (sla.status === "at_risk" && slaRiskThreshold === "at_risk") {
    shouldEscalate = true;
    reason = `SLA is at risk for ${effectivePriority} ticket.`;
  } else if (effectivePriority === "P1") {
    shouldEscalate = true;
    reason = `P1 ticket requires immediate escalation regardless of SLA status.`;
  } else {
    shouldEscalate = false;
    reason = `SLA is on track; escalation is not currently required.`;
  }

  const result = {
    ticketId: ticket.ticket_id,
    accountId: ticket.account_id,
    accountName: account.account_name,
    subject: ticket.subject,
    status: ticket.status,
    channel: ticket.channel,
    assignedTo: ticket.assigned_to,
    priority: effectivePriority,
    slaStatus: sla.status,
    slaDeadline: sla.slaDeadline,
    remainingMinutes: sla.remainingMinutes,
    shouldEscalate,
    reason,
    targetTeam: shouldEscalate ? rules.targetTeam : null,
    requiresManager: shouldEscalate ? rules.requiresManager : false,
    requiresConfirmation: shouldEscalate,
    sources: [
      {
        type: "ticket",
        id: ticket.ticket_id,
      },
      {
        type: "account",
        id: account.account_id,
      },
    ],
  };

  logger.info("Escalation evaluated", {
    ticketId: ticket.ticket_id,
    priority: effectivePriority,
    slaStatus: sla.status,
    shouldEscalate,
  });

  return result;
};

module.exports = {
  ESCALATION_RULES,
  evaluateEscalation,
};