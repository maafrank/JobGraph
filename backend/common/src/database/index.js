"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.redis = exports.pool = void 0;
exports.testDatabaseConnection = testDatabaseConnection;
exports.testRedisConnection = testRedisConnection;
exports.query = query;
exports.transaction = transaction;
const pg_1 = require("pg");
const ioredis_1 = require("ioredis");
// PostgreSQL connection pool
const pool = new pg_1.Pool({
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '5432'),
    database: process.env.DATABASE_NAME || 'jobgraph_dev',
    user: process.env.DATABASE_USER || 'postgres',
    password: process.env.DATABASE_PASSWORD || 'postgres',
    max: 20, // Maximum number of clients in the pool
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});
exports.pool = pool;
// Redis client
const redis = new ioredis_1.Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
    },
});
exports.redis = redis;
// Test database connection
async function testDatabaseConnection() {
    try {
        const client = await pool.connect();
        const result = await client.query('SELECT NOW()');
        client.release();
        console.log('✓ Database connected:', result.rows[0].now);
        return true;
    }
    catch (error) {
        console.error('✗ Database connection failed:', error);
        return false;
    }
}
// Test Redis connection
async function testRedisConnection() {
    try {
        await redis.ping();
        console.log('✓ Redis connected');
        return true;
    }
    catch (error) {
        console.error('✗ Redis connection failed:', error);
        return false;
    }
}
// Query helper with error handling
async function query(text, params) {
    const start = Date.now();
    try {
        const result = await pool.query(text, params);
        const duration = Date.now() - start;
        console.log('Executed query', { text, duration, rows: result.rowCount });
        return result;
    }
    catch (error) {
        console.error('Query error:', error);
        throw error;
    }
}
// Transaction helper
async function transaction(callback) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    }
    catch (error) {
        await client.query('ROLLBACK');
        throw error;
    }
    finally {
        client.release();
    }
}
