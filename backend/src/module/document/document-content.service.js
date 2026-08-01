const crypto = require("crypto");
const documentContentRepository = require("./document-content.repository");

/**
 * Domain service for `document_contents` operations.
 *
 * Delegates persistence to the repository while keeping business logic
 * (e.g. generating UUIDs) in one place.
 */
const saveExtractedText = async ({ documentId, content, pageCount, characterCount }) => {
  return documentContentRepository.saveExtractedText({
    id: crypto.randomUUID(),
    documentId,
    content,
    pageCount,
    characterCount,
  });
};

const getExtractedText = async (documentId) => {
  return documentContentRepository.getExtractedText(documentId);
};

const updateExtractedText = async ({ documentId, content, pageCount, characterCount }) => {
  return documentContentRepository.updateExtractedText({
    documentId,
    content,
    pageCount,
    characterCount,
  });
};

module.exports = {
  saveExtractedText,
  getExtractedText,
  updateExtractedText,
};