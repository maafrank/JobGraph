# JobGraph - AWS Infrastructure Guide

## Overview
This document outlines the AWS infrastructure setup for JobGraph, a skills-based job matching platform.

---

## Architecture Components

### 1. Compute Layer

#### **AWS ECS (Elastic Container Service) with Fargate**
- **Purpose**: Run containerized microservices
- **Services to Deploy**:
  - Authentication Service
  - Profile Service
  - Interview Service
  - Job Service
  - Matching Service
  - Notification Service

**Configuration**:
```yaml
# Example ECS Service Configuration
Service:
  - Name: profile-service
  - Launch Type: FARGATE
  - Desired Count: 2 (auto-scale 2-10)
  - CPU: 512
  - Memory: 1024
  - Health Check: /health
  - Auto Scaling:
      - Target CPU: 70%
      - Target Memory: 80%
```

#### **AWS Lambda**
- **Purpose**: Event-driven serverless functions
- **Use Cases**:
  - Resume parsing trigger (S3 upload → Textract)
  - Interview scoring
  - Match calculation (scheduled jobs)
  - Email notifications
  - Data cleanup (expired interviews)

**Key Functions**:
```
- resume-parser-lambda: Triggered by S3 upload
- interview-scorer-lambda: Score interview responses
- match-calculator-lambda: Calculate job matches (runs daily)
- notification-sender-lambda: Send emails via SES
- data-cleanup-lambda: Archive/delete expired data
```

---

### 2. API Layer

#### **Amazon API Gateway**
- **Purpose**: Single entry point for all API requests
- **Type**: HTTP API (REST)
- **Features**:
  - Request routing to ECS services
  - JWT authorization
  - Rate limiting (10,000 requests/minute)
  - Throttling
  - CORS configuration
  - API versioning (/api/v1, /api/v2)

**Endpoints Structure**:
```
https://api.jobgraph.com/
├── /api/v1/auth/*          → Auth Service (ECS)
├── /api/v1/users/*         → Profile Service (ECS)
├── /api/v1/interviews/*    → Interview Service (ECS)
├── /api/v1/jobs/*          → Job Service (ECS)
├── /api/v1/companies/*     → Job Service (ECS)
└── /api/v1/matches/*       → Matching Service (ECS)
```

---

### 3. Database Layer

#### **Amazon RDS (PostgreSQL)**
- **Purpose**: Primary relational database
- **Instance**: db.t3.medium (production: db.r5.large)
- **Configuration**:
  - Multi-AZ deployment for high availability
  - Automated backups (7-day retention)
  - Read replicas (2) for read-heavy operations
  - Encryption at rest (AWS KMS)
  - SSL/TLS connections required

**Database Details**:
```
- Engine: PostgreSQL 15.x
- Storage: 100GB SSD (gp3), auto-scaling to 500GB
- Backup Window: 02:00-04:00 UTC
- Maintenance Window: Sun 04:00-05:00 UTC
- Parameter Group: Custom (optimized for OLTP)
```

#### **Amazon DynamoDB**
- **Purpose**: Fast access to user sessions, cache data
- **Tables**:
  - `user-sessions`: Store active user sessions
  - `interview-progress`: Track in-progress interviews
  - `rate-limit-tracking`: API rate limiting data

**Configuration**:
```
- Billing Mode: On-demand (auto-scaling)
- Encryption: AWS managed keys
- Point-in-time recovery: Enabled
- TTL: Enabled (for expired sessions)
```

#### **Amazon ElastiCache (Redis)**
- **Purpose**: Caching layer for frequently accessed data
- **Node Type**: cache.t3.medium
- **Configuration**:
  - Cluster mode: Enabled (3 shards, 1 replica each)
  - Automatic failover
  - Backup retention: 7 days

**Cache Keys**:
```
- user:{user_id}:profile
- job:{job_id}
- skill:{skill_id}
- matches:{user_id}
- leaderboard:{skill_id}
```

---

### 4. Storage

#### **Amazon S3**
- **Buckets**:

1. **jobgraph-resumes-{env}**
   - Store uploaded resumes (PDF, DOCX)
   - Encryption: SSE-S3
   - Versioning: Enabled
   - Lifecycle: Archive to Glacier after 1 year
   - Access: Private (presigned URLs)

2. **jobgraph-assets-{env}**
   - Company logos
   - Profile pictures
   - Static assets
   - CloudFront distribution

