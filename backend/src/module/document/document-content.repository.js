const pool = require("../../config/db");
const AppError = require("../../utils/AppError");

/**
 * Repository for the `document_contents` table.
 *
 * The table is created on first use via the `ensureTable` method so there are
 * no manual migration steps required.
 */

const CREATE_TABLE_IF_NOT_EXISTS = `
  CREATE TABLE IF NOT EXISTS document_contents (
    id              UUID PRIMARY KEY,
    document_id     UUID NOT NULL UNIQUE REFERENCES documents(id) ON DELETE CASCADE,
    content         TEXT NOT NULL,
    page_count      INTEGER NOT NULL DEFAULT 0,
    character_count INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`;

const ensureTable = async () => {
  await pool.query(CREATE_TABLE_IF_NOT_EXISTS);
};

const saveExtractedText = async ({ id, documentId, content, pageCount, characterCount }) => {
  await ensureTable();

  const query = `
    INSERT INTO document_contents (id, document_id, content, page_count, character_count)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (document_id)
    DO UPDATE SET
      content          = EXCLUDED.content,
      page_count       = EXCLUDED.page_count,
      character_count  = EXCLUDED.character_count,
      updated_at       = CURRENT_TIMESTAMP
    RETURNING *;
  `;

  const values = [id, documentId, content, pageCount, characterCount];
  const { rows } = await pool.query(query, values);
  return rows[0];
};

const getExtractedText = async (documentId) => {
  await ensureTable();

  const query = `
    SELECT *
    FROM document_contents
    WHERE document_id = $1;
  `;

  const { rows } = await pool.query(query, [documentId]);

  if (!rows[0]) {
    throw new AppError("Document content not found", 404);
  }

  return rows[0];
};

const updateExtractedText = async ({ documentId, content, pageCount, characterCount }) => {
  await ensureTable();

  const query = `
    UPDATE document_contents
    SET content          = $1,
        page_count       = $2,
        character_count  = $3,
        updated_at       = CURRENT_TIMESTAMP
    WHERE document_id = $4
    RETURNING *;
  `;

  const values = [content, pageCount, characterCount, documentId];
  const { rows } = await pool.query(query, values);

  if (!rows[0]) {
    throw new AppError("Document content not found", 404);
  }

  return rows[0];
};

module.exports = {
  ensureTable,
  saveExtractedText,
  getExtractedText,
  updateExtractedText,
};