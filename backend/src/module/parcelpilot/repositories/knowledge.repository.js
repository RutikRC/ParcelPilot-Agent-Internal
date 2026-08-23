const pool = require("../../../config/db");
const AppError = require("../../../utils/AppError");

/**
 * Knowledge repository — deterministic access to document chunks with
 * source precedence filtering.
 *
 * This repository extends the existing search repository by adding
 * source-type and source-status filtering so the agent can retrieve
 * evidence with the correct authority model.
 */

/**
 * Search document chunks with optional source-type and source-status filters.
 *
 * @param {number[]} queryEmbedding - The query embedding vector (768 dimensions).
 * @param {object} options
 * @param {number} [options.limit] - Maximum results (default: 10).
 * @param {string} [options.documentType] - Filter by document_type (e.g. 'support_policy').
 * @param {string} [options.documentStatus] - Filter by document_status (e.g. 'current', 'deprecated').
 * @param {string} [options.accountId] - Filter by metadata account_id (for customer agreements).
 * @returns {Promise<Array<object>>} Array of chunk rows with source metadata.
 */
const searchKnowledgeChunks = async (
  queryEmbedding,
  { limit = 10, documentType, documentStatus, accountId } = {}
) => {
  if (!queryEmbedding || !Array.isArray(queryEmbedding) || queryEmbedding.length === 0) {
    throw new AppError("Query embedding is required for knowledge search", 400);
  }

  const safeLimit = Math.min(Math.max(1, limit), 100);
  const embeddingJson = JSON.stringify(queryEmbedding);

  const where = [
    "d.is_deleted = FALSE",
    "d.status = 'READY'",
    // Only return ParcelPilot assessment documents, not stray uploads
    // (e.g. dummy.pdf) that may exist in the vector index.
    "d.metadata->>'source' = 'parcelpilot_assessment'",
  ];
  const values = [embeddingJson];

  if (documentType) {
    values.push(documentType);
    where.push(`d.metadata->>'document_type' = $${values.length}`);
  }

  if (documentStatus) {
    values.push(documentStatus);
    where.push(`d.metadata->>'document_status' = $${values.length}`);
  }

  if (accountId) {
    // When an account is known, include general (non-account) documents
    // AND the specific customer's agreement, but never another
    // customer's agreement.
    values.push(accountId);
    where.push(`(
      d.metadata->>'account_id' IS NULL
      OR d.metadata->>'account_id' = ''
      OR d.metadata->>'account_id' = $${values.length}
    )`);
  }

  values.push(safeLimit);

  const query = `
    SELECT
      d.id AS "documentId",
      d.title AS "documentTitle",
      d.original_name AS "filename",
      d.metadata->>'document_type' AS "documentType",
      d.metadata->>'document_status' AS "documentStatus",
      d.metadata->>'account_id' AS "accountId",
      d.metadata->>'effective_date' AS "effectiveDate",
      dc.id AS "chunkId",
      dc.chunk_index AS "chunkIndex",
      dc.chunk_text AS "chunkText",
      dc.chunk_text AS content,
      1 - (de.embedding <=> $1::vector) AS similarity
    FROM document_embeddings de
    JOIN document_chunks dc ON dc.id = de.chunk_id
    JOIN documents d ON d.id = de.document_id
    WHERE ${where.join(" AND ")}
    ORDER BY de.embedding <=> $1::vector
    LIMIT $${values.length};
  `;

  try {
    const { rows } = await pool.query(query, values);

    return rows.map((row) => ({
      documentId: row.documentId,
      documentTitle: row.documentTitle,
      filename: row.filename,
      documentType: row.documentType,
      documentStatus: row.documentStatus,
      accountId: row.accountId,
      effectiveDate: row.effectiveDate,
      chunkId: row.chunkId,
      chunkIndex: row.chunkIndex,
      chunkText: row.chunkText,
      content: row.content,
      similarity: Math.round(row.similarity * 10000) / 10000,
    }));
  } catch (error) {
    if (error.code === "42703") {
      throw new AppError("pgvector extension is not enabled in the database", 500);
    }
    throw new AppError(`Database error during knowledge search: ${error.message}`, 500);
  }
};

/**
 * Fetch the full text of a document by its ID (for evidence aggregation).
 *
 * @param {string} documentId - The document UUID.
 * @returns {Promise<object|null>} The document row, or null.
 */
const getDocumentById = async (documentId) => {
  if (!documentId || typeof documentId !== "string" || documentId.trim().length === 0) {
    throw new AppError("documentId is required", 400);
  }

  const query = `
    SELECT
      d.id AS "documentId",
      d.title AS "documentTitle",
      d.original_name AS "filename",
      d.metadata->>'document_type' AS "documentType",
      d.metadata->>'document_status' AS "documentStatus",
      d.metadata->>'account_id' AS "accountId",
      d.metadata->>'effective_date' AS "effectiveDate",
      d.status AS "processingStatus"
    FROM documents d
    WHERE d.id = $1
      AND d.is_deleted = FALSE;
  `;

  const { rows } = await pool.query(query, [documentId]);
  return rows[0] || null;
};

module.exports = {
  searchKnowledgeChunks,
  getDocumentById,
};