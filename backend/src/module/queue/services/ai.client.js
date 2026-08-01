const axios = require("axios");
const AppError = require("../../../utils/AppError");
const logger = require("../../../utils/logger");

const DEFAULT_TIMEOUT = parseInt(process.env.AI_SERVICE_TIMEOUT || "600000", 10);
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";

/**
 * Reusable AI Service HTTP client.
 *
 * Centralises all outbound calls to the Python AI micro-service so that
 * connection configuration (base URL, timeout, error handling) lives in
 * one place.  Add new methods here as the pipeline grows.
 */
class AIClient {
  constructor() {
    this.client = axios.create({
      baseURL: AI_SERVICE_URL,
      timeout: DEFAULT_TIMEOUT,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });

    this.client.interceptors.response.use(
      (response) => response,
      (error) => this._handleError(error)
    );
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Call the FastAPI extraction endpoint.
   *
   * @param {object} params
   * @param {string} params.documentId        – UUID of the document
   * @param {string} params.filePath          – absolute or relative path to the file
   * @param {string} [params.traceId]         – optional correlation id
   * @returns {Promise<{documentId, fileType, pages, characters, text}>}
   */
  async callExtraction({ documentId, filePath, traceId }) {
    const startTime = Date.now();

    logger.info("Calling AI extraction service", {
      documentId,
      traceId,
      filePath,
    });

    const response = await this.client.post("/api/v1/extraction/extract", {
      documentId,
      filePath,
    });

    const duration = Date.now() - startTime;
    const body = response.data;

    if (!body || !body.success) {
      throw new AppError(
        body?.message || "AI extraction service returned unsuccessful response",
        response.status
      );
    }

    const { data } = body;

    logger.info("AI extraction completed", {
      documentId,
      traceId,
      httpStatus: response.status,
      executionTimeMs: duration,
      pages: data?.pages,
      characters: data?.characters,
      fileType: data?.fileType,
    });

    return {
      documentId: data.documentId,
      fileType: data.fileType,
      pages: data.pages,
      characters: data.characters,
      text: data.text,
    };
  }

  // ---------------------------------------------------------------------------
  // Chunking
  // ---------------------------------------------------------------------------

  /**
   * Call the FastAPI chunking endpoint.
   *
   * @param {string} text  – The full extracted text to be split into chunks.
   * @returns {Promise<{chunks: Array<{chunk_index, text, character_count, token_count}>}>}
   */
  async callChunking(text) {
    const startTime = Date.now();

    logger.info("Calling AI chunking service", {
      inputChars: text?.length || 0,
    });

    const response = await this.client.post("/api/v1/chunking/chunk", {
      text,
    });

    const duration = Date.now() - startTime;
    const body = response.data;

    if (!body || !body.success) {
      throw new AppError(
        body?.message || "AI chunking service returned unsuccessful response",
        response.status
      );
    }

    const { data } = body;
    const chunks = data?.chunks || [];

    logger.info("AI chunking completed", {
      httpStatus: response.status,
      executionTimeMs: duration,
      chunkCount: chunks.length,
    });

    return { chunks };
  }

  // ---------------------------------------------------------------------------
  // Embedding
  // ---------------------------------------------------------------------------

  /**
   * Call the FastAPI embedding generation endpoint.
   *
   * @param {string} text  – The chunk text to generate an embedding for.
   * @returns {Promise<{success: boolean, model: string, dimension: number, embedding: number[]}>}
   */
  async callEmbedding(text) {
    const startTime = Date.now();

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      throw new AppError("Cannot generate embedding for empty text", 422);
    }

    logger.info("Calling AI embedding service", {
      inputChars: text.length,
    });

    const response = await this.client.post("/api/v1/embedding/generate", {
      text,
    });

    const duration = Date.now() - startTime;
    const body = response.data;

    if (!body || !body.success) {
      throw new AppError(
        body?.message || "AI embedding service returned unsuccessful response",
        response.status
      );
    }

    const { data } = body;

    // Validate response shape
    if (!data || !data.embedding || !Array.isArray(data.embedding)) {
      throw new AppError(
        "AI embedding service returned invalid embedding data",
        422
      );
    }

    if (data.embedding.length === 0) {
      throw new AppError(
        "AI embedding service returned empty embedding vector",
        422
      );
    }

    if (data.dimension <= 0) {
      throw new AppError(
        `AI embedding service returned invalid dimension: ${data.dimension}`,
        422
      );
    }

    if (data.embedding.length !== data.dimension) {
      throw new AppError(
        `AI embedding service returned embedding length ${data.embedding.length} which does not match dimension ${data.dimension}`,
        422
      );
    }

    logger.info("AI embedding completed", {
      httpStatus: response.status,
      executionTimeMs: duration,
      model: data.model,
      dimension: data.dimension,
    });

    return {
      success: data.success,
      model: data.model,
      dimension: data.dimension,
      embedding: data.embedding,
    };
  }

