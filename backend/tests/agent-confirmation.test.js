const assert = require("assert");

const agentService = require("../src/module/parcelpilot/agent/agent.service");
const conversationManager = require("../src/module/parcelpilot/agent/conversation-manager");

describe("ParcelPilot Agent Confirmation Flow", () => {
  beforeEach(() => {
    conversationManager.clearAll();
  });

  const pendingAction = {
    type: "CANCEL_ORDER",
    targetId: "ORD-1001",
    createdAt: new Date().toISOString(),
  };

  describe("Confirmation Detection", () => {
    it("detects positive confirmations", () => {
      const state = { pendingAction };
      ["Yes, proceed.", "Yes.", "Proceed", "Confirm", "Go ahead", "Do it", "Please proceed"].forEach((m) => {
        assert.strictEqual(agentService.isConfirmation(m, state), true, m);
      });
    });

    it("detects negative rejections", () => {
      const state = { pendingAction };
      ["No", "No, don't", "Cancel", "Stop", "Never mind"].forEach((m) => {
        assert.strictEqual(agentService.isRejection(m, state), true, m);
        assert.strictEqual(agentService.isConfirmation(m, state), false, m);
      });
    });

    it("does not treat ambiguous messages as confirmation", () => {
      const state = { pendingAction };
      assert.strictEqual(agentService.isConfirmation("Maybe", state), false);
      assert.strictEqual(agentService.isRejection("Maybe", state), false);
    });

    it("does not detect confirmation without a pending action", () => {
      assert.strictEqual(agentService.isConfirmation("Yes", {}), false);
      assert.strictEqual(agentService.isRejection("No", {}), false);
    });
  });

  describe("Pending Action Persistence", () => {
    it("stores pending action in conversation state", () => {
      const conv = conversationManager.createConversation();
      conversationManager.updateState(conv.conversationId, { pendingAction });
      const state = conversationManager.getConversation(conv.conversationId).state;
      assert.strictEqual(state.pendingAction.type, "CANCEL_ORDER");
      assert.strictEqual(state.pendingAction.targetId, "ORD-1001");
    });

    it("clears pending action after explicit rejection", async () => {
      const conv = conversationManager.createConversation();
      conversationManager.updateState(conv.conversationId, { pendingAction });
      const result = await agentService.processMessage({
        conversationId: conv.conversationId,
        message: "No",
      });
      assert.strictEqual(result.response.status, "ACTION_REJECTED");
      assert.strictEqual(result.response.pendingAction, null);
      const state = conversationManager.getConversation(conv.conversationId).state;
      assert.strictEqual(state.pendingAction, null);
    });
  });

  describe("Regression Tests (Phase 4 Bug)", () => {
    const actionRegistry = require("../src/module/parcelpilot/actions/action.registry");
    const { buildResponse } = require("../src/module/parcelpilot/agent");

    it("newly generated pendingAction contains a valid ISO createdAt timestamp", () => {
      const decisionContext = {
        request: { intent: "CANCELLATION_ACTION", entities: { orderId: "ORD-1001" }, referenceTime: new Date().toISOString() },
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
      assert.ok(response.pendingAction);
      assert.ok(response.pendingAction.createdAt);
      assert.doesNotThrow(() => new Date(response.pendingAction.createdAt).toISOString());
      assert.strictEqual(response.pendingAction.createdAt, new Date(response.pendingAction.createdAt).toISOString());
    });

    it("confirmation of a valid pending action executes CANCEL_ORDER successfully and clears pendingAction", async () => {
      const originalHandler = actionRegistry.get("CANCEL_ORDER");
      let executeCalled = false;
      actionRegistry.register({
        type: "CANCEL_ORDER",
        metadata: { name: "CANCEL_ORDER" },
        validate: async () => ({ valid: true }),
        execute: async () => {
          executeCalled = true;
          return { success: true };
        }
      });

      try {
        const conv = conversationManager.createConversation();
        const activePendingAction = {
          type: "CANCEL_ORDER",
          targetId: "ORD-1001",
          createdAt: new Date().toISOString(),
        };
        conversationManager.updateState(conv.conversationId, { pendingAction: activePendingAction });

        const result = await agentService.processMessage({
          conversationId: conv.conversationId,
          message: "Yes, proceed."
        });

        assert.strictEqual(executeCalled, true);
        assert.strictEqual(result.response.status, "ACTION_COMPLETED");
        assert.strictEqual(result.response.pendingAction, null);

        const state = conversationManager.getConversation(conv.conversationId).state;
        assert.strictEqual(state.pendingAction, null);
      } finally {
        actionRegistry.register(originalHandler);
      }
    });

    it("rejects expired pending action and does not execute", async () => {
      const originalHandler = actionRegistry.get("CANCEL_ORDER");
      let executeCalled = false;
      actionRegistry.register({
        type: "CANCEL_ORDER",
        metadata: { name: "CANCEL_ORDER" },
        validate: async () => ({ valid: true }),
        execute: async () => {
          executeCalled = true;
          return { success: true };
        }
      });

      try {
        const conv = conversationManager.createConversation();
        const oldTime = new Date(Date.now() - 16 * 60 * 1000).toISOString();
        const expiredPendingAction = {
          type: "CANCEL_ORDER",
          targetId: "ORD-1001",
          createdAt: oldTime,
        };
        conversationManager.updateState(conv.conversationId, { pendingAction: expiredPendingAction });

        const result = await agentService.processMessage({
          conversationId: conv.conversationId,
          message: "Yes, proceed."
        });

        assert.strictEqual(executeCalled, false);
        assert.strictEqual(result.response.status, "CANNOT_DETERMINE");
        assert.strictEqual(result.response.answer, "The confirmation request has expired. Please request the action again.");
        assert.strictEqual(result.response.pendingAction, null);

        const state = conversationManager.getConversation(conv.conversationId).state;
        assert.strictEqual(state.pendingAction, null);
      } finally {
        actionRegistry.register(originalHandler);
      }
    });

    it("supports various confirmation message variants", async () => {
      const variants = ["Yes, proceed.", "Yes.", "Proceed", "Confirm", "Go ahead", "Do it", "Please proceed"];
      const originalHandler = actionRegistry.get("CANCEL_ORDER");
      actionRegistry.register({
        type: "CANCEL_ORDER",
        metadata: { name: "CANCEL_ORDER" },
        validate: async () => ({ valid: true }),
        execute: async () => ({ success: true })
      });

      try {
        for (const variant of variants) {
          const conv = conversationManager.createConversation();
          const activePendingAction = {
            type: "CANCEL_ORDER",
            targetId: "ORD-1001",
            createdAt: new Date().toISOString(),
          };
          conversationManager.updateState(conv.conversationId, { pendingAction: activePendingAction });

          const result = await agentService.processMessage({
            conversationId: conv.conversationId,
            message: variant
          });

          assert.strictEqual(result.response.status, "ACTION_COMPLETED", `Failed on variant: ${variant}`);
          assert.strictEqual(result.response.pendingAction, null);
        }
      } finally {
        actionRegistry.register(originalHandler);
      }
    });
  });
});