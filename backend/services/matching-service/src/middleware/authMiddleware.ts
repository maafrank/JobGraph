import { Request, Response, NextFunction } from 'express';
import { verifyToken, errorResponse } from '@jobgraph/common';

/**
 * Middleware to authenticate requests using JWT
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      res.status(401).json(
        errorResponse('NO_TOKEN', 'No authentication token provided')
      );
      return;
    }

    const token = authHeader.split(' ')[1]; // Bearer <token>

    if (!token) {
      res.status(401).json(
        errorResponse('INVALID_TOKEN_FORMAT', 'Invalid token format')
      );
      return;
    }

    const decoded = verifyToken(token);
    (req as any).user = decoded;
    next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      res.status(401).json(
        errorResponse('TOKEN_EXPIRED', 'Authentication token has expired')
      );
      return;
    }

    res.status(401).json(
      errorResponse('INVALID_TOKEN', 'Invalid authentication token')
    );
  }
}

/**
 * Middleware to require a specific role
 */
export function requireRole(role: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as any).user;

    if (!user || user.role !== role) {
      res.status(403).json(
        errorResponse(
          'FORBIDDEN',
          `Access denied. ${role} role required.`
        )
      );
      return;
    }

    next();
  };
}