  /**
   * Call the FastAPI retrieval embed-query endpoint.
   *
   * @param {object} params
   * @param {string} params.query   – The search query text to embed.
   * @param {string} [params.traceId] – optional correlation id
   * @returns {Promise<{embedding: number[], dimension: number}>}
   */
  async generateQueryEmbedding({ query, traceId }) {
    const startTime = Date.now();

    if (!query || typeof query !== "string" || query.trim().length === 0) {
      throw new AppError("Cannot generate embedding for empty query", 422);
    }

    logger.info("Calling AI query embedding service", {
      traceId,
      queryChars: query.length,
    });

    const response = await this.client.post("/api/v1/retrieval/embed-query", {
      query,
    });

    const duration = Date.now() - startTime;
    const body = response.data;

    if (!body || !body.success) {
      throw new AppError(
        body?.message || "AI query embedding service returned unsuccessful response",
        response.status
      );
    }

    const { data } = body;

    if (!data || !data.embedding || !Array.isArray(data.embedding)) {
      throw new AppError(
        "AI query embedding service returned invalid embedding data",
        422
      );
    }

    if (data.embedding.length === 0) {
      throw new AppError(
        "AI query embedding service returned empty embedding vector",
        422
      );
    }

    if (data.dimension <= 0) {
      throw new AppError(
        `AI query embedding service returned invalid dimension: ${data.dimension}`,
        422
      );
    }

    if (data.embedding.length !== data.dimension) {
      throw new AppError(
        `AI query embedding service returned embedding length ${data.embedding.length} which does not match dimension ${data.dimension}`,
        422
      );
    }

    logger.info("AI query embedding completed", {
      traceId,
      httpStatus: response.status,
      executionTimeMs: duration,
      dimension: data.dimension,
    });

    return {
      embedding: data.embedding,
      dimension: data.dimension,
    };
  }

  /**
   * Call the FastAPI RAG generation endpoint.
   *
   * @param {object} params
   * @param {string} params.question   – The user's question.
   * @param {Array<{chunkText: string, documentId?: string, documentTitle?: string, chunkIndex?: number}>} params.context – Retrieved chunks.
   * @param {string} [params.traceId]  – Optional correlation id.
   * @returns {Promise<{answer: string, model: string, usage: {inputChunks: number}}>}
   */
  async callRagGenerate({ question, context, traceId }) {
    const startTime = Date.now();

    if (!question || typeof question !== "string" || question.trim().length === 0) {
      throw new AppError("Question is required for RAG generation", 422);
    }

    logger.info("Calling AI RAG generation service", {
      traceId,
      questionChars: question.length,
      contextChunks: context?.length || 0,
    });

    const response = await this.client.post("/api/v1/chat/generate", {
      question,
      context,
    });

    const duration = Date.now() - startTime;
    const body = response.data;

    if (!body || !body.success) {
      throw new AppError(
        body?.message || "AI RAG generation service returned unsuccessful response",
        response.status
      );
    }

    const { data } = body;

    if (!data || !data.answer) {
      throw new AppError(
        "AI RAG generation service returned empty answer",
        422
      );
    }

    logger.info("AI RAG generation completed", {
      traceId,
      httpStatus: response.status,
      executionTimeMs: duration,
      answerChars: data.answer?.length || 0,
      model: data.model,
      inputChunks: data.usage?.inputChunks,
    });

    return {
      answer: data.answer,
      model: data.model,
      usage: data.usage || { inputChunks: context?.length || 0 },
    };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Centralised Axios error handler.
   * Converts network / timeout / HTTP errors into a consistent AppError.
   */
  _handleError(error) {
    if (error.code === "ECONNABORTED") {
      logger.error("AI service request timed out", {
        timeout: this.client.defaults.timeout,
      });
      return Promise.reject(
        new AppError("AI service request timed out", 504)
      );
    }

    if (error.code === "ECONNREFUSED") {
      logger.error("AI service connection refused", {
        baseURL: this.client.defaults.baseURL,
      });
      return Promise.reject(
        new AppError("AI service is unavailable (connection refused)", 503)
      );
    }

    if (error.response) {
      const status = error.response.status;
      const message =
        error.response.data?.message ||
        `AI service responded with status ${status}`;
      return Promise.reject(new AppError(message, status));
    }

    // Network or unknown error
    logger.error("AI service network error", {
      message: error.message,
    });
    return Promise.reject(
      new AppError(`AI service network error: ${error.message}`, 502)
    );
  }
}

// Singleton export
const aiClient = new AIClient();

module.exports = aiClient;