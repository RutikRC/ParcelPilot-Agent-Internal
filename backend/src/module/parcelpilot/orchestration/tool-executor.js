const toolRegistry = require("../tools");
const AppError = require("../../../utils/AppError");
const logger = require("../../../utils/logger");

/**
 * Tool executor — executes planned tools in dependency order.
 *
 * Uses the existing tool registry. Preserves execution order and passes
 * outputs into dependent tools. Captures success/failure and metadata.
 */

/**
 * Execute a single tool with error handling.
 *
 * @param {string} toolName - The tool name.
 * @param {object} params - The tool parameters.
 * @returns {Promise<object>} { tool, status, data | error_code, message, duration_ms }
 */
const executeSingleTool = async (toolName, params = {}) => {
  const startTime = Date.now();

  try {
    const data = await toolRegistry.executeTool(toolName, params);

    return {
      tool: toolName,
      status: "success",
      data,
      duration_ms: Date.now() - startTime,
    };
  } catch (error) {
    const duration = Date.now() - startTime;

    // Map AppError to a structured error without exposing internals
    const errorCode = error instanceof AppError ? mapErrorCode(error) : "TOOL_EXECUTION_FAILED";
    const message = error instanceof AppError ? error.message : "Tool execution failed";

    logger.warn("Tool execution failed", {
      tool: toolName,
      errorCode,
      duration_ms: duration,
    });

    return {
      tool: toolName,
      status: "error",
      error_code: errorCode,
      message,
      duration_ms: duration,
    };
  }
};

/**
 * Map an AppError to a stable error code.
 *
 * @param {AppError} error - The AppError instance.
 * @returns {string} The error code.
 */
const mapErrorCode = (error) => {
  if (error.statusCode === 404) {
    return "NOT_FOUND";
  }
  if (error.statusCode === 400) {
    return "INVALID_PARAMETERS";
  }
  if (error.statusCode === 401) {
    return "UNAUTHORIZED";
  }
  if (error.statusCode === 403) {
    return "FORBIDDEN";
  }
  return "TOOL_EXECUTION_FAILED";
};

/**
 * Execute a tool plan with dependency resolution.
 *
 * @param {object} plan - The tool plan from tool-planner.
 * @param {object} context - The request context.
 * @returns {Promise<object>} { results, errors }
 */
const executePlan = async (plan, context) => {
  if (!plan || !plan.steps || plan.steps.length === 0) {
    return { results: [], errors: [] };
  }

  const results = [];
  const errors = [];
  const outputMap = {}; // tool name -> output data

  // Build dependency graph
  const steps = plan.steps.map((step, index) => ({
    ...step,
    index,
    executed: false,
  }));

  // Execute steps in dependency order
  let remaining = [...steps];
  let progress = true;

  while (remaining.length > 0 && progress) {
    progress = false;

    for (const step of remaining) {
      // Check if all dependencies are satisfied
      const depsSatisfied = step.dependsOn.every((dep) => outputMap[dep] !== undefined);

      if (!depsSatisfied) {
        continue;
      }

      // Build params from context and previous outputs
      const params = buildParams(step.tool, context, outputMap);

      const result = await executeSingleTool(step.tool, params);
      results.push(result);

      if (result.status === "success") {
        outputMap[step.tool] = result.data;
      } else {
        errors.push(result);
      }

      step.executed = true;
      progress = true;
    }

    // Remove executed steps
    remaining = remaining.filter((step) => !step.executed);
  }

  // Any remaining steps have unsatisfied dependencies
  for (const step of remaining) {
    const result = {
      tool: step.tool,
      status: "skipped",
      error_code: "DEPENDENCY_FAILED",
      message: "Skipped because a dependency failed",
      duration_ms: 0,
    };
    results.push(result);
    errors.push(result);
  }

  return { results, errors };
};

/**
 * Build tool parameters from context and previous outputs.
 *
 * @param {string} toolName - The tool name.
 * @param {object} context - The request context.
 * @param {object} outputMap - Map of tool name -> output data.
 * @returns {object} The tool parameters.
 */
const buildParams = (toolName, context, outputMap) => {
  const params = {};

  switch (toolName) {
    case "get_order":
      if (context.orderId) params.orderId = context.orderId;
      break;

    case "get_account":
      if (context.accountId) {
        params.accountId = context.accountId;
      } else if (outputMap.get_order && outputMap.get_order.accountId) {
        params.accountId = outputMap.get_order.accountId;
      } else if (outputMap.get_ticket && outputMap.get_ticket.accountId) {
        params.accountId = outputMap.get_ticket.accountId;
      }
      break;

    case "get_customer_agreement":
      if (context.accountId) {
        params.accountId = context.accountId;
      } else if (outputMap.get_account && outputMap.get_account.accountId) {
        params.accountId = outputMap.get_account.accountId;
      }
      break;

    case "get_ticket":
      if (context.ticketId) params.ticketId = context.ticketId;
      break;

    case "search_tickets":
      if (context.accountId) params.accountId = context.accountId;
      if (context.ticketId) params.ticketId = context.ticketId;
      break;

    case "evaluate_cancellation":
      if (context.orderId) params.orderId = context.orderId;
      if (context.referenceTime) params.referenceTime = context.referenceTime;
      break;

    case "calculate_service_credit":
      if (context.orderId) params.orderId = context.orderId;
      if (context.referenceTime) params.referenceTime = context.referenceTime;
      break;

    case "calculate_sla_status":
      if (context.ticketId) params.ticketId = context.ticketId;
      if (context.referenceTime) params.referenceTime = context.referenceTime;
      break;

    case "evaluate_sla_risk":
      if (context.accountId) params.accountId = context.accountId;
      if (context.referenceTime) params.referenceTime = context.referenceTime;
      break;

    case "evaluate_escalation":
      if (context.ticketId) params.ticketId = context.ticketId;
      if (context.referenceTime) params.referenceTime = context.referenceTime;
      break;

    case "search_knowledge": {
      params.query = context.query;
      // When an account is already known from context, filter to it.
      // Otherwise, if an account was resolved during execution (via
      // get_account or get_order), pass that resolved account so that
      // customer-specific agreements for OTHER accounts are excluded.
      let resolvedAccountId = context.accountId;
      if (!resolvedAccountId && outputMap.get_account && outputMap.get_account.accountId) {
        resolvedAccountId = outputMap.get_account.accountId;
      }
      if (!resolvedAccountId && outputMap.get_order && outputMap.get_order.accountId) {
        resolvedAccountId = outputMap.get_order.accountId;
      }
      if (!resolvedAccountId && outputMap.get_ticket && outputMap.get_ticket.accountId) {
        resolvedAccountId = outputMap.get_ticket.accountId;
      }
      if (resolvedAccountId) params.accountId = resolvedAccountId;
      break;
    }

    case "list_accounts":
    case "list_orders":
    case "list_tickets":
      break;

    default:
      break;
  }

  return params;
};

module.exports = {
  executeSingleTool,
  executePlan,
  buildParams,
};