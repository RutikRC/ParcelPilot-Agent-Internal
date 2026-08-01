/**
 * @typedef {Object} SearchRequestDTO
 * @property {string} query - The search query text
 * @property {number} limit - Maximum number of results to return (default: 5)
 */

/**
 * @typedef {Object} SearchResultDTO
 * @property {string} documentId - UUID of the document
 * @property {string} documentTitle - Title of the document
 * @property {number} chunkIndex - Index of the chunk within the document
 * @property {string} chunkText - The text content of the chunk
 * @property {number} similarity - Cosine similarity score (0-1, higher = more similar)
 */

module.exports = {};