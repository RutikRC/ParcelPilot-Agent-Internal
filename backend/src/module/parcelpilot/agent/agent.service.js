const crypto = require("crypto");

const aiClient = require("../../queue/services/ai.client");
const orchestrationService = require("../services/orchestration.service");
const conversationManager = require("./conversation-manager");
const { SYSTEM_PROMPT } = require("./agent.prompt");
const { createAgentResponse, isValidResponse } = require("./output-schema");
const { buildResponse } = require("./response-builder");
const actionExecutor = require("../actions/action.executor");
const AppError = require("../../../utils/AppError");
const logger = require("../../../utils/logger");

const MAX_AGENT_STEPS = 8;
const MAX_TOOL_CALLS = 8;

/**
 * Normalize a message for deterministic confirmation/rejection matching.
 * Strips punctuation and collapses whitespace so "Yes, proceed." -> "yes proceed".
 */
const normalizeForDecision = (message) =>
  (message || "").toLowerCase().replace(/[.,!?;:]/g, " ").replace(/\s+/g, " ").trim();

/**
 * Deterministic positive confirmation of the stored pending action.
 * Only true when a pending action exists and the message is unambiguous.
 */
const isConfirmation = (message, conversationState) => {
  const normalized = normalizeForDecision(message);
  const pendingAction = conversationState && conversationState.pendingAction;
  if (!pendingAction || !normalized) return false;
  const confirmations = [
    "yes", "yeah", "yep", "sure", "ok", "okay",
    "go ahead", "proceed", "do it", "confirm", "confirmed",
    "please proceed",
  ];
  const cleaned = normalized.startsWith("please ") ? normalized.slice(7) : normalized;
  return confirmations.some((c) => cleaned === c || cleaned.startsWith(c + " "));
};

/**
 * Deterministic negative rejection of the stored pending action.
 * A rejection must NEVER execute.
 */
const isRejection = (message, conversationState) => {
  const normalized = normalizeForDecision(message);
  const pendingAction = conversationState && conversationState.pendingAction;
  if (!pendingAction || !normalized) return false;
  const rejections = ["no", "nope", "cancel", "don't", "do not", "stop", "never mind", "nevermind", "no don't", "dont"];
  return rejections.some((r) => normalized === r || normalized.startsWith(r + " "));
};

const isFollowUp = (message, conversationState) => {
  const normalized = normalizeForDecision(message);
  const hasContext = conversationState && (conversationState.lastIntent || conversationState.lastEntities);
  if (!hasContext) return false;
  const followUps = ["why", "how", "what about", "it", "that", "same", "do it", "yes", "no", "and", "also"];
  return followUps.some((f) => normalized === f || normalized.startsWith(f + " "));
};

const resolveFollowUp = (message, conversationState) => {
  const has = (k) => (conversationState.lastEntities && conversationState.lastEntities[k]) || null;
  return {
    query: message,
    accountId: has("accountId"),
    orderId: has("orderId"),
    ticketId: has("ticketId"),
    isConfirmation: isConfirmation(message, conversationState),
  };
};

const generateAnswer = async ({ message, decisionContext, traceId }) => {
  const context = [
    {
      chunkText:
        "User request: " + message + "\n\n" +
        "Intent: " + ((decisionContext && decisionContext.request && decisionContext.request.intent) || "UNKNOWN") + "\n\n" +
        "Facts:\n" + JSON.stringify((decisionContext && decisionContext.facts) || [], null, 2) + "\n\n" +
        "Business decisions:\n" + JSON.stringify((decisionContext && decisionContext.businessDecisions) || [], null, 2) + "\n\n" +
        "Authoritative evidence:\n" + JSON.stringify((decisionContext && decisionContext.authoritativeEvidence) || [], null, 2) + "\n\n" +
        "Supporting evidence:\n" + JSON.stringify((decisionContext && decisionContext.supportingEvidence) || [], null, 2) + "\n\n" +
        "Conflicts:\n" + JSON.stringify((decisionContext && decisionContext.conflicts) || [], null, 2) + "\n\n" +
        "Missing information:\n" + JSON.stringify((decisionContext && decisionContext.missingInformation) || [], null, 2),
    },
  ];
  try {
    const result = await aiClient.callRagGenerate({ question: message, context, traceId });
    return result.answer;
  } catch (error) {
    logger.warn("LLM answer generation failed, using deterministic answer", { traceId, error: error.message });
    return null;
  }
};

