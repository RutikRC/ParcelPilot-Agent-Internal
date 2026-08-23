const crypto = require("crypto");

const toolRegistry = require("../tools");
const policyService = require("./policy.service");
const AppError = require("../../../utils/AppError");
const logger = require("../../../utils/logger");

/**
 * ParcelPilot service — orchestrates the deterministic business tools.
 *
 * This service provides the agent-facing API for the ParcelPilot tools.
 * It handles tool execution, source precedence, and evidence aggregation.
 */

/**
 * Execute a single tool by name.
 *
 * @param {object} params
 * @param {string} params.toolName - The tool name.
 * @param {object} params.toolParams - The tool parameters.
 * @returns {Promise<object>} The tool result.
 */
const executeTool = async ({ toolName, toolParams = {} }) => {
  const traceId = crypto.randomUUID();
  const startTime = Date.now();

  if (!toolName || typeof toolName !== "string") {
    throw new AppError("toolName is required", 400);
  }

  logger.info("ParcelPilot tool execution started", {
    traceId,
    toolName,
  });

  let result;
  try {
    result = await toolRegistry.executeTool(toolName, toolParams);
  } catch (error) {
    logger.error("ParcelPilot tool execution failed", {
      traceId,
      toolName,
      error: error.message,
    });

    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError(
      `Tool ${toolName} execution failed: ${error.message}`,
      500
    );
  }

  const duration = Date.now() - startTime;

  logger.info("ParcelPilot tool execution completed", {
    traceId,
    toolName,
    executionTimeMs: duration,
  });

  return {
    toolName,
    result,
    traceId,
  };
};

/**
 * Get the list of available tools with metadata.
 *
 * @returns {Array<object>} Array of tool descriptors.
 */
const getTools = () => {
  return toolRegistry.getToolMetadata();
};

/**
 * Get the source precedence order.
 *
 * @returns {Array<{type: string, rank: number}>}
 */
const getSourcePrecedence = () => {
  return policyService.getSourcePrecedenceOrder();
};

module.exports = {
  executeTool,
  getTools,
  getSourcePrecedence,
};