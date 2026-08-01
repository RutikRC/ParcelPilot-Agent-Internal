const { JOB_TYPES } = require("../constants/job.constants");
const {
  enqueueNextStage,
  updateProcessingStage,
  updateDocumentStatus,
} = require("../services/queue.service");
const documentContentService = require("../../document/document-content.service");
const documentChunkService = require("../../document/document-chunk.service");
const aiClient = require("../../queue/services/ai.client");
const logger = require("../../../utils/logger");
const AppError = require("../../../utils/AppError");

const TEXT_CHUNKED = "TEXT_CHUNKED";

const processTextChunking = async (job) => {
  const { documentId, traceId } = job.data;

  logger.info("Chunk processor started", {
    documentId,
    traceId,
    jobName: job.name,
  });

  if (!documentId) {
    throw new AppError("Missing documentId in job payload", 400);
  }

  // 1. Update stage to TEXT_CHUNKING (in progress)
  await updateProcessingStage(documentId, JOB_TYPES.TEXT_CHUNKING);

  // 2. Load extracted text from document_contents
  let extractedContent;
  try {
    extractedContent = await documentContentService.getExtractedText(documentId);
  } catch (error) {
    if (error.statusCode === 404) {
      throw new AppError(
        `No extracted text found for document ${documentId}. Ensure extraction completed first.`,
        404
      );
    }
    throw error;
  }

  if (!extractedContent || !extractedContent.content || extractedContent.content.trim().length === 0) {
    throw new AppError(
      `Extracted text is empty for document ${documentId}`,
      404
    );
  }

  // 3. Call FastAPI Chunking API via the reusable AI client
  const chunkingResult = await aiClient.callChunking(extractedContent.content);

  // 4. Validate response – must have at least one chunk
  if (!chunkingResult.chunks || chunkingResult.chunks.length === 0) {
    throw new AppError(
      `AI chunking returned zero chunks for document ${documentId}`,
      422
    );
  }

  // 5. Replace all existing chunks and store new ones
  const savedChunks = await documentChunkService.saveChunks({
    documentId,
    chunks: chunkingResult.chunks,
  });

  // 6. Update processing_stage to TEXT_CHUNKED
  await updateProcessingStage(documentId, TEXT_CHUNKED);

  // 7. Update document status to chunked
  await updateDocumentStatus(documentId, "chunked");

  // Compute average chunk size for logging
  const totalChars = savedChunks.reduce((sum, c) => sum + c.characterCount, 0);
  const avgChunkSize = savedChunks.length > 0
    ? Math.round(totalChars / savedChunks.length)
    : 0;

  logger.info("Chunk processor completed", {
    documentId,
    traceId,
    chunkCount: savedChunks.length,
    avgChunkSize,
    totalChars,
    nextStage: JOB_TYPES.EMBEDDING_GENERATION,
  });

  // 8. Enqueue next stage (EMBEDDING_GENERATION – placeholder only, no implementation)
  return enqueueNextStage(job.name, job.data);
};

module.exports = {
  processTextChunking,
};
