const crypto = require("crypto");
const parcelpilotService = require("../services/parcelpilot.service");
const orchestrationService = require("../services/orchestration.service");
const agentService = require("../agent/agent.service");

/**
 * POST /api/v1/parcelpilot/tools/execute
 *
 * Execute a single ParcelPilot tool.
 */
const executeTool = async (req, res, next) => {
  try {
    const traceId = crypto.randomUUID();
    const { toolName, toolParams } = req.body;

    const result = await parcelpilotService.executeTool({
      toolName,
      toolParams,
    });

    return res.status(200).json({
      success: true,
      message: "Tool executed successfully",
      data: result,
      traceId,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/parcelpilot/tools
 *
 * List all available ParcelPilot tools with metadata.
 */
const listTools = async (req, res, next) => {
  try {
    const traceId = crypto.randomUUID();
    const tools = parcelpilotService.getTools();

    return res.status(200).json({
      success: true,
      message: "Tools retrieved successfully",
      data: tools,
      traceId,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/parcelpilot/source-precedence
 *
 * Get the source precedence order.
 */
const getSourcePrecedence = async (req, res, next) => {
  try {
    const traceId = crypto.randomUUID();
    const precedence = parcelpilotService.getSourcePrecedence();

    return res.status(200).json({
      success: true,
      message: "Source precedence retrieved successfully",
      data: precedence,
      traceId,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/parcelpilot/orchestrate
 *
 * Orchestrate a request through the full pipeline and return
 * the structured decision context.
 */
const orchestrate = async (req, res, next) => {
  try {
    const traceId = crypto.randomUUID();
    const { query, accountId, orderId, ticketId, conversationContext } = req.body;

    const result = await orchestrationService.orchestrateRequest({
      query,
      accountId,
      orderId,
      ticketId,
      conversationContext,
    });

    return res.status(200).json({
      success: true,
      message: "Request orchestrated successfully",
      data: result,
      traceId,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/parcelpilot/chat
 *
 * Process a conversational message through the agent.
 */
const chat = async (req, res, next) => {
  try {
    const traceId = crypto.randomUUID();
    const { conversationId, message, referenceTime } = req.body;

    const result = await agentService.processMessage({
      conversationId,
      message,
      referenceTime,
    });

    return res.status(200).json({
      success: true,
      message: "Message processed successfully",
      data: result,
      traceId,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  executeTool,
  listTools,
  getSourcePrecedence,
  orchestrate,
  chat,
};
