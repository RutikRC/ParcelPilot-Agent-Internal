const crypto = require("crypto");
const documentEmbeddingRepository = require("./document-embedding.repository");
const AppError = require("../../utils/AppError");

const EMBEDDING_MODEL = "nomic-embed-text";
const EMBEDDING_DIMENSION = 768;

/**
 * Domain service for `document_embeddings` operations.
 *
 * Generates UUIDs, validates vector data, and delegates persistence to the
 * repository, following the same patterns as document-chunk.service.js.
 */

/**
 * Validate that a vector is a non-empty array of numbers with the correct dimension.
 */
const validateVector = (embedding, label = "embedding") => {
  if (!embedding || !Array.isArray(embedding) || embedding.length === 0) {
    throw new AppError(`${label} is empty or invalid`, 422);
  }

  if (embedding.length !== EMBEDDING_DIMENSION) {
    throw new AppError(
      `${label} has wrong dimension: expected ${EMBEDDING_DIMENSION}, got ${embedding.length}`,
      422
    );
  }

  // Ensure all values are numbers
  for (let i = 0; i < embedding.length; i++) {
    if (typeof embedding[i] !== "number" || isNaN(embedding[i])) {
      throw new AppError(`${label} contains non-numeric value at index ${i}`, 422);
    }
  }
};

/**
 * Save a single embedding for one chunk.
 */
const saveEmbedding = async ({ documentId, chunkId, embedding }) => {
  validateVector(embedding);

  const id = crypto.randomUUID();

  const result = await documentEmbeddingRepository.insertEmbedding({
    id,
    documentId,
    chunkId,
    embedding,
    embeddingModel: EMBEDDING_MODEL,
    embeddingDimension: EMBEDDING_DIMENSION,
  });

  return result;
};

/**
 * Save (upsert) a single embedding for a chunk — if the chunk already has an
 * embedding it will be replaced.
 */
const upsertEmbedding = async ({ documentId, chunkId, embedding }) => {
  validateVector(embedding);

  const id = crypto.randomUUID();

  const result = await documentEmbeddingRepository.upsertEmbedding({
    id,
    documentId,
    chunkId,
    embedding,
    embeddingModel: EMBEDDING_MODEL,
    embeddingDimension: EMBEDDING_DIMENSION,
  });

  return result;
};

/**
 * Save multiple embeddings for a document in a single transaction.
 *
 * Each embedding is assigned a new UUID. Existing embeddings for the same
 * document are deleted inside the repository transaction (replace-all strategy).
 */
const saveEmbeddings = async ({ documentId, embeddings }) => {
  if (!embeddings || !Array.isArray(embeddings) || embeddings.length === 0) {
    throw new AppError("Embeddings array is empty or invalid", 400);
  }

  // Validate every vector before persisting anything
  for (let i = 0; i < embeddings.length; i++) {
    const emb = embeddings[i];
    if (!emb.chunkId) {
      throw new AppError(`Embedding at index ${i} is missing chunkId`, 400);
    }
    if (!emb.embedding) {
      throw new AppError(`Embedding at index ${i} is missing embedding vector`, 400);
    }
    validateVector(emb.embedding, `Embedding at index ${i}`);
  }

  const enriched = embeddings.map((emb) => ({
    id: crypto.randomUUID(),
    documentId,
    chunkId: emb.chunkId,
    embedding: emb.embedding,
    embeddingModel: EMBEDDING_MODEL,
    embeddingDimension: EMBEDDING_DIMENSION,
  }));

  await documentEmbeddingRepository.saveEmbeddingsBatch(enriched);

  return enriched;
};

/**
 * Get the embedding for a specific chunk.
 */
const getEmbeddingByChunk = async (chunkId) => {
  if (!chunkId) {
    throw new AppError("chunkId is required", 400);
  }
  return documentEmbeddingRepository.getEmbeddingByChunkId(chunkId);
};

/**
 * Get all embeddings for a document.
 */
const getEmbeddings = async (documentId) => {
  if (!documentId) {
    throw new AppError("documentId is required", 400);
  }
  return documentEmbeddingRepository.getEmbeddingsByDocumentId(documentId);
};

/**
 * Delete all embeddings for a document.
 */
const deleteEmbeddings = async (documentId) => {
  if (!documentId) {
    throw new AppError("documentId is required", 400);
  }
  return documentEmbeddingRepository.deleteEmbeddingsByDocumentId(documentId);
};

/**
 * Count embeddings for a document.
 */
const countEmbeddings = async (documentId) => {
  if (!documentId) {
    throw new AppError("documentId is required", 400);
  }
  return documentEmbeddingRepository.countEmbeddingsByDocumentId(documentId);
};

/**
 * Count all embeddings in the system.
 */
const countAll = async () => {
  return documentEmbeddingRepository.countAllEmbeddings();
};

module.exports = {
  saveEmbedding,
  upsertEmbedding,
  saveEmbeddings,
  getEmbeddingByChunk,
  getEmbeddings,
  deleteEmbeddings,
  countEmbeddings,
  countAll,
  validateVector,
};