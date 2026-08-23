/**
 * Output schema — structured agent response format.
 *
 * Defines the shape of the agent's final response so the API can return
 * structured data (status, answer, citations, pending action) separately
 * from the natural-language text.
 */

const VALID_STATUSES = [
  "ANSWERED",
  "NEEDS_INFORMATION",
  "NEEDS_CONFIRMATION",
  "REQUIRES_MANAGER_APPROVAL",
  "ACTION_COMPLETED",
  "ACTION_REJECTED",
  "ACTION_FAILED",
  "CANNOT_DETERMINE",
  "ESCALATION_REQUIRED",
  "ERROR",
];

const VALID_NEXT_STEPS = [
  "RESPOND",
  "ASK_CLARIFICATION",
  "REQUEST_CONFIRMATION",
  "ESCALATE",
  "END",
];

/**
 * Create a valid agent response object.
 *
 * @param {object} params
 * @param {string} [params.status] - One of VALID_STATUSES.
 * @param {string} [params.intent] - The detected intent.
 * @param {string} [params.answer] - The natural-language answer.
 * @param {Array<object>} [params.citations] - Source citations.
 * @param {boolean} [params.requiresConfirmation] - Whether confirmation is needed.
 * @param {object|null} [params.pendingAction] - Pending action descriptor.
 * @param {Array<object>} [params.missingInformation] - Missing fields.
 * @param {string} [params.nextStep] - One of VALID_NEXT_STEPS.
 * @returns {object} The structured agent response.
 */
const createAgentResponse = ({
  status = "ANSWERED",
  intent = null,
  answer = "",
  citations = [],
  requiresConfirmation = false,
  pendingAction = null,
  missingInformation = [],
  nextStep = "RESPOND",
} = {}) => {
  return {
    status,
    intent,
    answer,
    citations,
    requiresConfirmation,
    pendingAction,
    missingInformation,
    nextStep,
  };
};

/**
 * Validate an agent response object.
 *
 * @param {object} response - The response to validate.
 * @returns {boolean} Whether the response is valid.
 */
const isValidResponse = (response) => {
  if (!response || typeof response !== "object") {
    return false;
  }
  if (!VALID_STATUSES.includes(response.status)) {
    return false;
  }
  if (!VALID_NEXT_STEPS.includes(response.nextStep)) {
    return false;
  }
  if (typeof response.answer !== "string") {
    return false;
  }
  if (!Array.isArray(response.citations)) {
    return false;
  }
  if (!Array.isArray(response.missingInformation)) {
    return false;
  }
  return true;
};

module.exports = {
  VALID_STATUSES,
  VALID_NEXT_STEPS,
  createAgentResponse,
  isValidResponse,
};