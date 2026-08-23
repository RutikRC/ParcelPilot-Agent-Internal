const crypto = require("crypto");

/**
 * Request context builder — normalizes a user query into a structured
 * request context with extracted entities and intent.
 *
 * This is a deterministic layer. It does NOT use an LLM.
 */

// ---------------------------------------------------------------------------
// Entity extraction (deterministic regex)
// ---------------------------------------------------------------------------

const ENTITY_PATTERNS = {
  accountId: /\b(ACCT-\d{3,})\b/i,
  orderId: /\b(ORD-\d{3,})\b/i,
  ticketId: /\b(TKT-\d{3,}|TICKET-\d{3,})\b/i,
};

/**
 * Extract explicit identifiers from a query using deterministic patterns.
 *
 * @param {string} query - The user query.
 * @returns {object} Extracted entities (only present identifiers).
 */
const extractEntities = (query) => {
  if (!query || typeof query !== "string") {
    return {};
  }

  const entities = {};

  for (const [key, pattern] of Object.entries(ENTITY_PATTERNS)) {
    const match = query.match(pattern);
    if (match && match[1]) {
      entities[key] = match[1].toUpperCase();
    }
  }

  return entities;
};

// ---------------------------------------------------------------------------
// Intent classification (deterministic keyword rules)
// ---------------------------------------------------------------------------

const INTENT_RULES = [
  {
    // Policy questions must be checked first to prevent "cancellation policy"
    // from matching CANCELLATION_QUESTION.
    intent: "POLICY_QUESTION",
    keywords: ["policy", "cancellation policy", "support policy", "service credit policy", "what is the rule", "what are the rules"],
  },
  {
    intent: "CANCELLATION_QUESTION",
    keywords: ["cancel", "cancel order", "cancel my order", "cancellation request"],
  },
  {
    intent: "SERVICE_CREDIT_QUESTION",
    keywords: ["service credit", "credit", "refund", "compensation", "reimbursement"],
  },
  {
    intent: "SLA_QUESTION",
    keywords: ["sla", "response time", "response target", "deadline", "service level", "breach"],
  },
  {
    intent: "ESCALATION_QUESTION",
    keywords: ["escalat", "escalation", "raise to", "hand off", "handoff"],
  },
  {
    intent: "ACCOUNT_LOOKUP",
    keywords: ["account", "customer", "who is", "account details"],
  },
  {
    intent: "ORDER_LOOKUP",
    keywords: ["order", "shipment", "pickup", "delivery"],
  },
  {
    intent: "TICKET_LOOKUP",
    keywords: ["ticket", "support ticket", "issue", "case"],
  },
];

// Action-intent detection rules.
// These distinguish imperative/action requests (e.g. "Cancel ORD-1001.")
// from informational questions (e.g. "Can I cancel ORD-1001?").
const ACTION_INTENT_RULES = [
  {
    intent: "CANCELLATION_ACTION",
    // Imperative / explicit action wording for cancellation.
    actionPatterns: [
      /^(please\s+)?cancel\b/i,
      /^i want to cancel\b/i,
      /^i'd like to cancel\b/i,
      /^i would like to cancel\b/i,
      /^go ahead and cancel\b/i,
      /^can you cancel\b/i,
      /^could you cancel\b/i,
      /^please go ahead and cancel\b/i,
    ],
    // Question words that indicate an informational request, not an action.
    questionIndicators: ["can i", "is it", "is this", "is that", "what", "how", "will i", "would i", "am i", "do i", "should i"],
  },
  {
    intent: "ESCALATION_ACTION",
    actionPatterns: [
      /^(please\s+)?escalate\b/i,
      /^i want to escalate\b/i,
      /^go ahead and escalate\b/i,
      /^can you escalate\b/i,
      /^could you escalate\b/i,
    ],
    questionIndicators: ["can i", "is it", "is this", "is that", "what", "how", "will i", "would i", "am i", "do i", "should i"],
  },
];

/**
 * Classify whether a query is an action request (imperative) vs a question.
 *
 * @param {string} query - The user query.
 * @returns {string|null} The action intent, or null if not an action.
 */
const classifyActionIntent = (query) => {
  if (!query || typeof query !== "string") {
    return null;
  }

  const normalized = query.trim();

  for (const rule of ACTION_INTENT_RULES) {
    // If the query starts with a question word, it's informational, not an action.
    const isQuestion = rule.questionIndicators.some((q) => normalized.toLowerCase().startsWith(q));
    if (isQuestion) {
      continue;
    }

    // Check for imperative/action wording.
    if (rule.actionPatterns.some((pattern) => pattern.test(normalized))) {
      return rule.intent;
    }
  }

  return null;
};

/**
 * Classify the intent of a query using deterministic keyword rules.
 *
 * @param {string} query - The user query.
 * @returns {string} The classified intent.
 */
const classifyIntent = (query) => {
  if (!query || typeof query !== "string") {
    return "UNKNOWN";
  }

  const normalized = query.toLowerCase();

  // First check for action intents (imperative requests).
  const actionIntent = classifyActionIntent(query);
  if (actionIntent) {
    return actionIntent;
  }

  // Check intents in priority order (more specific rules take priority)
  for (const rule of INTENT_RULES) {
    if (rule.keywords.some((kw) => normalized.includes(kw))) {
      return rule.intent;
    }
  }

  return "GENERAL_KNOWLEDGE";
};

/**
 * Build a normalized request context.
 *
 * @param {object} input
 * @param {string} input.query - The user query.
 * @param {string} [input.accountId] - Explicit account ID (optional).
 * @param {string} [input.orderId] - Explicit order ID (optional).
 * @param {string} [input.ticketId] - Explicit ticket ID (optional).
 * @param {object} [input.conversationContext] - Optional conversation context.
 * @returns {object} The normalized request context.
 */
const buildRequestContext = ({
  query,
  accountId,
  orderId,
  ticketId,
  conversationContext,
  referenceTime,
} = {}) => {
  if (!query || typeof query !== "string" || query.trim().length === 0) {
    throw new Error("query is required");
  }

  const requestId = crypto.randomUUID();
  const extracted = extractEntities(query);

  // Explicit IDs take precedence over extracted ones
  const entities = {
    ...extracted,
    ...(accountId ? { accountId } : {}),
    ...(orderId ? { orderId } : {}),
    ...(ticketId ? { ticketId } : {}),
  };

  const intent = classifyIntent(query);

  return {
    requestId,
    query: query.trim(),
    accountId: entities.accountId || null,
    orderId: entities.orderId || null,
    ticketId: entities.ticketId || null,
    intent,
    entities,
    conversationContext: conversationContext || null,
    referenceTime: referenceTime || new Date().toISOString(),
  };
};

module.exports = {
  extractEntities,
  classifyIntent,
  classifyActionIntent,
  buildRequestContext,
  ENTITY_PATTERNS,
  INTENT_RULES,
  ACTION_INTENT_RULES,
};