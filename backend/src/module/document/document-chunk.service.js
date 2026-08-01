const crypto = require("crypto");
const documentChunkRepository = require("./document-chunk.repository");
const AppError = require("../../utils/AppError");

/**
 * Domain service for `document_chunks` operations.
 *
 * Generates UUIDs, validates chunk data, and delegates persistence to the
 * repository.
 */
const validateChunks = (chunks) => {
  if (!chunks || !Array.isArray(chunks) || chunks.length === 0) {
    throw new AppError("Chunks array is empty or invalid", 400);
  }

  for (const chunk of chunks) {
    if (!chunk.text || typeof chunk.text !== "string" || chunk.text.trim().length === 0) {
      throw new AppError(
        `Chunk at index ${chunk.chunk_index} has empty or invalid text`,
        400
      );
    }
  }
};

/**
 * Save all chunks for a document using a replace-all strategy.
 *
 * Each chunk is assigned a new UUID.  Existing chunks for the same document
 * are deleted inside the repository transaction.
 */
const saveChunks = async ({ documentId, chunks }) => {
  validateChunks(chunks);

  const enrichedChunks = chunks.map((chunk) => ({
    id: crypto.randomUUID(),
    documentId,
    chunkIndex: chunk.chunk_index,
    content: chunk.text,
    characterCount: chunk.character_count,
    tokenCount: chunk.token_count,
  }));

  await documentChunkRepository.saveChunks(enrichedChunks);

  return enrichedChunks;
};

const getChunks = async (documentId) => {
  return documentChunkRepository.getChunksByDocumentId(documentId);
};

const countChunks = async (documentId) => {
  return documentChunkRepository.countChunksByDocumentId(documentId);
};

module.exports = {
  saveChunks,
  getChunks,
  countChunks,
};