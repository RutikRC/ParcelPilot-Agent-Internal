const pool = require("../../config/db");
const AppError = require("../../utils/AppError");

const MIGRATIONS = [
  // 1. Create table if it does not exist at all
  `CREATE TABLE IF NOT EXISTS document_chunks (
    id               UUID PRIMARY KEY,
    document_id      UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    chunk_index      INTEGER NOT NULL,
    chunk_text       TEXT NOT NULL,
    character_count  INTEGER NOT NULL DEFAULT 0,
    token_count      INTEGER DEFAULT 0,
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_document_chunk UNIQUE(document_id, chunk_index)
  );`,

  // 2. Add index on document_id for fast lookups
  `CREATE INDEX IF NOT EXISTS idx_document_chunks_document
    ON document_chunks (document_id);`,

  // 3. Add composite index for ordering
  `CREATE INDEX IF NOT EXISTS idx_document_chunks_order
    ON document_chunks (document_id, chunk_index);`,
];

const ensureTable = async () => {
  for (const sql of MIGRATIONS) {
    await pool.query(sql);
  }
};

/**
 * Insert (or replace) all chunks for a given document in a single transaction.
 *
 * Existing chunks for the same document are deleted first so that re-running
 * chunking always produces a clean slate.
 */
const saveChunks = async (chunks) => {
  await ensureTable();

  if (!chunks || chunks.length === 0) {
    throw new AppError("No chunks to save", 400);
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Delete existing chunks for this document
    const documentId = chunks[0].documentId;
    await client.query(
      "DELETE FROM document_chunks WHERE document_id = $1",
      [documentId]
    );

    // Insert all chunks
    const insertQuery = `
      INSERT INTO document_chunks (id, document_id, chunk_index, chunk_text, character_count, token_count)
      VALUES ($1, $2, $3, $4, $5, $6)
    `;

    for (const chunk of chunks) {
      await client.query(insertQuery, [
        chunk.id,
        chunk.documentId,
        chunk.chunkIndex,
        chunk.content,
        chunk.characterCount,
        chunk.tokenCount,
      ]);
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const getChunksByDocumentId = async (documentId) => {
  await ensureTable();

  const query = `
    SELECT *
    FROM document_chunks
    WHERE document_id = $1
    ORDER BY chunk_index ASC;
  `;

  const { rows } = await pool.query(query, [documentId]);
  return rows;
};

const countChunksByDocumentId = async (documentId) => {
  await ensureTable();

  const query = `
    SELECT COUNT(*)::int AS count
    FROM document_chunks
    WHERE document_id = $1;
  `;

  const { rows } = await pool.query(query, [documentId]);
  return rows[0]?.count || 0;
};

module.exports = {
  ensureTable,
  saveChunks,
  getChunksByDocumentId,
  countChunksByDocumentId,
};