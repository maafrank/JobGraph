-- Migration 007: Add Job Applications Table
-- This enables candidates to apply to jobs and tracks application status

BEGIN;

-- Job Applications Table
-- Tracks candidate-initiated applications to jobs
-- Separate from job_matches which are employer-calculated matches
CREATE TABLE job_applications (
    application_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES jobs(job_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,

    -- Application content (both optional)
    cover_letter TEXT,
    resume_url VARCHAR(500), -- Can override profile resume
    custom_responses JSONB, -- For future custom questions per job

    -- Status tracking
    status VARCHAR(20) DEFAULT 'submitted' CHECK (status IN
        ('submitted', 'under_review', 'interviewing', 'rejected', 'withdrawn', 'accepted')),

    -- Timestamps
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP WITH TIME ZONE, -- When employer first viewed
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- One application per user per job
    UNIQUE(job_id, user_id)
);

-- Indexes for performance
CREATE INDEX idx_job_applications_job_id ON job_applications(job_id);
CREATE INDEX idx_job_applications_user_id ON job_applications(user_id);
CREATE INDEX idx_job_applications_status ON job_applications(status);
CREATE INDEX idx_job_applications_applied_at ON job_applications(applied_at DESC);

-- Auto-update updated_at timestamp
CREATE TRIGGER update_job_applications_updated_at BEFORE UPDATE ON job_applications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMIT;
