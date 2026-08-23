const agentService = require("./agent.service");
const conversationManager = require("./conversation-manager");
const { SYSTEM_PROMPT } = require("./agent.prompt");
const { createAgentResponse, isValidResponse } = require("./output-schema");
const { buildResponse } = require("./response-builder");
const toolAdapter = require("./tool-adapter");

/**
 * Agent module — combines all agent components.
 */

module.exports = {
  agentService,
  conversationManager,
  SYSTEM_PROMPT,
  createAgentResponse,
  isValidResponse,
  buildResponse,
  toolAdapter,
};