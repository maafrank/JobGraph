# Phases 3-5: Enhancement, Production & Scale - Detailed Implementation Plan

---

# Phase 3: Enhancement & Polish (Week 19-26)

**Timeline**: 8 weeks
**Goal**: Production-ready features, search, notifications, analytics

---

## Week 19-20: Search & Filtering (3.1)

### Week 19: OpenSearch Setup

**Day 1-2: OpenSearch Infrastructure**

```bash
# Add OpenSearch client
cd backend
npm install @opensearch-project/opensearch
```

**OpenSearch Service** (`backend/common/src/services/opensearch.service.ts`):
```typescript
import { Client } from '@opensearch-project/opensearch';

const client = new Client({
  node: process.env.OPENSEARCH_URL || 'https://localhost:9200',
  auth: {
    username: process.env.OPENSEARCH_USERNAME || 'admin',
    password: process.env.OPENSEARCH_PASSWORD || 'admin',
  },
  ssl: {
    rejectUnauthorized: false, // For development
  },
});

export class OpenSearchService {
  async createJobsIndex() {
    const indexName = 'jobs';

    // Check if index exists
    const exists = await client.indices.exists({ index: indexName });

    if (exists.body) {
      return;
    }

    // Create index with mapping
    await client.indices.create({
      index: indexName,
      body: {
        mappings: {
          properties: {
            job_id: { type: 'keyword' },
            title: { type: 'text', analyzer: 'standard' },
            description: { type: 'text', analyzer: 'standard' },
            company_name: { type: 'text' },
            city: { type: 'keyword' },
            state: { type: 'keyword' },
            country: { type: 'keyword' },
            remote_option: { type: 'keyword' },
            employment_type: { type: 'keyword' },
            experience_level: { type: 'keyword' },
            salary_min: { type: 'integer' },
            salary_max: { type: 'integer' },
            skills: { type: 'keyword' },
            created_at: { type: 'date' },
          },
        },
      },
    });
  }

  async indexJob(job: any) {
    await client.index({
      index: 'jobs',
      id: job.job_id,
      body: {
        job_id: job.job_id,
        title: job.title,
        description: job.description,
        company_name: job.company_name,
        city: job.city,
        state: job.state,
        country: job.country,
        remote_option: job.remote_option,
        employment_type: job.employment_type,
        experience_level: job.experience_level,
        salary_min: job.salary_min,
        salary_max: job.salary_max,
        skills: job.skills, // Array of skill names
        created_at: job.created_at,
      },
    });

    await client.indices.refresh({ index: 'jobs' });
  }

  async searchJobs(query: any) {
    const {
      q,
      location,
      remote,
      employmentType,
      experienceLevel,
      skills,
      salaryMin,
      page = 1,
      limit = 20,
    } = query;

    const must: any[] = [];
    const filter: any[] = [];

    // Full-text search
    if (q) {
      must.push({
        multi_match: {
          query: q,
          fields: ['title^2', 'description', 'company_name'],
          fuzziness: 'AUTO',
        },
      });
    }

    // Location filter
    if (location) {
      filter.push({
        bool: {
          should: [
            { match: { city: location } },
            { match: { state: location } },
          ],
        },
      });
    }

    // Remote filter
    if (remote) {
      filter.push({ term: { remote_option: remote } });
    }

    // Employment type filter
    if (employmentType) {
      filter.push({ term: { employment_type: employmentType } });
    }

    // Experience level filter
    if (experienceLevel) {
      filter.push({ term: { experience_level: experienceLevel } });
    }

    // Skills filter
    if (skills && skills.length > 0) {
      filter.push({ terms: { skills: skills } });
    }

    // Salary filter
    if (salaryMin) {
      filter.push({
        range: {
          salary_max: { gte: salaryMin },
        },
      });
    }

    const from = (page - 1) * limit;

    const result = await client.search({
      index: 'jobs',
      body: {
        from,
        size: limit,
        query: {
          bool: {
            must: must.length > 0 ? must : [{ match_all: {} }],
            filter,
          },
        },
        sort: [{ created_at: { order: 'desc' } }],
        highlight: {
          fields: {
            title: {},
            description: {},
          },
        },
      },
    });

    const hits = result.body.hits.hits;
    const total = result.body.hits.total.value;

    return {
      jobs: hits.map((hit: any) => ({
        ...hit._source,
        highlight: hit.highlight,
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async autocompleteSkills(prefix: string) {
    const result = await client.search({
      index: 'jobs',
      body: {
        size: 0,
        aggs: {
          skills: {
            terms: {
              field: 'skills',
              include: `${prefix}.*`,
              size: 10,
            },
          },
        },
      },
    });

    return result.body.aggregations.skills.buckets.map((b: any) => b.key);
  }

  async deleteJob(jobId: string) {
    await client.delete({
      index: 'jobs',
      id: jobId,
    });
  }
}
```

