const express = require("express");

const parcelpilotController = require("../controllers/parcelpilot.controller");
const {
  executeToolValidator,
  orchestrateValidator,
  chatValidator,
} = require("../validators/parcelpilot.validator");
const validate = require("../../../middlewares/validate.middleware");

const router = express.Router();

router.get("/tools", parcelpilotController.listTools);
router.get("/source-precedence", parcelpilotController.getSourcePrecedence);
router.post(
  "/tools/execute",
  executeToolValidator,
  validate,
  parcelpilotController.executeTool
);
router.post(
  "/orchestrate",
  orchestrateValidator,
  validate,
  parcelpilotController.orchestrate
);
router.post(
  "/chat",
  chatValidator,
  validate,
  parcelpilotController.chat
);

module.exports = router;
