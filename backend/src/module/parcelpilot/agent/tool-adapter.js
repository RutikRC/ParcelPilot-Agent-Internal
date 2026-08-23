const toolRegistry = require("../tools");

/**
 * Tool adapter — translates existing ParcelPilot tools into the format
 * required by the agent/LLM.
 *
 * Preserves tool name, description, input schema, and output. Tool
 * execution still goes through the existing tool registry.
 */

/**
 * Get the list of tools available to the agent.
 *
 * @returns {Array<object>} Array of tool descriptors.
 */
const getAgentTools = () => {
  return toolRegistry.getToolMetadata();
};

/**
 * Execute a tool by name through the existing registry.
 *
 * @param {string} toolName - The tool name.
 * @param {object} params - The tool parameters.
 * @returns {Promise<object>} The tool result.
 */
const executeTool = async (toolName, params = {}) => {
  return toolRegistry.executeTool(toolName, params);
};

module.exports = {
  getAgentTools,
  executeTool,
};