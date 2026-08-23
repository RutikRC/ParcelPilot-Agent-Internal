const crypto = require("crypto");
const policyService = require("../services/policy.service");

/**
 * Evidence aggregator — combines tool outputs into a structured evidence
 * collection with facts, policy evidence, business decisions, and warnings.
 */

/**
 * Normalize a tool result into evidence objects.
 *
 * @param {object} result - The tool execution result.
 * @returns {Array<object>} Array of evidence objects.
 */
const normalizeToolResult = (result) => {
  if (!result || result.status !== "success" || !result.data) {
    return [];
  }

  const evidence = [];
  const { tool, data } = result;

  switch (tool) {
    case "get_account": {
      evidence.push({
        evidenceId: crypto.randomUUID(),
        sourceType: "database",
        sourceId: data.accountId,
        field: "account",
        value: data,
        authorityRank: 0,
      });
      break;
    }

    case "get_order": {
      evidence.push({
        evidenceId: crypto.randomUUID(),
        sourceType: "database",
        sourceId: data.orderId,
        field: "order",
        value: data,
        authorityRank: 0,
      });
      break;
    }

    case "get_ticket": {
      evidence.push({
        evidenceId: crypto.randomUUID(),
        sourceType: "database",
        sourceId: data.ticketId,
        field: "ticket",
        value: data,
        authorityRank: 0,
      });
      break;
    }

    case "get_customer_agreement": {
      if (data.hasAgreement && data.agreement) {
        evidence.push({
          evidenceId: crypto.randomUUID(),
          sourceType: "customer_agreement",
          sourceId: data.agreement.documentId,
          documentId: data.agreement.documentId,
          documentName: data.agreement.filename,
          accountId: data.accountId,
          authorityRank: policyService.getSourcePrecedence("customer_agreement", "current"),
          applicable: true,
        });
      }
      break;
    }

    case "search_knowledge": {
      // Add authoritative and supporting evidence from knowledge search
      for (const chunk of data.authoritative || []) {
        evidence.push({
          evidenceId: crypto.randomUUID(),
          sourceType: chunk.documentType || "knowledge",
          sourceId: chunk.documentId,
          documentId: chunk.documentId,
          documentName: chunk.filename || chunk.documentTitle,
          accountId: chunk.accountId || null,
          chunkId: chunk.chunkId,
          text: chunk.chunkText,
          authorityRank: policyService.getSourcePrecedence(chunk.documentType, chunk.documentStatus),
          relevanceScore: chunk.similarity,
          applicable: true,
        });
      }
      for (const chunk of data.supporting || []) {
        evidence.push({
          evidenceId: crypto.randomUUID(),
          sourceType: chunk.documentType || "knowledge",
          sourceId: chunk.documentId,
          documentId: chunk.documentId,
          documentName: chunk.filename || chunk.documentTitle,
          accountId: chunk.accountId || null,
          chunkId: chunk.chunkId,
          text: chunk.chunkText,
          authorityRank: policyService.getSourcePrecedence(chunk.documentType, chunk.documentStatus),
          relevanceScore: chunk.similarity,
          applicable: true,
        });
      }
      break;
    }

    case "evaluate_cancellation":
    case "calculate_service_credit":
    case "calculate_sla_status":
    case "evaluate_sla_risk":
    case "evaluate_escalation": {
      evidence.push({
        evidenceId: crypto.randomUUID(),
        sourceType: "business_decision",
        sourceId: data.orderId || data.ticketId || data.accountId || tool,
        field: tool,
        value: data,
        authorityRank: 0,
      });
      break;
    }

    default:
      break;
  }

  return evidence;
};

/**
 * Aggregate tool results into a structured evidence collection.
 *
 * @param {Array<object>} results - The tool execution results.
 * @returns {object} { facts, policyEvidence, businessDecisions, warnings, missingInformation }
 */
const aggregateEvidence = (results) => {
  const facts = [];
  const policyEvidence = [];
  const businessDecisions = [];
  const warnings = [];
  const missingInformation = [];

  for (const result of results || []) {
    if (result.status !== "success") {
      if (result.status === "error") {
        warnings.push({
          tool: result.tool,
          errorCode: result.error_code,
          message: result.message,
        });
      }
      continue;
    }

    const evidence = normalizeToolResult(result);

    for (const item of evidence) {
      if (item.sourceType === "database") {
        facts.push(item);
      } else if (item.sourceType === "business_decision") {
        businessDecisions.push(item);
      } else {
        policyEvidence.push(item);
      }
    }
  }

  return {
    facts,
    policyEvidence,
    businessDecisions,
    warnings,
    missingInformation,
  };
};

module.exports = {
  normalizeToolResult,
  aggregateEvidence,
};