const { enqueueJob, createTraceId } = require("../services/queue.service");
const { JOB_TYPES } = require("../constants/job.constants");

const enqueueDocumentReceived = async ({ documentId, userId, traceId }) => {
  const payload = {
    documentId,
    userId,
    traceId: traceId || createTraceId(),
  };

  return enqueueJob(JOB_TYPES.DOCUMENT_RECEIVED, payload);
};

module.exports = {
  enqueueDocumentReceived,
};
