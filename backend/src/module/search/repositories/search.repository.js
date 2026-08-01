const pool = require("../../../config/db");
const AppError = require("../../../utils/AppError");

/**
 * Search repository — semantic retrieval via pgvector cosine similarity.
 *
 * Joins documents, document_chunks, and document_embeddings tables.
 * Filters out soft-deleted documents and non-ready documents.
 * Returns results sorted by similarity (highest first).
 */

/**
 * Execute a pgvector similarity search.
 *
 * @param {number[]} queryEmbedding - The query embedding vector (768 dimensions).
 * @param {number} limit - Maximum number of results to return.
 * @returns {Promise<Array<{documentId: string, documentTitle: string, chunkIndex: number, chunkText: string, similarity: number}>>}
 */
const searchSimilarChunks = async (queryEmbedding, limit) => {
  if (!queryEmbedding || !Array.isArray(queryEmbedding) || queryEmbedding.length === 0) {
    throw new AppError("Query embedding is required for similarity search", 400);
  }

  if (limit < 1) {
    limit = 5;
  }

  if (limit > 100) {
    limit = 100;
  }

  const embeddingJson = JSON.stringify(queryEmbedding);

  const query = `
    SELECT
      d.id AS "documentId",
      d.title AS "documentTitle",
      dc.chunk_index AS "chunkIndex",
      dc.chunk_text AS "chunkText",
      1 - (de.embedding <=> $1::vector) AS similarity
    FROM document_embeddings de
    JOIN document_chunks dc ON dc.id = de.chunk_id
    JOIN documents d ON d.id = de.document_id
    WHERE d.is_deleted = FALSE
      AND d.status = 'READY'
    ORDER BY de.embedding <=> $1::vector
    LIMIT $2;
  `;

  const values = [embeddingJson, limit];

  try {
    const { rows } = await pool.query(query, values);

    return rows.map((row) => ({
      documentId: row.documentId,
      documentTitle: row.documentTitle,
      chunkIndex: row.chunkIndex,
      chunkText: row.chunkText,
      similarity: Math.round(row.similarity * 10000) / 10000, // Round to 4 decimal places
    }));
  } catch (error) {
    if (error.code === "42703") {
      // Undefined column / vector extension not enabled
      throw new AppError("pgvector extension is not enabled in the database", 500);
    }
    throw new AppError(`Database error during similarity search: ${error.message}`, 500);
  }
};

module.exports = {
  searchSimilarChunks,
};