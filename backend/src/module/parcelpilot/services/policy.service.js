const AppError = require("../../../utils/AppError");
const logger = require("../../../utils/logger");

/**
 * Policy service — deterministic source precedence and conflict handling.
 *
 * The authority model follows the assessment specification:
 *
 *   1. Applicable customer-specific agreement
 *   2. Current support policy
 *   3. Current cancellation/service-credit SOP
 *   4. Current product operations documentation
 *   5. Historical tickets (contextual evidence only)
 *   6. Deprecated documents (historical context only)
 */

const SOURCE_PRECEDENCE = {
  customer_agreement: 1,
  support_policy: 2,
  operational_sop: 3,
  product_operations: 4,
  historical_ticket: 5,
  deprecated: 6,
};

const SOURCE_PRECEDENCE_ORDER = [
  "customer_agreement",
  "support_policy",
  "operational_sop",
  "product_operations",
  "historical_ticket",
  "deprecated",
];

/**
 * Determine the precedence rank for a given document type/status.
 *
 * @param {string} documentType - The document_type metadata value.
 * @param {string} documentStatus - The document_status metadata value.
 * @returns {number} The precedence rank (lower = higher authority).
 */
const getSourcePrecedence = (documentType, documentStatus) => {
  if (documentStatus === "deprecated") {
    return SOURCE_PRECEDENCE.deprecated;
  }

  if (documentType === "customer_agreement") {
    return SOURCE_PRECEDENCE.customer_agreement;
  }

  if (documentType === "support_policy") {
    return SOURCE_PRECEDENCE.support_policy;
  }

  if (documentType === "operational_sop") {
    return SOURCE_PRECEDENCE.operational_sop;
  }

  if (documentType === "product_operations") {
    return SOURCE_PRECEDENCE.product_operations;
  }

  return SOURCE_PRECEDENCE.deprecated;
};

/**
 * Rank a list of retrieved chunks by source precedence.
 *
 * @param {Array<object>} chunks - Retrieved chunks with documentType/documentStatus.
 * @returns {Array<object>} Chunks sorted by precedence (highest authority first).
 */
const rankChunksByPrecedence = (chunks) => {
  if (!chunks || chunks.length === 0) {
    return [];
  }

  return [...chunks].sort((a, b) => {
    const rankA = getSourcePrecedence(a.documentType, a.documentStatus);
    const rankB = getSourcePrecedence(b.documentType, b.documentStatus);
    return rankA - rankB;
  });
};

/**
 * Filter out deprecated sources unless explicitly requested.
 *
 * @param {Array<object>} chunks - Retrieved chunks.
 * @param {boolean} includeDeprecated - Whether to include deprecated sources.
 * @returns {Array<object>} Filtered chunks.
 */
const filterDeprecatedSources = (chunks, includeDeprecated = false) => {
  if (!chunks || chunks.length === 0) {
    return [];
  }

  if (includeDeprecated) {
    return chunks;
  }

  return chunks.filter((chunk) => chunk.documentStatus !== "deprecated");
};

/**
 * Detect conflicts between retrieved evidence.
 *
 * A conflict exists when two or more chunks from different source types
 * provide contradictory information about the same topic.
 *
 * @param {Array<object>} chunks - Retrieved chunks.
 * @returns {Array<object>} Array of conflict descriptors.
 */
const detectConflicts = (chunks) => {
  if (!chunks || chunks.length < 2) {
    return [];
  }

  const conflicts = [];
  const seen = new Set();

  for (let i = 0; i < chunks.length; i++) {
    for (let j = i + 1; j < chunks.length; j++) {
      const a = chunks[i];
      const b = chunks[j];

      // Only compare chunks from different source types
      if (a.documentType === b.documentType) {
        continue;
      }

      const key = `${a.documentId}:${b.documentId}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);

      const rankA = getSourcePrecedence(a.documentType, a.documentStatus);
      const rankB = getSourcePrecedence(b.documentType, b.documentStatus);

      conflicts.push({
        sourceA: {
          documentId: a.documentId,
          documentTitle: a.documentTitle,
          documentType: a.documentType,
          documentStatus: a.documentStatus,
          precedence: rankA,
        },
        sourceB: {
          documentId: b.documentId,
          documentTitle: b.documentTitle,
          documentType: b.documentType,
          documentStatus: b.documentStatus,
          precedence: rankB,
        },
        resolution: rankA < rankB ? "sourceA" : rankB < rankA ? "sourceB" : "unresolved",
      });
    }
  }

  return conflicts;
};

/**
 * Select the authoritative evidence from a set of retrieved chunks.
 *
 * @param {Array<object>} chunks - Retrieved chunks.
 * @param {object} options
 * @param {boolean} [options.includeDeprecated] - Include deprecated sources.
 * @returns {object} { authoritative, supporting, conflicts, deprecated }
 */
const selectAuthoritativeEvidence = (chunks, { includeDeprecated = false } = {}) => {
  if (!chunks || chunks.length === 0) {
    return {
      authoritative: [],
      supporting: [],
      conflicts: [],
      deprecated: [],
    };
  }

  const ranked = rankChunksByPrecedence(chunks);
  const conflicts = detectConflicts(chunks);

  const authoritative = [];
  const supporting = [];
  const deprecated = [];

  for (const chunk of ranked) {
    if (chunk.documentStatus === "deprecated") {
      deprecated.push(chunk);
      if (includeDeprecated) {
        supporting.push(chunk);
      }
      continue;
    }

    if (authoritative.length === 0) {
      authoritative.push(chunk);
    } else {
      supporting.push(chunk);
    }
  }

  return {
    authoritative,
    supporting,
    conflicts,
    deprecated,
  };
};

/**
 * Get the source precedence order for documentation/UI display.
 *
 * @returns {Array<{type: string, rank: number}>}
 */
const getSourcePrecedenceOrder = () => {
  return SOURCE_PRECEDENCE_ORDER.map((type, index) => ({
    type,
    rank: index + 1,
  }));
};

module.exports = {
  SOURCE_PRECEDENCE,
  SOURCE_PRECEDENCE_ORDER,
  getSourcePrecedence,
  rankChunksByPrecedence,
  filterDeprecatedSources,
  detectConflicts,
  selectAuthoritativeEvidence,
  getSourcePrecedenceOrder,
};