const { body } = require("express-validator");

const executeToolValidator = [
  body("toolName")
    .exists()
    .withMessage("toolName is required")
    .isString()
    .withMessage("toolName must be a string")
    .trim()
    .notEmpty()
    .withMessage("toolName cannot be empty")
    .isLength({ min: 1, max: 100 })
    .withMessage("toolName must be between 1 and 100 characters"),

  body("toolParams")
    .optional()
    .isObject()
    .withMessage("toolParams must be an object"),
];

const orchestrateValidator = [
  body("query")
    .exists()
    .withMessage("query is required")
    .isString()
    .withMessage("query must be a string")
    .trim()
    .notEmpty()
    .withMessage("query cannot be empty")
    .isLength({ min: 1, max: 2000 })
    .withMessage("query must be between 1 and 2000 characters"),

  body("accountId")
    .optional()
    .isString()
    .withMessage("accountId must be a string"),

  body("orderId")
    .optional()
    .isString()
    .withMessage("orderId must be a string"),

  body("ticketId")
    .optional()
    .isString()
    .withMessage("ticketId must be a string"),

  body("conversationContext")
    .optional()
    .isObject()
    .withMessage("conversationContext must be an object"),
];

const chatValidator = [
  body("message")
    .exists()
    .withMessage("message is required")
    .isString()
    .withMessage("message must be a string")
    .trim()
    .notEmpty()
    .withMessage("message cannot be empty")
    .isLength({ min: 1, max: 2000 })
    .withMessage("message must be between 1 and 2000 characters"),

  body("conversationId")
    .optional()
    .isString()
    .withMessage("conversationId must be a string"),

  body("referenceTime")
    .optional()
    .isString()
    .withMessage("referenceTime must be a string"),
];

module.exports = { executeToolValidator, orchestrateValidator, chatValidator };