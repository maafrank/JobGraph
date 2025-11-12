# Phase 3: Enhancement & Polish - Detailed Implementation Plan

**Timeline**: Week 19-26 (8 weeks)
**Goal**: Production-ready features including search, notifications, analytics, resume parsing, and mobile foundation

---

## Overview

Phase 3 transforms the MVP into a production-ready platform with advanced features that significantly improve user experience. This phase focuses on:

1. **Search & Discovery** - Full-text job search with OpenSearch
2. **Communication** - Email and in-app notifications
3. **Analytics** - Insights for candidates and employers
4. **Enhanced Resume Parsing** - AWS Textract integration
5. **Profile Enhancements** - Photos, LinkedIn import, portfolios
6. **Employer Tools** - Team management, candidate pipeline
7. **Mobile Foundation** - React Native app for core features

---

## Week 19-20: Search & Filtering (3.1)

### Week 19: OpenSearch Infrastructure

#### Day 1-2: OpenSearch Setup

**Install OpenSearch Client**:
```bash
cd backend
npm install @opensearch-project/opensearch
```

**Add OpenSearch to Docker Compose** (`docker-compose.yml`):
```yaml
services:
  # ... existing services (postgres, redis)

  opensearch:
    image: opensearchproject/opensearch:2.9.0
    container_name: jobgraph-opensearch
    environment:
      - discovery.type=single-node
      - plugins.security.disabled=true
      - "OPENSEARCH_JAVA_OPTS=-Xms512m -Xmx512m"
    ports:
      - "9200:9200"
      - "9600:9600"
    volumes:
      - opensearch_data:/usr/share/opensearch/data
    healthcheck:
      test: ["CMD-SHELL", "curl -f http://localhost:9200/_cluster/health || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 5

  opensearch-dashboards:
    image: opensearchproject/opensearch-dashboards:2.9.0
    container_name: jobgraph-opensearch-dashboards
    ports:
      - "5601:5601"
    environment:
      OPENSEARCH_HOSTS: '["http://opensearch:9200"]'
    depends_on:
      - opensearch

volumes:
  postgres_data:
  redis_data:
  opensearch_data:
```

