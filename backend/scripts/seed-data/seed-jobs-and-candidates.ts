/**
 * Seed script to populate database with realistic jobs and candidates
 * This creates a complete test environment for job matching
 */

import { pool, hashPassword } from '@jobgraph/common';

async function seedJobsAndCandidates() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('🌱 Seeding jobs and candidates...\n');

    // Create 3 candidate users with profiles and skills
    const candidates = [
      {
        email: 'alice.dev@example.com',
        password: 'Password123!',
        firstName: 'Alice',
        lastName: 'Johnson',
        headline: 'Full-Stack Software Engineer',
        summary: 'Experienced full-stack developer with 5 years building scalable web applications.',
        yearsExperience: 5,
        city: 'San Francisco',
        state: 'CA',
        country: 'USA',
        remotePreference: 'hybrid',
        willingToRelocate: false,
        skills: [
          { name: 'Python', score: 85 },
          { name: 'JavaScript', score: 90 },
          { name: 'React', score: 88 },
          { name: 'Node.js', score: 82 },
          { name: 'PostgreSQL', score: 75 },
          { name: 'AWS', score: 70 },
        ],
      },
      {
        email: 'bob.ml@example.com',
        password: 'Password123!',
        firstName: 'Bob',
        lastName: 'Smith',
        headline: 'Machine Learning Engineer',
        summary: 'ML engineer specializing in NLP and computer vision with 4 years experience.',
        yearsExperience: 4,
        city: 'New York',
        state: 'NY',
        country: 'USA',
        remotePreference: 'remote',
        willingToRelocate: true,
        skills: [
          { name: 'Python', score: 95 },
          { name: 'Machine Learning', score: 90 },
          { name: 'TensorFlow', score: 85 },
          { name: 'PyTorch', score: 80 },
          { name: 'SQL', score: 75 },
          { name: 'AWS', score: 72 },
        ],
      },
      {
        email: 'carol.data@example.com',
        password: 'Password123!',
        firstName: 'Carol',
        lastName: 'Williams',
        headline: 'Senior Data Scientist',
        summary: 'Data scientist with expertise in statistical modeling and big data analytics.',
        yearsExperience: 6,
        city: 'Seattle',
        state: 'WA',
        country: 'USA',
        remotePreference: 'flexible',
        willingToRelocate: false,
        skills: [
          { name: 'Python', score: 92 },
          { name: 'R', score: 88 },
          { name: 'Machine Learning', score: 85 },
          { name: 'Data Science', score: 90 },
          { name: 'SQL', score: 85 },
          { name: 'Tableau', score: 80 },
        ],
      },
    ];

    console.log('👤 Creating candidate users...');
    for (const candidate of candidates) {
      const hashedPassword = await hashPassword(candidate.password);

      // Create user
      const userResult = await client.query(
        `INSERT INTO users (email, password_hash, role, first_name, last_name)
         VALUES ($1, $2, 'candidate', $3, $4)
         RETURNING user_id`,
        [candidate.email, hashedPassword, candidate.firstName, candidate.lastName]
      );
      const userId = userResult.rows[0].user_id;

      // Create candidate profile
      await client.query(
        `INSERT INTO candidate_profiles (
          user_id, headline, summary, years_experience,
          city, state, country, remote_preference, willing_to_relocate
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          userId,
          candidate.headline,
          candidate.summary,
          candidate.yearsExperience,
          candidate.city,
          candidate.state,
          candidate.country,
          candidate.remotePreference,
          candidate.willingToRelocate,
        ]
      );

      // Add skills
      for (const skill of candidate.skills) {
        const skillResult = await client.query(
          `SELECT skill_id FROM skills WHERE name = $1`,
          [skill.name]
        );

        if (skillResult.rows.length > 0) {
          const skillId = skillResult.rows[0].skill_id;
          await client.query(
            `INSERT INTO user_skill_scores (user_id, skill_id, score, expires_at)
             VALUES ($1, $2, $3, CURRENT_TIMESTAMP + INTERVAL '1 year')`,
            [userId, skillId, skill.score]
          );
        }
      }

      console.log(`  ✓ Created ${candidate.firstName} ${candidate.lastName} (${candidate.email})`);
    }

    // Get the test employer company
    const companyResult = await client.query(
      `SELECT c.company_id, cu.user_id
       FROM companies c
       JOIN company_users cu ON c.company_id = cu.company_id
       JOIN users u ON cu.user_id = u.user_id
       WHERE u.email = 'employer@test.com'
       LIMIT 1`
    );

    if (companyResult.rows.length === 0) {
      console.log('\n❌ Error: No test employer found. Please run seed-test-users.ts first.');
      await client.query('ROLLBACK');
      return;
    }

    const companyId = companyResult.rows[0].company_id;
    const employerId = companyResult.rows[0].user_id;

    console.log('\n💼 Creating job postings...');

    // Job 1: Full-Stack Developer (should match Alice well)
    const job1 = await client.query(
      `INSERT INTO jobs (
        company_id, posted_by, title, description, requirements, responsibilities,
        city, state, country, remote_option,
        salary_min, salary_max, salary_currency,
        employment_type, experience_level, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'active')
      RETURNING job_id`,
      [
        companyId,
        employerId,
        'Senior Full-Stack Developer',
        'We are looking for an experienced full-stack developer to join our growing team. You will work on building scalable web applications using modern technologies.',
        '• 4+ years of software development experience\n• Strong knowledge of JavaScript and Python\n• Experience with React and Node.js\n• Understanding of databases and cloud platforms',
        '• Design and implement new features for our web platform\n• Collaborate with product team on requirements\n• Mentor junior developers\n• Participate in code reviews',
        'San Francisco',
        'CA',
        'USA',
        'hybrid',
        140000,
        180000,
        'USD',
        'full-time',
        'senior',
      ]
    );

    const job1Id = job1.rows[0].job_id;

    // Add skills for Job 1
    const job1Skills = [
      { name: 'JavaScript', weight: 0.30, minimumScore: 80, required: true },
      { name: 'Python', weight: 0.25, minimumScore: 75, required: true },
      { name: 'React', weight: 0.25, minimumScore: 75, required: true },
      { name: 'Node.js', weight: 0.15, minimumScore: 70, required: true },
      { name: 'PostgreSQL', weight: 0.05, minimumScore: 60, required: false },
    ];

    for (const skill of job1Skills) {
      const skillResult = await client.query(
        `SELECT skill_id FROM skills WHERE name = $1`,
        [skill.name]
      );
      if (skillResult.rows.length > 0) {
        await client.query(
          `INSERT INTO job_skills (job_id, skill_id, weight, minimum_score, required)
           VALUES ($1, $2, $3, $4, $5)`,
          [job1Id, skillResult.rows[0].skill_id, skill.weight, skill.minimumScore, skill.required]
        );
      }
    }

    console.log('  ✓ Created: Senior Full-Stack Developer');

    // Job 2: Machine Learning Engineer (should match Bob well)
    const job2 = await client.query(
      `INSERT INTO jobs (
        company_id, posted_by, title, description, requirements, responsibilities,
        city, state, country, remote_option,
        salary_min, salary_max, salary_currency,
        employment_type, experience_level, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'active')
      RETURNING job_id`,
      [
        companyId,
        employerId,
        'Machine Learning Engineer',
        'Join our AI team to build cutting-edge machine learning models for production systems. You will work on NLP and computer vision projects.',
        '• 3+ years of ML engineering experience\n• Strong Python programming skills\n• Experience with TensorFlow or PyTorch\n• Knowledge of MLOps and cloud platforms',
        '• Develop and deploy ML models to production\n• Work with large datasets and optimize model performance\n• Collaborate with data scientists and engineers\n• Implement best practices for ML pipelines',
        'New York',
        'NY',
        'USA',
        'remote',
        150000,
        200000,
        'USD',
        'full-time',
        'mid',
      ]
    );

    const job2Id = job2.rows[0].job_id;

    const job2Skills = [
      { name: 'Python', weight: 0.30, minimumScore: 85, required: true },
      { name: 'Machine Learning', weight: 0.35, minimumScore: 80, required: true },
      { name: 'TensorFlow', weight: 0.20, minimumScore: 75, required: true },
      { name: 'AWS', weight: 0.10, minimumScore: 65, required: false },
      { name: 'SQL', weight: 0.05, minimumScore: 60, required: false },
    ];

    for (const skill of job2Skills) {
      const skillResult = await client.query(
        `SELECT skill_id FROM skills WHERE name = $1`,
        [skill.name]
      );
      if (skillResult.rows.length > 0) {
        await client.query(
          `INSERT INTO job_skills (job_id, skill_id, weight, minimum_score, required)
           VALUES ($1, $2, $3, $4, $5)`,
          [job2Id, skillResult.rows[0].skill_id, skill.weight, skill.minimumScore, skill.required]
        );
      }
    }

    console.log('  ✓ Created: Machine Learning Engineer');

    // Job 3: Data Scientist (should match Carol well)
    const job3 = await client.query(
      `INSERT INTO jobs (
        company_id, posted_by, title, description, requirements, responsibilities,
        city, state, country, remote_option,
        salary_min, salary_max, salary_currency,
        employment_type, experience_level, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'active')
      RETURNING job_id`,
      [
        companyId,
        employerId,
        'Senior Data Scientist',
        'We are seeking a senior data scientist to lead analytics initiatives and build predictive models that drive business decisions.',
        '• 5+ years of data science experience\n• Expert in Python and R\n• Strong statistical modeling skills\n• Experience with data visualization tools',
        '• Lead data science projects from conception to deployment\n• Build statistical models and ML algorithms\n• Present findings to stakeholders\n• Mentor junior team members',
        'Seattle',
        'WA',
        'USA',
        'hybrid',
        160000,
        210000,
        'USD',
        'full-time',
        'senior',
      ]
    );

    const job3Id = job3.rows[0].job_id;

    const job3Skills = [
      { name: 'Python', weight: 0.30, minimumScore: 85, required: true },
      { name: 'Data Science', weight: 0.35, minimumScore: 85, required: true },
      { name: 'Machine Learning', weight: 0.20, minimumScore: 75, required: true },
      { name: 'SQL', weight: 0.10, minimumScore: 75, required: true },
      { name: 'R', weight: 0.05, minimumScore: 70, required: false },
    ];

    for (const skill of job3Skills) {
      const skillResult = await client.query(
        `SELECT skill_id FROM skills WHERE name = $1`,
        [skill.name]
      );
      if (skillResult.rows.length > 0) {
        await client.query(
          `INSERT INTO job_skills (job_id, skill_id, weight, minimum_score, required)
           VALUES ($1, $2, $3, $4, $5)`,
          [job3Id, skillResult.rows[0].skill_id, skill.weight, skill.minimumScore, skill.required]
        );
      }
    }

    console.log('  ✓ Created: Senior Data Scientist');

    await client.query('COMMIT');

    console.log('\n✅ Seed completed successfully!\n');
    console.log('📊 Summary:');
    console.log('  • 3 candidate users created');
    console.log('  • 3 job postings created');
    console.log('  • All candidates have relevant skills');
    console.log('\n🔐 Test Credentials:');
    console.log('  Employer: employer@test.com / Test123!');
    console.log('  Candidate 1: alice.dev@example.com / Password123!');
    console.log('  Candidate 2: bob.ml@example.com / Password123!');
    console.log('  Candidate 3: carol.data@example.com / Password123!');
    console.log('\n💡 Next steps:');
    console.log('  1. Login as employer@test.com');
    console.log('  2. Go to "My Jobs" page');
    console.log('  3. Click "Calculate Matches" on each job');
    console.log('  4. View matched candidates!\n');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error seeding data:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the seed function
seedJobsAndCandidates();
