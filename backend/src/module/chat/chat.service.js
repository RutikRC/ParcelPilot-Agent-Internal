const crypto = require("crypto");

const aiClient = require("../queue/services/ai.client");
const searchService = require("../search/services/search.service");
const AppError = require("../../utils/AppError");
const logger = require("../../utils/logger");

/**
 * Chat service — orchestrates the full RAG pipeline.
 *
 * 1. Receives the user question.
 * 2. Calls the existing semantic search to retrieve relevant chunks.
 * 3. Calls FastAPI RAG generation endpoint with question + chunks.
 * 4. Returns the final answer along with source references.
 */

/**
 * Answer a user question using RAG (Retrieval-Augmented Generation).
 *
 * @param {object} params
 * @param {string} params.question - The user's question.
 * @returns {Promise<{answer: string, sources: Array<{documentId: string, documentTitle: string, chunkIndex: number}>}>}
 */
const answer = async ({ question }) => {
  const traceId = crypto.randomUUID();
  const startTime = Date.now();

  // 1. Validate input
  if (!question || typeof question !== "string" || question.trim().length === 0) {
    throw new AppError("Question is required", 400);
  }

  logger.info("RAG chat started", {
    traceId,
    questionLength: question.length,
  });

  // 2. Retrieve relevant chunks via the existing semantic search pipeline
  let searchResult;
  try {
    searchResult = await searchService.search({ query: question, limit: 5 });
  } catch (error) {
    logger.error("Failed to retrieve chunks for RAG", {
      traceId,
      error: error.message,
    });

    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError(
      `Chunk retrieval failed for RAG: ${error.message}`,
      502
    );
  }

  const chunks = searchResult.results || [];

  if (chunks.length === 0) {
    logger.warn("No relevant chunks found for question", {
      traceId,
      questionLength: question.length,
    });

    return {
      answer: "I could not find any relevant information in the document repository to answer your question.",
      sources: [],
    };
  }

  // 3. Build context array for FastAPI
  const context = chunks.map((chunk) => ({
    chunkText: chunk.chunkText,
    documentId: chunk.documentId,
    documentTitle: chunk.documentTitle,
    chunkIndex: chunk.chunkIndex,
  }));

  // 4. Call FastAPI RAG generation
  let generationResult;
  try {
    generationResult = await aiClient.callRagGenerate({
      question,
      context,
      traceId,
    });
  } catch (error) {
    logger.error("Failed to generate RAG answer", {
      traceId,
      error: error.message,
    });

    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError(
      `RAG answer generation failed: ${error.message}`,
      502
    );
  }

  const duration = Date.now() - startTime;

  // 5. Build source references
  const sources = chunks.map((chunk) => ({
    documentId: chunk.documentId,
    documentTitle: chunk.documentTitle,
    chunkIndex: chunk.chunkIndex,
  }));

  logger.info("RAG chat completed", {
    traceId,
    executionTimeMs: duration,
    answerLength: generationResult.answer.length,
    sourceCount: sources.length,
    model: generationResult.model,
  });

  return {
    answer: generationResult.answer,
    sources,
  };
};

module.exports = {
  answer,
};