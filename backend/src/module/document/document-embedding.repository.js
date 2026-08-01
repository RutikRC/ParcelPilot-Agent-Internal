const pool = require("../../config/db");
const AppError = require("../../utils/AppError");

const EMBEDDING_DIMENSION = 768;
const EMBEDDING_MODEL = "nomic-embed-text";

const MIGRATIONS = [
  // 1. Enable pgvector extension
  `CREATE EXTENSION IF NOT EXISTS vector;`,

  // 2. Create table if it does not exist
  `CREATE TABLE IF NOT EXISTS document_embeddings (
    id                  UUID PRIMARY KEY,
    document_id         UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    chunk_id            UUID NOT NULL REFERENCES document_chunks(id) ON DELETE CASCADE,
    embedding           vector(${EMBEDDING_DIMENSION}) NOT NULL,
    embedding_model     VARCHAR(100) DEFAULT '${EMBEDDING_MODEL}',
    embedding_dimension INTEGER DEFAULT ${EMBEDDING_DIMENSION},
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_document_embeddings_chunk UNIQUE(chunk_id)
  );`,

  // 3. Index on document_id for fast lookups
  `CREATE INDEX IF NOT EXISTS idx_document_embeddings_document
    ON document_embeddings (document_id);`,

  // 4. Index on chunk_id for fast lookups
  `CREATE INDEX IF NOT EXISTS idx_document_embeddings_chunk
    ON document_embeddings (chunk_id);`,

  // 5. IVFFlat index for cosine similarity search (future RAG use)
  `CREATE INDEX IF NOT EXISTS idx_document_embeddings_vector
    ON document_embeddings
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);`,
];

const ensureTable = async () => {
  for (const sql of MIGRATIONS) {
    await pool.query(sql);
  }
};

/**
 * Insert a single embedding record.
 */
const insertEmbedding = async ({
  id,
  documentId,
  chunkId,
  embedding,
  embeddingModel,
  embeddingDimension,
}) => {
  await ensureTable();

  const query = `
    INSERT INTO document_embeddings
      (id, document_id, chunk_id, embedding, embedding_model, embedding_dimension)
    VALUES ($1, $2, $3, $4::vector, $5, $6)
    RETURNING *;
  `;

  const values = [
    id,
    documentId,
    chunkId,
    JSON.stringify(embedding),
    embeddingModel || EMBEDDING_MODEL,
    embeddingDimension || EMBEDDING_DIMENSION,
  ];

  const { rows } = await pool.query(query, values);
  return rows[0];
};

/**
 * Upsert an embedding for a given chunk_id.
 * If a row with the same chunk_id exists, it will be updated.
 */
const upsertEmbedding = async ({
  id,
  documentId,
  chunkId,
  embedding,
  embeddingModel,
  embeddingDimension,
}) => {
  await ensureTable();

  const query = `
    INSERT INTO document_embeddings
      (id, document_id, chunk_id, embedding, embedding_model, embedding_dimension)
    VALUES ($1, $2, $3, $4::vector, $5, $6)
    ON CONFLICT (chunk_id)
    DO UPDATE SET
      embedding           = EXCLUDED.embedding,
      embedding_model     = EXCLUDED.embedding_model,
      embedding_dimension = EXCLUDED.embedding_dimension,
      updated_at          = CURRENT_TIMESTAMP
    RETURNING *;
  `;

  const values = [
    id,
    documentId,
    chunkId,
    JSON.stringify(embedding),
    embeddingModel || EMBEDDING_MODEL,
    embeddingDimension || EMBEDDING_DIMENSION,
  ];

  const { rows } = await pool.query(query, values);
  return rows[0];
};

/**
 * Insert multiple embeddings in a single transaction.
 * Existing embeddings for the same document are deleted first (replace-all strategy).
 */
const saveEmbeddingsBatch = async (embeddings) => {
  await ensureTable();

  if (!embeddings || embeddings.length === 0) {
    throw new AppError("No embeddings to save", 400);
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Delete existing embeddings for this document
    const documentId = embeddings[0].documentId;
    await client.query(
      "DELETE FROM document_embeddings WHERE document_id = $1",
      [documentId]
    );

    // Insert all embeddings
    const insertQuery = `
      INSERT INTO document_embeddings
        (id, document_id, chunk_id, embedding, embedding_model, embedding_dimension)
      VALUES ($1, $2, $3, $4::vector, $5, $6)
    `;

    for (const emb of embeddings) {
      await client.query(insertQuery, [
        emb.id,
        emb.documentId,
        emb.chunkId,
        JSON.stringify(emb.embedding),
        emb.embeddingModel || EMBEDDING_MODEL,
        emb.embeddingDimension || EMBEDDING_DIMENSION,
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

/**
 * Fetch a single embedding by chunk_id.
 */
const getEmbeddingByChunkId = async (chunkId) => {
  await ensureTable();

  const query = `
    SELECT *
    FROM document_embeddings
    WHERE chunk_id = $1;
  `;

  const { rows } = await pool.query(query, [chunkId]);
  return rows[0] || null;
};

/**
 * Fetch all embeddings for a given document, ordered by chunk.
 */
const getEmbeddingsByDocumentId = async (documentId) => {
  await ensureTable();

  const query = `
    SELECT de.*, dc.chunk_index, dc.chunk_text
    FROM document_embeddings de
    JOIN document_chunks dc ON dc.id = de.chunk_id
    WHERE de.document_id = $1
    ORDER BY dc.chunk_index ASC;
  `;

  const { rows } = await pool.query(query, [documentId]);
  return rows;
};

/**
 * Delete all embeddings for a document.
 */
const deleteEmbeddingsByDocumentId = async (documentId) => {
  await ensureTable();

  const query = `
    DELETE FROM document_embeddings
    WHERE document_id = $1;
  `;

  const { rowCount } = await pool.query(query, [documentId]);
  return rowCount;
};

/**
 * Count embeddings for a document.
 */
const countEmbeddingsByDocumentId = async (documentId) => {
  await ensureTable();

  const query = `
    SELECT COUNT(*)::int AS count
    FROM document_embeddings
    WHERE document_id = $1;
  `;

  const { rows } = await pool.query(query, [documentId]);
  return rows[0]?.count || 0;
};

/**
 * Count all embeddings in the system.
 */
const countAllEmbeddings = async () => {
  await ensureTable();

  const query = `
    SELECT COUNT(*)::int AS count
    FROM document_embeddings;
  `;

  const { rows } = await pool.query(query);
  return rows[0]?.count || 0;
};

module.exports = {
  ensureTable,
  insertEmbedding,
  upsertEmbedding,
  saveEmbeddingsBatch,
  getEmbeddingByChunkId,
  getEmbeddingsByDocumentId,
  deleteEmbeddingsByDocumentId,
  countEmbeddingsByDocumentId,
  countAllEmbeddings,
};