**Update Job Service to Index Jobs**:
```typescript
// In job-service, after creating/updating a job
await openSearchService.indexJob({
  job_id: job.job_id,
  title: job.title,
  description: job.description,
  company_name: company.name,
  skills: jobSkills.map(s => s.skill_name),
  // ... other fields
});
```

### Week 20: Search Frontend

**Job Search Page** (`frontend/src/pages/jobs/JobSearch.tsx`):
```typescript
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { SearchIcon, FilterIcon } from '@heroicons/react/outline';

function JobSearch() {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState({
    location: '',
    remote: '',
    employmentType: '',
    skills: [],
    salaryMin: '',
  });
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery(
    ['jobs', query, filters, page],
    () => api.get('/jobs/search', { params: { q: query, ...filters, page } })
  );

  return (
    <div className="max-w-7xl mx-auto px-4">
      <h1 className="text-3xl font-bold mb-6">Find Your Next Job</h1>

      {/* Search Bar */}
      <div className="flex gap-4 mb-6">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search by title, skills, or company..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full px-4 py-3 border rounded-lg"
          />
        </div>
        <button className="px-6 py-3 bg-blue-600 text-white rounded-lg">
          <SearchIcon className="w-5 h-5" />
        </button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <select
          value={filters.location}
          onChange={(e) => setFilters({ ...filters, location: e.target.value })}
          className="px-4 py-2 border rounded"
        >
          <option value="">All Locations</option>
          <option value="remote">Remote</option>
          <option value="New York">New York</option>
          <option value="San Francisco">San Francisco</option>
        </select>

        <select
          value={filters.employmentType}
          onChange={(e) => setFilters({ ...filters, employmentType: e.target.value })}
          className="px-4 py-2 border rounded"
        >
          <option value="">All Types</option>
          <option value="full-time">Full-time</option>
          <option value="part-time">Part-time</option>
          <option value="contract">Contract</option>
        </select>

        <input
          type="number"
          placeholder="Min Salary"
          value={filters.salaryMin}
          onChange={(e) => setFilters({ ...filters, salaryMin: e.target.value })}
          className="px-4 py-2 border rounded"
        />

        <SkillsMultiSelect
          value={filters.skills}
          onChange={(skills) => setFilters({ ...filters, skills })}
        />
      </div>

      {/* Results */}
      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <div>
          <p className="mb-4">
            {data.pagination.total} jobs found
          </p>

          <div className="space-y-4">
            {data.jobs.map((job) => (
              <JobCard key={job.job_id} job={job} />
            ))}
          </div>

          {/* Pagination */}
          <Pagination
            currentPage={page}
            totalPages={data.pagination.pages}
            onPageChange={setPage}
          />
        </div>
      )}
    </div>
  );
}
```

---

## Week 21: Notifications & Emails (3.2)

### Day 1-2: AWS SES Setup

