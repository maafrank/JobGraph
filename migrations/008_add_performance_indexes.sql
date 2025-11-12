-- Migration 008: Add Performance Indexes
-- This migration adds critical indexes identified in PERFORMANCE_ANALYSIS.md
-- Expected impact: 20-100x performance improvement on critical queries

BEGIN;

-- ============================================================================
-- P0 CRITICAL INDEXES
-- ============================================================================

-- 1. Job Applications Lookup Optimization
-- Used in: getJobCandidates() - LEFT JOIN on EVERY employer page load
-- Impact: 100x faster (5,000ms → 50ms with 100K applications)
-- Query: SELECT ... FROM job_matches jm LEFT JOIN job_applications ja
--        ON jm.job_id = ja.job_id AND jm.user_id = ja.user_id
CREATE INDEX IF NOT EXISTS idx_job_applications_job_user
ON job_applications(job_id, user_id);

-- 2. User Skill Scores with Expiry Check
-- Used in: browseJobsWithScores() - Called on EVERY candidate dashboard load
-- Impact: 50x faster (500ms → 10ms with 1M skill scores)
-- Query: SELECT ... FROM user_skill_scores WHERE user_id = $1 AND expires_at > NOW()
-- Note: Composite index on user_id and expires_at for efficient filtering
CREATE INDEX IF NOT EXISTS idx_user_skill_scores_user_expires
ON user_skill_scores(user_id, expires_at);

-- 3. Active Jobs Sorted by Date
-- Used in: getJobs() - Public job listing page
-- Impact: 20x faster (2,000ms → 100ms), enables index-only scan
-- Query: SELECT ... FROM jobs WHERE status = 'active' ORDER BY created_at DESC
-- Note: Partial index only includes active jobs, DESC for sort optimization
CREATE INDEX IF NOT EXISTS idx_jobs_status_created
ON jobs(status, created_at DESC)
WHERE status = 'active';

-- ============================================================================
-- P1 HIGH-VALUE INDEXES
-- ============================================================================

-- 4. Job Skills Lookup with Covering Index
-- Used in: Matching algorithm - Frequently joined table
-- Impact: Eliminates table lookups by including columns in index
-- Query: SELECT weight, minimum_score, required FROM job_skills
--        WHERE job_id = $1 AND skill_id = $2
-- Note: INCLUDE clause adds columns to index without being part of search key
CREATE INDEX IF NOT EXISTS idx_job_skills_job_skill_include
ON job_skills(job_id, skill_id)
INCLUDE (weight, minimum_score, required);

-- 5. Composite User-Skill Lookup for Matching
-- Used in: calculateJobMatches() - Finding candidate skills efficiently
-- Impact: Faster skill score lookups during matching
-- Query: SELECT score FROM user_skill_scores
--        WHERE user_id = $1 AND skill_id = $2 AND expires_at > NOW()
-- Note: Three-column composite for precise lookups
CREATE INDEX IF NOT EXISTS idx_user_skill_scores_user_skill_valid
ON user_skill_scores(user_id, skill_id, expires_at);

-- 6. Job Matches Status Filtering
-- Used in: Employer views candidates with status filters
-- Impact: Faster filtering by match status
-- Query: SELECT ... FROM job_matches WHERE job_id = $1 AND status = $2
CREATE INDEX IF NOT EXISTS idx_job_matches_job_status
ON job_matches(job_id, status);

-- 7. Application Status Filtering for Candidates
-- Used in: My Applications page with status filters
-- Impact: Faster filtering of applications by status
-- Query: SELECT ... FROM job_applications WHERE user_id = $1 AND status = $2
CREATE INDEX IF NOT EXISTS idx_job_applications_user_status
ON job_applications(user_id, status);

-- ============================================================================
-- QUERY OPTIMIZATION NOTES
-- ============================================================================

-- To verify index usage after migration, run:
-- EXPLAIN ANALYZE SELECT ... [your query here]
--
-- Look for:
-- - "Index Scan" or "Index Only Scan" (GOOD - using index)
-- - "Seq Scan" (BAD - full table scan)
-- - "Bitmap Index Scan" (OK - partial index usage)
--
-- Example:
-- EXPLAIN ANALYZE
-- SELECT * FROM job_applications
-- WHERE job_id = 'some-uuid' AND user_id = 'some-uuid';
--
-- Should show: "Index Scan using idx_job_applications_job_user"

COMMIT;

-- ============================================================================
-- MIGRATION VERIFICATION QUERIES
-- ============================================================================

-- Run these after migration to verify indexes were created:

-- List all indexes on job_applications
-- SELECT indexname, indexdef FROM pg_indexes
-- WHERE tablename = 'job_applications' ORDER BY indexname;

-- List all indexes on user_skill_scores
-- SELECT indexname, indexdef FROM pg_indexes
-- WHERE tablename = 'user_skill_scores' ORDER BY indexname;

-- List all indexes on jobs
-- SELECT indexname, indexdef FROM pg_indexes
-- WHERE tablename = 'jobs' ORDER BY indexname;

-- List all indexes on job_skills
-- SELECT indexname, indexdef FROM pg_indexes
-- WHERE tablename = 'job_skills' ORDER BY indexname;

-- Check index sizes
-- SELECT
--     schemaname,
--     tablename,
--     indexname,
--     pg_size_pretty(pg_relation_size(indexname::regclass)) as index_size
-- FROM pg_indexes
-- WHERE schemaname = 'public'
-- ORDER BY pg_relation_size(indexname::regclass) DESC;
