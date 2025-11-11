import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { JwtPayload } from '../types';

const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m'; // Short-lived access token
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';

// Password hashing
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function comparePassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// JWT tokens
export function generateToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}

// Validation helpers
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function isValidPassword(password: string): boolean {
  // At least 8 characters, 1 uppercase, 1 lowercase, 1 number, 1 special char
  const passwordRegex =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  return passwordRegex.test(password);
}

// Error handling
export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'AppError';
  }
}

// API Response formatter
export function successResponse<T>(data: T, pagination?: any) {
  return {
    success: true,
    data,
    ...(pagination && { pagination }),
  };
}

export function errorResponse(
  code: string,
  message: string,
  details?: any
) {
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
export function generateRefreshToken(): string {
  return crypto.randomBytes(64).toString('hex');
}

export function getRefreshTokenExpiryDate(): Date {
  const expiryMs = parseRefreshTokenExpiry(REFRESH_TOKEN_EXPIRES_IN);
  return new Date(Date.now() + expiryMs);
}

function parseRefreshTokenExpiry(expiry: string): number {
  // Parse strings like '7d', '24h', '60m'
  const match = expiry.match(/^(\d+)([dhm])$/);
  if (!match) return 7 * 24 * 60 * 60 * 1000; // Default 7 days

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
export function generateVerificationToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function getVerificationTokenExpiryDate(): Date {
  // Verification tokens expire in 24 hours
  return new Date(Date.now() + 24 * 60 * 60 * 1000);
}
