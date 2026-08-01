const { JOB_TYPES } = require("../constants/job.constants");
const { enqueueNextStage, updateProcessingStage } = require("../services/queue.service");
const logger = require("../../../utils/logger");
const AppError = require("../../../utils/AppError");

const processDocumentReceived = async (job) => {
  const { documentId, traceId } = job.data;

  logger.info("Document processor started", {
    documentId,
    traceId,
    jobName: job.name,
  });

  if (!documentId) {
    throw new AppError("Missing documentId in job payload", 400);
  }

  await updateProcessingStage(documentId, JOB_TYPES.DOCUMENT_RECEIVED);

  logger.info("Document processor completed", {
    documentId,
    traceId,
    nextStage: JOB_TYPES.TEXT_EXTRACTION,
  });

  return enqueueNextStage(job.name, job.data);
};

module.exports = {
  processDocumentReceived,
};