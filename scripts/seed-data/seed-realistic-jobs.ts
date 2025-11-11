import { pool } from '../../backend/common/src/database';

async function seedRealisticJobs() {
  try {
    console.log('🌱 Seeding realistic job postings...');

    // First, get the employer user and company
    const employerResult = await pool.query(
      'SELECT user_id FROM users WHERE role = $1 LIMIT 1',
      ['employer']
    );

    if (employerResult.rows.length === 0) {
      console.log('❌ No employer user found. Creating one...');
      const newEmployer = await pool.query(
        `INSERT INTO users (email, password_hash, role, first_name, last_name)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING user_id`,
        [
          'employer@techcorp.com',
          '$2b$10$abcdefghijklmnopqrstuvwxyz123456',
          'employer',
          'Sarah',
          'Johnson'
        ]
      );
      employerResult.rows[0] = newEmployer.rows[0];
    }

    const employerId = employerResult.rows[0].user_id;

    // Get or create company
    let companyResult = await pool.query(
      'SELECT company_id FROM companies LIMIT 1'
    );

    if (companyResult.rows.length === 0) {
      console.log('Creating companies...');

      // Create multiple companies
      const companies = [
        {
          name: 'TechCorp AI Solutions',
          description: 'Leading AI and machine learning company building the future of intelligent systems',
          industry: 'Artificial Intelligence',
          size: '100-500',
          website: 'https://techcorp.ai',
          city: 'San Francisco',
          state: 'CA',
          country: 'USA'
        },
        {
          name: 'DataFlow Analytics',
          description: 'Data science consultancy helping enterprises make data-driven decisions',
          industry: 'Data Analytics',
          size: '50-100',
          website: 'https://dataflow.io',
          city: 'New York',
          state: 'NY',
          country: 'USA'
        },
        {
          name: 'CloudScale Infrastructure',
          description: 'Cloud infrastructure and DevOps services provider',
          industry: 'Cloud Computing',
          size: '500-1000',
          website: 'https://cloudscale.com',
          city: 'Seattle',
          state: 'WA',
          country: 'USA'
        },
        {
          name: 'FinTech Innovations',
          description: 'Financial technology startup revolutionizing digital banking',
          industry: 'Financial Technology',
          size: '10-50',
          website: 'https://fintechinno.com',
          city: 'Austin',
          state: 'TX',
          country: 'USA'
        }
      ];

      for (const company of companies) {
        const result = await pool.query(
          `INSERT INTO companies (name, description, industry, company_size, website, city, state, country)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING company_id`,
          [company.name, company.description, company.industry, company.size, company.website, company.city, company.state, company.country]
        );

        // Link employer to company
        await pool.query(
          `INSERT INTO company_users (company_id, user_id, role)
           VALUES ($1, $2, $3)
           ON CONFLICT DO NOTHING`,
          [result.rows[0].company_id, employerId, 'owner']
        );
      }

      companyResult = await pool.query('SELECT company_id FROM companies');
    }

    const companies = companyResult.rows;

    // Get all skills
    const skillsResult = await pool.query(
      'SELECT skill_id, name FROM skills WHERE active = TRUE'
    );
    const skills = skillsResult.rows;

    const getSkillId = (name: string) => {
      const skill = skills.find((s: any) => s.name.toLowerCase() === name.toLowerCase());
      return skill?.skill_id;
    };

    // Define realistic jobs with different skill requirements
    const jobs = [
      {
        companyIndex: 0,
        title: 'Senior Machine Learning Engineer',
        description: `We're seeking a talented ML Engineer to join our AI research team. You'll work on cutting-edge projects involving natural language processing, computer vision, and reinforcement learning.

Key Responsibilities:
- Design and implement ML models for production systems
- Optimize model performance and scalability
- Collaborate with data scientists and software engineers
- Stay current with latest ML research and techniques

We offer competitive compensation, equity, and the opportunity to work with world-class AI researchers.`,
        requirements: 'MS/PhD in Computer Science or related field, 5+ years ML experience',
        responsibilities: 'Model development, code review, mentoring junior engineers',
        city: 'San Francisco',
        state: 'CA',
        remote: false,
        employmentType: 'full-time' as const,
        experienceLevel: 'senior' as const,
        salaryMin: 180000,
        salaryMax: 250000,
        skills: [
          { name: 'Python', weight: 0.3, minScore: 80, required: true },
          { name: 'Machine Learning', weight: 0.35, minScore: 85, required: true },
          { name: 'TensorFlow', weight: 0.2, minScore: 70, required: true },
          { name: 'AWS', weight: 0.15, minScore: 60, required: false }
        ]
      },
      {
        companyIndex: 1,
        title: 'Data Scientist',
        description: `Join our data science team to transform raw data into actionable insights. You'll work with Fortune 500 clients to solve complex business problems using advanced analytics and machine learning.

What You'll Do:
- Build predictive models and statistical analyses
- Create data visualizations and dashboards
- Present findings to stakeholders
- Collaborate with cross-functional teams

Perfect for someone passionate about turning data into business value.`,
        requirements: 'BS in Statistics, Math, or Computer Science; 3+ years experience',
        responsibilities: 'Data analysis, model building, client presentations',
        city: 'New York',
        state: 'NY',
        remote: true,
        employmentType: 'full-time' as const,
        experienceLevel: 'mid' as const,
        salaryMin: 120000,
        salaryMax: 160000,
        skills: [
          { name: 'Python', weight: 0.25, minScore: 75, required: true },
          { name: 'SQL', weight: 0.25, minScore: 70, required: true },
          { name: 'Tableau', weight: 0.2, minScore: 65, required: true },
          { name: 'Machine Learning', weight: 0.3, minScore: 70, required: false }
        ]
      },
      {
        companyIndex: 2,
        title: 'DevOps Engineer',
        description: `We're looking for a DevOps engineer to help scale our cloud infrastructure. You'll work on automation, CI/CD pipelines, and infrastructure as code.

Your Impact:
- Design and maintain CI/CD pipelines
- Automate infrastructure provisioning
- Monitor system performance and reliability
- Implement security best practices

Join a team that values automation, collaboration, and continuous improvement.`,
        requirements: '3+ years DevOps experience, strong Linux skills',
        responsibilities: 'Infrastructure automation, pipeline maintenance, on-call rotation',
        city: 'Seattle',
        state: 'WA',
        remote: true,
        employmentType: 'full-time' as const,
        experienceLevel: 'mid' as const,
        salaryMin: 130000,
        salaryMax: 170000,
        skills: [
          { name: 'AWS', weight: 0.35, minScore: 80, required: true },
          { name: 'Docker', weight: 0.25, minScore: 75, required: true },
          { name: 'Kubernetes', weight: 0.25, minScore: 70, required: true },
          { name: 'Python', weight: 0.15, minScore: 60, required: false }
        ]
      },
      {
        companyIndex: 2,
        title: 'Cloud Solutions Architect',
        description: `Lead the design of enterprise cloud solutions for our clients. You'll be responsible for architecting scalable, secure, and cost-effective cloud infrastructures.

Responsibilities:
- Design multi-cloud architectures
- Provide technical leadership to engineering teams
- Conduct architecture reviews and security assessments
- Engage with clients to understand requirements

This role offers the opportunity to work on diverse, challenging projects across industries.`,
        requirements: '7+ years experience, AWS/Azure certifications preferred',
        responsibilities: 'Architecture design, technical leadership, client engagement',
        city: 'Seattle',
        state: 'WA',
        remote: false,
        employmentType: 'full-time' as const,
        experienceLevel: 'senior' as const,
        salaryMin: 170000,
        salaryMax: 220000,
        skills: [
          { name: 'AWS', weight: 0.4, minScore: 85, required: true },
          { name: 'Azure', weight: 0.3, minScore: 75, required: true },
          { name: 'Kubernetes', weight: 0.2, minScore: 70, required: false },
          { name: 'Terraform', weight: 0.1, minScore: 65, required: false }
        ]
      },
      {
        companyIndex: 3,
        title: 'Full Stack Developer',
        description: `Join our agile team building the next generation of digital banking products. You'll work across the full stack, from React frontends to Node.js microservices.

What We're Looking For:
- Strong JavaScript/TypeScript skills
- Experience with modern web frameworks
- Understanding of microservices architecture
- Passion for clean code and best practices

We offer a fast-paced startup environment with significant ownership and impact.`,
        requirements: '3-5 years full stack development experience',
        responsibilities: 'Feature development, code review, sprint planning',
        city: 'Austin',
        state: 'TX',
        remote: true,
        employmentType: 'full-time' as const,
        experienceLevel: 'mid' as const,
        salaryMin: 110000,
        salaryMax: 150000,
        skills: [
          { name: 'JavaScript', weight: 0.3, minScore: 80, required: true },
          { name: 'React', weight: 0.25, minScore: 75, required: true },
          { name: 'Node.js', weight: 0.25, minScore: 75, required: true },
          { name: 'Python', weight: 0.2, minScore: 60, required: false }
        ]
      },
      {
        companyIndex: 3,
        title: 'Senior Backend Engineer - Payments',
        description: `We're building the future of payments infrastructure. As a Senior Backend Engineer, you'll design and implement critical payment processing systems handling millions of transactions.

Key Focus Areas:
- High-performance payment APIs
- Data consistency and reliability
- Security and compliance
- Scalability and fault tolerance

Join a team solving hard problems in the fintech space with cutting-edge technology.`,
        requirements: '5+ years backend development, payments experience a plus',
        responsibilities: 'API design, system architecture, performance optimization',
        city: 'Austin',
        state: 'TX',
        remote: false,
        employmentType: 'full-time' as const,
        experienceLevel: 'senior' as const,
        salaryMin: 150000,
        salaryMax: 200000,
        skills: [
          { name: 'Python', weight: 0.35, minScore: 85, required: true },
          { name: 'PostgreSQL', weight: 0.25, minScore: 80, required: true },
          { name: 'AWS', weight: 0.2, minScore: 70, required: true },
          { name: 'Go', weight: 0.2, minScore: 60, required: false }
        ]
      },
      {
        companyIndex: 0,
        title: 'AI Research Scientist',
        description: `Join our research lab working on fundamental AI research. You'll publish papers, develop novel algorithms, and push the boundaries of what's possible with artificial intelligence.

Research Areas:
- Natural language understanding
- Computer vision
- Reinforcement learning
- Multi-modal learning

We're looking for creative thinkers who can translate theoretical ideas into practical applications.`,
        requirements: 'PhD in CS/ML or equivalent research experience',
        responsibilities: 'Research, paper writing, model development, collaboration',
        city: 'San Francisco',
        state: 'CA',
        remote: false,
        employmentType: 'full-time' as const,
        experienceLevel: 'senior' as const,
        salaryMin: 200000,
        salaryMax: 300000,
        skills: [
          { name: 'Machine Learning', weight: 0.4, minScore: 90, required: true },
          { name: 'Python', weight: 0.3, minScore: 85, required: true },
          { name: 'TensorFlow', weight: 0.2, minScore: 80, required: true },
          { name: 'Prompt Engineering', weight: 0.1, minScore: 75, required: false }
        ]
      },
      {
        companyIndex: 1,
        title: 'Junior Data Analyst',
        description: `Start your data career with our analytics team! You'll learn from experienced data scientists while working on real client projects.

You'll Work On:
- Data cleaning and preparation
- Creating reports and visualizations
- Supporting senior analysts
- Learning advanced analytics techniques

Great opportunity for recent graduates or career changers passionate about data.`,
        requirements: 'BS in related field, SQL knowledge, eagerness to learn',
        responsibilities: 'Data preparation, report generation, learning',
        city: 'New York',
        state: 'NY',
        remote: true,
        employmentType: 'full-time' as const,
        experienceLevel: 'entry' as const,
        salaryMin: 70000,
        salaryMax: 90000,
        skills: [
          { name: 'SQL', weight: 0.4, minScore: 60, required: true },
          { name: 'Excel', weight: 0.3, minScore: 70, required: true },
          { name: 'Python', weight: 0.2, minScore: 50, required: false },
          { name: 'Tableau', weight: 0.1, minScore: 40, required: false }
        ]
      }
    ];

    console.log(`\n📝 Creating ${jobs.length} job postings...\n`);

    for (const job of jobs) {
      const company = companies[job.companyIndex % companies.length];
      if (!company) {
        console.log(`⚠️  Skipping job ${job.title} - no company available`);
        continue;
      }
      const companyId = company.company_id;

      // Insert job
      const jobResult = await pool.query(
        `INSERT INTO jobs
         (company_id, title, description, requirements, city, state, country,
          remote_option, employment_type, experience_level, salary_min, salary_max,
          salary_currency, status, posted_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
         RETURNING job_id`,
        [
          companyId,
          job.title,
          job.description,
          job.requirements,
          job.city,
          job.state,
          'USA',
          job.remote ? 'remote' : 'onsite',
          job.employmentType,
          job.experienceLevel,
          job.salaryMin,
          job.salaryMax,
          'USD',
          'active',
          employerId
        ]
      );

      const jobId = jobResult.rows[0].job_id;
      console.log(`✅ Created: ${job.title} (${job.city}, ${job.state})`);

      // Add skills to job
      for (const skill of job.skills) {
        const skillId = getSkillId(skill.name);
        if (skillId) {
          await pool.query(
            `INSERT INTO job_skills (job_id, skill_id, weight, minimum_score, required)
             VALUES ($1, $2, $3, $4, $5)`,
            [jobId, skillId, skill.weight, skill.minScore, skill.required]
          );
          console.log(`  └─ Added skill: ${skill.name} (weight: ${skill.weight}, min: ${skill.minScore}, required: ${skill.required})`);
        } else {
          console.log(`  └─ ⚠️  Skill not found: ${skill.name}`);
        }
      }
      console.log('');
    }

    console.log('✅ Successfully seeded realistic job postings!');
    console.log('\n📊 Summary:');
    console.log(`   - ${jobs.length} jobs created`);
    console.log(`   - ${companies.length} companies`);
    console.log('   - Various skill requirements and levels');
    console.log('\n💡 Next steps:');
    console.log('   1. Add skills to candidate profiles');
    console.log('   2. Run matching algorithm: POST /api/v1/matching/jobs/:jobId/calculate');
    console.log('   3. View matches on the Job Matches page');

  } catch (error) {
    console.error('❌ Error seeding jobs:', error);
    throw error;
  } finally {
    await pool.end();
    process.exit(0);
  }
}

seedRealisticJobs();
