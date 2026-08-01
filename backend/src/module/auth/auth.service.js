const authRepository = require("./auth.repository");
const {
    hashPassword,
    comparePassword,
} = require("../../utils/password");
const AppError = require("../../utils/AppError");

const {
    generateAccessToken,
    generateRefreshToken,
    verifyRefreshToken,
} = require("../../utils/jwt");

/**
 * Register User
 */
const register = async ({ username, email, password }) => {
    const existingUser = await authRepository.findUserByEmail(email);

    if (existingUser) {
        throw new AppError("Email already exists", 400);
    }

    const hashedPassword = await hashPassword(password);

    const user = await authRepository.createUser(
        username,
        email,
        hashedPassword
    );

    return user;
};

/**
 * Login User
 */
const login = async ({ email, password }) => {
    const user = await authRepository.findUserByEmail(email);

    if (!user) {
        throw new AppError("Invalid email or password", 400);
    }

    const isPasswordValid = await comparePassword(
        password,
        user.password
    );

    if (!isPasswordValid) {
        throw new AppError("Invalid email or password", 400);
    }

    const payload = {
        id: user.id,
        email: user.email,
    };

    const accessToken = generateAccessToken(payload);

    const refreshToken = generateRefreshToken(payload);

    await authRepository.updateRefreshToken(
        user.id,
        refreshToken
    );

    return {
        accessToken,
        refreshToken,
        user: {
            id: user.id,
            username: user.username,
            email: user.email,
        },
    };
};

/**
 * Refresh Access Token
 */
const refresh = async (refreshToken) => {
    if (!refreshToken) {
        throw new AppError("Refresh token is required", 400);
    }

    // Verify JWT signature
    const decoded = verifyRefreshToken(refreshToken);

    // Check if token exists in DB
    const user = await authRepository.findUserByRefreshToken(refreshToken);

    if (!user) {
        throw new AppError("Invalid refresh token", 401);
    }

    const payload = {
        id: user.id,
        email: user.email,
    };

    // Generate new tokens
    const accessToken = generateAccessToken(payload);

    const newRefreshToken = generateRefreshToken(payload);

    // Replace old refresh token
    await authRepository.updateRefreshToken(
        user.id,
        newRefreshToken
    );

    return {
        accessToken,
        refreshToken: newRefreshToken,
    };
};

/**
 * Logout
 */
const logout = async (userId) => {
    await authRepository.removeRefreshToken(userId);

    return {
        message: "Logged out successfully",
    };
};

/**
 * Get Current User
 */
const getCurrentUser = async (userId) => {
    const user = await authRepository.findUserById(userId);

    if (!user) {
        throw new AppError("User not found", 404);
    }

    return user;
};

module.exports = {
    register,
    login,
    refresh,
    logout,
    getCurrentUser,
};