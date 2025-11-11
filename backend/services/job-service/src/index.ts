import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import jobRoutes from './routes/jobRoutes';
import { testDatabaseConnection, testRedisConnection } from '@jobgraph/common';
import { errorResponse } from '@jobgraph/common';

// Load environment variables
dotenv.config({ path: '../../.env' });

const app = express();
const PORT = process.env.JOB_SERVICE_PORT || 3002;

// Middleware
app.use(helmet()); // Security headers
app.use(cors()); // Enable CORS
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies

// Health check endpoint
app.get('/health', async (req: Request, res: Response) => {
  try {
    await testDatabaseConnection();
    await testRedisConnection();
    res.status(200).json({
      status: 'healthy',
      service: 'job-service',
      timestamp: new Date().toISOString(),
      database: 'connected',
      redis: 'connected',
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      service: 'job-service',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Routes
app.use('/api/v1/jobs', jobRoutes);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json(
    errorResponse('NOT_FOUND', `Route ${req.method} ${req.path} not found`)
  );
});

// Error handler
app.use((err: Error, req: Request, res: Response, next: any) => {
  console.error('Unhandled error:', err);
  res.status(500).json(
    errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', {
      message: err.message,
    })
  );
});

// Start server
async function startServer() {
  try {
    // Test database connection
    console.log('Testing database connection...');
    await testDatabaseConnection();
    console.log('✓ Database connected');

    // Test Redis connection
    console.log('Testing Redis connection...');
    await testRedisConnection();
    console.log('✓ Redis connected');

    // Start listening
    app.listen(PORT, () => {
      console.log(`\n🚀 Job Service running on port ${PORT}`);
      console.log(`   Health: http://localhost:${PORT}/health`);
      console.log(`   API: http://localhost:${PORT}/api/v1/jobs`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
