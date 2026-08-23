const assert = require("assert");

const { buildResponse } = require("../src/module/parcelpilot/agent");

describe("ParcelPilot Agent Grounded Answer (Phase 3 Final)", () => {
  describe("Grounded Answer Generation", () => {
    it("should generate answer from authoritative evidence for policy question", () => {
      const decisionContext = {
        request: { intent: "POLICY_QUESTION", entities: {} },
        facts: [],
        businessDecisions: [],
        authoritativeEvidence: [
          {
            documentName: "03_Cancellation_and_Service_Credit_SOP_v4.pdf",
            sourceType: "operational_sop",
            text: "BOOKED, not yet PICKED_UP: May be cancelled. No fee within 30 minutes of booking. After 30 minutes, charge INR 250 unless a customer agreement explicitly waives the cancellation fee.",
            authorityRank: 3,
          },
        ],
        supportingEvidence: [],
        conflicts: [],
        missingInformation: [],
        warnings: [],
        recommendedNextStep: "READ_ONLY_ANSWER",
        canAnswer: true,
        requiresConfirmation: false,
        requiresHumanEscalation: false,
      };
      const response = buildResponse(decisionContext);
      assert.strictEqual(response.status, "ANSWERED");
      assert.ok(response.answer.includes("cancelled"));
      assert.ok(response.answer.includes("INR 250"));
      assert.ok(!response.answer.includes("I have retrieved the relevant information"));
    });

    it("should not include customer agreements for generic policy question", () => {
      const decisionContext = {
        request: { intent: "POLICY_QUESTION", entities: {} },
        facts: [],
        businessDecisions: [],
        authoritativeEvidence: [
          {
            documentName: "01_Support_Policy_v3_CURRENT.pdf",
            sourceType: "support_policy",
            text: "ParcelPilot Support Policy v3 - Status: CURRENT",
            authorityRank: 2,
          },
        ],
        supportingEvidence: [],
        conflicts: [],
        missingInformation: [],
        warnings: [],
        recommendedNextStep: "READ_ONLY_ANSWER",
        canAnswer: true,
        requiresConfirmation: false,
        requiresHumanEscalation: false,
      };
      const response = buildResponse(decisionContext);
      assert.strictEqual(response.status, "ANSWERED");
      const hasAgreement = response.citations.some((c) => c.sourceType === "customer_agreement");
      assert.strictEqual(hasAgreement, false);
    });

    it("should use deterministic reason for cancellation decision", () => {
      const decisionContext = {
        request: { intent: "CANCELLATION_QUESTION", entities: { orderId: "ORD-1001" } },
        facts: [{ sourceType: "database", field: "order", value: { orderId: "ORD-1001" } }],
        businessDecisions: [
          {
            sourceType: "business_decision",
            sourceId: "ORD-1001",
            value: {
              orderId: "ORD-1001",
              eligible: false,
              feeInr: 0,
              reason: "Cancellation has already been requested for this order.",
              requiresConfirmation: false,
            },
          },
        ],
        authoritativeEvidence: [],
        supportingEvidence: [],
        conflicts: [],
        missingInformation: [],
        warnings: [],
        recommendedNextStep: "READ_ONLY_ANSWER",
        canAnswer: true,
        requiresConfirmation: false,
        requiresHumanEscalation: false,
      };
      const response = buildResponse(decisionContext);
      assert.strictEqual(response.status, "ANSWERED");
      assert.strictEqual(response.answer, "Cancellation has already been requested for this order.");
    });
  });
});