**SES Email Service** (`backend/services/notification-service/src/services/email.service.ts`):
```typescript
import { SESClient, SendEmailCommand, SendTemplatedEmailCommand } from '@aws-sdk/client-ses';

const sesClient = new SESClient({
  region: process.env.AWS_REGION || 'us-east-1',
});

export class EmailService {
  async sendEmail(to: string, subject: string, htmlBody: string, textBody?: string) {
    const command = new SendEmailCommand({
      Source: process.env.FROM_EMAIL || 'noreply@jobgraph.com',
      Destination: {
        ToAddresses: [to],
      },
      Message: {
        Subject: { Data: subject },
        Body: {
          Html: { Data: htmlBody },
          Text: { Data: textBody || this.stripHtml(htmlBody) },
        },
      },
    });

    await sesClient.send(command);
  }

  async sendWelcomeEmail(user: any) {
    const subject = 'Welcome to JobGraph!';
    const html = `
      <h1>Welcome to JobGraph, ${user.firstName}!</h1>
      <p>We're excited to have you on our skills-based job matching platform.</p>
      <p>Next steps:</p>
      <ol>
        <li>Complete your profile</li>
        <li>Upload your resume</li>
        <li>Take skill interviews</li>
        <li>Get matched to amazing jobs!</li>
      </ol>
      <a href="${process.env.FRONTEND_URL}/profile">Complete Your Profile</a>
    `;

    await this.sendEmail(user.email, subject, html);
  }

  async sendNewMatchNotification(user: any, job: any, matchScore: number) {
    const subject = `New Job Match: ${job.title}`;
    const html = `
      <h1>You've been matched to a new job!</h1>
      <h2>${job.title} at ${job.company_name}</h2>
      <p><strong>Match Score: ${matchScore.toFixed(1)}%</strong></p>
      <p>${job.description.substring(0, 200)}...</p>
      <p><strong>Location:</strong> ${job.city}, ${job.state} ${job.remote_option ? '(Remote Available)' : ''}</p>
      <p><strong>Salary:</strong> $${job.salary_min.toLocaleString()} - $${job.salary_max.toLocaleString()}</p>
      <a href="${process.env.FRONTEND_URL}/jobs/${job.job_id}">View Job Details</a>
    `;

    await this.sendEmail(user.email, subject, html);
  }

  async sendInterviewReminderEmail(user: any, skill: any) {
    const subject = `Complete Your ${skill.name} Interview`;
    const html = `
      <h1>Don't forget to complete your interview!</h1>
      <p>Hi ${user.firstName},</p>
      <p>You started an interview for <strong>${skill.name}</strong> but haven't finished it yet.</p>
      <p>Complete your interview to:</p>
      <ul>
        <li>Get matched to relevant jobs</li>
        <li>See your skill percentile ranking</li>
        <li>Receive personalized feedback</li>
      </ul>
      <a href="${process.env.FRONTEND_URL}/interviews/${skill.skill_id}">Complete Interview</a>
    `;

    await this.sendEmail(user.email, subject, html);
  }

  async sendEmployerContactNotification(candidate: any, job: any, employer: any) {
    const subject = `An employer is interested in you!`;
    const html = `
      <h1>Great news!</h1>
      <p>Hi ${candidate.firstName},</p>
      <p><strong>${employer.firstName} ${employer.lastName}</strong> from <strong>${job.company_name}</strong>
      has viewed your profile and is interested in your application for <strong>${job.title}</strong>.</p>
      <p>They may reach out to you soon for the next steps.</p>
      <a href="${process.env.FRONTEND_URL}/matches">View Your Matches</a>
    `;

    await this.sendEmail(candidate.email, subject, html);
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '');
  }
}
```

### Day 3-4: In-App Notifications

