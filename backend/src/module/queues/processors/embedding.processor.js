const { JOB_TYPES } = require("../constants/job.constants");
const {
  enqueueNextStage,
  updateProcessingStage,
  updateDocumentStatus,
} = require("../services/queue.service");
const documentChunkService = require("../../document/document-chunk.service");
const documentEmbeddingService = require("../../document/document-embedding.service");
const aiClient = require("../../queue/services/ai.client");
const logger = require("../../../utils/logger");
const AppError = require("../../../utils/AppError");

const EMBEDDINGS_GENERATED = "EMBEDDINGS_GENERATED";
const DEFAULT_CONCURRENCY = 5;

/**
 * Process a batch of chunks: generate embeddings for each chunk in parallel
 * but limited by the concurrency window.
 *
 * @param {Array<{id: string, chunk_text: string, chunk_index: number}>} chunks
 * @param {string} documentId
 * @param {string} traceId
 * @param {number} concurrency - max parallel requests to Ollama
 * @returns {Promise<Array<{chunkId: string, embedding: number[]}>>}
 */
const generateEmbeddingsForBatch = async ({
  chunks,
  documentId,
  traceId,
  concurrency = DEFAULT_CONCURRENCY,
}) => {
  const results = [];

  // Process in concurrent windows (sliding window of `concurrency` size)
  for (let i = 0; i < chunks.length; i += concurrency) {
    const window = chunks.slice(i, i + concurrency);

    const windowResults = await Promise.all(
      window.map(async (chunk) => {
        const chunkStartTime = Date.now();

        logger.info("Generating embedding for chunk", {
          documentId,
          traceId,
          chunkId: chunk.id,
          chunkIndex: chunk.chunk_index,
          chunkChars: chunk.chunk_text?.length || 0,
        });

        // Call the AI service to generate the embedding
        const embeddingResult = await aiClient.callEmbedding(chunk.chunk_text);

        // Validate the embedding via the service
        documentEmbeddingService.validateVector(
          embeddingResult.embedding,
          `Embedding for chunk ${chunk.chunk_index} (${chunk.id})`
        );

        const chunkDuration = Date.now() - chunkStartTime;

        logger.info("Embedding generated for chunk", {
          documentId,
          traceId,
          chunkId: chunk.id,
          chunkIndex: chunk.chunk_index,
          executionTimeMs: chunkDuration,
          model: embeddingResult.model,
          dimension: embeddingResult.dimension,
        });

        return {
          chunkId: chunk.id,
          embedding: embeddingResult.embedding,
        };
      })
    );

    results.push(...windowResults);
  }

  return results;
};

const processEmbeddingGeneration = async (job) => {
  const { documentId, traceId } = job.data;
  const overallStartTime = Date.now();

  logger.info("Embedding processor started", {
    documentId,
    traceId,
    jobName: job.name,
  });

  if (!documentId) {
    throw new AppError("Missing documentId in job payload", 400);
  }

  // 1. Update stage to EMBEDDING_GENERATION (in progress)
  await updateProcessingStage(documentId, JOB_TYPES.EMBEDDING_GENERATION);

  // 2. Load all chunks for the document
  let chunks;
  try {
    chunks = await documentChunkService.getChunks(documentId);
  } catch (error) {
    if (error.statusCode === 404) {
      throw new AppError(
        `No chunks found for document ${documentId}. Ensure chunking completed first.`,
        404
      );
    }
    throw error;
  }

  if (!chunks || chunks.length === 0) {
    throw new AppError(
      `No chunks found for document ${documentId}. Ensure chunking completed first.`,
      404
    );
  }

  const totalChunks = chunks.length;
  logger.info("Loaded chunks for embedding", {
    documentId,
    traceId,
    totalChunks,
  });

  // 3. Generate embeddings for every chunk with concurrency control
  const embeddingResults = await generateEmbeddingsForBatch({
    chunks,
    documentId,
    traceId,
    concurrency: parseInt(process.env.EMBEDDING_CONCURRENCY || DEFAULT_CONCURRENCY, 10),
  });

  // Verify we have embeddings for all chunks
  if (embeddingResults.length !== totalChunks) {
    throw new AppError(
      `Generated ${embeddingResults.length} embeddings but expected ${totalChunks} for document ${documentId}`,
      500
    );
  }

  // 4. Save all embeddings in a single transaction (replace-all strategy)
  const savedEmbeddings = await documentEmbeddingService.saveEmbeddings({
    documentId,
    embeddings: embeddingResults,
  });

  // 5. Update processing_stage to EMBEDDINGS_GENERATED
  await updateProcessingStage(documentId, EMBEDDINGS_GENERATED);

  // 6. Update document status to embedded
  await updateDocumentStatus(documentId, "embedded");

  const overallDuration = Date.now() - overallStartTime;

  logger.info("Embedding processor completed", {
    documentId,
    traceId,
    totalChunks,
    embeddingsGenerated: savedEmbeddings.length,
    totalExecutionTimeMs: overallDuration,
    nextStage: JOB_TYPES.VECTOR_INDEXING,
  });

  // 7. Enqueue next stage (VECTOR_INDEXING – placeholder only, no implementation)
  return enqueueNextStage(job.name, job.data);
};

module.exports = {
  processEmbeddingGeneration,
};