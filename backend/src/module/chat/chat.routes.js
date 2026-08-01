const express = require("express");

const chatController = require("./chat.controller");
const { chatValidator } = require("./chat.validator");
const validate = require("../../middlewares/validate.middleware");

const router = express.Router();

router.post(
  "/",
  chatValidator,
  validate,
  chatController.answerQuestion
);

module.exports = router;