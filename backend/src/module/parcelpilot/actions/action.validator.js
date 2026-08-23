const { ACTION_TYPES } = require("./action.types");

/**
 * Action validator — validates action type, target, and confirmation.
 */
const validateActionType = (type) => Object.values(ACTION_TYPES).includes(type);

const validatePendingAction = (pendingAction) => {
  if (!pendingAction || typeof pendingAction !== "object") {
    return { valid: false, reason: "No pending action" };
  }
  if (!validateActionType(pendingAction.type)) {
    return { valid: false, reason: `Unknown action type: ${pendingAction.type}` };
  }
  if (!pendingAction.targetId) {
    return { valid: false, reason: "targetId is required" };
  }
  if (!pendingAction.createdAt) {
    return { valid: false, reason: "createdAt is required" };
  }
  return { valid: true };
};

const isExpired = (pendingAction, now = Date.now()) => {
  const { PENDING_ACTION_TTL_MS } = require("./action.types");
  const createdAt = new Date(pendingAction.createdAt).getTime();
  return now - createdAt > PENDING_ACTION_TTL_MS;
};

module.exports = { validateActionType, validatePendingAction, isExpired };