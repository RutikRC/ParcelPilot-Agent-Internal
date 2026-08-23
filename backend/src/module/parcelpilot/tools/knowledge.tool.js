const crypto = require("crypto");

const aiClient = require("../../queue/services/ai.client");
const knowledgeRepository = require("../repositories/knowledge.repository");
const policyService = require("../services/policy.service");
const AppError = require("../../../utils/AppError");
const logger = require("../../../utils/logger");

/**
 * Knowledge tool — agent-facing retrieval tool.
 *
 * This tool wraps the existing semantic search pipeline and applies
 * source precedence and conflict handling so the agent receives
 * authoritative evidence rather than raw vector search results.
 */

/**
 * Search the knowledge base with source precedence applied.
 *
 * @param {object} params
 * @param {string} params.query - The search query.
 * @param {number} [params.limit] - Maximum results (default: 10).
 * @param {string} [params.documentType] - Filter by document type.
 * @param {string} [params.documentStatus] - Filter by document status.
 * @param {string} [params.accountId] - Filter by account (for customer agreements).
 * @param {boolean} [params.includeDeprecated] - Include deprecated sources.
 * @returns {Promise<object>} { results, authoritative, supporting, conflicts, deprecated }
 */
const searchKnowledge = async ({
  query,
  limit = 10,
  documentType,
  documentStatus,
  accountId,
  includeDeprecated = false,
}) => {
  const traceId = crypto.randomUUID();
  const startTime = Date.now();

  if (!query || typeof query !== "string" || query.trim().length === 0) {
    throw new AppError("Query is required for knowledge search", 400);
  }

  logger.info("Knowledge search started", {
    traceId,
    queryLength: query.length,
    limit,
    documentType,
    documentStatus,
    accountId,
  });

  // 1. Generate query embedding via FastAPI
  let embeddingResult;
  try {
    embeddingResult = await aiClient.generateQueryEmbedding({
      query,
      traceId,
    });
  } catch (error) {
    logger.error("Failed to generate query embedding for knowledge search", {
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

  const { embedding } = embeddingResult;

  if (!embedding || embedding.length !== 768) {
    throw new AppError(
      `Query embedding dimension mismatch: expected 768, got ${embedding?.length || 0}`,
      502
    );
  }

  // 2. Execute knowledge search with filters.
  let chunks;
  try {
    chunks = await knowledgeRepository.searchKnowledgeChunks(embedding, {
      limit,
      documentType,
      documentStatus,
      accountId,
    });
  } catch (error) {
    logger.error("Failed to execute knowledge search", {
      traceId,
      error: error.message,
    });

    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError(
      `Knowledge search failed: ${error.message}`,
      500
    );
  }

  // 3. When NO account is identified, exclude customer-specific agreements
  //    because they are only applicable to their owning account. Generic
  //    policy questions should surface global/current policy sources.
  let applicableChunks = chunks;
  if (!accountId) {
    applicableChunks = chunks.filter((c) => c.documentType !== "customer_agreement");
  }

  // 4. Apply source precedence and conflict handling
  const evidence = policyService.selectAuthoritativeEvidence(applicableChunks, {
    includeDeprecated,
  });

  const duration = Date.now() - startTime;

  logger.info("Knowledge search completed", {
    traceId,
    executionTimeMs: duration,
    returnedChunkCount: applicableChunks.length,
    authoritativeCount: evidence.authoritative.length,
    supportingCount: evidence.supporting.length,
    conflictCount: evidence.conflicts.length,
    deprecatedCount: evidence.deprecated.length,
  });

  return {
    results: applicableChunks,
    ...evidence,
  };
};

module.exports = {
  searchKnowledge,
};