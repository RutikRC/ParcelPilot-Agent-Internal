const actionRegistry = require("./action.registry");
const { validatePendingAction, isExpired } = require("./action.validator");
const { ACTION_STATUSES, ACTION_TYPES } = require("./action.types");
const auditService = require("../audit/audit.service");
const logger = require("../../../utils/logger");

const buildActionParams = (pendingAction) => {
  const params = pendingAction.parameters || {};
  const value = pendingAction.targetId;
  switch (pendingAction.type) {
    case ACTION_TYPES.CANCEL_ORDER:
      return { ...params, orderId: params.orderId || value };
    case ACTION_TYPES.ISSUE_SERVICE_CREDIT:
      return { ...params, orderId: params.orderId || value };
    case ACTION_TYPES.ESCALATE_TICKET:
      return { ...params, ticketId: params.ticketId || value };
    default:
      return params;
  }
};

const execute = async ({ pendingAction, conversationId, traceId, referenceTime }) => {
  const startTime = Date.now();

  const validation = validatePendingAction(pendingAction);
  if (!validation.valid) {
    return { status: "ACTION_REJECTED", reason: validation.reason };
  }

  const refTimeMs = referenceTime ? new Date(referenceTime).getTime() : Date.now();
  if (isExpired(pendingAction, refTimeMs)) {
    await auditService.record({
      conversationId,
      actionType: pendingAction.type,
      targetId: pendingAction.targetId,
      status: ACTION_STATUSES.EXPIRED,
      traceId,
    });
    return { status: "CANNOT_DETERMINE", reason: "The confirmation request has expired. Please request the action again." };
  }

  const handler = actionRegistry.get(pendingAction.type);
  if (!handler) {
    return { success: false, reason: `Unknown action type: ${pendingAction.type}` };
  }

  const actionParams = buildActionParams(pendingAction);

  const actionValidation = await handler.validate(actionParams);

  if (actionValidation.requiresManagerApproval) {
    await auditService.record({
      conversationId,
      actionType: pendingAction.type,
      targetId: pendingAction.targetId,
      status: ACTION_STATUSES.REJECTED,
      reason: actionValidation.reason || "Manager approval required",
      traceId,
    });
    return {
      success: false,
      status: "REQUIRES_MANAGER_APPROVAL",
      requiresManagerApproval: true,
      reason: actionValidation.reason || "This action requires manager approval.",
      creditAmount: actionValidation.decision?.creditInr ?? null,
      orderId: actionValidation.decision?.orderId || null,
      currency: "INR",
      mutated: false,
      nextStep: "Manager approval required before execution.",
    };
  }

  if (!actionValidation.valid) {
    await auditService.record({
      conversationId,
      actionType: pendingAction.type,
      targetId: pendingAction.targetId,
      status: ACTION_STATUSES.REJECTED,
      reason: actionValidation.reason,
      traceId,
    });
    return { success: false, status: "ACTION_REJECTED", reason: actionValidation.reason };
  }

  try {
    const result = await handler.execute(actionParams);
    await auditService.record({
      conversationId,
      actionType: pendingAction.type,
      targetId: pendingAction.targetId,
      status: ACTION_STATUSES.COMPLETED,
      traceId,
    });
    logger.info("Action executed", {
      traceId,
      conversationId,
      actionType: pendingAction.type,
      targetId: pendingAction.targetId,
      executionTimeMs: Date.now() - startTime,
    });
    return { success: true, status: "ACTION_COMPLETED", result };
  } catch (error) {
    await auditService.record({
      conversationId,
      actionType: pendingAction.type,
      targetId: pendingAction.targetId,
      status: ACTION_STATUSES.FAILED,
      reason: error.message,
      traceId,
    });
    return { success: false, status: "ACTION_FAILED", reason: "Action execution failed" };
  }
};

module.exports = { execute, buildActionParams };