**Notification Service** (`backend/services/notification-service/src/services/notification.service.ts`):
```typescript
export class NotificationService {
  async createNotification(userId: string, type: string, title: string, message: string, link?: string) {
    await pool.query(
      `INSERT INTO notifications (user_id, type, title, message, link)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, type, title, message, link]
    );
  }

  async getUserNotifications(userId: string, unreadOnly = false) {
    let query = `
      SELECT * FROM notifications
      WHERE user_id = $1
    `;

    if (unreadOnly) {
      query += ' AND read = false';
    }

    query += ' ORDER BY created_at DESC LIMIT 50';

    const result = await pool.query(query, [userId]);
    return result.rows;
  }

  async markAsRead(notificationId: string, userId: string) {
    await pool.query(
      'UPDATE notifications SET read = true WHERE notification_id = $1 AND user_id = $2',
      [notificationId, userId]
    );
  }

  async markAllAsRead(userId: string) {
    await pool.query(
      'UPDATE notifications SET read = true WHERE user_id = $1',
      [userId]
    );
  }

  async getUnreadCount(userId: string) {
    const result = await pool.query(
      'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND read = false',
      [userId]
    );

    return parseInt(result.rows[0].count);
  }

  // Convenience methods for common notifications
  async notifyNewMatch(userId: string, jobId: string, matchScore: number) {
    await this.createNotification(
      userId,
      'new_match',
      'New Job Match!',
      `You've been matched to a new job with ${matchScore.toFixed(1)}% compatibility`,
      `/jobs/${jobId}`
    );

    // Also send email
    const user = await this.getUser(userId);
    const job = await this.getJob(jobId);
    await emailService.sendNewMatchNotification(user, job, matchScore);
  }

  async notifyEmployerContact(candidateId: string, jobId: string) {
    await this.createNotification(
      candidateId,
      'employer_contact',
      'Employer Interest',
      'An employer has viewed your profile and is interested in your application',
      `/matches`
    );

    // Also send email
    const candidate = await this.getUser(candidateId);
    const job = await this.getJob(jobId);
    const employer = await this.getUser(job.posted_by);
    await emailService.sendEmployerContactNotification(candidate, job, employer);
  }
}
```

### Day 5: Notification Frontend

**Notification Bell Component**:
```typescript
function NotificationBell() {
  const { data: unreadCount } = useQuery(['notifications', 'unread-count'], () =>
    api.get('/notifications/unread-count')
  );

  const { data: notifications } = useQuery(['notifications'], () =>
    api.get('/notifications')
  );

  const [isOpen, setIsOpen] = useState(false);

  const markAsRead = useMutation((id: string) =>
    api.put(`/notifications/${id}/read`)
  );

  return (
    <div className="relative">
      <button onClick={() => setIsOpen(!isOpen)} className="relative">
        <BellIcon className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white shadow-lg rounded-lg z-50">
          <div className="p-4 border-b">
            <h3 className="font-semibold">Notifications</h3>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications?.map((n) => (
              <div
                key={n.notification_id}
                className={`p-4 border-b cursor-pointer hover:bg-gray-50 ${
                  !n.read ? 'bg-blue-50' : ''
                }`}
                onClick={() => {
                  markAsRead.mutate(n.notification_id);
                  if (n.link) navigate(n.link);
                }}
              >
                <p className="font-medium">{n.title}</p>
                <p className="text-sm text-gray-600">{n.message}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {formatDistanceToNow(new Date(n.created_at))} ago
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## Week 22: Analytics Dashboard (3.3)

### Candidate Analytics

**Analytics Service** (`backend/services/analytics-service/src/services/analytics.service.ts`):
```typescript
export class AnalyticsService {
  async getCandidateAnalytics(userId: string) {
    // Skill scores over time
    const skillScoresResult = await pool.query(
      `SELECT s.name, uss.score, uss.percentile, uss.created_at
       FROM user_skill_scores uss
       JOIN skills s ON uss.skill_id = s.skill_id
       WHERE uss.user_id = $1
       ORDER BY uss.created_at DESC`,
      [userId]
    );

    // Interview completion rate
    const interviewStatsResult = await pool.query(
      `SELECT
         COUNT(*) as total,
         COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
         COUNT(CASE WHEN status = 'abandoned' THEN 1 END) as abandoned
       FROM interviews
       WHERE user_id = $1`,
      [userId]
    );

    // Match statistics
    const matchStatsResult = await pool.query(
      `SELECT
         COUNT(*) as total_matches,
         AVG(overall_score) as avg_match_score,
         COUNT(CASE WHEN status = 'viewed' THEN 1 END) as viewed,
         COUNT(CASE WHEN status = 'contacted' THEN 1 END) as contacted
       FROM job_matches
       WHERE user_id = $1`,
      [userId]
    );

    // Top matching jobs
    const topMatchesResult = await pool.query(
      `SELECT jm.overall_score, j.title, j.company_id, c.name as company_name
       FROM job_matches jm
       JOIN jobs j ON jm.job_id = j.job_id
       JOIN companies c ON j.company_id = c.company_id
       WHERE jm.user_id = $1
       ORDER BY jm.overall_score DESC
       LIMIT 10`,
      [userId]
    );

    return {
      skillScores: skillScoresResult.rows,
      interviewStats: interviewStatsResult.rows[0],
      matchStats: matchStatsResult.rows[0],
      topMatches: topMatchesResult.rows,
    };
  }

  async getEmployerAnalytics(companyId: string) {
    // Job posting performance
    const jobStatsResult = await pool.query(
      `SELECT
         j.job_id,
         j.title,
         j.views,
         COUNT(jm.match_id) as total_matches,
         AVG(jm.overall_score) as avg_candidate_score,
         COUNT(CASE WHEN jm.status = 'contacted' THEN 1 END) as contacted
       FROM jobs j
       LEFT JOIN job_matches jm ON j.job_id = jm.job_id
       WHERE j.company_id = $1
       GROUP BY j.job_id
       ORDER BY j.created_at DESC`,
      [companyId]
    );

    // Candidate quality distribution
    const candidateDistributionResult = await pool.query(
      `SELECT
         CASE
           WHEN overall_score >= 90 THEN 'Excellent (90-100)'
           WHEN overall_score >= 80 THEN 'Good (80-89)'
           WHEN overall_score >= 70 THEN 'Average (70-79)'
           ELSE 'Below Average (<70)'
         END as score_range,
         COUNT(*) as count
       FROM job_matches jm
       JOIN jobs j ON jm.job_id = j.job_id
       WHERE j.company_id = $1
       GROUP BY score_range
       ORDER BY score_range DESC`,
      [companyId]
    );

    return {
      jobStats: jobStatsResult.rows,
      candidateDistribution: candidateDistributionResult.rows,
    };
  }
}
```

**Analytics Dashboard Frontend**:
```typescript
import { BarChart, LineChart, PieChart } from 'recharts';

function CandidateDashboard() {
  const { data } = useQuery(['analytics', 'candidate'], () =>
    api.get('/analytics/candidate')
  );

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Your Analytics</h1>

      {/* Skill Scores */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Your Skills</h2>
        <div className="grid grid-cols-3 gap-4">
          {data.skillScores.map((skill) => (
            <div key={skill.name} className="border rounded p-4">
              <p className="font-medium">{skill.name}</p>
              <p className="text-3xl font-bold">{skill.score}/100</p>
              <p className="text-sm text-gray-600">
                Top {100 - skill.percentile}%
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Interview Stats */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Interview Statistics</h2>
        <PieChart
          data={[
            { name: 'Completed', value: data.interviewStats.completed },
            { name: 'Abandoned', value: data.interviewStats.abandoned },
          ]}
          width={400}
          height={300}
        />
      </div>

      {/* Match Stats */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Job Matches</h2>
        <div className="grid grid-cols-4 gap-4">
          <StatCard label="Total Matches" value={data.matchStats.total_matches} />
          <StatCard label="Avg Match Score" value={`${data.matchStats.avg_match_score.toFixed(1)}%`} />
          <StatCard label="Profile Views" value={data.matchStats.viewed} />
          <StatCard label="Contacted" value={data.matchStats.contacted} />
        </div>
      </div>

      {/* Top Matches */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Your Best Matches</h2>
        <div className="space-y-2">
          {data.topMatches.map((match) => (
            <div key={match.job_id} className="flex justify-between items-center p-3 border rounded">
              <div>
                <p className="font-medium">{match.title}</p>
                <p className="text-sm text-gray-600">{match.company_name}</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-green-600">{match.overall_score.toFixed(1)}%</p>
                <p className="text-xs text-gray-600">Match Score</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

---

## Week 23: Enhanced Resume Parsing - AWS Textract (3.4)

**Textract Service** (`backend/services/profile-service/src/services/textract.service.ts`):
```typescript
import { TextractClient, AnalyzeDocumentCommand } from '@aws-sdk/client-textract';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

const textractClient = new TextractClient({ region: process.env.AWS_REGION });
const s3Client = new S3Client({ region: process.env.AWS_REGION });

export class TextractService {
  async parseResume(s3Key: string) {
    const command = new AnalyzeDocumentCommand({
      Document: {
        S3Object: {
          Bucket: process.env.S3_BUCKET_RESUMES,
          Name: s3Key,
        },
      },
      FeatureTypes: ['TABLES', 'FORMS'],
    });

    const response = await textractClient.send(command);

    // Extract structured data
    const extractedData = this.extractStructuredData(response.Blocks || []);

    return extractedData;
  }

  private extractStructuredData(blocks: any[]) {
    const lines: string[] = [];
    const tables: any[] = [];
    const keyValuePairs: any = {};

    for (const block of blocks) {
      if (block.BlockType === 'LINE') {
        lines.push(block.Text);
      } else if (block.BlockType === 'TABLE') {
        tables.push(this.extractTable(block, blocks));
      } else if (block.BlockType === 'KEY_VALUE_SET' && block.EntityTypes.includes('KEY')) {
        const key = this.getKeyText(block, blocks);
        const value = this.getValueText(block, blocks);
        if (key && value) {
          keyValuePairs[key] = value;
        }
      }
    }

    // Parse specific sections
    const email = this.extractEmail(lines);
    const phone = this.extractPhone(lines);
    const education = this.extractEducation(lines);
    const workExperience = this.extractWorkExperience(lines);
    const skills = this.extractSkills(lines);

    return {
      email,
      phone,
      education,
      workExperience,
      skills,
      keyValuePairs,
      rawText: lines.join('\n'),
    };
  }

  private extractEducation(lines: string[]) {
    const education: any[] = [];
    const educationKeywords = ['education', 'academic background', 'degree'];

    // Find education section
    let inEducationSection = false;
    let currentEducation: any = {};

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase();

      if (educationKeywords.some(k => line.includes(k))) {
        inEducationSection = true;
        continue;
      }

      if (inEducationSection) {
        // Check if we've moved to a new section
        if (line.includes('experience') || line.includes('skills')) {
          inEducationSection = false;
          if (Object.keys(currentEducation).length > 0) {
            education.push(currentEducation);
            currentEducation = {};
          }
          continue;
        }

        // Extract degree
        const degreeMatch = line.match(/(bachelor|master|phd|doctorate|associate|diploma|certificate)/i);
        if (degreeMatch) {
          if (Object.keys(currentEducation).length > 0) {
            education.push(currentEducation);
          }
          currentEducation = { degree: lines[i] };
        }

        // Extract institution
        const institutionMatch = line.match(/(university|college|institute|school)/i);
        if (institutionMatch && !currentEducation.institution) {
          currentEducation.institution = lines[i];
        }

        // Extract year
        const yearMatch = line.match(/\b(19|20)\d{2}\b/);
        if (yearMatch) {
          currentEducation.graduationYear = parseInt(yearMatch[0]);
        }
      }
    }

    if (Object.keys(currentEducation).length > 0) {
      education.push(currentEducation);
    }

    return education;
  }

  private extractWorkExperience(lines: string[]) {
    const experience: any[] = [];
    const experienceKeywords = ['experience', 'work history', 'employment', 'professional experience'];

    let inExperienceSection = false;
    let currentJob: any = {};

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase();

      if (experienceKeywords.some(k => line.includes(k))) {
        inExperienceSection = true;
        continue;
      }

      if (inExperienceSection) {
        if (line.includes('education') || line.includes('skills') || line.includes('projects')) {
          inExperienceSection = false;
          if (Object.keys(currentJob).length > 0) {
            experience.push(currentJob);
            currentJob = {};
          }
          continue;
        }

        // Detect job title (usually bold or first line of entry)
        // Company name detection
        // Date range detection
        const dateMatch = line.match(/\b(19|20)\d{2}\s*[-–]\s*(19|20)\d{2}|present\b/i);
        if (dateMatch) {
          if (Object.keys(currentJob).length > 0) {
            experience.push(currentJob);
          }
          currentJob = {
            title: lines[Math.max(0, i - 2)],
            company: lines[Math.max(0, i - 1)],
            dateRange: lines[i],
          };
        }
      }
    }

    if (Object.keys(currentJob).length > 0) {
      experience.push(currentJob);
    }

    return experience;
  }

  private extractSkills(lines: string[]) {
    const skills: string[] = [];
    const skillKeywords = ['skills', 'technical skills', 'technologies'];

    const knownSkills = [
      'Python', 'JavaScript', 'TypeScript', 'Java', 'C++', 'Go', 'Rust',
      'React', 'Angular', 'Vue', 'Node.js', 'Django', 'Flask',
      'Machine Learning', 'Deep Learning', 'NLP', 'Computer Vision',
      'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes',
      'SQL', 'PostgreSQL', 'MongoDB', 'Redis',
      // Add more known skills
    ];

    let inSkillsSection = false;

    for (const line of lines) {
      const lowerLine = line.toLowerCase();

      if (skillKeywords.some(k => lowerLine.includes(k))) {
        inSkillsSection = true;
        continue;
      }

      if (inSkillsSection) {
        if (lowerLine.includes('experience') || lowerLine.includes('education')) {
          break;
        }

        // Check for known skills in the line
        for (const skill of knownSkills) {
          if (line.includes(skill) && !skills.includes(skill)) {
            skills.push(skill);
          }
        }
      }
    }

    return skills;
  }

  private extractEmail(lines: string[]) {
    for (const line of lines) {
      const emailMatch = line.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
      if (emailMatch) {
        return emailMatch[0];
      }
    }
    return null;
  }

  private extractPhone(lines: string[]) {
    for (const line of lines) {
      const phoneMatch = line.match(/(\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
      if (phoneMatch) {
        return phoneMatch[0];
      }
    }
    return null;
  }

  private extractTable(tableBlock: any, blocks: any[]) {
    // Implement table extraction if needed
    return {};
  }

  private getKeyText(keyBlock: any, blocks: any[]): string {
    // Extract text from KEY block
    return '';
  }

  private getValueText(keyBlock: any, blocks: any[]): string {
    // Extract text from VALUE block
    return '';
  }
}
```

---

## Week 24-25: Profile & Employer Enhancements (3.5-3.6)

- Profile picture upload
- LinkedIn import (OAuth)
- Portfolio links
- Certifications section
- Profile completion percentage
- Employer team management
- Candidate shortlisting
- Pipeline management (contacted → interviewing → offered → hired)

---

## Week 26: Mobile App Foundation (3.7)

**React Native Setup**:
```bash
npx react-native init JobGraphMobile --template react-native-template-typescript
```

**Core Mobile Features**:
1. Authentication
2. Browse jobs
3. Take interviews (limited to MCQ on mobile, full interviews on web)
4. View matches
5. Notifications

---

# Phase 4: AWS Infrastructure & Production (Week 27-30)

**Timeline**: 4 weeks
**Goal**: Production deployment on AWS

---

## Week 27: Infrastructure as Code (4.1)

**AWS CDK Setup**:
```bash
cd infrastructure
npm init -y
npm install aws-cdk-lib constructs
npx cdk init app --language typescript
```

**CDK Stack Structure** (`infrastructure/lib/jobgraph-stack.ts`):
```typescript
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as elasticache from 'aws-cdk-lib/aws-elasticache';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cognito from 'aws-cdk-lib/aws-cognito';

export class JobGraphStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // VPC
    const vpc = new ec2.Vpc(this, 'JobGraphVPC', {
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        { name: 'Public', subnetType: ec2.SubnetType.PUBLIC },
        { name: 'Private', subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
        { name: 'Database', subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      ],
    });

    // RDS PostgreSQL
    const database = new rds.DatabaseInstance(this, 'JobGraphDB', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_15_3,
      }),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MEDIUM),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      multiAz: true,
      allocatedStorage: 100,
      maxAllocatedStorage: 500,
      backupRetention: cdk.Duration.days(7),
      deletionProtection: true,
    });

    // ElastiCache Redis
    const redis = new elasticache.CfnCacheCluster(this, 'JobGraphRedis', {
      cacheNodeType: 'cache.t3.medium',
      engine: 'redis',
      numCacheNodes: 1,
      vpcSecurityGroupIds: [/* security group */],
    });

    // S3 Buckets
    const resumesBucket = new s3.Bucket(this, 'ResumesBucket', {
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: true,
      lifecycleRules: [
        {
          transitions: [
            {
              storageClass: s3.StorageClass.GLACIER,
              transitionAfter: cdk.Duration.days(365),
            },
          ],
        },
      ],
    });

    // ECS Cluster
    const cluster = new ecs.Cluster(this, 'JobGraphCluster', {
      vpc,
    });

    // ECS Services (repeat for each microservice)
    const authService = new ecs.FargateService(this, 'AuthService', {
      cluster,
      taskDefinition: /* task def */,
      desiredCount: 2,
      minHealthyPercent: 100,
      maxHealthyPercent: 200,
    });

    // Cognito
    const userPool = new cognito.UserPool(this, 'UserPool', {
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
      },
    });

    // ... more resources
  }
}
```

**Deploy**:
```bash
# Bootstrap CDK (first time)
cdk bootstrap aws://ACCOUNT-ID/us-east-1

