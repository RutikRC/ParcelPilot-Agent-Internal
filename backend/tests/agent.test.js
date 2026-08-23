const assert = require("assert");

const {
  agentService,
  conversationManager,
  createAgentResponse,
  isValidResponse,
  buildResponse,
} = require("../src/module/parcelpilot/agent");

describe("ParcelPilot Agent", () => {
  beforeEach(() => {
    conversationManager.clearAll();
  });

  describe("Output Schema", () => {
    it("should create a valid agent response", () => {
      const response = createAgentResponse({
        status: "ANSWERED",
        answer: "Test answer",
      });
      assert.strictEqual(response.status, "ANSWERED");
      assert.strictEqual(response.nextStep, "RESPOND");
      assert.ok(isValidResponse(response));
    });

    it("should reject invalid status", () => {
      const response = createAgentResponse({
        status: "INVALID",
        answer: "Test",
      });
      assert.strictEqual(isValidResponse(response), false);
    });
  });

  describe("Conversation Manager", () => {
    it("should create and retrieve a conversation", () => {
      const conv = conversationManager.createConversation();
      assert.ok(conv.conversationId);
      const retrieved = conversationManager.getConversation(conv.conversationId);
      assert.strictEqual(retrieved.conversationId, conv.conversationId);
    });

    it("should append messages", () => {
      const conv = conversationManager.createConversation();
      conversationManager.appendMessage(conv.conversationId, {
        role: "user",
        content: "Hello",
      });
      const messages = conversationManager.getMessages(conv.conversationId);
      assert.strictEqual(messages.length, 1);
      assert.strictEqual(messages[0].content, "Hello");
    });

    it("should update state", () => {
      const conv = conversationManager.createConversation();
      conversationManager.updateState(conv.conversationId, { lastIntent: "POLICY_QUESTION" });
      const updated = conversationManager.getConversation(conv.conversationId);
      assert.strictEqual(updated.state.lastIntent, "POLICY_QUESTION");
    });
  });

  describe("Confirmation Detection", () => {
    it("should detect confirmation when pending action exists", () => {
      const state = {
        pendingAction: { type: "CANCEL_ORDER", targetId: "ORD-1001" },
      };
      assert.strictEqual(agentService.isConfirmation("Yes", state), true);
      assert.strictEqual(agentService.isConfirmation("Do it", state), true);
      assert.strictEqual(agentService.isConfirmation("No", state), false);
    });

    it("should not detect confirmation without pending action", () => {
      const state = {};
      assert.strictEqual(agentService.isConfirmation("Yes", state), false);
    });
  });

  describe("Follow-up Detection", () => {
    it("should detect follow-up with context", () => {
      const state = {
        lastIntent: "SLA_QUESTION",
        lastEntities: { ticketId: "TKT-501" },
      };
      assert.strictEqual(agentService.isFollowUp("Why?", state), true);
      assert.strictEqual(agentService.isFollowUp("What about it?", state), true);
    });

    it("should not detect follow-up without context", () => {
      const state = {};
      assert.strictEqual(agentService.isFollowUp("Why?", state), false);
    });
  });

  describe("Response Builder", () => {
    it("should return NEEDS_INFORMATION for missing order", () => {
      const decisionContext = {
        request: { intent: "CANCELLATION_QUESTION", entities: {} },
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
      assert.strictEqual(response.nextStep, "ASK_CLARIFICATION");
    });

    it("should return CANNOT_DETERMINE for NOT_FOUND", () => {
      const decisionContext = {
        request: { intent: "CANCELLATION_QUESTION", entities: { orderId: "ORD-9999" } },
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
    });

    it("should return NEEDS_CONFIRMATION for cancellable order action", () => {
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
    });

    it("should return ANSWERED for policy question", () => {
      const decisionContext = {
        request: { intent: "POLICY_QUESTION", entities: {} },
        facts: [],
        businessDecisions: [],
        authoritativeEvidence: [
          { documentName: "01_Support_Policy_v3_CURRENT.pdf", sourceType: "support_policy" },
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
      assert.strictEqual(response.nextStep, "RESPOND");
      assert.ok(response.citations.length > 0);
    });

    it("should return ESCALATION_REQUIRED for unresolved conflict", () => {
      const decisionContext = {
        request: { intent: "POLICY_QUESTION", entities: {} },
        facts: [],
        businessDecisions: [],
        authoritativeEvidence: [],
        supportingEvidence: [],
        conflicts: [
          { requiresClarification: true, severity: "high" },
        ],
        missingInformation: [],
        warnings: [],
        recommendedNextStep: "REQUIRES_HUMAN_ESCALATION",
        canAnswer: false,
        requiresConfirmation: false,
        requiresHumanEscalation: true,
      };
      const response = buildResponse(decisionContext);
      assert.strictEqual(response.status, "ESCALATION_REQUIRED");
      assert.strictEqual(response.nextStep, "ESCALATE");
    });
  });
});