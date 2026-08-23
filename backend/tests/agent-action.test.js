const assert = require("assert");

const { requestContextBuilder } = require("../src/module/parcelpilot/orchestration");
const { buildResponse } = require("../src/module/parcelpilot/agent");

describe("ParcelPilot Agent Action Intent (Phase 3.1)", () => {
  describe("Action Intent Detection", () => {
    it("should classify 'Can I cancel ORD-1001?' as CANCELLATION_QUESTION", () => {
      const ctx = requestContextBuilder.buildRequestContext({ query: "Can I cancel ORD-1001?" });
      assert.strictEqual(ctx.intent, "CANCELLATION_QUESTION");
    });

    it("should classify 'Cancel ORD-1001.' as CANCELLATION_ACTION", () => {
      const ctx = requestContextBuilder.buildRequestContext({ query: "Cancel ORD-1001." });
      assert.strictEqual(ctx.intent, "CANCELLATION_ACTION");
    });

    it("should classify 'Please cancel ORD-1001.' as CANCELLATION_ACTION", () => {
      const ctx = requestContextBuilder.buildRequestContext({ query: "Please cancel ORD-1001." });
      assert.strictEqual(ctx.intent, "CANCELLATION_ACTION");
    });

    it("should classify 'I want to cancel ORD-1001.' as CANCELLATION_ACTION", () => {
      const ctx = requestContextBuilder.buildRequestContext({ query: "I want to cancel ORD-1001." });
      assert.strictEqual(ctx.intent, "CANCELLATION_ACTION");
    });

    it("should classify 'What is the cancellation policy?' as POLICY_QUESTION", () => {
      const ctx = requestContextBuilder.buildRequestContext({ query: "What is the cancellation policy?" });
      assert.strictEqual(ctx.intent, "POLICY_QUESTION");
    });

    it("should classify 'Is ORD-1001 eligible for cancellation?' as CANCELLATION_QUESTION", () => {
      const ctx = requestContextBuilder.buildRequestContext({ query: "Is ORD-1001 eligible for cancellation?" });
      assert.strictEqual(ctx.intent, "CANCELLATION_QUESTION");
    });
  });

  describe("Action Response Builder", () => {
    it("should return ANSWERED for informational cancellation question", () => {
      const decisionContext = {
        request: { intent: "CANCELLATION_QUESTION", entities: { orderId: "ORD-1001" } },
        facts: [{ sourceType: "database", field: "order", value: { orderId: "ORD-1001" } }],
        businessDecisions: [
          {
            sourceType: "business_decision",
            sourceId: "ORD-1001",
            value: {
              orderId: "ORD-1001",
              eligible: true,
              feeInr: 0,
              reason: "Order ORD-1001 is eligible for cancellation with no fee.",
              requiresConfirmation: true,
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
        requiresConfirmation: true,
        requiresHumanEscalation: false,
      };
      const response = buildResponse(decisionContext);
      assert.strictEqual(response.status, "ANSWERED");
      assert.strictEqual(response.requiresConfirmation, false);
      assert.strictEqual(response.pendingAction, null);
    });

    it("should return NEEDS_CONFIRMATION for cancellation action", () => {
      const decisionContext = {
        request: { intent: "CANCELLATION_ACTION", entities: { orderId: "ORD-1001" } },
        facts: [{ sourceType: "database", field: "order", value: { orderId: "ORD-1001" } }],
        businessDecisions: [
          {
            sourceType: "business_decision",
            sourceId: "ORD-1001",
            value: {
              orderId: "ORD-1001",
              eligible: true,
              feeInr: 0,
              reason: "Order ORD-1001 is eligible for cancellation with no fee.",
              requiresConfirmation: true,
            },
          },
        ],
        authoritativeEvidence: [],
        supportingEvidence: [],
        conflicts: [],
        missingInformation: [],
        warnings: [],
        recommendedNextStep: "REQUIRES_CONFIRMATION",
        canAnswer: true,
        requiresConfirmation: true,
        requiresHumanEscalation: false,
      };
      const response = buildResponse(decisionContext);
      assert.strictEqual(response.status, "NEEDS_CONFIRMATION");
      assert.strictEqual(response.requiresConfirmation, true);
      assert.strictEqual(response.pendingAction.type, "CANCEL_ORDER");
      assert.strictEqual(response.pendingAction.targetId, "ORD-1001");
      assert.strictEqual(response.nextStep, "REQUEST_CONFIRMATION");
    });

    it("should return ANSWERED when cancellation is not allowed", () => {
      const decisionContext = {
        request: { intent: "CANCELLATION_ACTION", entities: { orderId: "ORD-1001" } },
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
      assert.strictEqual(response.requiresConfirmation, false);
      assert.strictEqual(response.pendingAction, null);
    });

    it("should return NEEDS_INFORMATION for missing order", () => {
      const decisionContext = {
        request: { intent: "CANCELLATION_ACTION", entities: {} },
        facts: [],
        businessDecisions: [],
        authoritativeEvidence: [],
        supportingEvidence: [],
        conflicts: [],
        missingInformation: [
          { field: "order_id", reason: "Cancellation evaluation requires an order", state: "UNKNOWN" },
        ],
        warnings: [],
        recommendedNextStep: "MISSING_INFORMATION",
        canAnswer: false,
        requiresConfirmation: false,
        requiresHumanEscalation: false,
      };
      const response = buildResponse(decisionContext);
      assert.strictEqual(response.status, "NEEDS_INFORMATION");
      assert.strictEqual(response.pendingAction, null);
    });

    it("should return CANNOT_DETERMINE for NOT_FOUND order", () => {
      const decisionContext = {
        request: { intent: "CANCELLATION_ACTION", entities: { orderId: "ORD-9999" } },
        facts: [],
        businessDecisions: [],
        authoritativeEvidence: [],
        supportingEvidence: [],
        conflicts: [],
        missingInformation: [
          { field: "order_id", reason: "Order ORD-9999 not found", state: "NOT_FOUND" },
        ],
        warnings: [],
        recommendedNextStep: "CANNOT_DETERMINE",
        canAnswer: false,
        requiresConfirmation: false,
        requiresHumanEscalation: false,
      };
      const response = buildResponse(decisionContext);
      assert.strictEqual(response.status, "CANNOT_DETERMINE");
      assert.strictEqual(response.pendingAction, null);
    });
  });
});