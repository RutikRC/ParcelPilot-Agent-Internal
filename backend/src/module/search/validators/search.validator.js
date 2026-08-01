const { body } = require("express-validator");

const searchValidator = [
  body("query")
    .exists()
    .withMessage("query is required")
    .isString()
    .withMessage("query must be a string")
    .trim()
    .notEmpty()
    .withMessage("query cannot be empty")
    .isLength({ min: 1, max: 1000 })
    .withMessage("query must be between 1 and 1000 characters"),

  body("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("limit must be an integer between 1 and 100")
    .toInt(),
];

module.exports = { searchValidator };