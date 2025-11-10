-- JobGraph Database Schema (PostgreSQL)
-- This schema supports the skills-based job matching platform

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- USERS & AUTHENTICATION
-- ============================================================================

CREATE TABLE users (
    user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    role VARCHAR(20) NOT NULL CHECK (role IN ('candidate', 'employer', 'admin')),
    email_verified BOOLEAN DEFAULT FALSE,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- ============================================================================
-- CANDIDATE PROFILES
-- ============================================================================

CREATE TABLE candidate_profiles (
    profile_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    headline VARCHAR(200),
    summary TEXT,
    years_experience INTEGER,
    resume_url VARCHAR(500),
    resume_parsed_data JSONB, -- Store parsed resume data
    city VARCHAR(100),
    state VARCHAR(100),
    country VARCHAR(100),
    willing_to_relocate BOOLEAN DEFAULT FALSE,
    remote_preference VARCHAR(20) CHECK (remote_preference IN ('remote', 'hybrid', 'onsite', 'flexible')),
    profile_visibility VARCHAR(20) DEFAULT 'public' CHECK (profile_visibility IN ('public', 'private', 'anonymous')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_candidate_profiles_user_id ON candidate_profiles(user_id);
CREATE INDEX idx_candidate_profiles_location ON candidate_profiles(city, state, country);

-- Education history
CREATE TABLE education (
    education_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID NOT NULL REFERENCES candidate_profiles(profile_id) ON DELETE CASCADE,
    degree VARCHAR(100) NOT NULL,
    field_of_study VARCHAR(100),
    institution VARCHAR(200) NOT NULL,
    graduation_year INTEGER,
    gpa DECIMAL(3, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_education_profile_id ON education(profile_id);

-- Work experience
CREATE TABLE work_experience (
    experience_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID NOT NULL REFERENCES candidate_profiles(profile_id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    company VARCHAR(200) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    is_current BOOLEAN DEFAULT FALSE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_work_experience_profile_id ON work_experience(profile_id);

-- Follow-up questions for candidates
CREATE TABLE follow_up_questions (
    question_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    question_type VARCHAR(50) NOT NULL,
    triggered_by VARCHAR(100), -- e.g., "resume_gap", "skill_clarification"
    answer TEXT,
    answered_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_follow_up_questions_user_id ON follow_up_questions(user_id);

-- ============================================================================
-- COMPANIES
-- ============================================================================

CREATE TABLE companies (
    company_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) UNIQUE NOT NULL,
    description TEXT,
    website VARCHAR(255),
    logo_url VARCHAR(500),
    industry VARCHAR(100),
    company_size VARCHAR(50) CHECK (company_size IN ('1-10', '11-50', '51-200', '201-500', '501-1000', '1000+')),
    city VARCHAR(100),
    state VARCHAR(100),
    country VARCHAR(100),
    verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_companies_name ON companies(name);
CREATE INDEX idx_companies_verified ON companies(verified);

-- Company users (employers)
CREATE TABLE company_users (
    company_user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(company_id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL CHECK (role IN ('owner', 'admin', 'recruiter', 'hiring_manager')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, company_id)
);

CREATE INDEX idx_company_users_user_id ON company_users(user_id);
CREATE INDEX idx_company_users_company_id ON company_users(company_id);

-- ============================================================================
-- SKILLS
-- ============================================================================

CREATE TABLE skills (
    skill_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    category VARCHAR(50) NOT NULL, -- 'programming', 'data_science', 'finance', etc.
    description TEXT,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_skills_category ON skills(category);
CREATE INDEX idx_skills_active ON skills(active);
CREATE INDEX idx_skills_name ON skills(name);

-- ============================================================================
-- INTERVIEWS
-- ============================================================================

-- Interview templates per skill
CREATE TABLE interview_templates (
    template_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    skill_id UUID NOT NULL REFERENCES skills(skill_id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    difficulty_level VARCHAR(20) CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced')),
    duration_minutes INTEGER NOT NULL,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_interview_templates_skill_id ON interview_templates(skill_id);

-- Question bank
CREATE TABLE questions (
    question_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_id UUID NOT NULL REFERENCES interview_templates(template_id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    question_type VARCHAR(50) NOT NULL CHECK (question_type IN ('multiple_choice', 'coding', 'open_ended', 'true_false')),
    difficulty VARCHAR(20) CHECK (difficulty IN ('easy', 'medium', 'hard')),
    points INTEGER NOT NULL DEFAULT 10,
    options JSONB, -- For multiple choice: {"A": "option1", "B": "option2", ...}
    correct_answer TEXT, -- For objective questions
    evaluation_rubric TEXT, -- For AI-evaluated questions
    test_cases JSONB, -- For coding questions
    time_limit_seconds INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_questions_template_id ON questions(template_id);
CREATE INDEX idx_questions_type ON questions(question_type);

-- User interviews
CREATE TABLE interviews (
    interview_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    skill_id UUID NOT NULL REFERENCES skills(skill_id) ON DELETE CASCADE,
    template_id UUID NOT NULL REFERENCES interview_templates(template_id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'expired', 'abandoned')),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    valid_until TIMESTAMP WITH TIME ZONE, -- Interviews expire after X months
    overall_score DECIMAL(5, 2), -- 0-100
    percentile DECIMAL(5, 2), -- Compared to all users who took this interview
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, skill_id) -- One interview per user per skill
);

CREATE INDEX idx_interviews_user_id ON interviews(user_id);
CREATE INDEX idx_interviews_skill_id ON interviews(skill_id);
CREATE INDEX idx_interviews_status ON interviews(status);

-- Interview responses
CREATE TABLE interview_responses (
    response_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    interview_id UUID NOT NULL REFERENCES interviews(interview_id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES questions(question_id) ON DELETE CASCADE,
    answer TEXT,
    score DECIMAL(5, 2), -- 0-100 for this question
    time_spent_seconds INTEGER,
    ai_feedback TEXT, -- Optional AI-generated feedback
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_interview_responses_interview_id ON interview_responses(interview_id);

-- AI evaluation details
CREATE TABLE interview_evaluations (
    evaluation_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    interview_id UUID UNIQUE NOT NULL REFERENCES interviews(interview_id) ON DELETE CASCADE,
    strengths TEXT[],
    weaknesses TEXT[],
    confidence_level DECIMAL(3, 2), -- 0-1
    detailed_feedback TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User skill scores (derived from interviews)
CREATE TABLE user_skill_scores (
    user_skill_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    skill_id UUID NOT NULL REFERENCES skills(skill_id) ON DELETE CASCADE,
    interview_id UUID NOT NULL REFERENCES interviews(interview_id) ON DELETE CASCADE,
    score DECIMAL(5, 2) NOT NULL, -- 0-100
    percentile DECIMAL(5, 2), -- 0-100
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    UNIQUE(user_id, skill_id)
);

CREATE INDEX idx_user_skill_scores_user_id ON user_skill_scores(user_id);
CREATE INDEX idx_user_skill_scores_skill_id ON user_skill_scores(skill_id);
CREATE INDEX idx_user_skill_scores_expires_at ON user_skill_scores(expires_at);

-- ============================================================================
-- JOB POSTINGS
-- ============================================================================

CREATE TABLE jobs (
    job_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(company_id) ON DELETE CASCADE,
    posted_by UUID NOT NULL REFERENCES users(user_id),
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    requirements TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    country VARCHAR(100),
    remote_option VARCHAR(20) CHECK (remote_option IN ('remote', 'hybrid', 'onsite', 'flexible')),
    salary_min INTEGER,
    salary_max INTEGER,
    salary_currency VARCHAR(3) DEFAULT 'USD',
    employment_type VARCHAR(50) CHECK (employment_type IN ('full-time', 'part-time', 'contract', 'internship')),
    experience_level VARCHAR(50) CHECK (experience_level IN ('entry', 'mid', 'senior', 'lead', 'executive')),
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'closed', 'cancelled')),
    views INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_jobs_company_id ON jobs(company_id);
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_location ON jobs(city, state, country);
CREATE INDEX idx_jobs_created_at ON jobs(created_at DESC);

-- Job required skills
CREATE TABLE job_skills (
    job_skill_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES jobs(job_id) ON DELETE CASCADE,
    skill_id UUID NOT NULL REFERENCES skills(skill_id) ON DELETE CASCADE,
    weight DECIMAL(3, 2) NOT NULL DEFAULT 1.0, -- 0-1, importance of this skill
    minimum_score DECIMAL(5, 2) NOT NULL DEFAULT 60.0, -- 0-100, threshold to qualify
    required BOOLEAN DEFAULT TRUE, -- Is this skill required or preferred?
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(job_id, skill_id)
);

CREATE INDEX idx_job_skills_job_id ON job_skills(job_id);
CREATE INDEX idx_job_skills_skill_id ON job_skills(skill_id);

-- ============================================================================
-- MATCHING & RANKING
-- ============================================================================

-- Job matches (candidate-job pairs)
CREATE TABLE job_matches (
    match_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES jobs(job_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    overall_score DECIMAL(5, 2) NOT NULL, -- 0-100
    match_rank INTEGER, -- Rank for this job (1 = best match)
    skill_breakdown JSONB NOT NULL, -- Detailed skill-by-skill breakdown
    status VARCHAR(20) DEFAULT 'matched' CHECK (status IN ('matched', 'viewed', 'contacted', 'shortlisted', 'rejected', 'hired')),
    viewed_at TIMESTAMP WITH TIME ZONE,
    contacted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(job_id, user_id)
);

CREATE INDEX idx_job_matches_job_id ON job_matches(job_id);
CREATE INDEX idx_job_matches_user_id ON job_matches(user_id);
CREATE INDEX idx_job_matches_score ON job_matches(overall_score DESC);
CREATE INDEX idx_job_matches_rank ON job_matches(job_id, match_rank);

-- ============================================================================
-- NOTIFICATIONS
-- ============================================================================

CREATE TABLE notifications (
    notification_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- 'new_match', 'interview_reminder', 'employer_contact', etc.
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    link VARCHAR(500), -- Deep link to relevant page
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(user_id, read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

-- ============================================================================
-- AUDIT & LOGGING
-- ============================================================================

CREATE TABLE audit_logs (
    log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(user_id),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID,
    changes JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_candidate_profiles_updated_at BEFORE UPDATE ON candidate_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_interview_templates_updated_at BEFORE UPDATE ON interview_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_jobs_updated_at BEFORE UPDATE ON jobs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_job_matches_updated_at BEFORE UPDATE ON job_matches
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- VIEWS
-- ============================================================================

-- View for active candidates with completed interviews
CREATE VIEW active_candidates AS
SELECT
    u.user_id,
    u.email,
    u.first_name,
    u.last_name,
    cp.headline,
    cp.years_experience,
    cp.city,
    cp.state,
    cp.country,
    COUNT(DISTINCT uss.skill_id) as skills_count,
    AVG(uss.score) as average_skill_score
FROM users u
JOIN candidate_profiles cp ON u.user_id = cp.user_id
LEFT JOIN user_skill_scores uss ON u.user_id = uss.user_id AND uss.expires_at > CURRENT_TIMESTAMP
WHERE u.role = 'candidate' AND u.active = TRUE
GROUP BY u.user_id, u.email, u.first_name, u.last_name, cp.headline, cp.years_experience, cp.city, cp.state, cp.country;

-- View for active jobs with skill requirements
CREATE VIEW active_jobs_with_skills AS
SELECT
    j.job_id,
    j.title,
    j.company_id,
    c.name as company_name,
    j.city,
    j.state,
    j.remote_option,
    j.employment_type,
    j.salary_min,
    j.salary_max,
    j.created_at,
    j.expires_at,
    ARRAY_AGG(s.name) as required_skills
FROM jobs j
JOIN companies c ON j.company_id = c.company_id
LEFT JOIN job_skills js ON j.job_id = js.job_id
LEFT JOIN skills s ON js.skill_id = s.skill_id
WHERE j.status = 'active'
GROUP BY j.job_id, j.title, j.company_id, c.name, j.city, j.state, j.remote_option, j.employment_type, j.salary_min, j.salary_max, j.created_at, j.expires_at;

-- ============================================================================
-- SAMPLE DATA INSERTS (for development/testing)
-- ============================================================================

-- Sample skills
INSERT INTO skills (name, category, description) VALUES
    ('Python', 'programming', 'Python programming language'),
    ('Machine Learning', 'data_science', 'Machine learning algorithms and frameworks'),
    ('Prompt Engineering', 'ai', 'Creating effective prompts for LLMs'),
    ('Data Engineering', 'data_science', 'Building data pipelines and infrastructure'),
    ('Financial Analysis', 'finance', 'Analyzing financial data and markets'),
    ('SQL', 'programming', 'Structured Query Language for databases'),
    ('React', 'programming', 'React JavaScript library'),
    ('AWS', 'cloud', 'Amazon Web Services cloud platform');

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Full-text search on jobs
CREATE INDEX idx_jobs_fulltext ON jobs USING gin(to_tsvector('english', title || ' ' || description));

-- Composite index for matching algorithm
CREATE INDEX idx_user_skill_scores_composite ON user_skill_scores(skill_id, score DESC, expires_at);

-- Index for job matching queries
CREATE INDEX idx_job_skills_composite ON job_skills(skill_id, minimum_score, weight);
