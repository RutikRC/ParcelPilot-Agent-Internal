const { Worker } = require("bullmq");
const { queue } = require("../config/bullmq.config");
const { JOB_TYPES } = require("../constants/job.constants");
const logger = require("../../../utils/logger");
const {
  processDocumentReceived,
} = require("../processors/document.processor");
const {
  processTextExtraction,
} = require("../processors/extraction.processor");
const {
  processTextChunking,
} = require("../processors/chunk.processor");
const {
  processEmbeddingGeneration,
} = require("../processors/embedding.processor");
const {
  processVectorIndexing,
} = require("../processors/indexing.processor");

const worker = new Worker(
  queue.name,
  async (job) => {
    logger.info("Worker received job", {
      jobId: job.id,
      jobName: job.name,
      documentId: job.data.documentId,
      traceId: job.data.traceId,
      attemptsMade: job.attemptsMade,
    });

    switch (job.name) {
      case JOB_TYPES.DOCUMENT_RECEIVED:
        return processDocumentReceived(job);
      case JOB_TYPES.TEXT_EXTRACTION:
        return processTextExtraction(job);
      case JOB_TYPES.TEXT_CHUNKING:
        return processTextChunking(job);
      case JOB_TYPES.EMBEDDING_GENERATION:
        return processEmbeddingGeneration(job);
      case JOB_TYPES.VECTOR_INDEXING:
        return processVectorIndexing(job);
      default:
        throw new Error(`Unsupported job type: ${job.name}`);
    }
  },
  {
    connection: queue.opts.connection,
    concurrency: 1,
  }
);

worker.on("completed", (job) => {
  logger.info("Worker job completed", {
    jobId: job.id,
    jobName: job.name,
    documentId: job.data.documentId,
    traceId: job.data.traceId,
  });
});

worker.on("failed", (job, err) => {
  const attempts = job.attemptsMade || 0;
  const maxAttempts = (job.opts && job.opts.attempts) || 5;

  logger.error("Worker job failed", {
    jobId: job.id,
    jobName: job.name,
    documentId: job.data.documentId,
    traceId: job.data.traceId,
    error: err.message || err,
    attemptsMade: attempts,
    attemptsRemaining: Math.max(maxAttempts - attempts, 0),
  });
});

worker.on("error", (error) => {
  logger.error("Worker error", error);
});

module.exports = worker;
