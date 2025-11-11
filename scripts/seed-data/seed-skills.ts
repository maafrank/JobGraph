import { pool } from '../../backend/common/src/database';

const skills = [
  // Programming Languages
  { name: 'Python', category: 'programming', description: 'Python programming language' },
  { name: 'JavaScript', category: 'programming', description: 'JavaScript programming language' },
  { name: 'TypeScript', category: 'programming', description: 'TypeScript programming language' },
  { name: 'Java', category: 'programming', description: 'Java programming language' },
  { name: 'C++', category: 'programming', description: 'C++ programming language' },
  { name: 'Go', category: 'programming', description: 'Go programming language' },
  { name: 'Rust', category: 'programming', description: 'Rust programming language' },
  { name: 'SQL', category: 'programming', description: 'Structured Query Language' },

  // Data Science & ML
  { name: 'Machine Learning', category: 'data_science', description: 'Machine learning algorithms and frameworks' },
  { name: 'Data Engineering', category: 'data_science', description: 'Building data pipelines and infrastructure' },
  { name: 'Data Analysis', category: 'data_science', description: 'Analyzing and interpreting data' },
  { name: 'Deep Learning', category: 'data_science', description: 'Neural networks and deep learning' },
  { name: 'NLP', category: 'data_science', description: 'Natural Language Processing' },
  { name: 'Computer Vision', category: 'data_science', description: 'Image and video analysis' },

  // AI & Prompt Engineering
  { name: 'Prompt Engineering', category: 'ai', description: 'Creating effective prompts for LLMs' },
  { name: 'LLM Applications', category: 'ai', description: 'Building applications with large language models' },

  // Web Development
  { name: 'React', category: 'web_development', description: 'React JavaScript library' },
  { name: 'Node.js', category: 'web_development', description: 'Node.js runtime' },
  { name: 'Vue.js', category: 'web_development', description: 'Vue.js framework' },
  { name: 'Angular', category: 'web_development', description: 'Angular framework' },
  { name: 'Django', category: 'web_development', description: 'Django web framework' },
  { name: 'FastAPI', category: 'web_development', description: 'FastAPI framework' },

  // Cloud & DevOps
  { name: 'AWS', category: 'cloud', description: 'Amazon Web Services cloud platform' },
  { name: 'Azure', category: 'cloud', description: 'Microsoft Azure cloud platform' },
  { name: 'GCP', category: 'cloud', description: 'Google Cloud Platform' },
  { name: 'Docker', category: 'devops', description: 'Container platform' },
  { name: 'Kubernetes', category: 'devops', description: 'Container orchestration' },
  { name: 'CI/CD', category: 'devops', description: 'Continuous Integration and Deployment' },

  // Databases
  { name: 'PostgreSQL', category: 'database', description: 'PostgreSQL relational database' },
  { name: 'MongoDB', category: 'database', description: 'MongoDB NoSQL database' },
  { name: 'Redis', category: 'database', description: 'Redis in-memory data store' },

  // Finance
  { name: 'Financial Analysis', category: 'finance', description: 'Analyzing financial data and markets' },
  { name: 'Financial Modeling', category: 'finance', description: 'Building financial models' },
  { name: 'Risk Management', category: 'finance', description: 'Financial risk assessment and management' },
];

async function seedSkills() {
  const client = await pool.connect();

  try {
    console.log('🌱 Seeding skills...');

    for (const skill of skills) {
      await client.query(
        `INSERT INTO skills (name, category, description, active)
         VALUES ($1, $2, $3, true)
         ON CONFLICT (name) DO NOTHING`,
        [skill.name, skill.category, skill.description]
      );
    }

    const result = await client.query('SELECT COUNT(*) FROM skills');
    console.log(`✓ Seeded ${result.rows[0].count} skills`);

  } catch (error) {
    console.error('Error seeding skills:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seedSkills();
