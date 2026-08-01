const express = require("express");

const searchController = require("../controllers/search.controller");
const { searchValidator } = require("../validators/search.validator");
const validate = require("../../../middlewares/validate.middleware");

const router = express.Router();

router.post(
  "/",
  searchValidator,
  validate,
  searchController.searchChunks
);

module.exports = router;