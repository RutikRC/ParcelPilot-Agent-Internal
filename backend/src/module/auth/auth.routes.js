const express = require("express");

const authController = require("./auth.controller");
const authMiddleware = require("../../middlewares/auth.middleware");

// We'll create these in the next steps
const {
    registerValidator,
    loginValidator,
} = require("./auth.validator");

const validate = require("../../middlewares/validate.middleware");

const router = express.Router();

/**
 * Register
 * POST /api/auth/register
 */
router.post(
    "/register",
    registerValidator,
    validate,
    authController.register
);

/**
 * Login
 * POST /api/auth/login
 */
router.post(
    "/login",
    loginValidator,
    validate,
    authController.login
);

/**
 * Refresh Token
 * POST /api/auth/refresh
 */
router.post(
    "/refresh",
    authController.refresh
);

/**
 * Logout
 * POST /api/auth/logout
 */
router.post(
    "/logout",
    authMiddleware,
    authController.logout
);

/**
 * Current User
 * GET /api/auth/me
 */
router.get(
    "/me",
    authMiddleware,
    authController.me
);

module.exports = router;