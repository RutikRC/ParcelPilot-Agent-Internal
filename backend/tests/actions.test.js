const assert = require("assert");
const actions = require("../src/module/parcelpilot/actions");

describe("ParcelPilot Phase 4 Actions", () => {
  describe("Action Types", () => {
    it("defines supported action types", () => {
      assert.ok(actions.ACTION_TYPES.CANCEL_ORDER);
      assert.ok(actions.ACTION_TYPES.ISSUE_SERVICE_CREDIT);
      assert.ok(actions.ACTION_TYPES.ESCALATE_TICKET);
    });
  });

  describe("Action Registry", () => {
    it("loads registered actions", () => {
      const listed = actions.actionRegistry.list();
      assert.ok(Array.isArray(listed));
      assert.ok(listed.length >= 1);
    });
  });

  describe("Action Validator", () => {
    it("rejects unknown action type", () => {
      const result = actions.actionValidator.validatePendingAction({
        type: "UNKNOWN", targetId: "X", createdAt: new Date().toISOString(),
      });
      assert.strictEqual(result.valid, false);
    });

    it("rejects missing targetId", () => {
      const result = actions.actionValidator.validatePendingAction({
        type: "CANCEL_ORDER", createdAt: new Date().toISOString(),
      });
      assert.strictEqual(result.valid, false);
    });

    it("validates a valid pending action", () => {
      const result = actions.actionValidator.validatePendingAction({
        type: "CANCEL_ORDER", targetId: "ORD-1001", createdAt: new Date().toISOString(),
      });
      assert.strictEqual(result.valid, true);
    });

    it("detects expired pending action", () => {
      const old = new Date(Date.now() - 16 * 60 * 1000).toISOString();
      assert.strictEqual(actions.actionValidator.isExpired({ createdAt: old }), true);
    });
  });

  describe("Manager Approval Flow", () => {
    it("maps ISSUE_SERVICE_CREDIT to orderId and schema supports REQUIRES_MANAGER_APPROVAL", () => {
      const params = actions.actionExecutor.buildActionParams({ type: "ISSUE_SERVICE_CREDIT", targetId: "ORD-1001" });
      assert.strictEqual(params.orderId, "ORD-1001");
      const os = require("../src/module/parcelpilot/agent/output-schema");
      assert.ok(os.VALID_STATUSES.includes("REQUIRES_MANAGER_APPROVAL"));
      const fs = require("fs");
      const src = fs.readFileSync("backend/src/module/parcelpilot/actions/action.executor.js", "utf8");
      assert.ok(src.includes("REQUIRES_MANAGER_APPROVAL"));
      assert.ok(src.includes("mutated: false"));
    });
  });

  describe("Action Executor Param Mapping", () => {
    it("maps CANCEL_ORDER targetId to orderId", () => {
      const params = actions.actionExecutor.buildActionParams({ type: "CANCEL_ORDER", targetId: "ORD-1001" });
      assert.strictEqual(params.orderId, "ORD-1001");
    });

    it("maps ESCALATE_TICKET targetId to ticketId", () => {
      const params = actions.actionExecutor.buildActionParams({ type: "ESCALATE_TICKET", targetId: "TKT-501" });
      assert.strictEqual(params.ticketId, "TKT-501");
    });
  });
});