# Deploy to dev
cdk deploy --context env=dev

# Deploy to production
cdk deploy --context env=prod
```

---

## Week 28: Service Migration (4.2)

**Migration Checklist**:
- [ ] Migrate database to RDS
- [ ] Migrate Redis to ElastiCache
- [ ] Replace local auth with Cognito
- [ ] Update S3 bucket references
- [ ] Deploy services to ECS
- [ ] Configure environment variables in Secrets Manager
- [ ] Set up API Gateway
- [ ] Configure CloudFront CDN

---

## Week 29: CI/CD Pipeline (4.3)

**GitHub Actions Workflow** (`.github/workflows/deploy.yml`):
```yaml
name: Deploy to AWS

on:
  push:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm test

  build-and-push:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1

      - name: Login to ECR
        run: aws ecr get-login-password | docker login --username AWS --password-stdin $ECR_REGISTRY

      - name: Build and push Docker image
        run: |
          docker build -t jobgraph-auth-service ./backend/services/auth-service
          docker tag jobgraph-auth-service:latest $ECR_REGISTRY/jobgraph-auth-service:$GITHUB_SHA
          docker push $ECR_REGISTRY/jobgraph-auth-service:$GITHUB_SHA

      - name: Update ECS service
        run: |
          aws ecs update-service --cluster jobgraph-cluster --service auth-service --force-new-deployment
