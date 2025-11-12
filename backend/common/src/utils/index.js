"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppError = void 0;
exports.hashPassword = hashPassword;
exports.comparePassword = comparePassword;
exports.generateToken = generateToken;
exports.verifyToken = verifyToken;
exports.isValidEmail = isValidEmail;
exports.isValidPassword = isValidPassword;
exports.successResponse = successResponse;
exports.errorResponse = errorResponse;
exports.generateRefreshToken = generateRefreshToken;
exports.getRefreshTokenExpiryDate = getRefreshTokenExpiryDate;
exports.generateVerificationToken = generateVerificationToken;
exports.getVerificationTokenExpiryDate = getVerificationTokenExpiryDate;
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = __importDefault(require("crypto"));
const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m'; // Short-lived access token
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';
// Password hashing
async function hashPassword(password) {
    return bcrypt_1.default.hash(password, SALT_ROUNDS);
}
async function comparePassword(password, hash) {
    return bcrypt_1.default.compare(password, hash);
}
// JWT tokens
function generateToken(payload) {
    return jsonwebtoken_1.default.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}
function verifyToken(token) {
    return jsonwebtoken_1.default.verify(token, JWT_SECRET);
}
// Validation helpers
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}
function isValidPassword(password) {
    // At least 8 characters, 1 uppercase, 1 lowercase, 1 number, 1 special char
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    return passwordRegex.test(password);
}
// Error handling
class AppError extends Error {
    statusCode;
    code;
    details;
    constructor(statusCode, code, message, details) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
        this.name = 'AppError';
    }
}
exports.AppError = AppError;
// API Response formatter
function successResponse(data, pagination) {
    return {
        success: true,
        data,
        ...(pagination && { pagination }),
    };
}
function errorResponse(code, message, details) {
    return {
        success: false,
        error: {
            code,
            message,
            details,
        },
    };
}
// Refresh token utilities
function generateRefreshToken() {
    return crypto_1.default.randomBytes(64).toString('hex');
}
function getRefreshTokenExpiryDate() {
    const expiryMs = parseRefreshTokenExpiry(REFRESH_TOKEN_EXPIRES_IN);
    return new Date(Date.now() + expiryMs);
}
function parseRefreshTokenExpiry(expiry) {
    // Parse strings like '7d', '24h', '60m'
    const match = expiry.match(/^(\d+)([dhm])$/);
    if (!match)
        return 7 * 24 * 60 * 60 * 1000; // Default 7 days
    const value = parseInt(match[1]);
    const unit = match[2];
    switch (unit) {
        case 'd': return value * 24 * 60 * 60 * 1000;
        case 'h': return value * 60 * 60 * 1000;
        case 'm': return value * 60 * 1000;
        default: return 7 * 24 * 60 * 60 * 1000;
    }
}
// Email verification token
function generateVerificationToken() {
    return crypto_1.default.randomBytes(32).toString('hex');
}
function getVerificationTokenExpiryDate() {
    // Verification tokens expire in 24 hours
    return new Date(Date.now() + 24 * 60 * 60 * 1000);
}
