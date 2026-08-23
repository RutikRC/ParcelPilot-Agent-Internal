const pool = require("../../../config/db");
const ticketRepository = require("../repositories/ticket.repository");
const escalationService = require("../services/escalation.service");
const { ACTION_TYPES } = require("./action.types");

/**
 * ESCALATE_TICKET action — deterministic escalation mutation.
 */
module.exports = {
  type: ACTION_TYPES.ESCALATE_TICKET,
  metadata: { name: "ESCALATE_TICKET", description: "Escalate a ticket", requiresConfirmation: true },
  validate: async (params) => {
    if (!params || !params.ticketId) return { valid: false, reason: "ticketId is required" };
    const decision = await escalationService.evaluateEscalation({ ticketId: params.ticketId });
    if (!decision.shouldEscalate) return { valid: false, reason: decision.reason, decision };
    return { valid: true, decision };
  },
  execute: async (params) => {
    const ticketId = params.ticketId;
    const ticket = await ticketRepository.getTicketById(ticketId);
    if (!ticket) return { ticketId, rejected: true, reason: "Ticket not found" };
    if (ticket.status === "ESCALATED") return { ticketId, alreadyCompleted: true, status: "ESCALATED" };
    const decision = await escalationService.evaluateEscalation({ ticketId });
    if (!decision.shouldEscalate) return { ticketId, rejected: true, reason: decision.reason };
    await pool.query(
      `UPDATE tickets SET status = 'ESCALATED', assigned_to = $2, updated_at = CURRENT_TIMESTAMP
       WHERE ticket_id = $1 RETURNING *`,
      [ticketId, decision.targetTeam]
    );
    return { success: true, ticketId, alreadyEscalated: false, targetTeam: decision.targetTeam };
  },
};