```

---

## Week 30: Monitoring, Security & Performance (4.4-4.6)

**CloudWatch Dashboards**:
- API latency metrics
- Error rates
- Database connections
- ECS service health
- Lambda invocations

**Security**:
- WAF rules
- Secrets rotation
- VPC security groups
- IAM least privilege
- Security audit (AWS Inspector)

**Performance**:
- Database query optimization
- Redis caching
- CDN configuration
- Load testing (Artillery)
- Auto-scaling policies

---

# Phase 5: Launch & Scale (Week 31+)

**Timeline**: Ongoing
**Goal**: Public launch and continuous improvement

---

## Week 31-32: Beta Launch

- Invite 100 beta users
- Collect feedback via surveys
- Monitor analytics
- Fix critical bugs
- Iterate on UX based on feedback

---

## Week 33-34: Public Launch

- Marketing website
- Launch announcement (Product Hunt, Twitter, LinkedIn)
- PR outreach
- Content marketing (blog posts)
- SEO optimization
- Monitor performance and scale as needed

---

## Post-Launch: Continuous Features

### Video Interviews
- WebRTC integration
- Record and review
- AI analysis of video responses

### AI Resume Builder
- Generate optimized resumes
- Skill-based recommendations
- ATS-friendly formatting

### Referral Program
- Reward users for successful referrals
- Bonus features for referrers

### Advanced Analytics
- Market salary data
- Skill demand trends
- Career path recommendations

### Skill Endorsements
- Peer endorsements
- Employer verifications
- Skill badges

### Multi-language Support
- Internationalization
- Multiple currencies
- Global job postings

---

## Success Metrics

### Phase 3:
- [ ] Full-text search working
- [ ] Emails sent successfully
- [ ] Analytics dashboards populated
- [ ] 100+ active users

### Phase 4:
- [ ] 100% running on AWS
- [ ] CI/CD pipeline functional
- [ ] Monitoring active with alerting
- [ ] Load tested for 1000+ users
- [ ] Security audit passed

### Phase 5:
- [ ] 500+ registered users
- [ ] 50+ companies
- [ ] 200+ job postings
- [ ] 1000+ completed interviews
- [ ] 500+ successful matches
- [ ] 90%+ uptime
- [ ] <200ms API response time

---

## Completion

**Total Timeline**: ~34 weeks (8 months) from start to public launch

With this comprehensive plan, you now have:
1. ✅ System design documentation
2. ✅ Database schema
3. ✅ AWS infrastructure plan
4. ✅ Phase 0: Foundation setup
5. ✅ Phase 1: MVP with auth, profiles, jobs, basic matching
6. ✅ Phase 2: Interview system with AI scoring
7. ✅ Phase 3: Search, notifications, analytics, mobile
8. ✅ Phase 4: Production AWS deployment
9. ✅ Phase 5: Launch strategy

**Next Step**: Begin Phase 0 implementation!