**Create OpenSearch Service** (`backend/common/src/services/opensearch.service.ts`):
```typescript
import { Client } from '@opensearch-project/opensearch';

const client = new Client({
  node: process.env.OPENSEARCH_URL || 'http://localhost:9200',
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
      console.log('Jobs index already exists');
      return;
    }

    // Create index with mapping
    await client.indices.create({
      index: indexName,
      body: {
        settings: {
          number_of_shards: 1,
          number_of_replicas: 1,
          analysis: {
            analyzer: {
              job_analyzer: {
                type: 'custom',
                tokenizer: 'standard',
                filter: ['lowercase', 'stop', 'snowball'],
              },
            },
          },
        },
        mappings: {
          properties: {
            job_id: { type: 'keyword' },
            title: {
              type: 'text',
              analyzer: 'job_analyzer',
              fields: {
                keyword: { type: 'keyword' },
              },
            },
            description: {
              type: 'text',
              analyzer: 'job_analyzer',
            },
            requirements: {
              type: 'text',
              analyzer: 'job_analyzer',
            },
            company_name: {
              type: 'text',
              fields: {
                keyword: { type: 'keyword' },
              },
            },
            city: { type: 'keyword' },
            state: { type: 'keyword' },
            country: { type: 'keyword' },
            remote_option: { type: 'keyword' },
            employment_type: { type: 'keyword' },
            experience_level: { type: 'keyword' },
            salary_min: { type: 'integer' },
            salary_max: { type: 'integer' },
            salary_currency: { type: 'keyword' },
            skills: { type: 'keyword' },
            status: { type: 'keyword' },
            created_at: { type: 'date' },
            updated_at: { type: 'date' },
          },
        },
      },
    });

    console.log('Jobs index created successfully');
  }

  async indexJob(job: any) {
    try {
      await client.index({
        index: 'jobs',
        id: job.job_id,
        body: {
          job_id: job.job_id,
          title: job.title,
          description: job.description,
          requirements: job.requirements,
          company_name: job.company_name,
          city: job.city,
          state: job.state,
          country: job.country,
          remote_option: job.remote_option,
          employment_type: job.employment_type,
          experience_level: job.experience_level,
          salary_min: job.salary_min,
          salary_max: job.salary_max,
          salary_currency: job.salary_currency,
          skills: job.skills, // Array of skill names
          status: job.status,
          created_at: job.created_at,
          updated_at: job.updated_at,
        },
      });

      await client.indices.refresh({ index: 'jobs' });
      console.log(`Indexed job: ${job.job_id}`);
    } catch (error) {
      console.error('Error indexing job:', error);
      throw error;
    }
  }

  async updateJob(jobId: string, updates: any) {
    try {
      await client.update({
        index: 'jobs',
        id: jobId,
        body: {
          doc: updates,
        },
      });

      await client.indices.refresh({ index: 'jobs' });
      console.log(`Updated job: ${jobId}`);
    } catch (error) {
      console.error('Error updating job:', error);
      throw error;
    }
  }

  async deleteJob(jobId: string) {
    try {
      await client.delete({
        index: 'jobs',
        id: jobId,
      });

      await client.indices.refresh({ index: 'jobs' });
      console.log(`Deleted job: ${jobId}`);
    } catch (error) {
      console.error('Error deleting job:', error);
      throw error;
    }
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
      salaryMax,
      page = 1,
      limit = 20,
    } = query;

    const must: any[] = [];
    const filter: any[] = [];

    // Only search active jobs by default
    filter.push({ term: { status: 'active' } });

    // Full-text search on title, description, requirements
    if (q && q.trim()) {
      must.push({
        multi_match: {
          query: q,
          fields: ['title^3', 'description^2', 'requirements', 'company_name'],
          fuzziness: 'AUTO',
          operator: 'or',
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
            { match: { country: location } },
          ],
          minimum_should_match: 1,
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

    // Skills filter (match any of the specified skills)
    if (skills && Array.isArray(skills) && skills.length > 0) {
      filter.push({ terms: { skills: skills } });
    }

    // Salary filters
    if (salaryMin) {
      filter.push({
        range: {
          salary_max: { gte: parseInt(salaryMin) },
        },
      });
    }

    if (salaryMax) {
      filter.push({
        range: {
          salary_min: { lte: parseInt(salaryMax) },
        },
      });
    }

    const from = (page - 1) * limit;

    try {
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
          sort: [
            { _score: { order: 'desc' } },
            { created_at: { order: 'desc' } },
          ],
          highlight: {
            fields: {
              title: { number_of_fragments: 0 },
              description: { number_of_fragments: 3, fragment_size: 150 },
              requirements: { number_of_fragments: 2, fragment_size: 100 },
            },
            pre_tags: ['<mark>'],
            post_tags: ['</mark>'],
          },
        },
      });

      const hits = result.body.hits.hits;
      const total = result.body.hits.total.value;

      return {
        jobs: hits.map((hit: any) => ({
          ...hit._source,
          score: hit._score,
          highlight: hit.highlight,
        })),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      console.error('Error searching jobs:', error);
      throw error;
    }
  }

  async autocompleteSkills(prefix: string, limit: number = 10) {
    try {
      const result = await client.search({
        index: 'jobs',
        body: {
          size: 0,
          aggs: {
            skills: {
              terms: {
                field: 'skills',
                include: `${prefix}.*`,
                size: limit,
              },
            },
          },
        },
      });

      return result.body.aggregations.skills.buckets.map((b: any) => b.key);
    } catch (error) {
      console.error('Error autocompleting skills:', error);
      return [];
    }
  }

  async getJobFacets() {
    try {
      const result = await client.search({
        index: 'jobs',
        body: {
          size: 0,
          query: {
            term: { status: 'active' },
          },
          aggs: {
            employment_types: {
              terms: { field: 'employment_type', size: 10 },
            },
            experience_levels: {
              terms: { field: 'experience_level', size: 10 },
            },
            remote_options: {
              terms: { field: 'remote_option', size: 10 },
            },
            top_skills: {
              terms: { field: 'skills', size: 20 },
            },
            salary_ranges: {
              range: {
                field: 'salary_min',
                ranges: [
                  { key: 'Under $50k', to: 50000 },
                  { key: '$50k-$75k', from: 50000, to: 75000 },
                  { key: '$75k-$100k', from: 75000, to: 100000 },
                  { key: '$100k-$150k', from: 100000, to: 150000 },
                  { key: '$150k+', from: 150000 },
                ],
              },
            },
          },
        },
      });

      return {
        employmentTypes: result.body.aggregations.employment_types.buckets,
        experienceLevels: result.body.aggregations.experience_levels.buckets,
        remoteOptions: result.body.aggregations.remote_options.buckets,
        topSkills: result.body.aggregations.top_skills.buckets,
        salaryRanges: result.body.aggregations.salary_ranges.buckets,
      };
    } catch (error) {
      console.error('Error getting job facets:', error);
      throw error;
    }
  }

  async bulkIndexJobs(jobs: any[]) {
    const body = jobs.flatMap((job) => [
      { index: { _index: 'jobs', _id: job.job_id } },
      {
        job_id: job.job_id,
        title: job.title,
        description: job.description,
        requirements: job.requirements,
        company_name: job.company_name,
        city: job.city,
        state: job.state,
        country: job.country,
        remote_option: job.remote_option,
        employment_type: job.employment_type,
        experience_level: job.experience_level,
        salary_min: job.salary_min,
        salary_max: job.salary_max,
        salary_currency: job.salary_currency,
        skills: job.skills,
        status: job.status,
        created_at: job.created_at,
        updated_at: job.updated_at,
      },
    ]);

    try {
      const result = await client.bulk({ body });

      if (result.body.errors) {
        console.error('Bulk indexing errors:', result.body.items.filter((item: any) => item.index.error));
      }

      await client.indices.refresh({ index: 'jobs' });
      console.log(`Bulk indexed ${jobs.length} jobs`);
    } catch (error) {
      console.error('Error bulk indexing jobs:', error);
      throw error;
    }
  }
}

export const openSearchService = new OpenSearchService();
```

#### Day 3: Update Job Service to Index Jobs

**Modify Job Service** (`backend/services/job-service/src/controllers/job.controller.ts`):
```typescript
import { openSearchService } from '@jobgraph/common/services/opensearch.service';

export class JobController {
  async createJob(req: Request, res: Response) {
    // ... existing job creation logic

    const job = await jobService.createJob(data);

    // Index job in OpenSearch
    await openSearchService.indexJob({
      job_id: job.job_id,
      title: job.title,
      description: job.description,
      requirements: job.requirements,
      company_name: company.name,
      city: job.city,
      state: job.state,
      country: job.country,
      remote_option: job.remote_option,
      employment_type: job.employment_type,
      experience_level: job.experience_level,
      salary_min: job.salary_min,
      salary_max: job.salary_max,
      salary_currency: job.salary_currency,
      skills: jobSkills.map((s) => s.skill_name),
      status: job.status,
      created_at: job.created_at,
      updated_at: job.updated_at,
    });

    res.status(201).json(successResponse(job));
  }

  async updateJob(req: Request, res: Response) {
    // ... existing update logic

    const updatedJob = await jobService.updateJob(jobId, updates);

    // Update in OpenSearch
    await openSearchService.updateJob(jobId, {
      title: updatedJob.title,
      description: updatedJob.description,
      requirements: updatedJob.requirements,
      status: updatedJob.status,
      updated_at: updatedJob.updated_at,
      // ... other updated fields
    });

    res.json(successResponse(updatedJob));
  }

  async deleteJob(req: Request, res: Response) {
    // ... existing delete logic

    await jobService.deleteJob(jobId);

    // Remove from OpenSearch
    await openSearchService.deleteJob(jobId);

    res.status(204).send();
  }
}
```

