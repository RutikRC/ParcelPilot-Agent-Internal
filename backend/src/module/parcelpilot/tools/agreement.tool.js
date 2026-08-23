const agreementRepository = require("../repositories/agreement.repository");
const AppError = require("../../../utils/AppError");

/**
 * Agreement tool — agent-facing customer agreement lookup.
 */

/**
 * Get the customer agreement for an account.
 *
 * @param {object} params
 * @param {string} params.accountId - The account identifier.
 * @returns {Promise<object>} The agreement record.
 */
const getCustomerAgreement = async ({ accountId }) => {
  if (!accountId || typeof accountId !== "string" || accountId.trim().length === 0) {
    throw new AppError("accountId is required", 400);
  }

  const agreement = await agreementRepository.getAgreementByAccountId(accountId);

  if (!agreement) {
    return {
      accountId,
      hasAgreement: false,
      agreement: null,
    };
  }

  return {
    accountId,
    hasAgreement: true,
    agreement: {
      documentId: agreement.documentId,
      title: agreement.title,
      filename: agreement.filename,
      documentType: agreement.documentType,
      documentStatus: agreement.documentStatus,
      effectiveDate: agreement.effectiveDate,
    },
  };
};

/**
 * List all customer agreements.
 *
 * @returns {Promise<Array<object>>} Array of agreement records.
 */
const listCustomerAgreements = async () => {
  const agreements = await agreementRepository.listAllAgreements();

  return agreements.map((agreement) => ({
    documentId: agreement.documentId,
    title: agreement.title,
    filename: agreement.filename,
    documentType: agreement.documentType,
    documentStatus: agreement.documentStatus,
    accountId: agreement.accountId,
    effectiveDate: agreement.effectiveDate,
  }));
};

module.exports = {
  getCustomerAgreement,
  listCustomerAgreements,
};