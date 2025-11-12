import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import authRoutes from '../../../services/auth-service/src/routes/authRoutes';
import { errorResponse } from '@jobgraph/common';

/**
 * Create Express app for testing
 * Mirrors the production app but without starting the server
 */
export function createTestApp(): Express {
  const app = express();

  // Middleware
  app.use(helmet());
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Routes
  app.use('/api/v1/auth', authRoutes);

  // 404 handler
  app.use((req, res) => {
    res.status(404).json(
      errorResponse('NOT_FOUND', `Route ${req.method} ${req.path} not found`)
    );
  });

  // Error handler
  app.use((err: Error, req: express.Request, res: express.Response, next: any) => {
    console.error('Unhandled error:', err);
    res.status(500).json(
      errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', {
        message: err.message,
      })
    );
  });

  return app;
}
