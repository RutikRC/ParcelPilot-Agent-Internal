const crypto = require("crypto");
const pool = require("../../../config/db");
const { queue } = require("../config/bullmq.config");
const { JOB_TYPES } = require("../constants/job.constants");
const AppError = require("../../../utils/AppError");
const logger = require("../../../utils/logger");

const DEFAULT_JOB_OPTIONS = {
  attempts: 5,
  backoff: {
    type: "exponential",
    delay: 2000,
  },
  removeOnComplete: true,
  removeOnFail: false,
};

const createTraceId = () => crypto.randomUUID();

const enqueueJob = async (jobName, payload, options = {}) => {
  if (!jobName) {
    throw new AppError("Job name is required", 400);
  }

  if (!payload || !payload.documentId) {
    throw new AppError("Job payload must include documentId", 400);
  }

  const jobPayload = {
    ...payload,
    traceId: payload.traceId || createTraceId(),
    createdAt: payload.createdAt || new Date().toISOString(),
  };

  const jobOptions = {
    ...DEFAULT_JOB_OPTIONS,
    ...options,
  };

  logger.info("Enqueueing job", {
    jobName,
    documentId: jobPayload.documentId,
    traceId: jobPayload.traceId,
  });

  return queue.add(jobName, jobPayload, jobOptions);
};

const enqueueNextStage = async (currentJobName, payload) => {
  const nextJobByStage = {
    [JOB_TYPES.DOCUMENT_RECEIVED]: JOB_TYPES.TEXT_EXTRACTION,
    [JOB_TYPES.TEXT_EXTRACTION]: JOB_TYPES.TEXT_CHUNKING,
    [JOB_TYPES.TEXT_CHUNKING]: JOB_TYPES.EMBEDDING_GENERATION,
    [JOB_TYPES.EMBEDDING_GENERATION]: JOB_TYPES.VECTOR_INDEXING,
  };

  const nextJobName = nextJobByStage[currentJobName];

  if (!nextJobName) {
    logger.info("No next stage found for job", {
      currentJobName,
      documentId: payload.documentId,
      traceId: payload.traceId,
    });

    return null;
  }

  return enqueueJob(nextJobName, payload);
};

const getRetryInfo = (job) => {
  if (!job) {
    return { attemptsMade: 0, attemptsRemaining: 0 };
  }

  const attemptsMade = job.attemptsMade || 0;
  const attemptsTotal = (job.opts && job.opts.attempts) || DEFAULT_JOB_OPTIONS.attempts;

  return {
    attemptsMade,
    attemptsRemaining: Math.max(attemptsTotal - attemptsMade, 0),
  };
};

const updateProcessingStage = async (documentId, processingStage) => {
  const query = `
    UPDATE documents
    SET processing_stage = $1,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING id, processing_stage;
  `;

  const { rows } = await pool.query(query, [processingStage, documentId]);

  if (!rows[0]) {
    throw new AppError("Document not found", 404);
  }

  logger.info("Updated processing stage", {
    documentId,
    processingStage,
  });

  return rows[0];
};

const updateDocumentStatus = async (documentId, status) => {
  const query = `
    UPDATE documents
    SET status = $1,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING id, status;
  `;

  const { rows } = await pool.query(query, [status, documentId]);

  if (!rows[0]) {
    throw new AppError("Document not found", 404);
  }

  logger.info("Updated document status", {
    documentId,
    status,
  });

  return rows[0];
};

module.exports = {
  createTraceId,
  enqueueJob,
  enqueueNextStage,
  getRetryInfo,
  updateProcessingStage,
  updateDocumentStatus,
};