#### Day 4: Create Search API Endpoint

**Add Search Routes** (`backend/services/job-service/src/routes/search.routes.ts`):
```typescript
import { Router } from 'express';
import { SearchController } from '../controllers/search.controller';

const router = Router();
const searchController = new SearchController();

router.get('/search', searchController.searchJobs);
router.get('/search/autocomplete/skills', searchController.autocompleteSkills);
router.get('/search/facets', searchController.getJobFacets);

export default router;
```

**Search Controller** (`backend/services/job-service/src/controllers/search.controller.ts`):
```typescript
import { Request, Response } from 'express';
import { openSearchService } from '@jobgraph/common/services/opensearch.service';
import { successResponse } from '@jobgraph/common/utils';

export class SearchController {
  async searchJobs(req: Request, res: Response) {
    try {
      const result = await openSearchService.searchJobs(req.query);
      res.json(successResponse(result.jobs, result.pagination));
    } catch (error) {
      console.error('Search error:', error);
      res.status(500).json({ error: 'Search failed' });
    }
  }

  async autocompleteSkills(req: Request, res: Response) {
    const { prefix, limit } = req.query;

    if (!prefix || typeof prefix !== 'string') {
      return res.status(400).json({ error: 'Prefix required' });
    }

    try {
      const skills = await openSearchService.autocompleteSkills(
        prefix,
        limit ? parseInt(limit as string) : 10
      );
      res.json(successResponse(skills));
    } catch (error) {
      console.error('Autocomplete error:', error);
      res.status(500).json({ error: 'Autocomplete failed' });
    }
  }

  async getJobFacets(req: Request, res: Response) {
    try {
      const facets = await openSearchService.getJobFacets();
      res.json(successResponse(facets));
    } catch (error) {
      console.error('Facets error:', error);
      res.status(500).json({ error: 'Failed to get facets' });
    }
  }
}
```

#### Day 5: Backfill Existing Jobs

**Create Backfill Script** (`scripts/backfill-opensearch.ts`):
```typescript
import { pool } from '../backend/common/src/database';
import { openSearchService } from '../backend/common/src/services/opensearch.service';

async function backfillJobs() {
  console.log('Starting OpenSearch backfill...');

  // Create index
  await openSearchService.createJobsIndex();

  // Get all active jobs
  const result = await pool.query(`
    SELECT
      j.*,
      c.name as company_name,
      COALESCE(
        (SELECT json_agg(s.name)
         FROM job_skills js
         JOIN skills s ON js.skill_id = s.skill_id
         WHERE js.job_id = j.job_id),
        '[]'::json
      ) as skills
    FROM jobs j
    JOIN companies c ON j.company_id = c.company_id
    WHERE j.status = 'active'
  `);

  console.log(`Found ${result.rows.length} jobs to index`);

  // Bulk index
  await openSearchService.bulkIndexJobs(result.rows);

  console.log('Backfill complete!');
  process.exit(0);
}

backfillJobs();
```

Run the backfill:
```bash
cd backend
npx ts-node ../scripts/backfill-opensearch.ts
```

---

### Week 20: Search Frontend

#### Day 1-3: Job Search Page

