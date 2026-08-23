const AppError = require("../../../utils/AppError");

const accountTool = require("./account.tool");
const orderTool = require("./order.tool");
const ticketTool = require("./ticket.tool");
const agreementTool = require("./agreement.tool");
const knowledgeTool = require("./knowledge.tool");
const slaTool = require("./sla.tool");
const cancellationTool = require("./cancellation.tool");
const serviceCreditTool = require("./service-credit.tool");
const escalationTool = require("./escalation.tool");

/**
 * Tool registry — exposes all ParcelPilot agent tools.
 *
 * Each tool is a function that takes a params object and returns a result.
 * Tools are deterministic and enforce authorization at the data layer.
 */

const TOOLS = {
  get_account: {
    name: "get_account",
    description:
      "Get account details by account_id or account_name. Returns plan, status, premium support, and contract file.",
    handler: accountTool.getAccount,
    params: {
      accountId: { type: "string", required: false },
      accountName: { type: "string", required: false },
    },
  },
  list_accounts: {
    name: "list_accounts",
    description: "List accounts with optional filters (plan, status, premiumSupport).",
    handler: accountTool.listAccounts,
    params: {
      plan: { type: "string", required: false },
      status: { type: "string", required: false },
      premiumSupport: { type: "boolean", required: false },
    },
  },
  get_order: {
    name: "get_order",
    description:
      "Get order details by order_id. Returns carrier, status, pickup window, fees, and fault flags.",
    handler: orderTool.getOrder,
    params: {
      orderId: { type: "string", required: true },
    },
  },
  list_orders: {
    name: "list_orders",
    description: "List orders with optional filters (accountId, status, carrier).",
    handler: orderTool.listOrders,
    params: {
      accountId: { type: "string", required: false },
      status: { type: "string", required: false },
      carrier: { type: "string", required: false },
    },
  },
  get_ticket: {
    name: "get_ticket",
    description:
      "Get ticket details by ticket_id. Returns status, subject, description, channel, and historical resolution.",
    handler: ticketTool.getTicket,
    params: {
      ticketId: { type: "string", required: true },
    },
  },
  search_tickets: {
    name: "search_tickets",
    description:
      "Search tickets with optional filters (accountId, status, channel, assignedTo, search text).",
    handler: ticketTool.searchTickets,
    params: {
      accountId: { type: "string", required: false },
      status: { type: "string", required: false },
      channel: { type: "string", required: false },
      assignedTo: { type: "string", required: false },
      search: { type: "string", required: false },
      limit: { type: "number", required: false },
    },
  },
  get_customer_agreement: {
    name: "get_customer_agreement",
    description:
      "Get the customer-specific agreement for an account. Returns the agreement document reference.",
    handler: agreementTool.getCustomerAgreement,
    params: {
      accountId: { type: "string", required: true },
    },
  },
  search_knowledge: {
    name: "search_knowledge",
    description:
      "Search the knowledge base (policies, SOPs, product docs, customer agreements) with source precedence applied.",
    handler: knowledgeTool.searchKnowledge,
    params: {
      query: { type: "string", required: true },
      limit: { type: "number", required: false },
      documentType: { type: "string", required: false },
      documentStatus: { type: "string", required: false },
      accountId: { type: "string", required: false },
      includeDeprecated: { type: "boolean", required: false },
    },
  },
  calculate_sla_status: {
    name: "calculate_sla_status",
    description:
      "Calculate SLA status for a ticket. Returns SLA target, deadline, remaining time, and status.",
    handler: slaTool.calculateSlaStatus,
    params: {
      ticketId: { type: "string", required: true },
      priority: { type: "string", required: false },
      referenceTime: { type: "string", required: false },
    },
  },
  evaluate_sla_risk: {
    name: "evaluate_sla_risk",
    description:
      "Evaluate SLA risk for a list of tickets. Returns SLA status for each ticket.",
    handler: slaTool.evaluateSlaRisk,
    params: {
      accountId: { type: "string", required: false },
      status: { type: "string", required: false },
      referenceTime: { type: "string", required: false },
      limit: { type: "number", required: false },
    },
  },
  evaluate_cancellation: {
    name: "evaluate_cancellation",
    description:
      "Evaluate cancellation eligibility for an order. Returns eligibility, fee, and reason.",
    handler: cancellationTool.evaluateCancellation,
    params: {
      orderId: { type: "string", required: true },
      referenceTime: { type: "string", required: false },
    },
  },
  calculate_service_credit: {
    name: "calculate_service_credit",
    description:
      "Calculate service credit eligibility for an order. Returns eligibility, credit amount, and reason.",
    handler: serviceCreditTool.calculateServiceCredit,
    params: {
      orderId: { type: "string", required: true },
      referenceTime: { type: "string", required: false },
    },
  },
  evaluate_escalation: {
    name: "evaluate_escalation",
    description:
      "Evaluate escalation requirements for a ticket. Returns whether escalation is needed and target team.",
    handler: escalationTool.evaluateEscalation,
    params: {
      ticketId: { type: "string", required: true },
      priority: { type: "string", required: false },
      referenceTime: { type: "string", required: false },
    },
  },
};

/**
 * Execute a tool by name.
 *
 * @param {string} toolName - The tool name (e.g. "get_account").
 * @param {object} params - The tool parameters.
 * @returns {Promise<object>} The tool result.
 */
const executeTool = async (toolName, params = {}) => {
  const tool = TOOLS[toolName];
  if (!tool) {
    throw new AppError(`Unknown tool: ${toolName}`, 400);
  }

  return tool.handler(params);
};

/**
 * Get tool metadata for UI/agent planning.
 *
 * @returns {Array<object>} Array of tool descriptors.
 */
const getToolMetadata = () => {
  return Object.values(TOOLS).map((tool) => ({
    name: tool.name,
    description: tool.description,
    params: tool.params,
  }));
};

module.exports = {
  TOOLS,
  executeTool,
  getToolMetadata,
};