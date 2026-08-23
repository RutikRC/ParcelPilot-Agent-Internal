const assert = require("assert");

const {
  requestContextBuilder,
  toolPlanner,
  evidenceAggregator,
  conflictResolver,
  missingDataHandler,
  decisionContextBuilder,
} = require("../src/module/parcelpilot/orchestration");

describe("ParcelPilot Orchestration", () => {
  describe("Request Context Builder", () => {
    it("should extract order ID from query", () => {
      const context = requestContextBuilder.buildRequestContext({
        query: "Can I cancel ORD-1001?",
      });
      assert.strictEqual(context.orderId, "ORD-1001");
      assert.strictEqual(context.intent, "CANCELLATION_QUESTION");
    });

    it("should extract account ID from query", () => {
      const context = requestContextBuilder.buildRequestContext({
        query: "What is the SLA for ACCT-001?",
      });
      assert.strictEqual(context.accountId, "ACCT-001");
      assert.strictEqual(context.intent, "SLA_QUESTION");
    });

    it("should extract ticket ID from query", () => {
      const context = requestContextBuilder.buildRequestContext({
        query: "Escalate TKT-501",
      });
      assert.strictEqual(context.ticketId, "TKT-501");
      assert.strictEqual(context.intent, "ESCALATION_ACTION");
    });

    it("should classify policy question", () => {
      const context = requestContextBuilder.buildRequestContext({
        query: "What is the cancellation policy?",
      });
      assert.strictEqual(context.intent, "POLICY_QUESTION");
    });

    it("should classify general knowledge", () => {
      const context = requestContextBuilder.buildRequestContext({
        query: "How does the system work?",
      });
      assert.strictEqual(context.intent, "GENERAL_KNOWLEDGE");
    });

    it("should not invent missing IDs", () => {
      const context = requestContextBuilder.buildRequestContext({
        query: "Can I cancel my order?",
      });
      assert.strictEqual(context.orderId, null);
      assert.strictEqual(context.accountId, null);
      assert.strictEqual(context.ticketId, null);
    });
  });

  describe("Tool Planner", () => {
    it("should plan cancellation tools with order", () => {
      const context = requestContextBuilder.buildRequestContext({
        query: "Can I cancel ORD-1001?",
      });
      const plan = toolPlanner.planTools(context);
      assert.strictEqual(plan.intent, "CANCELLATION_QUESTION");
      assert.ok(plan.steps.some((s) => s.tool === "get_order"));
      assert.ok(plan.steps.some((s) => s.tool === "get_account"));
      assert.ok(plan.steps.some((s) => s.tool === "get_customer_agreement"));
      assert.ok(plan.steps.some((s) => s.tool === "evaluate_cancellation"));
    });

    it("should plan policy question with knowledge tool only", () => {
      const context = requestContextBuilder.buildRequestContext({
        query: "What is the cancellation policy?",
      });
      const plan = toolPlanner.planTools(context);
      assert.strictEqual(plan.intent, "POLICY_QUESTION");
      assert.strictEqual(plan.steps.length, 1);
      assert.strictEqual(plan.steps[0].tool, "search_knowledge");
    });

    it("should plan SLA question with ticket", () => {
      const context = requestContextBuilder.buildRequestContext({
        query: "What is the SLA for TKT-501?",
      });
      const plan = toolPlanner.planTools(context);
      assert.strictEqual(plan.intent, "SLA_QUESTION");
      assert.ok(plan.steps.some((s) => s.tool === "get_ticket"));
      assert.ok(plan.steps.some((s) => s.tool === "calculate_sla_status"));
    });
  });

  describe("Evidence Aggregator", () => {
    it("should aggregate database facts", () => {
      const results = [
        {
          tool: "get_order",
          status: "success",
          data: { orderId: "ORD-1001", status: "BOOKED" },
        },
      ];
      const evidence = evidenceAggregator.aggregateEvidence(results);
      assert.strictEqual(evidence.facts.length, 1);
      assert.strictEqual(evidence.facts[0].sourceType, "database");
      assert.strictEqual(evidence.facts[0].sourceId, "ORD-1001");
    });

    it("should aggregate business decisions", () => {
      const results = [
        {
          tool: "evaluate_cancellation",
          status: "success",
          data: { eligible: true, feeInr: 0, requiresConfirmation: true },
        },
      ];
      const evidence = evidenceAggregator.aggregateEvidence(results);
      assert.strictEqual(evidence.businessDecisions.length, 1);
      assert.strictEqual(evidence.businessDecisions[0].sourceType, "business_decision");
    });

    it("should capture tool errors as warnings", () => {
      const results = [
        {
          tool: "get_order",
          status: "error",
          error_code: "NOT_FOUND",
          message: "Order could not be found",
        },
      ];
      const evidence = evidenceAggregator.aggregateEvidence(results);
      assert.strictEqual(evidence.warnings.length, 1);
      assert.strictEqual(evidence.warnings[0].errorCode, "NOT_FOUND");
    });
  });

  describe("Missing Data Handler", () => {
    it("should detect missing order ID for cancellation", () => {
      const context = requestContextBuilder.buildRequestContext({
        query: "Can I cancel my order?",
      });
      const missing = missingDataHandler.detectMissingInformation(context, { warnings: [] });
      assert.strictEqual(missing.length, 1);
      assert.strictEqual(missing[0].field, "order_id");
      assert.strictEqual(missing[0].state, "UNKNOWN");
    });

    it("should detect NOT_FOUND for unknown order", () => {
      const context = requestContextBuilder.buildRequestContext({
        query: "Can I cancel ORD-9999?",
      });
      const evidence = {
        warnings: [
          {
            tool: "get_order",
            errorCode: "NOT_FOUND",
            message: "Order ORD-9999 not found",
          },
        ],
      };
      const missing = missingDataHandler.detectMissingInformation(context, evidence);
      assert.ok(missing.some((m) => m.state === "NOT_FOUND"));
    });
  });

  describe("Decision Context Builder", () => {
    it("should return MISSING_INFORMATION when order ID is missing", () => {
      const context = requestContextBuilder.buildRequestContext({
        query: "Can I cancel my order?",
      });
      const missing = [
        { field: "order_id", reason: "Cancellation evaluation requires an order", state: "UNKNOWN" },
      ];
      const decision = decisionContextBuilder.buildDecisionContext({
        context,
        evidence: { facts: [], policyEvidence: [], businessDecisions: [], warnings: [] },
        conflicts: [],
        missing,
      });
      assert.strictEqual(decision.recommendedNextStep, "MISSING_INFORMATION");
      assert.strictEqual(decision.canAnswer, false);
    });

    it("should return READ_ONLY_ANSWER when evidence is present", () => {
      const context = requestContextBuilder.buildRequestContext({
        query: "What is the cancellation policy?",
      });
      const decision = decisionContextBuilder.buildDecisionContext({
        context,
        evidence: {
          facts: [],
          policyEvidence: [{ authorityRank: 2 }],
          businessDecisions: [],
          warnings: [],
        },
        conflicts: [],
        missing: [],
      });
      assert.strictEqual(decision.recommendedNextStep, "READ_ONLY_ANSWER");
      assert.strictEqual(decision.canAnswer, true);
    });

    it("should return REQUIRES_CONFIRMATION for cancellable order", () => {
      const context = requestContextBuilder.buildRequestContext({
        query: "Can I cancel ORD-1001?",
      });
      const decision = decisionContextBuilder.buildDecisionContext({
        context,
        evidence: {
          facts: [{ sourceType: "database" }],
          policyEvidence: [],
          businessDecisions: [
            { value: { eligible: true, requiresConfirmation: true } },
          ],
          warnings: [],
        },
        conflicts: [],
        missing: [],
      });
      assert.strictEqual(decision.recommendedNextStep, "REQUIRES_CONFIRMATION");
      assert.strictEqual(decision.requiresConfirmation, true);
    });
  });

  describe("Conflict Resolver", () => {
    it("should detect conflicts between different source types", () => {
      const evidence = {
        policyEvidence: [
          {
            documentId: "a",
            documentName: "Current Policy",
            sourceType: "support_policy",
            authorityRank: 2,
          },
          {
            documentId: "b",
            documentName: "Northstar Agreement",
            sourceType: "customer_agreement",
            authorityRank: 1,
          },
        ],
      };
      const conflicts = conflictResolver.resolveConflicts(evidence);
      assert.ok(conflicts.length > 0);
      assert.strictEqual(conflicts[0].requiresClarification, false);
    });
  });
});