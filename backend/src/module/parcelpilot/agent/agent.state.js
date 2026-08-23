/**
 * Agent state — structured state for the ParcelPilot conversational agent.
 *
 * Holds conversation context, request context, tool results, decision
 * context, and pending confirmation/action state. Does NOT store secrets.
 */

/**
 * Create a fresh agent state.
 *
 * @param {object} params
 * @param {string} [params.conversationId] - The conversation identifier.
 * @param {string} [params.message] - The current user message.
 * @returns {object} The initial agent state.
 */
const createAgentState = ({ conversationId = null, message = "" } = {}) => ({
  conversationId,
  messages: [],
  currentRequest: message,
  requestContext: null,
  intent: null,
  entities: {},
  toolCalls: [],
  toolResults: [],
  decisionContext: null,
  pendingConfirmation: false,
  pendingAction: null,
  response: null,
  status: "IDLE",
  iterationCount: 0,
});

/**
 * Append a message to the conversation history.
 *
 * @param {object} state - The agent state.
 * @param {object} message - { role: "user"|"assistant", content: string }.
 * @returns {object} The updated state.
 */
const appendMessage = (state, message) => {
  return {
    ...state,
    messages: [...(state.messages || []), message],
  };
};

/**
 * Update the agent state with a partial patch.
 *
 * @param {object} state - The agent state.
 * @param {object} patch - Partial state to merge.
 * @returns {object} The updated state.
 */
const updateState = (state, patch) => {
  return {
    ...state,
    ...patch,
  };
};

module.exports = {
  createAgentState,
  appendMessage,
  updateState,
};