const crypto = require("crypto");
const policyService = require("../services/policy.service");

/**
 * Conflict resolver — normalizes conflicts detected by the policy service
 * into structured conflict descriptors.
 *
 * Reuses the existing policy.service.js source precedence. Does NOT
 * duplicate the precedence algorithm.
 */

/**
 * Resolve conflicts from aggregated evidence.
 *
 * @param {object} evidence - The aggregated evidence from evidence-aggregator.
 * @returns {Array<object>} Array of normalized conflict descriptors.
 */
const resolveConflicts = (evidence) => {
  if (!evidence) {
    return [];
  }

  const conflicts = [];

  // Collect policy evidence chunks for conflict detection
  const policyChunks = (evidence.policyEvidence || []).map((item) => ({
    documentId: item.documentId || item.sourceId,
    documentTitle: item.documentName || item.sourceId,
    documentType: item.sourceType,
    documentStatus: item.sourceType === "customer_agreement" ? "current" : "current",
    similarity: item.relevanceScore || 0,
  }));

  // Use the existing policy service to detect conflicts
  const detected = policyService.detectConflicts(policyChunks);

  for (const conflict of detected) {
    const severity = determineSeverity(conflict);
    const resolution = conflict.resolution === "unresolved" ? null : conflict.resolution;

    conflicts.push({
      conflictId: crypto.randomUUID(),
      topic: "policy_conflict",
      sources: [
        {
          documentId: conflict.sourceA.documentId,
          documentName: conflict.sourceA.documentTitle,
          sourceType: conflict.sourceA.documentType,
          authorityRank: conflict.sourceA.precedence,
        },
        {
          documentId: conflict.sourceB.documentId,
          documentName: conflict.sourceB.documentTitle,
          sourceType: conflict.sourceB.documentType,
          authorityRank: conflict.sourceB.precedence,
        },
      ],
      severity,
      resolution,
      requiresClarification: resolution === null,
    });
  }

  return conflicts;
};

/**
 * Determine conflict severity based on source precedence difference.
 *
 * @param {object} conflict - The detected conflict.
 * @returns {string} Severity: low, medium, or high.
 */
const determineSeverity = (conflict) => {
  const rankDiff = Math.abs(conflict.sourceA.precedence - conflict.sourceB.precedence);

  if (rankDiff >= 3) {
    return "high";
  }
  if (rankDiff >= 2) {
    return "medium";
  }
  return "low";
};

module.exports = {
  resolveConflicts,
  determineSeverity,
};