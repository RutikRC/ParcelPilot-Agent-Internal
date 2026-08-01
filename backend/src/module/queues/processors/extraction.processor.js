const path = require("path");
const { JOB_TYPES } = require("../constants/job.constants");
const {
  enqueueNextStage,
  updateProcessingStage,
  updateDocumentStatus,
} = require("../services/queue.service");
const documentRepository = require("../../document/document.repository");
const documentContentService = require("../../document/document-content.service");
const aiClient = require("../../queue/services/ai.client");
const logger = require("../../../utils/logger");
const AppError = require("../../../utils/AppError");

const TEXT_EXTRACTED = "TEXT_EXTRACTED";

const processTextExtraction = async (job) => {
  const { documentId, traceId } = job.data;

  logger.info("Extraction processor started", {
    documentId,
    traceId,
    jobName: job.name,
  });

  if (!documentId) {
    throw new AppError("Missing documentId in job payload", 400);
  }

  // 1. Update stage to TEXT_EXTRACTION (in progress)
  await updateProcessingStage(documentId, JOB_TYPES.TEXT_EXTRACTION);

  // 2. Load document metadata from PostgreSQL
  const document = await documentRepository.getDocumentById(documentId);

  if (!document) {
    throw new AppError(`Document ${documentId} not found`, 404);
  }

  // 3. Build absolute file path
  let absolutePath = path.resolve(document.path);

  // 4. Convert Windows path to WSL-compatible path when running inside WSL.
  //    The AI service runs inside WSL and cannot access Windows-style paths (E:\...).
  //    WSL mounts Windows drives under /mnt/<drive-letter>/...
  //    Example: E:\AI CRM\backend\uploads\file.pdf → /mnt/e/AI CRM/backend/uploads/file.pdf
  if (/^[A-Za-z]:\\/.test(absolutePath)) {
    const drive = absolutePath[0].toLowerCase();
    const wslPath = absolutePath
      .replace(/^[A-Za-z]:\\/, `/mnt/${drive}/`)
      .replace(/\\/g, "/");
    logger.info("Converted Windows path to WSL path", {
      original: absolutePath,
      wsl: wslPath,
    });
    absolutePath = wslPath;
  }

  // 5. Call FastAPI Extraction API via the reusable AI client
  const extractionResult = await aiClient.callExtraction({
    documentId,
    filePath: absolutePath,
    traceId,
  });

  // 5. Validate response – text must be present
  if (!extractionResult.text || extractionResult.text.trim().length === 0) {
    throw new AppError(
      `AI extraction returned empty text for document ${documentId}`,
      422
    );
  }

  // 6. Store extracted text into `document_contents`
  await documentContentService.saveExtractedText({
    documentId,
    content: extractionResult.text,
    pageCount: extractionResult.pages,
    characterCount: extractionResult.characters,
  });

  // 7. Update processing_stage to TEXT_EXTRACTED
  await updateProcessingStage(documentId, TEXT_EXTRACTED);

  // 8. Update document status to extracted
  await updateDocumentStatus(documentId, "extracted");

  logger.info("Extraction processor completed", {
    documentId,
    traceId,
    pages: extractionResult.pages,
    characters: extractionResult.characters,
    fileType: extractionResult.fileType,
    nextStage: JOB_TYPES.TEXT_CHUNKING,
  });

  // 9. Enqueue next stage (TEXT_CHUNKING – placeholder only, no implementation)
  return enqueueNextStage(job.name, job.data);
};

module.exports = {
  processTextExtraction,
};
