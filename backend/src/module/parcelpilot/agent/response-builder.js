const { createAgentResponse } = require("./output-schema");

/**
 * Response builder — converts the Phase 2B decision context into a
 * structured agent response.
 *
 * Handles:
 * - missing information → NEEDS_INFORMATION
 * - NOT_FOUND → CANNOT_DETERMINE
 * - requiresConfirmation → NEEDS_CONFIRMATION with pendingAction
 * - requiresHumanEscalation → ESCALATION_REQUIRED
 * - otherwise → ANSWERED with grounded answer
 */

/**
 * Build citations from the decision context evidence.
 *
 * @param {object} decisionContext - The Phase 2B decision context.
 * @returns {Array<object>} Array of citation objects.
 */
const buildCitations = (decisionContext) => {
  const citations = [];
  const evidence = [
    ...(decisionContext?.authoritativeEvidence || []),
    ...(decisionContext?.supportingEvidence || []),
  ];

  for (const item of evidence) {
    if (!item.documentName && !item.documentId) {
      continue;
    }
    citations.push({
      document: item.documentName || item.documentId,
      sourceType: item.sourceType || "knowledge",
      documentId: item.documentId || null,
      chunkId: item.chunkId || null,
      accountId: item.accountId || null,
    });
  }

  return citations;
};

/**
 * Detect a pending action from the decision context.
 *
 * @param {object} decisionContext - The Phase 2B decision context.
 * @returns {object|null} The pending action descriptor, or null.
 */
const detectPendingAction = (decisionContext) => {
  const decisions = decisionContext?.businessDecisions || [];
  const intent = decisionContext?.request?.intent;

  for (const decision of decisions) {
    const value = decision.value || {};
    if (!value.requiresConfirmation) {
      continue;
    }

    // Map intent to a pending action type
    let type = null;
    let targetId = null;

    switch (intent) {
      case "CANCELLATION_QUESTION":
      case "CANCELLATION_ACTION":
        type = "CANCEL_ORDER";
        targetId = value.orderId || decision.sourceId;
        break;
      case "SERVICE_CREDIT_QUESTION":
        type = "ISSUE_SERVICE_CREDIT";
        targetId = value.orderId || decision.sourceId;
        break;
      case "ESCALATION_QUESTION":
      case "ESCALATION_ACTION":
        type = "ESCALATE_TICKET";
        targetId = value.ticketId || decision.sourceId;
        break;
      default:
        break;
    }

    if (type) {
      return {
        type,
        targetId,
        createdAt: decisionContext.request?.referenceTime || new Date().toISOString(),
        details: value,
      };
    }
  }

  return null;
};

/**
 * Build a grounded answer from the decision context.
 *
 * @param {object} decisionContext - The Phase 2B decision context.
 * @returns {string} The natural-language answer.
 */
const buildGroundedAnswer = (decisionContext) => {
  const decisions = decisionContext?.businessDecisions || [];
  const facts = decisionContext?.facts || [];
  const intent = decisionContext?.request?.intent;
  const authoritative = decisionContext?.authoritativeEvidence || [];
  const supporting = decisionContext?.supportingEvidence || [];

  // 1. If there's a business decision, explain it (deterministic result)
  for (const decision of decisions) {
    const value = decision.value || {};
    if (value.reason) {
      return value.reason;
    }
  }

  // 2. If there are facts, summarize them
  if (facts.length > 0) {
    const order = facts.find((f) => f.field === "order");
    const account = facts.find((f) => f.field === "account");
    if (order && account) {
      return `Order ${order.value.orderId} belongs to ${account.value.accountName} (${account.value.accountId}).`;
    }
    if (order) {
      return `Order ${order.value.orderId} is currently ${order.value.status}.`;
    }
    if (account) {
      return `Account ${account.value.accountName} (${account.value.accountId}) is on the ${account.value.plan} plan.`;
    }
  }

  // 3. For policy/knowledge questions, build an answer from the retrieved
  //    authoritative evidence (the actual policy/SOP/agreement text).
  const evidence = [...authoritative, ...supporting];
  if (evidence.length > 0) {
    // Prefer the highest-authority evidence (lowest authorityRank).
    const sorted = [...evidence].sort((a, b) => (a.authorityRank || 99) - (b.authorityRank || 99));
    const top = sorted[0];
    if (top && top.text) {
      // Return a concise excerpt of the authoritative policy text.
      const text = top.text.trim();
      return text.length > 500 ? `${text.slice(0, 500)}...` : text;
    }
    if (top && top.documentName) {
      return `According to ${top.documentName}, the applicable policy applies.`;
    }
  }

  return "I have retrieved the relevant information for your request.";
};

