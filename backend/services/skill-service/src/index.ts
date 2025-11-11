import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import skillRoutes from './routes/skillRoutes';
import { testDatabaseConnection, testRedisConnection } from '@jobgraph/common';

dotenv.config();

const app = express();
const PORT = process.env.SKILL_SERVICE_PORT || 3003;

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
      service: 'skill-service',
      timestamp: new Date().toISOString(),
      database: 'connected',
      redis: 'connected',
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      service: 'skill-service',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Routes
app.use('/api/v1/skills', skillRoutes);

// Start server
app.listen(PORT, () => {
  console.log(`Skill Service running on port ${PORT}`);
});

export default app;
