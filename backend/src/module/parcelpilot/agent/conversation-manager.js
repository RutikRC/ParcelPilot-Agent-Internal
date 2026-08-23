const crypto = require("crypto");

/**
 * Conversation manager — in-memory conversation state storage.
 *
 * Provides a clean abstraction for conversation persistence. Uses an
 * in-memory Map behind the abstraction so it can be replaced with a
 * database-backed store later without changing callers.
 */

// In-memory store: conversationId -> conversation state
const store = new Map();

// Maximum number of messages retained per conversation
const MAX_MESSAGES = 50;

/**
 * Create a new conversation.
 *
 * @returns {object} { conversationId, messages, state }
 */
const createConversation = () => {
  const conversationId = crypto.randomUUID();
  const conversation = {
    conversationId,
    messages: [],
    state: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  store.set(conversationId, conversation);
  return conversation;
};

/**
 * Get a conversation by ID.
 *
 * @param {string} conversationId - The conversation identifier.
 * @returns {object|null} The conversation, or null if not found.
 */
const getConversation = (conversationId) => {
  if (!conversationId) {
    return null;
  }
  return store.get(conversationId) || null;
};

/**
 * Append a message to a conversation.
 *
 * @param {string} conversationId - The conversation identifier.
 * @param {object} message - { role: "user"|"assistant", content: string }.
 * @returns {object|null} The updated conversation, or null if not found.
 */
const appendMessage = (conversationId, message) => {
  const conversation = getConversation(conversationId);
  if (!conversation) {
    return null;
  }

  conversation.messages.push(message);

  // Trim old messages to bound memory
  if (conversation.messages.length > MAX_MESSAGES) {
    conversation.messages = conversation.messages.slice(-MAX_MESSAGES);
  }

  conversation.updatedAt = new Date().toISOString();
  return conversation;
};

/**
 * Update the state of a conversation.
 *
 * @param {string} conversationId - The conversation identifier.
 * @param {object} patch - Partial state to merge.
 * @returns {object|null} The updated conversation, or null if not found.
 */
const updateState = (conversationId, patch) => {
  const conversation = getConversation(conversationId);
  if (!conversation) {
    return null;
  }

  conversation.state = {
    ...(conversation.state || {}),
    ...patch,
  };
  conversation.updatedAt = new Date().toISOString();
  return conversation;
};

/**
 * Get the message history for a conversation.
 *
 * @param {string} conversationId - The conversation identifier.
 * @returns {Array<object>} Array of messages.
 */
const getMessages = (conversationId) => {
  const conversation = getConversation(conversationId);
  return conversation ? conversation.messages : [];
};

/**
 * Clear all conversations (for tests).
 */
const clearAll = () => {
  store.clear();
};

module.exports = {
  createConversation,
  getConversation,
  appendMessage,
  updateState,
  getMessages,
  clearAll,
};