/**
 * ParcelPilot Document Metadata Helper
 *
 * Provides deterministic classification metadata for the six supplied
 * assessment PDFs. The account_id is NOT hard-coded here; it is resolved
 * from the workbook's accounts sheet via the contract_file column.
 *
 * The metadata is stored in the existing documents.metadata JSONB column so
 * the existing document pipeline and retrieval system can use it.
 */

const DOCUMENT_CLASSIFICATIONS = {
  "01_Support_Policy_v3_CURRENT.pdf": {
    document_type: "support_policy",
    document_status: "current",
  },
  "02_Support_Policy_v2_DEPRECATED.pdf": {
    document_type: "support_policy",
    document_status: "deprecated",
  },
  "03_Cancellation_and_Service_Credit_SOP_v4.pdf": {
    document_type: "operational_sop",
    document_status: "current",
  },
  "04_Product_Operations_Guide_and_Known_Issues.pdf": {
    document_type: "product_operations",
    document_status: "current",
  },
  "05_Northstar_Logistics_Enterprise_Agreement.pdf": {
    document_type: "customer_agreement",
    document_status: "current",
  },
  "06_LumenWorks_Service_Agreement.pdf": {
    document_type: "customer_agreement",
    document_status: "current",
  },
};

/**
 * Return the classification metadata for a supplied PDF filename.
 *
 * @param {string} filename - The PDF filename (e.g. "01_Support_Policy_v3_CURRENT.pdf")
 * @returns {{document_type: string, document_status: string}|null}
 */
const getClassification = (filename) => {
  if (!filename) {
    return null;
  }
  const base = filename.split(/[\\/]/).pop();
  return DOCUMENT_CLASSIFICATIONS[base] || null;
};

/**
 * Build the full metadata object for a supplied PDF, including the resolved
 * account_id when the PDF is a customer agreement.
 *
 * @param {string} filename - The PDF filename
 * @param {string|null} accountId - Resolved account_id from the workbook (nullable)
 * @returns {object} metadata object for the documents.metadata JSONB column
 */
const buildDocumentMetadata = (filename, accountId = null, effectiveDate = null) => {
  const classification = getClassification(filename);

  if (!classification) {
    return null;
  }

  const metadata = {
    document_type: classification.document_type,
    document_status: classification.document_status,
    source: "parcelpilot_assessment",
  };

  // Only attach account_id for customer agreements (or when explicitly provided)
  if (accountId) {
    metadata.account_id = accountId;
  }

  if (effectiveDate) {
    metadata.effective_date = effectiveDate;
  }

  return metadata;
};

module.exports = {
  DOCUMENT_CLASSIFICATIONS,
  getClassification,
  buildDocumentMetadata,
};