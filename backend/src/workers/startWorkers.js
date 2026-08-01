const { createTraceId } = require("../module/queues/services/queue.service");
const { registerQueueEvents } = require("../module/queues/events/queue.events");
const worker = require("../module/queues/workers/document.worker");
const logger = require("../utils/logger");

const startWorkers = async () => {
  try {
    registerQueueEvents();

    logger.info("Worker Started", {
      queueName: worker.name,
      process: process.pid,
      traceId: createTraceId(),
    });
  } catch (error) {
    logger.error("Failed to start workers", error);
    process.exit(1);
  }
};

startWorkers();
