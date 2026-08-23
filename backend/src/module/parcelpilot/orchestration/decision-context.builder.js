/**
 * Decision context builder — produces the structured decision context
 * that will become the future LLM's input.
 */

/**
 * Determine the recommended next step based on evidence and missing info.
 *
 * @param {object} params
 * @param {object} context - The request context.
 * @param {object} evidence - The aggregated evidence.
 * @param {Array<object>} missing - The missing information.
 * @param {Array<object>} conflicts - The resolved conflicts.
 * @returns {string} The recommended next step.
 */
const determineNextStep = ({ context, evidence, missing, conflicts }) => {
  // Missing information takes priority
  if (missing && missing.length > 0) {
    const hasNotFound = missing.some((m) => m.state === "NOT_FOUND");
    if (hasNotFound) {
      return "CANNOT_DETERMINE";
    }
    return "MISSING_INFORMATION";
  }

  // Unresolved conflicts require clarification
  if (conflicts && conflicts.some((c) => c.requiresClarification)) {
    return "REQUIRES_HUMAN_ESCALATION";
  }

  // Business decisions that require confirmation
  const decisions = evidence?.businessDecisions || [];
  for (const decision of decisions) {
    const value = decision.value || {};
    if (value.requiresConfirmation) {
      return "REQUIRES_CONFIRMATION";
    }
    if (value.requiresManagerApproval) {
      return "REQUIRES_MANAGER_APPROVAL";
    }
  }

  // Check if we have enough to answer
  const hasFacts = (evidence?.facts || []).length > 0;
  const hasPolicy = (evidence?.policyEvidence || []).length > 0;
  const hasDecision = decisions.length > 0;

  if (hasFacts || hasPolicy || hasDecision) {
    return "READ_ONLY_ANSWER";
  }

  return "CANNOT_DETERMINE";
};

/**
 * Determine whether the system can answer the request.
 *
 * @param {object} params
 * @param {Array<object>} missing - The missing information.
 * @param {Array<object>} conflicts - The resolved conflicts.
 * @returns {boolean} Whether the system can answer.
 */
const canAnswer = ({ missing, conflicts }) => {
  if (missing && missing.length > 0) {
    return false;
  }
  if (conflicts && conflicts.some((c) => c.requiresClarification)) {
    return false;
  }
  return true;
};

/**
 * Build the decision context.
 *
 * @param {object} params
 * @param {object} params.context - The request context.
 * @param {object} params.evidence - The aggregated evidence.
 * @param {Array<object>} params.conflicts - The resolved conflicts.
 * @param {Array<object>} params.missing - The missing information.
 * @returns {object} The decision context.
 */
const buildDecisionContext = ({ context, evidence, conflicts, missing }) => {
  const nextStep = determineNextStep({ context, evidence, missing, conflicts });
  const answerable = canAnswer({ missing, conflicts });

  // Determine if confirmation is required
  const decisions = evidence?.businessDecisions || [];
  const requiresConfirmation = decisions.some((d) => d.value?.requiresConfirmation);
  const requiresManagerApproval = decisions.some((d) => d.value?.requiresManagerApproval);

  // Determine if human escalation is required
  const requiresHumanEscalation =
    conflicts.some((c) => c.requiresClarification) ||
    nextStep === "REQUIRES_HUMAN_ESCALATION";

  return {
    request: {
      query: context.query,
      intent: context.intent,
      entities: context.entities,
      referenceTime: context.referenceTime,
    },
    facts: evidence?.facts || [],
    businessDecisions: decisions,
    authoritativeEvidence: (evidence?.policyEvidence || []).filter((e) => e.authorityRank <= 3),
    supportingEvidence: (evidence?.policyEvidence || []).filter((e) => e.authorityRank > 3),
    conflicts,
    missingInformation: missing,
    warnings: evidence?.warnings || [],
    recommendedNextStep: nextStep,
    canAnswer: answerable,
    requiresConfirmation,
    requiresManagerApproval,
    requiresHumanEscalation,
  };
};

module.exports = {
  determineNextStep,
  canAnswer,
  buildDecisionContext,
};