3. **jobgraph-backups-{env}**
   - Database backups
   - Log archives
   - Lifecycle: Delete after 90 days

**S3 Configuration**:
```
- Block Public Access: Enabled
- Versioning: Enabled
- Encryption: AES-256
- CORS: Configured for web uploads
- Event Notifications: Trigger Lambda on resume upload
```

---

### 5. Search & Analytics

#### **Amazon OpenSearch**
- **Purpose**: Full-text search for jobs and candidates
- **Domain**: jobgraph-search
- **Instance**: 3x t3.medium.search
- **Configuration**:
  - EBS storage: 100GB per node
  - Dedicated master nodes: 3x t3.small.search
  - Automated snapshots to S3

**Indices**:
```
- jobs_index: Job postings with full-text search
- candidates_index: Candidate profiles (anonymized)
- skills_index: Skills database
```

**Search Features**:
- Full-text search (title, description, skills)
- Faceted filtering (location, salary, remote)
- Autocomplete/suggestions
- Geo-location search

---

### 6. AI/ML Services

#### **Amazon Textract**
- **Purpose**: Extract text and structure from resumes
- **Usage**: Lambda function triggered by S3 upload
- **Features**:
  - Document text extraction
  - Table detection
  - Form data extraction
  - Handwriting recognition

**Resume Parsing Pipeline**:
```
User uploads resume → S3 bucket → EventBridge → Lambda
→ Textract API → Parse results → Store in RDS → Generate follow-up questions
```

#### **Amazon Bedrock**
- **Purpose**: AI-powered interview evaluation
- **Model**: Claude 3.5 Sonnet
- **Use Cases**:
  - Evaluate open-ended interview responses
  - Generate interview questions
  - Provide candidate feedback
  - Resume gap analysis

**Example Prompt**:
```
Evaluate the following response to a machine learning interview question:

Question: Explain the bias-variance tradeoff.
Answer: {candidate_answer}

Provide:
1. Score (0-100)
2. Strengths
3. Areas for improvement
4. Confidence level
```

---

### 7. Authentication & Authorization

#### **Amazon Cognito**
- **User Pools**: Manage user authentication
- **Features**:
  - Email/password authentication
  - MFA (optional)
  - Password policies
  - Email verification
  - Forgot password flow
  - OAuth 2.0 / OIDC

**User Pool Configuration**:
```
- Sign-in options: Email
- MFA: Optional (SMS or TOTP)
- Password Policy: Min 8 chars, uppercase, lowercase, number, special
- Email Verification: Required
- Token Expiration: Access (1 hour), Refresh (30 days)
```

**User Groups**:
- `candidates`: Candidate users
- `employers`: Company recruiters
- `admins`: Platform administrators

---

### 8. Messaging & Notifications

#### **Amazon SES (Simple Email Service)**
- **Purpose**: Transactional emails
- **Email Types**:
  - Welcome emails
  - Email verification
  - Password reset
  - Interview reminders
  - New job matches
  - Employer contact notifications

**Configuration**:
```
- Verified Domain: jobgraph.com
- DKIM: Enabled
- SPF: Configured
- Bounce/Complaint Handling: SNS notifications
- Templates: Stored in SES
```

#### **Amazon SNS (Simple Notification Service)**
- **Purpose**: Push notifications, pub/sub messaging
- **Topics**:
  - `new-matches`: Notify candidates of new job matches
  - `interview-reminders`: Interview deadline reminders
  - `employer-actions`: Employer contact notifications

#### **Amazon EventBridge**
- **Purpose**: Event-driven architecture
- **Rules**:
  - Resume uploaded → Trigger parser
  - Interview completed → Calculate score
  - Job posted → Find matches
  - Scheduled: Daily match calculation

---

### 9. Monitoring & Logging

#### **Amazon CloudWatch**
- **Metrics**:
  - API response times
  - Error rates
  - ECS service health
  - Lambda invocations/errors
  - Database connections
  - Cache hit rates

**Alarms**:
```
- API error rate > 5%
- ECS CPU utilization > 80%
- RDS connections > 80% of max
- Lambda concurrent executions > 900
- S3 bucket size > 1TB
```

**Dashboards**:
- Service health overview
- API performance metrics
- Database performance
- Cost tracking

#### **AWS X-Ray**
- **Purpose**: Distributed tracing
- **Instrumentation**:
  - API Gateway
  - Lambda functions
  - ECS services
  - Database queries

