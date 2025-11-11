import { pool } from '../../backend/common/src/database';
import { hashPassword } from '../../backend/common/src/utils';

async function seedTestUsers() {
  const client = await pool.connect();

  try {
    console.log('🌱 Seeding test users...');

    // Test candidate
    const candidatePassword = await hashPassword('Test123!');
    await client.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, role, email_verified)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (email) DO NOTHING`,
      ['candidate@test.com', candidatePassword, 'Test', 'Candidate', 'candidate', true]
    );

    // Test employer
    const employerPassword = await hashPassword('Test123!');
    await client.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, role, email_verified)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (email) DO NOTHING`,
      ['employer@test.com', employerPassword, 'Test', 'Employer', 'employer', true]
    );

    // Test admin
    const adminPassword = await hashPassword('Admin123!');
    await client.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, role, email_verified)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (email) DO NOTHING`,
      ['admin@test.com', adminPassword, 'Test', 'Admin', 'admin', true]
    );

    const result = await client.query('SELECT COUNT(*) FROM users');
    console.log(`✓ Seeded ${result.rows[0].count} users`);
    console.log('\nTest credentials:');
    console.log('  Candidate: candidate@test.com / Test123!');
    console.log('  Employer: employer@test.com / Test123!');
    console.log('  Admin: admin@test.com / Admin123!');

  } catch (error) {
    console.error('Error seeding users:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seedTestUsers();
