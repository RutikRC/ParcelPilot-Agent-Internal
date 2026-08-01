const { QueueEvents } = require("bullmq");
const { QUEUE_NAME_DOCUMENT_PROCESSING } = require("../constants/queue.constants");
const { redisConnection } = require("../config/bullmq.config");
const logger = require("../../../utils/logger");

const registerQueueEvents = () => {
  const queueEvents = new QueueEvents(QUEUE_NAME_DOCUMENT_PROCESSING, {
    connection: redisConnection,
  });

  queueEvents.on("waiting", ({ jobId }) => {
    logger.info("Queue event waiting", { jobId });
  });

  queueEvents.on("active", ({ jobId, prev }) => {
    logger.info("Queue event active", { jobId, prev });
  });

  queueEvents.on("completed", ({ jobId, returnvalue }) => {
    logger.info("Queue event completed", { jobId, returnvalue });
  });

  queueEvents.on("failed", ({ jobId, failedReason, prev }) => {
    logger.error("Queue event failed", { jobId, failedReason, prev });
  });

  queueEvents.on("progress", ({ jobId, data }) => {
    logger.info("Queue event progress", { jobId, data });
  });

  queueEvents.on("stalled", ({ jobId }) => {
    logger.warn("Queue event stalled", { jobId });
  });

  queueEvents.on("error", (error) => {
    logger.error("Queue events error", error);
  });

  return queueEvents;
};

module.exports = {
  registerQueueEvents,
};