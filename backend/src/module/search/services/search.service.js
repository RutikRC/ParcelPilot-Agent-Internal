const crypto = require("crypto");

const aiClient = require("../../queue/services/ai.client");
const searchRepository = require("../repositories/search.repository");
const AppError = require("../../../utils/AppError");
const logger = require("../../../utils/logger");

/**
 * Search service — orchestrates the semantic retrieval pipeline.
 *
 * 1. Validates the request.
 * 2. Calls FastAPI to generate a query embedding.
 * 3. Calls the repository to perform pgvector similarity search.
 * 4. Transforms the database response into the API response format.
 */

/**
 * Perform a semantic search across document chunks.
 *
 * @param {object} params
 * @param {string} params.query - The search query text.
 * @param {number} params.limit - Maximum number of results (default: 5).
 * @returns {Promise<{results: Array<{documentId: string, documentTitle: string, chunkIndex: number, chunkText: string, similarity: number}>}>}
 */
const search = async ({ query, limit = 5 }) => {
  const traceId = crypto.randomUUID();
  const startTime = Date.now();

  // 1. Validate input
  if (!query || typeof query !== "string" || query.trim().length === 0) {
    throw new AppError("Search query is required", 400);
  }

  const safeLimit = Math.min(Math.max(1, limit), 100);

  logger.info("Semantic search started", {
    traceId,
    queryLength: query.length,
    limit: safeLimit,
  });

  // 2. Generate query embedding via FastAPI
  let embeddingResult;
  try {
    embeddingResult = await aiClient.generateQueryEmbedding({
      query,
      traceId,
    });
  } catch (error) {
    logger.error("Failed to generate query embedding", {
      traceId,
      error: error.message,
    });

    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError(
      `Query embedding generation failed: ${error.message}`,
      502
    );
  }

  const { embedding, dimension } = embeddingResult;

  // 3. Validate embedding dimension
  if (!embedding || embedding.length !== 768) {
    throw new AppError(
      `Query embedding dimension mismatch: expected 768, got ${embedding?.length || 0}`,
      502
    );
  }

  // 4. Execute pgvector similarity search
  let chunks;
  try {
    chunks = await searchRepository.searchSimilarChunks(embedding, safeLimit);
  } catch (error) {
    logger.error("Failed to execute similarity search", {
      traceId,
      error: error.message,
    });

    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError(
      `Similarity search failed: ${error.message}`,
      500
    );
  }

  const duration = Date.now() - startTime;

  // 5. Log results summary
  logger.info("Semantic search completed", {
    traceId,
    executionTimeMs: duration,
    returnedChunkCount: chunks.length,
    topSimilarity: chunks.length > 0 ? chunks[0].similarity : null,
    questionLength: query.length,
  });

  return { results: chunks };
};

module.exports = {
  search,
};