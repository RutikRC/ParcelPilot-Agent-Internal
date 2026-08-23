const pool = require("../../../config/db");
const AppError = require("../../../utils/AppError");

/**
 * Agreement repository — deterministic access to customer agreements.
 *
 * Customer agreements are stored in the documents table with metadata:
 *   - document_type = 'customer_agreement'
 *   - document_status = 'current'
 *   - metadata.account_id = the owning account
 */

/**
 * Fetch the customer agreement document for a given account.
 *
 * @param {string} accountId - The account identifier.
 * @returns {Promise<object|null>} The agreement document row, or null.
 */
const getAgreementByAccountId = async (accountId) => {
  if (!accountId || typeof accountId !== "string" || accountId.trim().length === 0) {
    throw new AppError("accountId is required", 400);
  }

  const query = `
    SELECT
      d.id AS "documentId",
      d.title,
      d.original_name AS "filename",
      d.metadata->>'document_type' AS "documentType",
      d.metadata->>'document_status' AS "documentStatus",
      d.metadata->>'account_id' AS "accountId",
      d.metadata->>'effective_date' AS "effectiveDate",
      d.status AS "processingStatus",
      d.created_at AS "createdAt"
    FROM documents d
    WHERE d.is_deleted = FALSE
      AND d.status = 'READY'
      AND d.metadata->>'document_type' = 'customer_agreement'
      AND d.metadata->>'account_id' = $1
    ORDER BY d.created_at DESC
    LIMIT 1;
  `;

  const { rows } = await pool.query(query, [accountId]);
  return rows[0] || null;
};

/**
 * Fetch all customer agreement documents (for cross-account analysis).
 *
 * @returns {Promise<Array<object>>} Array of agreement document rows.
 */
const listAllAgreements = async () => {
  const query = `
    SELECT
      d.id AS "documentId",
      d.title,
      d.original_name AS "filename",
      d.metadata->>'document_type' AS "documentType",
      d.metadata->>'document_status' AS "documentStatus",
      d.metadata->>'account_id' AS "accountId",
      d.metadata->>'effective_date' AS "effectiveDate",
      d.status AS "processingStatus",
      d.created_at AS "createdAt"
    FROM documents d
    WHERE d.is_deleted = FALSE
      AND d.status = 'READY'
      AND d.metadata->>'document_type' = 'customer_agreement'
    ORDER BY d.original_name;
  `;

  const { rows } = await pool.query(query);
  return rows;
};

module.exports = {
  getAgreementByAccountId,
  listAllAgreements,
};