#### **CloudWatch Logs**
- **Log Groups**:
  - `/aws/ecs/profile-service`
  - `/aws/ecs/interview-service`
  - `/aws/lambda/resume-parser`
  - `/aws/rds/postgresql/error`
  - `/aws/apigateway/access-logs`

**Log Retention**: 30 days (archive to S3)

---

### 10. Security

#### **AWS WAF (Web Application Firewall)**
- **Purpose**: Protect API Gateway from common attacks
- **Rules**:
  - Rate limiting (per IP)
  - SQL injection protection
  - XSS protection
  - Geo-blocking (if needed)
  - Known bad IPs (AWS Managed Rules)

#### **AWS Secrets Manager**
- **Purpose**: Store sensitive credentials
- **Secrets**:
  - Database passwords
  - API keys (third-party services)
  - JWT signing keys
  - Encryption keys

**Rotation**: Automatic rotation every 90 days

#### **AWS KMS (Key Management Service)**
- **Purpose**: Encryption key management
- **Keys**:
  - RDS encryption key
  - S3 bucket encryption
  - DynamoDB encryption
  - Secrets Manager encryption

#### **AWS IAM**
- **Roles**:
  - `ecs-task-role`: ECS tasks access to AWS services
  - `lambda-execution-role`: Lambda functions
  - `rds-monitoring-role`: Enhanced monitoring

**Policies**: Least privilege principle

#### **VPC Configuration**
```
VPC: 10.0.0.0/16
├── Public Subnets (2 AZs)
│   ├── 10.0.1.0/24 (us-east-1a)
│   └── 10.0.2.0/24 (us-east-1b)
│   └── Resources: ALB, NAT Gateway
├── Private Subnets (2 AZs)
│   ├── 10.0.10.0/24 (us-east-1a)
│   └── 10.0.11.0/24 (us-east-1b)
│   └── Resources: ECS tasks, Lambda
└── Database Subnets (2 AZs)
    ├── 10.0.20.0/24 (us-east-1a)
    └── 10.0.21.0/24 (us-east-1b)
    └── Resources: RDS, ElastiCache
```

**Security Groups**:
- `alb-sg`: Allow HTTP/HTTPS from internet
- `ecs-sg`: Allow traffic from ALB only
- `rds-sg`: Allow PostgreSQL from ECS only
- `lambda-sg`: Allow outbound to RDS/S3

---

### 11. CDN & Static Assets

#### **Amazon CloudFront**
- **Purpose**: CDN for static assets and web app
- **Distributions**:

1. **Web App Distribution**
   - Origin: S3 bucket (React app)
   - Domain: app.jobgraph.com
   - HTTPS: Required (ACM certificate)
   - Caching: Aggressive (1 year for assets)

2. **Assets Distribution**
   - Origin: S3 bucket (logos, images)
   - Domain: assets.jobgraph.com
   - Caching: 1 month

**Configuration**:
```
- HTTP/2: Enabled
- Gzip Compression: Enabled
- Geo-Restriction: None
- Viewer Protocol Policy: Redirect HTTP to HTTPS
- Price Class: Use All Edge Locations
```

---

### 12. Networking

#### **Route 53**
- **Purpose**: DNS management
- **Hosted Zone**: jobgraph.com

**DNS Records**:
```
A     jobgraph.com              → CloudFront (web app)
A     api.jobgraph.com          → API Gateway
A     assets.jobgraph.com       → CloudFront (assets)
CNAME www.jobgraph.com          → jobgraph.com
MX    jobgraph.com              → SES mail servers
TXT   jobgraph.com              → SPF, DKIM records
```

#### **Application Load Balancer (ALB)**
- **Purpose**: Route traffic to ECS services
- **Listeners**:
  - HTTP (80) → Redirect to HTTPS
  - HTTPS (443) → Forward to target groups

**Target Groups**:
- `profile-service-tg`
- `interview-service-tg`
- `job-service-tg`
- `matching-service-tg`

---

## Deployment Architecture

### Environments

1. **Development** (dev)
   - Single-AZ deployment
   - Minimal resources
   - No read replicas

2. **Staging** (staging)
   - Multi-AZ deployment
   - Scaled-down production mirror
   - Testing environment

3. **Production** (prod)
   - Multi-AZ, multi-region (future)
   - Full redundancy
   - Auto-scaling enabled

---

## Infrastructure as Code

### AWS CDK (TypeScript)

