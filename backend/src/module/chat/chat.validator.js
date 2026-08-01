const { body } = require("express-validator");

const chatValidator = [
  body("question")
    .exists()
    .withMessage("question is required")
    .isString()
    .withMessage("question must be a string")
    .trim()
    .notEmpty()
    .withMessage("question cannot be empty")
    .isLength({ min: 1, max: 2000 })
    .withMessage("question must be between 1 and 2000 characters"),
];

module.exports = { chatValidator };