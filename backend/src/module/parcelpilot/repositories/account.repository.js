const pool = require("../../../config/db");
const AppError = require("../../../utils/AppError");

/**
 * Account repository — deterministic access to the accounts table.
 */

/**
 * Fetch a single account by account_id.
 *
 * @param {string} accountId - The account identifier (e.g. "ACCT-001").
 * @returns {Promise<object|null>} The account row, or null if not found.
 */
const getAccountById = async (accountId) => {
  if (!accountId || typeof accountId !== "string" || accountId.trim().length === 0) {
    throw new AppError("accountId is required", 400);
  }

  const query = `
    SELECT
      account_id,
      account_name,
      plan,
      status,
      csm,
      contract_file,
      premium_support,
      notes,
      ingested_at,
      updated_at
    FROM accounts
    WHERE account_id = $1;
  `;

  const { rows } = await pool.query(query, [accountId]);
  return rows[0] || null;
};

/**
 * Fetch a single account by account_name (case-insensitive).
 *
 * @param {string} accountName - The account name (e.g. "Northstar Logistics").
 * @returns {Promise<object|null>} The account row, or null if not found.
 */
const getAccountByName = async (accountName) => {
  if (!accountName || typeof accountName !== "string" || accountName.trim().length === 0) {
    throw new AppError("accountName is required", 400);
  }

  const query = `
    SELECT
      account_id,
      account_name,
      plan,
      status,
      csm,
      contract_file,
      premium_support,
      notes,
      ingested_at,
      updated_at
    FROM accounts
    WHERE LOWER(account_name) = LOWER($1);
  `;

  const { rows } = await pool.query(query, [accountName]);
  return rows[0] || null;
};

/**
 * List all accounts, optionally filtered.
 *
 * @param {object} filters
 * @param {string} [filters.plan] - Filter by plan.
 * @param {string} [filters.status] - Filter by status.
 * @param {boolean} [filters.premiumSupport] - Filter by premium support flag.
 * @returns {Promise<Array<object>>} Array of account rows.
 */
const listAccounts = async ({ plan, status, premiumSupport } = {}) => {
  const where = [];
  const values = [];

  if (plan) {
    values.push(plan);
    where.push(`plan = $${values.length}`);
  }

  if (status) {
    values.push(status);
    where.push(`status = $${values.length}`);
  }

  if (premiumSupport !== undefined && premiumSupport !== null) {
    values.push(premiumSupport);
    where.push(`premium_support = $${values.length}`);
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

  const query = `
    SELECT
      account_id,
      account_name,
      plan,
      status,
      csm,
      contract_file,
      premium_support,
      notes,
      ingested_at,
      updated_at
    FROM accounts
    ${whereClause}
    ORDER BY account_id;
  `;

  const { rows } = await pool.query(query, values);
  return rows;
};

module.exports = {
  getAccountById,
  getAccountByName,
  listAccounts,
};