**Project Structure**:
```
infrastructure/
├── bin/
│   └── jobgraph-stack.ts       # Entry point
├── lib/
│   ├── compute-stack.ts        # ECS, Lambda
│   ├── database-stack.ts       # RDS, DynamoDB, Redis
│   ├── storage-stack.ts        # S3 buckets
│   ├── api-stack.ts            # API Gateway
│   ├── auth-stack.ts           # Cognito
│   ├── monitoring-stack.ts     # CloudWatch, X-Ray
│   └── security-stack.ts       # WAF, Secrets Manager
├── cdk.json
└── package.json
```

**Deployment Commands**:
```bash
# Bootstrap CDK (first time only)
cdk bootstrap aws://ACCOUNT-ID/us-east-1

# Deploy to dev
cdk deploy --context env=dev

# Deploy to production
cdk deploy --context env=prod --require-approval=never
```

---

## Cost Estimation (Monthly)

### Development Environment
```
- ECS Fargate (2 tasks):           $30
- RDS PostgreSQL (db.t3.medium):   $70
- ElastiCache (cache.t3.micro):    $15
- S3 (100GB):                      $3
- Lambda (minimal usage):          $5
- API Gateway (1M requests):       $4
- Cognito (1K users):              $0 (free tier)
- CloudWatch (basic):              $10
Total: ~$140/month
```

### Production Environment (10K users, 1K jobs)
```
- ECS Fargate (8 tasks, auto-scale): $250
- RDS PostgreSQL (db.r5.large):       $400
  - Read replicas (2x):               $800
- ElastiCache (3 shards):             $150
- S3 (1TB storage, 10K uploads):      $30
- Lambda (1M invocations):            $20
- API Gateway (10M requests):         $35
- Cognito (10K users):                $50
- OpenSearch (3 nodes):               $300
- CloudFront (100GB transfer):        $10
- Textract (5K documents):            $20
- Bedrock (100K tokens):              $30
- SES (50K emails):                   $5
- CloudWatch (detailed):              $50
- Data Transfer:                      $100
Total: ~$2,250/month
```

---

## Scaling Strategy

### Horizontal Scaling
- **ECS Services**: Auto-scale based on CPU/memory (2-10 tasks)
- **RDS**: Add read replicas for read-heavy workloads
- **ElastiCache**: Add shards for increased throughput

### Vertical Scaling
- **RDS**: Upgrade instance type as database grows
- **OpenSearch**: Add more powerful nodes

### Optimization
- Enable RDS query caching
- Use CloudFront for static assets
- Implement database connection pooling
- Use ElastiCache for frequently accessed data
- Batch process match calculations

---

## Disaster Recovery

### Backup Strategy
- **RDS**: Automated daily backups (7-day retention)
- **DynamoDB**: Point-in-time recovery (35 days)
- **S3**: Versioning enabled
- **Infrastructure**: CDK code in Git

### Recovery Time Objective (RTO)
- Database: 30 minutes (restore from backup)
- Application: 15 minutes (redeploy ECS tasks)
- Full system: 1 hour

### Recovery Point Objective (RPO)
- Database: 5 minutes (automated backups)
- Files: Real-time (S3 versioning)

---

## Security Checklist

- [ ] Enable MFA for AWS root account
- [ ] Use IAM roles (no long-term credentials)
- [ ] Enable CloudTrail for audit logging
- [ ] Encrypt all data at rest (RDS, S3, DynamoDB)
- [ ] Use TLS 1.2+ for all connections
- [ ] Implement WAF rules on API Gateway
- [ ] Regular security scans (AWS Inspector)
- [ ] Rotate secrets every 90 days
- [ ] Enable VPC Flow Logs
- [ ] Implement least privilege access
- [ ] Use private subnets for backend services
- [ ] Enable GuardDuty for threat detection

---

## Next Steps

1. **Set up AWS account** and enable billing alerts
2. **Configure domain** in Route 53
3. **Deploy infrastructure** using CDK (dev environment)
4. **Set up CI/CD pipeline** (GitHub Actions → AWS)
5. **Deploy services** to ECS
6. **Configure monitoring** and alarms
7. **Load test** the system
8. **Deploy to production**

---

## Additional Resources

- [AWS Well-Architected Framework](https://aws.amazon.com/architecture/well-architected/)
- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [ECS Best Practices](https://docs.aws.amazon.com/AmazonECS/latest/bestpracticesguide/)
- [RDS Best Practices](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_BestPractices.html)
