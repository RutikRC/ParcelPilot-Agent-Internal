/**
 * Tool planner — determines which existing tools are required for a request.
 *
 * The planner creates a structured plan with sequential dependencies.
 * It does NOT execute tools.
 */

/**
 * Build a tool plan for a given request context.
 *
 * @param {object} context - The request context from request-context.builder.
 * @returns {object} The tool plan with steps and dependencies.
 */
const planTools = (context) => {
  if (!context) {
    return { intent: "UNKNOWN", steps: [] };
  }

  const { intent, orderId, accountId, ticketId } = context;
  const steps = [];

  switch (intent) {
    case "CANCELLATION_QUESTION":
    case "CANCELLATION_ACTION": {
      if (orderId) {
        steps.push({ tool: "get_order", reason: "Need order state", dependsOn: [] });
        steps.push({ tool: "get_account", reason: "Need customer context", dependsOn: ["get_order"] });
        steps.push({ tool: "get_customer_agreement", reason: "Need customer-specific policy", dependsOn: ["get_account"] });
        steps.push({ tool: "evaluate_cancellation", reason: "Need deterministic cancellation decision", dependsOn: ["get_order", "get_account"] });
        // search_knowledge depends on get_account so the resolved account
        // is available to filter out other customers' agreements.
        steps.push({ tool: "search_knowledge", reason: "Need authoritative policy evidence", dependsOn: ["get_account"] });
      } else {
        steps.push({ tool: "search_knowledge", reason: "Need cancellation policy evidence", dependsOn: [] });
      }
      break;
    }

    case "SERVICE_CREDIT_QUESTION": {
      if (orderId) {
        steps.push({ tool: "get_order", reason: "Need order state", dependsOn: [] });
        steps.push({ tool: "get_account", reason: "Need customer context", dependsOn: ["get_order"] });
        steps.push({ tool: "get_customer_agreement", reason: "Need customer-specific policy", dependsOn: ["get_account"] });
        steps.push({ tool: "calculate_service_credit", reason: "Need deterministic service credit decision", dependsOn: ["get_order", "get_account"] });
        steps.push({ tool: "search_knowledge", reason: "Need service credit policy evidence", dependsOn: ["get_account"] });
      } else {
        steps.push({ tool: "search_knowledge", reason: "Need service credit policy evidence", dependsOn: [] });
      }
      break;
    }

    case "SLA_QUESTION": {
      if (ticketId) {
        steps.push({ tool: "get_ticket", reason: "Need ticket state", dependsOn: [] });
        steps.push({ tool: "get_account", reason: "Need customer context", dependsOn: ["get_ticket"] });
        steps.push({ tool: "calculate_sla_status", reason: "Need deterministic SLA calculation", dependsOn: ["get_ticket", "get_account"] });
        steps.push({ tool: "search_knowledge", reason: "Need SLA policy evidence", dependsOn: ["get_account"] });
      } else if (accountId) {
        steps.push({ tool: "get_account", reason: "Need customer context", dependsOn: [] });
        steps.push({ tool: "search_tickets", reason: "Need tickets for SLA evaluation", dependsOn: ["get_account"] });
        steps.push({ tool: "evaluate_sla_risk", reason: "Need deterministic SLA risk evaluation", dependsOn: ["get_account", "search_tickets"] });
        steps.push({ tool: "search_knowledge", reason: "Need SLA policy evidence", dependsOn: ["get_account"] });
      } else {
        steps.push({ tool: "search_knowledge", reason: "Need SLA policy evidence", dependsOn: [] });
      }
      break;
    }

    case "ESCALATION_QUESTION":
    case "ESCALATION_ACTION": {
      if (ticketId) {
        steps.push({ tool: "get_ticket", reason: "Need ticket state", dependsOn: [] });
        steps.push({ tool: "get_account", reason: "Need customer context", dependsOn: ["get_ticket"] });
        steps.push({ tool: "evaluate_escalation", reason: "Need deterministic escalation decision", dependsOn: ["get_ticket", "get_account"] });
        steps.push({ tool: "search_knowledge", reason: "Need escalation policy evidence", dependsOn: ["get_account"] });
      } else {
        steps.push({ tool: "search_knowledge", reason: "Need escalation policy evidence", dependsOn: [] });
      }
      break;
    }

    case "POLICY_QUESTION": {
      steps.push({ tool: "search_knowledge", reason: "Need policy evidence", dependsOn: [] });
      break;
    }

    case "ACCOUNT_LOOKUP": {
      if (accountId) {
        steps.push({ tool: "get_account", reason: "Need account details", dependsOn: [] });
        steps.push({ tool: "get_customer_agreement", reason: "Need customer agreement", dependsOn: ["get_account"] });
      } else {
        steps.push({ tool: "list_accounts", reason: "Need account list", dependsOn: [] });
      }
      break;
    }

    case "ORDER_LOOKUP": {
      if (orderId) {
        steps.push({ tool: "get_order", reason: "Need order details", dependsOn: [] });
        steps.push({ tool: "get_account", reason: "Need customer context", dependsOn: ["get_order"] });
      } else {
        steps.push({ tool: "list_orders", reason: "Need order list", dependsOn: [] });
      }
      break;
    }

    case "TICKET_LOOKUP": {
      if (ticketId) {
        steps.push({ tool: "get_ticket", reason: "Need ticket details", dependsOn: [] });
        steps.push({ tool: "get_account", reason: "Need customer context", dependsOn: ["get_ticket"] });
      } else {
        steps.push({ tool: "search_tickets", reason: "Need ticket list", dependsOn: [] });
      }
      break;
    }

    case "GENERAL_KNOWLEDGE":
    default: {
      steps.push({ tool: "search_knowledge", reason: "Need knowledge evidence", dependsOn: [] });
      break;
    }
  }

  return {
    intent,
    steps,
  };
};

module.exports = {
  planTools,
};