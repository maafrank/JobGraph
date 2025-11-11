import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import matchingRoutes from './routes/matchingRoutes';
import { testDatabaseConnection, testRedisConnection } from '@jobgraph/common';

dotenv.config();

const app = express();
const PORT = process.env.MATCHING_SERVICE_PORT || 3004;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', async (req: Request, res: Response) => {
  try {
    await testDatabaseConnection();
    await testRedisConnection();
    res.status(200).json({
      status: 'healthy',
      service: 'matching-service',
      timestamp: new Date().toISOString(),
      database: 'connected',
      redis: 'connected',
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      service: 'matching-service',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Routes
app.use('/api/v1/matching', matchingRoutes);

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 Matching Service running on port ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   API: http://localhost:${PORT}/api/v1/matching\n`);
});

// Test database connection on startup
testDatabaseConnection()
  .then(() => console.log('✓ Database connected'))
  .catch((err) => console.error('✗ Database connection failed:', err.message));

// Test Redis connection on startup
testRedisConnection()
  .then(() => console.log('✓ Redis connected'))
  .catch((err) => console.error('✗ Redis connection failed:', err.message));

export default app;
