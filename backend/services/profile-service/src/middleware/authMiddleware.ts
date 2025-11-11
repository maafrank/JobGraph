import { Request, Response, NextFunction } from 'express';
import { verifyToken, errorResponse } from '@jobgraph/common';

/**
 * Middleware to verify JWT token and attach user info to request
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json(
        errorResponse('NO_TOKEN', 'No authentication token provided')
      );
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    try {
      const decoded = verifyToken(token);

      // Attach user info to request object
      (req as any).user = decoded;

      next();
    } catch (error) {
      res.status(401).json(
        errorResponse('INVALID_TOKEN', 'Invalid or expired token')
      );
      return;
    }
  } catch (error) {
    console.error('Authentication middleware error:', error);
    res.status(500).json(
      errorResponse('INTERNAL_ERROR', 'An error occurred during authentication')
    );
  }
}

/**
 * Middleware to check if user has required role(s)
 */
export function requireRole(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as any).user;

    if (!user) {
      res.status(401).json(
        errorResponse('UNAUTHORIZED', 'Authentication required')
      );
      return;
    }

    if (!allowedRoles.includes(user.role)) {
      res.status(403).json(
        errorResponse('FORBIDDEN', `Access denied. Required role: ${allowedRoles.join(' or ')}`)
      );
      return;
    }

    next();
  };
}