/**
 * Build the agent response from a decision context.
 *
 * @param {object} decisionContext - The Phase 2B decision context.
 * @returns {object} The structured agent response.
 */
const buildResponse = (decisionContext) => {
  if (!decisionContext) {
    return createAgentResponse({
      status: "ERROR",
      answer: "I was unable to process your request.",
      nextStep: "END",
    });
  }

  const missing = decisionContext.missingInformation || [];
  const conflicts = decisionContext.conflicts || [];
  const requiresConfirmation = decisionContext.requiresConfirmation;
  const requiresHumanEscalation = decisionContext.requiresHumanEscalation;
  const canAnswer = decisionContext.canAnswer;
  const intent = decisionContext.request?.intent;

  // 1. Missing information
  if (missing.length > 0) {
    const hasNotFound = missing.some((m) => m.state === "NOT_FOUND");
    if (hasNotFound) {
      const notFound = missing.find((m) => m.state === "NOT_FOUND");
      return createAgentResponse({
        status: "CANNOT_DETERMINE",
        intent,
        answer: `I couldn't find the requested record. ${notFound?.reason || "Please check the identifier and try again."}`,
        citations: buildCitations(decisionContext),
        missingInformation: missing,
        nextStep: "ASK_CLARIFICATION",
      });
    }

    const missingField = missing[0];
    const fieldLabel = missingField.field === "order_id" ? "order ID" : missingField.field;
    return createAgentResponse({
      status: "NEEDS_INFORMATION",
      intent,
      answer: `I need more information to help with that. Could you provide the ${fieldLabel}?`,
      citations: buildCitations(decisionContext),
      missingInformation: missing,
      nextStep: "ASK_CLARIFICATION",
    });
  }

  // 2. Unresolved conflicts
  if (conflicts.some((c) => c.requiresClarification)) {
    return createAgentResponse({
      status: "ESCALATION_REQUIRED",
      intent,
      answer: "I found conflicting information that I cannot safely resolve. This may require human review.",
      citations: buildCitations(decisionContext),
      requiresConfirmation: false,
      nextStep: "ESCALATE",
    });
  }

  // 3. Human escalation required
  if (requiresHumanEscalation) {
    return createAgentResponse({
      status: "ESCALATION_REQUIRED",
      intent,
      answer: "This request requires human review. I've flagged it for escalation.",
      citations: buildCitations(decisionContext),
      nextStep: "ESCALATE",
    });
  }

  // 4. Confirmation required (state-changing action).
  // Only ACTION intents (e.g. "Cancel ORD-1001.") produce a pending action.
  // Informational QUESTION intents (e.g. "Can I cancel ORD-1001?") remain
  // ANSWERED with requiresConfirmation=false.
  const isActionIntent = intent === "CANCELLATION_ACTION" || intent === "ESCALATION_ACTION";
  if (requiresConfirmation && isActionIntent) {
    const pendingAction = detectPendingAction(decisionContext);
    const answer = buildGroundedAnswer(decisionContext);
    return createAgentResponse({
      status: "NEEDS_CONFIRMATION",
      intent,
      answer: `${answer} Would you like me to proceed?`,
      citations: buildCitations(decisionContext),
      requiresConfirmation: true,
      pendingAction,
      nextStep: "REQUEST_CONFIRMATION",
    });
  }

  // 5. Cannot determine
  if (!canAnswer) {
    return createAgentResponse({
      status: "CANNOT_DETERMINE",
      intent,
      answer: "I was unable to determine an answer from the available information.",
      citations: buildCitations(decisionContext),
      nextStep: "END",
    });
  }

  // 6. Answered
  return createAgentResponse({
    status: "ANSWERED",
    intent,
    answer: buildGroundedAnswer(decisionContext),
    citations: buildCitations(decisionContext),
    nextStep: "RESPOND",
  });
};

module.exports = {
  buildCitations,
  detectPendingAction,
  buildGroundedAnswer,
  buildResponse,
};