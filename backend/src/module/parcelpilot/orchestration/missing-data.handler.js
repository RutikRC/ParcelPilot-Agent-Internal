/**
 * Missing data handler — identifies required missing information.
 *
 * Distinguishes UNKNOWN (not provided) from NOT_FOUND (provided but absent).
 */

// Required fields per intent.
// The contextKey maps to the camelCase property in the request context.
const REQUIRED_FIELDS = {
  CANCELLATION_QUESTION: [
    { field: "order_id", contextKey: "orderId", reason: "Cancellation evaluation requires an order" },
  ],
  SERVICE_CREDIT_QUESTION: [
    { field: "order_id", contextKey: "orderId", reason: "Service credit calculation requires an order" },
  ],
  SLA_QUESTION: [
    { field: "ticket_id", contextKey: "ticketId", reason: "SLA calculation requires a ticket" },
  ],
  ESCALATION_QUESTION: [
    { field: "ticket_id", contextKey: "ticketId", reason: "Escalation evaluation requires a ticket" },
  ],
  ACCOUNT_LOOKUP: [
    { field: "account_id", contextKey: "accountId", reason: "Account lookup requires an account" },
  ],
  ORDER_LOOKUP: [
    { field: "order_id", contextKey: "orderId", reason: "Order lookup requires an order" },
  ],
  TICKET_LOOKUP: [
    { field: "ticket_id", contextKey: "ticketId", reason: "Ticket lookup requires a ticket" },
  ],
};

/**
 * Map a snake_case field name to the camelCase request-context key.
 *
 * @param {string} field - The snake_case field name (e.g. "order_id").
 * @returns {string|null} The camelCase context key (e.g. "orderId"), or null.
 */
const fieldToContextKey = (field) => {
  const map = {
    order_id: "orderId",
    account_id: "accountId",
    ticket_id: "ticketId",
  };
  return map[field] || null;
};

/**
 * Detect missing information for a request.
 *
 * @param {object} context - The request context.
 * @param {object} evidence - The aggregated evidence.
 * @returns {Array<object>} Array of missing field descriptors.
 */
const detectMissingInformation = (context, evidence) => {
  if (!context) {
    return [];
  }

  const missing = [];
  const required = REQUIRED_FIELDS[context.intent] || [];

  for (const req of required) {
    const field = req.field;
    const contextKey = req.contextKey || fieldToContextKey(field);
    const value = context[contextKey];

    if (!value) {
      missing.push({
        field,
        reason: req.reason,
        state: "UNKNOWN",
      });
    }
  }

  // Check for NOT_FOUND states from tool execution
  const warnings = evidence?.warnings || [];
  for (const warning of warnings) {
    if (warning.errorCode === "NOT_FOUND") {
      const field = mapToolToField(warning.tool);
      if (field) {
        missing.push({
          field,
          reason: warning.message,
          state: "NOT_FOUND",
        });
      }
    }
  }

  return missing;
};

/**
 * Map a tool name to the field it looks up.
 *
 * @param {string} tool - The tool name.
 * @returns {string|null} The field name, or null.
 */
const mapToolToField = (tool) => {
  switch (tool) {
    case "get_order":
      return "order_id";
    case "get_account":
      return "account_id";
    case "get_ticket":
      return "ticket_id";
    default:
      return null;
  }
};

module.exports = {
  REQUIRED_FIELDS,
  detectMissingInformation,
  mapToolToField,
};