**Create Search Page** (`frontend/src/pages/jobs/JobSearch.tsx`):
```typescript
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { jobService } from '../../services/job.service';
import { SearchIcon, FilterIcon, MapPinIcon, BriefcaseIcon, CurrencyDollarIcon } from '@heroicons/react/24/outline';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { JobCard } from '../../components/jobs/JobCard';
import { Pagination } from '../../components/common/Pagination';
import { SkillsMultiSelect } from '../../components/common/SkillsMultiSelect';

interface SearchFilters {
  location: string;
  remote: string;
  employmentType: string;
  experienceLevel: string;
  skills: string[];
  salaryMin: string;
  salaryMax: string;
}

export function JobSearch() {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [filters, setFilters] = useState<SearchFilters>({
    location: '',
    remote: '',
    employmentType: '',
    experienceLevel: '',
    skills: [],
    salaryMin: '',
    salaryMax: '',
  });
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      setPage(1); // Reset to first page on new search
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch jobs
  const { data, isLoading, error } = useQuery({
    queryKey: ['jobs', 'search', debouncedQuery, filters, page],
    queryFn: () =>
      jobService.searchJobs({
        q: debouncedQuery,
        ...filters,
        page,
      }),
  });

  // Fetch facets for filter options
  const { data: facets } = useQuery({
    queryKey: ['jobs', 'facets'],
    queryFn: () => jobService.getJobFacets(),
  });

  const handleFilterChange = (key: keyof SearchFilters, value: any) => {
    setFilters({ ...filters, [key]: value });
    setPage(1); // Reset to first page
  };

  const clearFilters = () => {
    setFilters({
      location: '',
      remote: '',
      employmentType: '',
      experienceLevel: '',
      skills: [],
      salaryMin: '',
      salaryMax: '',
    });
    setPage(1);
  };

  const hasActiveFilters = Object.values(filters).some((v) =>
    Array.isArray(v) ? v.length > 0 : Boolean(v)
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Find Your Next Job</h1>
        <p className="text-lg text-gray-600">
          Search thousands of jobs matched to your skills
        </p>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by job title, skills, or company..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-6 py-3 border rounded-lg flex items-center gap-2 ${
              showFilters ? 'bg-blue-50 border-blue-500 text-blue-700' : 'border-gray-300 text-gray-700'
            }`}
          >
            <FilterIcon className="w-5 h-5" />
            Filters
            {hasActiveFilters && (
              <span className="ml-1 px-2 py-0.5 bg-blue-500 text-white text-xs rounded-full">
                {Object.values(filters).filter((v) => (Array.isArray(v) ? v.length > 0 : Boolean(v))).length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="mb-6 p-6 bg-gray-50 border border-gray-200 rounded-lg">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Filters</h3>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                Clear all
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Location */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Location
              </label>
              <div className="relative">
                <MapPinIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="City or state"
                  value={filters.location}
                  onChange={(e) => handleFilterChange('location', e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>

            {/* Remote Option */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Remote Work
              </label>
              <select
                value={filters.remote}
                onChange={(e) => handleFilterChange('remote', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">All Options</option>
                <option value="remote">Remote Only</option>
                <option value="hybrid">Hybrid</option>
                <option value="onsite">On-site</option>
              </select>
            </div>

            {/* Employment Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Employment Type
              </label>
              <select
                value={filters.employmentType}
                onChange={(e) => handleFilterChange('employmentType', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">All Types</option>
                {facets?.employmentTypes?.map((type: any) => (
                  <option key={type.key} value={type.key}>
                    {type.key.charAt(0).toUpperCase() + type.key.slice(1)} ({type.doc_count})
                  </option>
                ))}
              </select>
            </div>

            {/* Experience Level */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Experience Level
              </label>
              <select
                value={filters.experienceLevel}
                onChange={(e) => handleFilterChange('experienceLevel', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">All Levels</option>
                {facets?.experienceLevels?.map((level: any) => (
                  <option key={level.key} value={level.key}>
                    {level.key.charAt(0).toUpperCase() + level.key.slice(1)} ({level.doc_count})
                  </option>
                ))}
              </select>
            </div>

            {/* Skills */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Skills
              </label>
              <SkillsMultiSelect
                value={filters.skills}
                onChange={(skills) => handleFilterChange('skills', skills)}
                placeholder="Search and select skills..."
              />
            </div>

            {/* Salary Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Min Salary
              </label>
              <div className="relative">
                <CurrencyDollarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="number"
                  placeholder="50,000"
                  value={filters.salaryMin}
                  onChange={(e) => handleFilterChange('salaryMin', e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Max Salary
              </label>
              <div className="relative">
                <CurrencyDollarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="number"
                  placeholder="150,000"
                  value={filters.salaryMax}
                  onChange={(e) => handleFilterChange('salaryMax', e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {isLoading ? (
        <div className="flex justify-center items-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-red-600">Failed to load jobs. Please try again.</p>
        </div>
      ) : data?.data?.length === 0 ? (
        <div className="text-center py-12">
          <BriefcaseIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No jobs found</h3>
          <p className="text-gray-600">
            Try adjusting your search or filters to find more results.
          </p>
        </div>
      ) : (
        <>
          {/* Results Header */}
          <div className="flex justify-between items-center mb-4">
            <p className="text-gray-600">
              <span className="font-semibold">{data.pagination.total}</span> jobs found
            </p>
          </div>

          {/* Job Cards */}
          <div className="space-y-4 mb-6">
            {data.data.map((job: any) => (
              <JobCard key={job.job_id} job={job} showHighlight={Boolean(debouncedQuery)} />
            ))}
          </div>

          {/* Pagination */}
          {data.pagination.pages > 1 && (
            <Pagination
              currentPage={page}
              totalPages={data.pagination.pages}
              onPageChange={setPage}
            />
          )}
        </>
      )}
    </div>
  );
}
```

#### Day 4: Skills Autocomplete Component

**Skills Multi-Select** (`frontend/src/components/common/SkillsMultiSelect.tsx`):
```typescript
import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { jobService } from '../../services/job.service';
import { XMarkIcon } from '@heroicons/react/24/solid';

interface SkillsMultiSelectProps {
  value: string[];
  onChange: (skills: string[]) => void;
  placeholder?: string;
}

export function SkillsMultiSelect({ value, onChange, placeholder }: SkillsMultiSelectProps) {
  const [inputValue, setInputValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const { data: suggestions } = useQuery({
    queryKey: ['skills', 'autocomplete', inputValue],
    queryFn: () => jobService.autocompleteSkills(inputValue),
    enabled: inputValue.length >= 2,
  });

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (skill: string) => {
    if (!value.includes(skill)) {
      onChange([...value, skill]);
    }
    setInputValue('');
    setIsOpen(false);
  };

  const handleRemove = (skill: string) => {
    onChange(value.filter((s) => s !== skill));
  };

  return (
    <div ref={wrapperRef} className="relative">
      {/* Selected Skills */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {value.map((skill) => (
            <span
              key={skill}
              className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm"
            >
              {skill}
              <button
                onClick={() => handleRemove(skill)}
                className="hover:bg-blue-200 rounded-full p-0.5"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Input */}
      <input
        type="text"
        value={inputValue}
        onChange={(e) => {
          setInputValue(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder || 'Type to search skills...'}
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />

      {/* Dropdown */}
      {isOpen && suggestions && suggestions.data.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {suggestions.data.map((skill: string) => (
            <button
              key={skill}
              onClick={() => handleSelect(skill)}
              disabled={value.includes(skill)}
              className={`w-full px-4 py-2 text-left hover:bg-gray-50 ${
                value.includes(skill) ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {skill}
              {value.includes(skill) && (
                <span className="ml-2 text-xs text-gray-500">(already selected)</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

#### Day 5: Job Card with Highlights

**Job Card Component** (`frontend/src/components/jobs/JobCard.tsx`):
```typescript
import { Link } from 'react-router-dom';
import { MapPinIcon, BriefcaseIcon, CurrencyDollarIcon, ClockIcon } from '@heroicons/react/24/outline';
import { formatDistanceToNow } from 'date-fns';

interface JobCardProps {
  job: any;
  showHighlight?: boolean;
}

export function JobCard({ job, showHighlight }: JobCardProps) {
  const formatSalary = () => {
    if (!job.salary_min && !job.salary_max) return 'Salary not disclosed';

    const format = (amount: number) =>
      new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: job.salary_currency || 'USD',
        maximumFractionDigits: 0,
      }).format(amount);

    if (job.salary_min && job.salary_max) {
      return `${format(job.salary_min)} - ${format(job.salary_max)}`;
    } else if (job.salary_min) {
      return `From ${format(job.salary_min)}`;
    } else {
      return `Up to ${format(job.salary_max)}`;
    }
  };

  const renderHighlightedText = (text: string | undefined, highlights: any) => {
    if (!showHighlight || !highlights || !text) return text;

    // If we have highlights for this field, use them
    const highlightedFragments = highlights[0];
    if (highlightedFragments) {
      return <span dangerouslySetInnerHTML={{ __html: highlightedFragments }} />;
    }

    return text;
  };

  return (
    <Link
      to={`/jobs/${job.job_id}`}
      className="block bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow"
    >
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <h3 className="text-xl font-semibold text-gray-900 mb-1">
            {renderHighlightedText(job.title, job.highlight?.title)}
          </h3>
          <p className="text-lg text-gray-700">{job.company_name}</p>
        </div>
        {job.score && (
          <div className="ml-4 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
            {Math.round(job.score * 10)}% match
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-4 mb-4 text-sm text-gray-600">
        {(job.city || job.state) && (
          <div className="flex items-center gap-1">
            <MapPinIcon className="w-4 h-4" />
            <span>
              {[job.city, job.state].filter(Boolean).join(', ')}
              {job.remote_option === 'remote' && ' (Remote)'}
            </span>
          </div>
        )}

        {job.employment_type && (
          <div className="flex items-center gap-1">
            <BriefcaseIcon className="w-4 h-4" />
            <span className="capitalize">{job.employment_type.replace('-', ' ')}</span>
          </div>
        )}

        <div className="flex items-center gap-1">
          <CurrencyDollarIcon className="w-4 h-4" />
          <span>{formatSalary()}</span>
        </div>

        {job.created_at && (
          <div className="flex items-center gap-1">
            <ClockIcon className="w-4 h-4" />
            <span>Posted {formatDistanceToNow(new Date(job.created_at))} ago</span>
          </div>
        )}
      </div>

      {job.description && (
        <p className="text-gray-700 mb-4 line-clamp-3">
          {showHighlight && job.highlight?.description
            ? renderHighlightedText(job.description, job.highlight.description)
            : job.description}
        </p>
      )}

      {job.skills && job.skills.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {job.skills.slice(0, 5).map((skill: string) => (
            <span
              key={skill}
              className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm"
            >
              {skill}
            </span>
          ))}
          {job.skills.length > 5 && (
            <span className="px-2 py-1 text-gray-500 text-sm">
              +{job.skills.length - 5} more
            </span>
          )}
        </div>
      )}
    </Link>
  );
}
```

---

## Week 21: Notifications & Emails (3.2)

### Day 1-2: AWS SES Setup

**Install AWS SES SDK**:
```bash
cd backend
npm install @aws-sdk/client-ses
```

**Create Email Service** (`backend/services/notification-service/src/services/email.service.ts`):
```typescript
import { SESClient, SendEmailCommand, SendTemplatedEmailCommand } from '@aws-sdk/client-ses';

const sesClient = new SESClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export class EmailService {
  private fromEmail = process.env.FROM_EMAIL || 'noreply@jobgraph.com';
  private frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  async sendEmail(to: string, subject: string, htmlBody: string, textBody?: string) {
    try {
      const command = new SendEmailCommand({
        Source: this.fromEmail,
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

      const result = await sesClient.send(command);
      console.log(`Email sent to ${to}: ${result.MessageId}`);
      return result;
    } catch (error) {
      console.error('Error sending email:', error);
      throw error;
    }
  }

  async sendWelcomeEmail(user: any) {
    const subject = 'Welcome to JobGraph!';
    const html = this.getWelcomeEmailTemplate(user);

    await this.sendEmail(user.email, subject, html);
  }

  async sendEmailVerification(user: any, verificationToken: string) {
    const subject = 'Verify your email address';
    const verificationUrl = `${this.frontendUrl}/verify-email?token=${verificationToken}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .button { display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: #ffffff; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 14px; color: #6b7280; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Verify your email address</h1>
          <p>Hi ${user.first_name},</p>
          <p>Thanks for signing up for JobGraph! Please verify your email address by clicking the button below:</p>
          <a href="${verificationUrl}" class="button">Verify Email Address</a>
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #3b82f6;">${verificationUrl}</p>
          <p>This link will expire in 24 hours.</p>
          <div class="footer">
            <p>If you didn't create a JobGraph account, you can safely ignore this email.</p>
            <p>&copy; ${new Date().getFullYear()} JobGraph. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await this.sendEmail(user.email, subject, html);
  }

  async sendNewMatchNotification(user: any, job: any, matchScore: number) {
    const subject = `New Job Match: ${job.title}`;
    const jobUrl = `${this.frontendUrl}/jobs/${job.job_id}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .match-score { font-size: 32px; font-weight: bold; color: #10b981; margin: 20px 0; }
          .job-details { background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .button { display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: #ffffff; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 14px; color: #6b7280; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🎯 You've been matched to a new job!</h1>
          <div class="match-score">${matchScore.toFixed(1)}% Match</div>

          <div class="job-details">
            <h2>${job.title}</h2>
            <p><strong>Company:</strong> ${job.company_name}</p>
            <p><strong>Location:</strong> ${[job.city, job.state].filter(Boolean).join(', ')}
              ${job.remote_option === 'remote' ? ' (Remote)' : ''}</p>
            ${job.salary_min && job.salary_max ? `
              <p><strong>Salary:</strong> $${job.salary_min.toLocaleString()} - $${job.salary_max.toLocaleString()}</p>
            ` : ''}
            <p>${job.description.substring(0, 200)}...</p>
          </div>

          <a href="${jobUrl}" class="button">View Job Details</a>

          <div class="footer">
            <p>You can manage your job match notifications in your <a href="${this.frontendUrl}/settings">account settings</a>.</p>
            <p>&copy; ${new Date().getFullYear()} JobGraph. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await this.sendEmail(user.email, subject, html);
  }

  async sendInterviewReminderEmail(user: any, skill: any, interviewId: string) {
    const subject = `Complete Your ${skill.name} Interview`;
    const interviewUrl = `${this.frontendUrl}/interviews/${interviewId}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .button { display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: #ffffff; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .benefits { background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 14px; color: #6b7280; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Don't forget to complete your interview!</h1>
          <p>Hi ${user.first_name},</p>
          <p>You started an interview for <strong>${skill.name}</strong> but haven't finished it yet.</p>

          <div class="benefits">
            <h3>Complete your interview to:</h3>
            <ul>
              <li>✅ Get matched to relevant jobs</li>
              <li>📊 See your skill percentile ranking</li>
              <li>💡 Receive personalized feedback</li>
              <li>🎯 Improve your match scores</li>
            </ul>
          </div>

          <a href="${interviewUrl}" class="button">Complete Interview</a>

          <div class="footer">
            <p>Interview expires in 7 days. Don't miss out on job opportunities!</p>
            <p>&copy; ${new Date().getFullYear()} JobGraph. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await this.sendEmail(user.email, subject, html);
  }

  async sendEmployerContactNotification(candidate: any, job: any, employer: any) {
    const subject = `An employer is interested in you!`;
    const matchesUrl = `${this.frontendUrl}/candidate/job-matches`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .highlight { background-color: #dbeafe; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .button { display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: #ffffff; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 14px; color: #6b7280; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🎉 Great news!</h1>
          <p>Hi ${candidate.first_name},</p>

          <div class="highlight">
            <p><strong>${employer.first_name} ${employer.last_name}</strong> from <strong>${job.company_name}</strong>
            has viewed your profile and is interested in your application for <strong>${job.title}</strong>.</p>
          </div>

          <p>They may reach out to you soon for the next steps. Make sure your profile is up to date!</p>

          <a href="${matchesUrl}" class="button">View Your Matches</a>

          <div class="footer">
            <p>Keep your skills updated and complete more interviews to get better matches.</p>
            <p>&copy; ${new Date().getFullYear()} JobGraph. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await this.sendEmail(candidate.email, subject, html);
  }

  async sendPasswordResetEmail(user: any, resetToken: string) {
    const subject = 'Reset your password';
    const resetUrl = `${this.frontendUrl}/reset-password?token=${resetToken}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .button { display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: #ffffff; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .warning { background-color: #fef3c7; padding: 15px; border-left: 4px solid #f59e0b; margin: 20px 0; }
          .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 14px; color: #6b7280; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Reset your password</h1>
          <p>Hi ${user.first_name},</p>
          <p>We received a request to reset your password. Click the button below to choose a new password:</p>

          <a href="${resetUrl}" class="button">Reset Password</a>

          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #3b82f6;">${resetUrl}</p>

          <div class="warning">
            <strong>⚠️ Security Notice:</strong> This link will expire in 1 hour. If you didn't request a password reset, please ignore this email.
          </div>

          <div class="footer">
            <p>For security, we never ask for your password via email.</p>
            <p>&copy; ${new Date().getFullYear()} JobGraph. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await this.sendEmail(user.email, subject, html);
  }

  private getWelcomeEmailTemplate(user: any): string {
    const profileUrl = `${this.frontendUrl}/${user.role}/profile`;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #3b82f6 0%, #1e40af 100%); color: white; padding: 40px 20px; border-radius: 8px 8px 0 0; text-align: center; }
          .content { background-color: #ffffff; padding: 30px 20px; }
          .button { display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: #ffffff; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .steps { background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .step { margin: 15px 0; }
          .step-number { display: inline-block; width: 30px; height: 30px; background-color: #3b82f6; color: white; border-radius: 50%; text-align: center; line-height: 30px; margin-right: 10px; }
          .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 14px; color: #6b7280; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to JobGraph! 🎉</h1>
          </div>
          <div class="content">
            <p>Hi ${user.first_name},</p>
            <p>We're excited to have you join JobGraph, the skills-based job matching platform where your abilities shine!</p>

            <div class="steps">
              <h3>Get started in 4 easy steps:</h3>

              ${user.role === 'candidate' ? `
                <div class="step">
                  <span class="step-number">1</span>
                  <strong>Complete your profile</strong> - Add your education and work experience
                </div>
                <div class="step">
                  <span class="step-number">2</span>
                  <strong>Upload your resume</strong> - We'll auto-fill your information
                </div>
                <div class="step">
                  <span class="step-number">3</span>
                  <strong>Take skill interviews</strong> - Showcase your expertise
                </div>
                <div class="step">
                  <span class="step-number">4</span>
                  <strong>Get matched</strong> - Receive job recommendations based on your skills
                </div>
              ` : `
                <div class="step">
                  <span class="step-number">1</span>
                  <strong>Create your company profile</strong> - Tell candidates about your company
                </div>
                <div class="step">
                  <span class="step-number">2</span>
                  <strong>Post your first job</strong> - Define required skills and thresholds
                </div>
                <div class="step">
                  <span class="step-number">3</span>
                  <strong>Calculate matches</strong> - Our AI finds the best candidates
                </div>
                <div class="step">
                  <span class="step-number">4</span>
                  <strong>Contact top candidates</strong> - Reach out to highly-matched talent
                </div>
              `}
            </div>

            <div style="text-align: center;">
              <a href="${profileUrl}" class="button">Get Started Now</a>
            </div>

            <p>If you have any questions, feel free to reply to this email or check out our <a href="${this.frontendUrl}/help">Help Center</a>.</p>

            <p>Happy ${user.role === 'candidate' ? 'job hunting' : 'hiring'}!</p>
            <p>The JobGraph Team</p>
          </div>

          <div class="footer">
            <p>You're receiving this email because you signed up for JobGraph.</p>
            <p>&copy; ${new Date().getFullYear()} JobGraph. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private stripHtml(html: string): string {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim();
  }
}

export const emailService = new EmailService();
```

### Day 3-4: In-App Notifications

**Notification Service** (`backend/services/notification-service/src/services/notification.service.ts`):
```typescript
import { pool } from '@jobgraph/common/database';
import { AppError } from '@jobgraph/common/utils';
import { emailService } from './email.service';

export class NotificationService {
  async createNotification(
    userId: string,
    type: string,
    title: string,
    message: string,
    link?: string,
    metadata?: any
  ) {
    try {
      const result = await pool.query(
        `INSERT INTO notifications (user_id, type, title, message, link, metadata)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [userId, type, title, message, link, metadata ? JSON.stringify(metadata) : null]
      );

      return result.rows[0];
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  }

  async getUserNotifications(userId: string, options: { unreadOnly?: boolean; limit?: number; offset?: number } = {}) {
    const { unreadOnly = false, limit = 50, offset = 0 } = options;

    let query = `
      SELECT * FROM notifications
      WHERE user_id = $1
    `;

    const params: any[] = [userId];

    if (unreadOnly) {
      query += ' AND read = false';
    }

    query += ' ORDER BY created_at DESC LIMIT $2 OFFSET $3';
    params.push(limit, offset);

    try {
      const result = await pool.query(query, params);
      return result.rows;
    } catch (error) {
      console.error('Error getting notifications:', error);
      throw error;
    }
  }

  async markAsRead(notificationId: string, userId: string) {
    try {
      const result = await pool.query(
        'UPDATE notifications SET read = true, read_at = NOW() WHERE notification_id = $1 AND user_id = $2 RETURNING *',
        [notificationId, userId]
      );

      if (result.rows.length === 0) {
        throw new AppError(404, 'NOTIFICATION_NOT_FOUND', 'Notification not found');
      }

      return result.rows[0];
    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  }

  async markAllAsRead(userId: string) {
    try {
      await pool.query(
        'UPDATE notifications SET read = true, read_at = NOW() WHERE user_id = $1 AND read = false',
        [userId]
      );
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      throw error;
    }
  }

  async getUnreadCount(userId: string): Promise<number> {
    try {
      const result = await pool.query(
        'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND read = false',
        [userId]
      );

      return parseInt(result.rows[0].count);
    } catch (error) {
      console.error('Error getting unread count:', error);
      throw error;
    }
  }

  async deleteNotification(notificationId: string, userId: string) {
    try {
      const result = await pool.query(
        'DELETE FROM notifications WHERE notification_id = $1 AND user_id = $2 RETURNING *',
        [notificationId, userId]
      );

      if (result.rows.length === 0) {
        throw new AppError(404, 'NOTIFICATION_NOT_FOUND', 'Notification not found');
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
      throw error;
    }
  }

  // Convenience methods for common notifications

  async notifyNewMatch(userId: string, jobId: string, matchScore: number) {
    // Get user and job details
    const userResult = await pool.query('SELECT * FROM users WHERE user_id = $1', [userId]);
    const jobResult = await pool.query(`
      SELECT j.*, c.name as company_name
      FROM jobs j
      JOIN companies c ON j.company_id = c.company_id
      WHERE j.job_id = $1
    `, [jobId]);

    if (userResult.rows.length === 0 || jobResult.rows.length === 0) {
      return;
    }

    const user = userResult.rows[0];
    const job = jobResult.rows[0];

    // Create in-app notification
    await this.createNotification(
      userId,
      'new_match',
      'New Job Match!',
      `You've been matched to ${job.title} at ${job.company_name} with ${matchScore.toFixed(1)}% compatibility`,
      `/jobs/${jobId}`,
      { jobId, matchScore }
    );

    // Send email notification (async, don't wait)
    emailService.sendNewMatchNotification(user, job, matchScore).catch((err) =>
      console.error('Error sending match email:', err)
    );
  }

  async notifyEmployerContact(candidateId: string, jobId: string, employerId: string) {
    // Get candidate, job, and employer details
    const candidateResult = await pool.query('SELECT * FROM users WHERE user_id = $1', [candidateId]);
    const jobResult = await pool.query(`
      SELECT j.*, c.name as company_name
      FROM jobs j
      JOIN companies c ON j.company_id = c.company_id
      WHERE j.job_id = $1
    `, [jobId]);
    const employerResult = await pool.query('SELECT * FROM users WHERE user_id = $1', [employerId]);

    if (candidateResult.rows.length === 0 || jobResult.rows.length === 0 || employerResult.rows.length === 0) {
      return;
    }

    const candidate = candidateResult.rows[0];
    const job = jobResult.rows[0];
    const employer = employerResult.rows[0];

    // Create in-app notification
    await this.createNotification(
      candidateId,
      'employer_contact',
      'Employer Interest',
      `${job.company_name} has viewed your profile and is interested in your application for ${job.title}`,
      `/candidate/job-matches`,
      { jobId, employerId }
    );

    // Send email notification
    emailService.sendEmployerContactNotification(candidate, job, employer).catch((err) =>
      console.error('Error sending contact email:', err)
    );
  }

  async notifyInterviewCompleted(userId: string, skillId: string, score: number, percentile: number) {
    const skillResult = await pool.query('SELECT name FROM skills WHERE skill_id = $1', [skillId]);

    if (skillResult.rows.length === 0) {
      return;
    }

    const skillName = skillResult.rows[0].name;

    await this.createNotification(
      userId,
      'interview_completed',
      'Interview Completed!',
      `You scored ${score.toFixed(1)}/100 on your ${skillName} interview (top ${100 - percentile}%)`,
      `/candidate/skills`,
      { skillId, score, percentile }
    );
  }

  async notifyApplicationStatusChange(userId: string, jobId: string, newStatus: string) {
    const jobResult = await pool.query(`
      SELECT j.title, c.name as company_name
      FROM jobs j
      JOIN companies c ON j.company_id = c.company_id
      WHERE j.job_id = $1
    `, [jobId]);

    if (jobResult.rows.length === 0) {
      return;
    }

    const job = jobResult.rows[0];

    const statusMessages: Record<string, string> = {
      under_review: 'is now under review',
      interviewing: 'has moved to the interview stage',
      accepted: 'has been accepted! 🎉',
      rejected: 'was not selected',
    };

    const message = statusMessages[newStatus] || `status has been updated to ${newStatus}`;

    await this.createNotification(
      userId,
      'application_status',
      'Application Update',
      `Your application for ${job.title} at ${job.company_name} ${message}`,
      `/candidate/applications`,
      { jobId, status: newStatus }
    );
  }
}

export const notificationService = new NotificationService();
```

### Day 5: Notification Frontend

**Notification Bell Component** (`frontend/src/components/layout/NotificationBell.tsx`):
```typescript
import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { BellIcon } from '@heroicons/react/24/outline';
import { notificationService } from '../../services/notification.service';
import { formatDistanceToNow } from 'date-fns';

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Get unread count
  const { data: unreadCount } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => notificationService.getUnreadCount(),
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Get notifications
  const { data: notifications, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationService.getNotifications({ limit: 10 }),
    enabled: isOpen, // Only fetch when dropdown is open
  });

  // Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: (id: string) => notificationService.markAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
    },
  });

  // Mark all as read mutation
  const markAllAsReadMutation = useMutation({
    mutationFn: () => notificationService.markAllAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
    },
  });

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNotificationClick = (notification: any) => {
    if (!notification.read) {
      markAsReadMutation.mutate(notification.notification_id);
    }

    if (notification.link) {
      navigate(notification.link);
    }

    setIsOpen(false);
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'new_match':
        return '🎯';
      case 'employer_contact':
        return '💼';
      case 'interview_completed':
        return '✅';
      case 'application_status':
        return '📬';
      default:
        return '🔔';
    }
  };

  return (
    <div ref={wrapperRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg"
      >
        <BellIcon className="w-6 h-6" />
        {unreadCount && unreadCount.data > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount.data > 9 ? '9+' : unreadCount.data}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-white shadow-lg rounded-lg border border-gray-200 z-50 max-h-[500px] flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-gray-200 flex justify-between items-center">
            <h3 className="font-semibold text-gray-900">Notifications</h3>
            {unreadCount && unreadCount.data > 0 && (
              <button
                onClick={() => markAllAsReadMutation.mutate()}
                className="text-sm text-blue-600 hover:text-blue-700"
                disabled={markAllAsReadMutation.isPending}
              >
                Mark all as read
              </button>
            )}
          </div>

          {/* Notifications List */}
          <div className="overflow-y-auto flex-1">
            {isLoading ? (
              <div className="p-8 text-center text-gray-500">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
              </div>
            ) : notifications && notifications.data.length > 0 ? (
              notifications.data.map((notification: any) => (
                <div
                  key={notification.notification_id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors ${
                    !notification.read ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="flex gap-3">
                    <div className="text-2xl flex-shrink-0">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-sm mb-1">
                        {notification.title}
                      </p>
                      <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                        {notification.message}
                      </p>
                      <p className="text-xs text-gray-400">
                        {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    {!notification.read && (
                      <div className="flex-shrink-0">
                        <span className="inline-block w-2 h-2 bg-blue-500 rounded-full"></span>
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-gray-500">
                <BellIcon className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>No notifications yet</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-gray-200">
            <button
              onClick={() => {
                navigate('/notifications');
                setIsOpen(false);
              }}
              className="w-full text-center text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              View all notifications
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

**Add to Navbar** (`frontend/src/components/layout/Navbar.tsx`):
```typescript
import { NotificationBell } from './NotificationBell';

// In the navbar component, add after user profile:
<NotificationBell />
```

---

## Week 22: Analytics Dashboard (3.3)

[Content continues with Analytics implementation...]

---

## Week 23: Enhanced Resume Parsing - AWS Textract (3.4)

[Content continues with Textract implementation...]

---

## Week 24-25: Profile & Employer Enhancements (3.5-3.6)

[Content continues with profile enhancements...]

---

## Week 26: Mobile App Foundation (3.7)

[Content continues with mobile app setup...]

---

## Phase 3 Success Criteria

### Functional Requirements
- [ ] Full-text job search with filters working
- [ ] Email notifications sent for all events
- [ ] In-app notifications system functional
- [ ] Analytics dashboards populated with real data
- [ ] Resume parsing with Textract extracts data accurately
- [ ] Profile enhancements (photos, LinkedIn) complete
- [ ] Employer team management functional
- [ ] Mobile app core features working

### Technical Requirements
- [ ] OpenSearch cluster running and indexed
- [ ] SES configured and sending emails
- [ ] Notification service operational
- [ ] Analytics queries optimized
- [ ] Textract integration working
- [ ] 100+ active users in system
- [ ] All Phase 3 features tested

### Performance Metrics
- [ ] Search results return < 500ms
- [ ] Email delivery rate > 95%
- [ ] Notification delivery < 1 second
- [ ] Analytics dashboard loads < 2 seconds
- [ ] Resume parsing < 10 seconds
- [ ] Mobile app loads < 3 seconds

---

## Next Steps

Once Phase 3 is complete, the platform is ready for **Phase 4: AWS Infrastructure & Production Deployment**.