const processMessage = async ({ conversationId, message, referenceTime }) => {
  const traceId = crypto.randomUUID();
  const startTime = Date.now();

  if (!message || typeof message !== "string" || message.trim().length === 0) {
    throw new AppError("message is required", 400);
  }

  let conversation = conversationId ? conversationManager.getConversation(conversationId) : null;
  if (!conversation) conversation = conversationManager.createConversation();

  const conversationState = conversation.state || {};
  conversationManager.appendMessage(conversation.conversationId, { role: "user", content: message });

  const confirm = isConfirmation(message, conversationState);
  const reject = isRejection(message, conversationState);

  // Pending-action path (BEFORE any RAG / intent classification).
  if (conversationState.pendingAction) {
    const pendingAction = conversationState.pendingAction;

    if (reject) {
      const response = createAgentResponse({
        status: "ACTION_REJECTED",
        intent: conversationState.lastIntent || pendingAction.type,
        answer: "Understood. I will not proceed with the requested action.",
        requiresConfirmation: false,
        pendingAction: null,
        nextStep: "RESPOND",
      });
      conversationManager.updateState(conversation.conversationId, { pendingAction: null, lastResponse: response });
      conversationManager.appendMessage(conversation.conversationId, { role: "assistant", content: response.answer });
      return { conversationId: conversation.conversationId, response };
    }

    if (confirm) {
      const execution = await actionExecutor.execute({ pendingAction, conversationId: conversation.conversationId, traceId, referenceTime });
      const isManager = execution.status === "REQUIRES_MANAGER_APPROVAL";
      const response = createAgentResponse({
        status: execution.success ? "ACTION_COMPLETED" : (execution.status || "ACTION_FAILED"),
        intent: conversationState.lastIntent || pendingAction.type,
        answer: isManager
          ? "This action requires manager approval before execution. " + (execution.reason || "") + " Estimated credit amount: " + (execution.creditAmount ?? "N/A") + " " + (execution.currency || "INR") + ". No mutation was performed. Next step: " + (execution.nextStep || "Obtain manager approval.")
          : (execution.success ? "The action has been completed successfully." : (execution.reason || "The action could not be completed.")),
        requiresConfirmation: false,
        pendingAction: execution.success ? null : (execution.status === "ACTION_FAILED" ? pendingAction : null),
        nextStep: isManager ? "ESCALATE" : "RESPOND",
      });
      conversationManager.updateState(conversation.conversationId, { pendingAction: response.pendingAction || null, lastResponse: response });
      conversationManager.appendMessage(conversation.conversationId, { role: "assistant", content: response.answer });
      logger.info("Agent action executed", {
        traceId,
        conversationId: conversation.conversationId,
        pendingActionType: pendingAction.type,
        pendingActionTarget: pendingAction.targetId,
        status: response.status,
      });
      return { conversationId: conversation.conversationId, response };
    }

    if (!isFollowUp(message, conversationState)) {
      const response = createAgentResponse({
        status: "NEEDS_CONFIRMATION",
        intent: conversationState.lastIntent || pendingAction.type,
        answer: "I found a pending action that requires explicit confirmation. Please reply 'yes' or 'proceed' to confirm, or 'no' to cancel it.",
        requiresConfirmation: true,
        pendingAction,
        nextStep: "REQUEST_CONFIRMATION",
      });
      conversationManager.updateState(conversation.conversationId, { pendingAction, lastResponse: response });
      conversationManager.appendMessage(conversation.conversationId, { role: "assistant", content: response.answer });
      return { conversationId: conversation.conversationId, response };
    }
  }

  let requestInput = { query: message, referenceTime };
  if (confirm || isFollowUp(message, conversationState)) {
    requestInput = { ...resolveFollowUp(message, conversationState), referenceTime };
  }

  let decisionContext;
  try {
    decisionContext = await orchestrationService.orchestrateRequest(requestInput);
  } catch (error) {
    logger.error("Orchestration failed in agent", { traceId, error: error.message });
    return {
      conversationId: conversation.conversationId,
      response: createAgentResponse({ status: "ERROR", answer: "I was unable to process your request. Please try again.", nextStep: "END" }),
    };
  }

  let response = buildResponse(decisionContext);

  if (response.status === "ANSWERED" || response.status === "NEEDS_CONFIRMATION") {
    const llmAnswer = await generateAnswer({ message, decisionContext, traceId });
    if (llmAnswer) response = Object.assign({}, response, { answer: llmAnswer });
  }

  conversationManager.updateState(conversation.conversationId, {
    lastIntent: (decisionContext && decisionContext.request && decisionContext.request.intent) || null,
    lastEntities: (decisionContext && decisionContext.request && decisionContext.request.entities) || {},
    pendingAction: response.pendingAction || null,
    lastResponse: response,
  });
  conversationManager.appendMessage(conversation.conversationId, { role: "assistant", content: response.answer });

  logger.info("Agent message processed", {
    traceId,
    conversationId: conversation.conversationId,
    intent: decisionContext && decisionContext.request && decisionContext.request.intent,
    status: response.status,
    executionTimeMs: Date.now() - startTime,
  });
  return { conversationId: conversation.conversationId, response };
};

module.exports = {
  processMessage,
  isConfirmation,
  isRejection,
  isFollowUp,
  resolveFollowUp,
  normalizeForDecision,
  generateAnswer,
  MAX_AGENT_STEPS,
  MAX_TOOL_CALLS,
};