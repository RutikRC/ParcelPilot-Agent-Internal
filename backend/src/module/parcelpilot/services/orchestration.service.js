const crypto = require("crypto");

const {
  requestContextBuilder,
  toolPlanner,
  toolExecutor,
  evidenceAggregator,
  conflictResolver,
  missingDataHandler,
  decisionContextBuilder,
} = require("../orchestration");
const AppError = require("../../../utils/AppError");
const logger = require("../../../utils/logger");

/**
 * Orchestration service — orchestrates the full request pipeline.
 *
 *   query
 *     → context
 *     → intent
 *     → tool plan
 *     → tool execution
 *     → evidence
 *     → precedence
 *     → conflict/missing data handling
 *     → decision context
 *
 * This is READ-ONLY. No state-changing actions are performed.
 */

/**
 * Orchestrate a request.
 *
 * @param {object} input
 * @param {string} input.query - The user query.
 * @param {string} [input.accountId] - Explicit account ID (optional).
 * @param {string} [input.orderId] - Explicit order ID (optional).
 * @param {string} [input.ticketId] - Explicit ticket ID (optional).
 * @param {object} [input.conversationContext] - Optional conversation context.
 * @returns {Promise<object>} The structured decision context.
 */
const orchestrateRequest = async ({
  query,
  accountId,
  orderId,
  ticketId,
  conversationContext,
  referenceTime,
} = {}) => {
  const startTime = Date.now();

  if (!query || typeof query !== "string" || query.trim().length === 0) {
    throw new AppError("query is required", 400);
  }

  // 1. Build request context
  const context = requestContextBuilder.buildRequestContext({
    query,
    accountId,
    orderId,
    ticketId,
    conversationContext,
    referenceTime,
  });

  logger.info("Orchestration started", {
    requestId: context.requestId,
    intent: context.intent,
    queryLength: query.length,
  });

  // 2. Plan tools
  const plan = toolPlanner.planTools(context);

  logger.info("Tool plan created", {
    requestId: context.requestId,
    intent: context.intent,
    stepCount: plan.steps.length,
    tools: plan.steps.map((s) => s.tool),
  });

  // 3. Execute tools
  const { results, errors } = await toolExecutor.executePlan(plan, context);

  logger.info("Tool execution completed", {
    requestId: context.requestId,
    successCount: results.filter((r) => r.status === "success").length,
    errorCount: errors.length,
  });

  // 4. Aggregate evidence
  const evidence = evidenceAggregator.aggregateEvidence(results);

  // 5. Resolve conflicts (reuses policy.service.js)
  const conflicts = conflictResolver.resolveConflicts(evidence);

  // 6. Detect missing information
  const missing = missingDataHandler.detectMissingInformation(context, evidence);

  // 7. Build decision context
  const decisionContext = decisionContextBuilder.buildDecisionContext({
    context,
    evidence,
    conflicts,
    missing,
  });

  const duration = Date.now() - startTime;

  logger.info("Orchestration completed", {
    requestId: context.requestId,
    intent: context.intent,
    executionTimeMs: duration,
    factCount: evidence.facts.length,
    policyEvidenceCount: evidence.policyEvidence.length,
    decisionCount: evidence.businessDecisions.length,
    conflictCount: conflicts.length,
    missingCount: missing.length,
    recommendedNextStep: decisionContext.recommendedNextStep,
  });

  return decisionContext;
};

module.exports = {
  orchestrateRequest,
};