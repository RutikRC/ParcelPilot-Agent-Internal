const accountRepository = require("../repositories/account.repository");
const AppError = require("../../../utils/AppError");

/**
 * Account tool — agent-facing account lookup.
 */

/**
 * Get an account by ID or name.
 *
 * @param {object} params
 * @param {string} [params.accountId] - The account identifier.
 * @param {string} [params.accountName] - The account name.
 * @returns {Promise<object>} The account record.
 */
const getAccount = async ({ accountId, accountName }) => {
  if (!accountId && !accountName) {
    throw new AppError("Either accountId or accountName is required", 400);
  }

  let account = null;

  if (accountId) {
    account = await accountRepository.getAccountById(accountId);
  } else if (accountName) {
    account = await accountRepository.getAccountByName(accountName);
  }

  if (!account) {
    throw new AppError(
      `Account not found for ${accountId ? `ID ${accountId}` : `name ${accountName}`}`,
      404
    );
  }

  return {
    accountId: account.account_id,
    accountName: account.account_name,
    plan: account.plan,
    status: account.status,
    csm: account.csm,
    contractFile: account.contract_file,
    premiumSupport: account.premium_support,
    notes: account.notes,
  };
};

/**
 * List accounts with optional filters.
 *
 * @param {object} params
 * @param {string} [params.plan] - Filter by plan.
 * @param {string} [params.status] - Filter by status.
 * @param {boolean} [params.premiumSupport] - Filter by premium support.
 * @returns {Promise<Array<object>>} Array of account records.
 */
const listAccounts = async ({ plan, status, premiumSupport } = {}) => {
  const accounts = await accountRepository.listAccounts({
    plan,
    status,
    premiumSupport,
  });

  return accounts.map((account) => ({
    accountId: account.account_id,
    accountName: account.account_name,
    plan: account.plan,
    status: account.status,
    csm: account.csm,
    contractFile: account.contract_file,
    premiumSupport: account.premium_support,
    notes: account.notes,
  }));
};

module.exports = {
  getAccount,
  listAccounts,
};