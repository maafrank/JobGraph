# JobGraph

**Skills-Based Job Matching Platform**

JobGraph is an intelligent job matching platform that revolutionizes hiring by focusing on verified skills rather than just resumes. Candidates interview once per skill, and their scores are used to match them with multiple relevant jobs.

## Core Concept

- **Candidates**: Upload resume, complete skill-based interviews, get matched to jobs
- **Companies**: Post jobs with required skills, get ranked list of qualified candidates
- **One Interview Per Skill**: Candidates interview once for each skill (e.g., Python, Machine Learning), and that score applies to all jobs requiring that skill
- **Intelligent Matching**: AI-powered scoring matches candidates to jobs based on skill proficiency and job requirements

## Key Features

### For Candidates
- Resume upload with AI-powered parsing and auto-fill
- Skill-based interviews (reusable across multiple jobs)
- Personalized job recommendations based on skill scores
- Track skill proficiency and compare with others
- Interview once, apply to many jobs

### For Employers
- Post jobs with specific skill requirements and weights
- View ranked candidates by compatibility score
- Access verified skill assessments
- Filter candidates by skill proficiency levels
- Connect directly with top matches

### Platform Features
- AI-powered resume parsing (AWS Textract)
- Intelligent interview generation and scoring (AWS Bedrock)
- Multi-skill job matching algorithm
- Real-time notifications
- Comprehensive analytics

## Technology Stack

### Frontend
- React + TypeScript
- TailwindCSS
- React Query for state management

### Backend
- Node.js / Python (FastAPI)
- PostgreSQL (primary database)
- Redis (caching)
- AWS ECS (container orchestration)

### AWS Services
- **Compute**: ECS Fargate, Lambda
- **Database**: RDS (PostgreSQL), DynamoDB, ElastiCache (Redis)
- **Storage**: S3
- **AI/ML**: Textract (resume parsing), Bedrock (interview evaluation)
- **Search**: OpenSearch
- **Auth**: Cognito
- **API**: API Gateway
- **Notifications**: SES, SNS
- **Monitoring**: CloudWatch, X-Ray

## Documentation

- [System Design](./SYSTEM_DESIGN.md) - Comprehensive system architecture and design
- [Database Schema](./DATABASE_SCHEMA.sql) - Complete PostgreSQL schema
- [AWS Infrastructure](./AWS_INFRASTRUCTURE.md) - AWS setup and deployment guide

## Getting Started

(Coming soon: Setup instructions, development environment, and deployment guide)

## Architecture Overview

```
Candidates → Resume Upload → AI Parsing → Profile Creation
          ↓
     Skill Interviews → AI Scoring → Skill Scores
          ↓
     Job Matching Algorithm → Ranked Matches
          ↓
     Employers View Candidates → Contact Top Matches
```

## Matching Algorithm

Jobs require multiple skills with different weights. For example:
- Senior ML Engineer: Machine Learning (40%), Python (30%), Data Engineering (20%), AWS (10%)

The system calculates a match score for each candidate based on their skill interview scores:
```
match_score = Σ(skill_score[i] × weight[i]) / Σ(weight[i])
```

Candidates must meet minimum thresholds for each required skill to qualify.

## Development Phases

### Phase 1: MVP (3-4 months)
- User authentication and basic profiles
- Resume upload and parsing
- Manual skill entry (no interviews yet)
- Basic job posting and matching

### Phase 2: Core Features (2-3 months)
- Skill-based interview system
- AI-powered scoring
- Advanced matching algorithm
- Notifications

### Phase 3: Enhancement (2-3 months)
- Search and filtering
- Analytics dashboards
- Mobile app
- Performance optimization

### Phase 4: Scale (Ongoing)
- ML model improvements
- Additional interview types
- Video interviews
- Scale infrastructure

## License

MIT License - See [LICENSE](./LICENSE) file for details

## Contributing

(Coming soon: Contribution guidelines)

## Contact

For questions or feedback, please open an issue on GitHub.