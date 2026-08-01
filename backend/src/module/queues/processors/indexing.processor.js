const { JOB_TYPES } = require("../constants/job.constants");
const { updateProcessingStage, updateDocumentStatus } = require("../services/queue.service");
const logger = require("../../../utils/logger");
const AppError = require("../../../utils/AppError");

const processVectorIndexing = async (job) => {
  const { documentId, traceId } = job.data;

  logger.info("Indexing processor started", {
    documentId,
    traceId,
    jobName: job.name,
  });

  if (!documentId) {
    throw new AppError("Missing documentId in job payload", 400);
  }

  await updateProcessingStage(documentId, JOB_TYPES.VECTOR_INDEXING);
  await updateDocumentStatus(documentId, "READY");

  logger.info("Indexing processor completed", {
    documentId,
    traceId,
    status: "READY",
  });

  return { documentId, status: "READY" };
};

module.exports = {
  processVectorIndexing,
};