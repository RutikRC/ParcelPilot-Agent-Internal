/**
 * Assessment Data Migration Runner
 *
 * Applies the Phase 1 structured-data migrations (accounts, orders, tickets,
 * assessment_dataset_metadata) using the same ensureTable convention as the
 * document repositories.
 *
 * Usage:
 *   node src/module/assessment/migrate.js
 */

const assessmentRepository = require("./assessment.repository");
const logger = require("../../utils/logger");

const run = async () => {
  logger.info("Starting assessment data migration...");

  try {
    await assessmentRepository.ensureTable();
    logger.info("Assessment data migration completed successfully.");
    process.exit(0);
  } catch (error) {
    logger.error("Assessment data migration failed", error);
    process.exit(1);
  }
};

run();