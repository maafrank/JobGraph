-- Migration: Add Resume Upload and Parsing Tables
-- Description: Adds support for resume upload (BYTEA storage), parsing, auto-fill suggestions, and employer sharing
-- Phase: Phase 1 - File Upload & Resume Parsing
-- Date: 2025-11-11

-- ============================================================================
-- Table 1: user_documents
-- Stores uploaded files (resumes, cover letters, certificates) with BYTEA storage
-- ============================================================================

CREATE TABLE user_documents (
  document_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(user_id) ON DELETE CASCADE NOT NULL,

  -- Document metadata
  document_type VARCHAR(50) NOT NULL,  -- 'resume', 'cover_letter', 'certificate'
  file_name VARCHAR(255) NOT NULL,
  file_size INTEGER NOT NULL,  -- bytes
  mime_type VARCHAR(100) NOT NULL,  -- 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'

  -- File storage (BYTEA approach for Phase 1)
  file_data BYTEA NOT NULL,  -- Actual file binary data

  -- Version management
  is_current BOOLEAN DEFAULT true,  -- Latest version flag
  version INTEGER DEFAULT 1,

  -- Processing status
  upload_status VARCHAR(50) DEFAULT 'pending',  -- 'pending', 'processing', 'completed', 'failed'
  processing_error TEXT,  -- Error message if parsing failed

  -- Timestamps
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,  -- When parsing completed
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Future S3 migration fields (nullable for Phase 1)
  s3_key VARCHAR(500),  -- Will be used in Phase 4
  s3_bucket VARCHAR(100),  -- Will be used in Phase 4

  -- Constraints
  CONSTRAINT valid_document_type CHECK (document_type IN ('resume', 'cover_letter', 'certificate')),
  CONSTRAINT valid_upload_status CHECK (upload_status IN ('pending', 'processing', 'completed', 'failed'))
);

-- Indexes for performance
CREATE INDEX idx_user_documents_user_id ON user_documents(user_id);
CREATE INDEX idx_user_documents_current ON user_documents(user_id, is_current) WHERE is_current = true;
CREATE INDEX idx_user_documents_type ON user_documents(user_id, document_type);
CREATE INDEX idx_user_documents_status ON user_documents(upload_status) WHERE upload_status IN ('pending', 'processing');

-- Ensure only one current resume per user per document type
CREATE UNIQUE INDEX idx_user_documents_current_unique
  ON user_documents(user_id, document_type)
  WHERE is_current = true;

-- Comment on table
COMMENT ON TABLE user_documents IS 'Stores uploaded documents (resumes, cover letters) with BYTEA storage for Phase 1, S3 migration planned for Phase 4';
COMMENT ON COLUMN user_documents.file_data IS 'Binary file data stored in PostgreSQL (Phase 1). Will be NULL after S3 migration (Phase 4)';
COMMENT ON COLUMN user_documents.is_current IS 'Flag to mark the latest version of a document. Only one current document per type per user';

-- ============================================================================
-- Table 2: resume_parsed_data
-- Stores extracted structured data from resumes
-- ============================================================================

CREATE TABLE resume_parsed_data (
  parsed_data_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES user_documents(document_id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES users(user_id) ON DELETE CASCADE NOT NULL,

  -- Extracted structured data (JSONB for flexibility)
  contact_info JSONB,  -- {email, phone, linkedin, github, website, city, state, country}
  summary TEXT,  -- Professional summary/objective
  skills JSONB,  -- [{skill_name, proficiency, years_experience, confidence}]
  education JSONB,  -- [{degree, field_of_study, institution, graduation_year, gpa, confidence}]
  work_experience JSONB,  -- [{title, company, start_date, end_date, is_current, description, skills_used, confidence}]
  certifications JSONB,  -- [{name, issuer, date_obtained, expiration_date, credential_id, confidence}]

  -- Raw extracted text (for reference and keyword matching)
  raw_text TEXT,

  -- Parsing metadata
  parser_used VARCHAR(50) NOT NULL,  -- 'pdf-parse', 'mammoth', 'textract', 'manual'
  confidence_score DECIMAL(3,2),  -- Overall confidence 0.00 - 1.00
  parsing_errors JSONB,  -- [{field, error, details}]

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint: one parsed data per document
  UNIQUE(document_id)
);

-- Indexes for performance
CREATE INDEX idx_resume_parsed_data_user_id ON resume_parsed_data(user_id);
CREATE INDEX idx_resume_parsed_data_document_id ON resume_parsed_data(document_id);

-- GIN indexes for JSONB searching (enables efficient searches within JSONB fields)
CREATE INDEX idx_resume_parsed_skills ON resume_parsed_data USING GIN (skills);
CREATE INDEX idx_resume_parsed_education ON resume_parsed_data USING GIN (education);
CREATE INDEX idx_resume_parsed_experience ON resume_parsed_data USING GIN (work_experience);

-- Comment on table
COMMENT ON TABLE resume_parsed_data IS 'Stores structured data extracted from resumes using pdf-parse, mammoth, or other parsers';
COMMENT ON COLUMN resume_parsed_data.raw_text IS 'Full text extracted from resume, used for keyword matching and search';
COMMENT ON COLUMN resume_parsed_data.confidence_score IS 'Overall parsing confidence (0.00-1.00). Higher scores indicate more reliable extraction';

-- ============================================================================
-- Table 3: resume_autofill_suggestions
-- Stores auto-fill suggestions from parsed data
-- ============================================================================

CREATE TABLE resume_autofill_suggestions (
  suggestion_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(user_id) ON DELETE CASCADE NOT NULL,
  document_id UUID REFERENCES user_documents(document_id) ON DELETE CASCADE NOT NULL,

  -- Suggestion details
  suggestion_type VARCHAR(50) NOT NULL,  -- 'basic_info', 'education', 'work_experience', 'skills', 'certifications'
  suggested_data JSONB NOT NULL,  -- Actual data to apply
  target_table VARCHAR(50),  -- 'candidate_profiles', 'education', 'work_experience', 'user_skill_scores'
  target_record_id UUID,  -- If updating existing record (NULL for new records)

  -- Status tracking
  status VARCHAR(50) DEFAULT 'pending',  -- 'pending', 'accepted', 'rejected', 'applied'
  confidence DECIMAL(3,2),  -- Confidence score 0.00 - 1.00

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  applied_at TIMESTAMPTZ,  -- When user accepted suggestion

  -- Constraints
  CONSTRAINT valid_suggestion_type CHECK (suggestion_type IN ('basic_info', 'education', 'work_experience', 'skills', 'certifications')),
  CONSTRAINT valid_suggestion_status CHECK (status IN ('pending', 'accepted', 'rejected', 'applied'))
);

-- Indexes for performance
CREATE INDEX idx_resume_suggestions_user_id ON resume_autofill_suggestions(user_id);
CREATE INDEX idx_resume_suggestions_status ON resume_autofill_suggestions(user_id, status) WHERE status = 'pending';
CREATE INDEX idx_resume_suggestions_document ON resume_autofill_suggestions(document_id);
CREATE INDEX idx_resume_suggestions_type ON resume_autofill_suggestions(user_id, suggestion_type);

-- Comment on table
COMMENT ON TABLE resume_autofill_suggestions IS 'Stores auto-fill suggestions generated from parsed resume data. Users can accept or reject suggestions';
COMMENT ON COLUMN resume_autofill_suggestions.suggested_data IS 'JSONB containing the data to be applied (field names, values, etc.)';
COMMENT ON COLUMN resume_autofill_suggestions.target_table IS 'The database table where this suggestion would be applied if accepted';

-- ============================================================================
-- Table 4: resume_shares
-- Privacy-controlled resume sharing with employers
-- ============================================================================

CREATE TABLE resume_shares (
  share_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES user_documents(document_id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES users(user_id) ON DELETE CASCADE NOT NULL,  -- Candidate

  -- Sharing scope
  shared_with_company_id UUID REFERENCES companies(company_id) ON DELETE CASCADE NOT NULL,
  shared_for_job_id UUID REFERENCES jobs(job_id) ON DELETE CASCADE,  -- Optional: specific job

  -- Access control
  share_status VARCHAR(50) DEFAULT 'active',  -- 'active', 'revoked', 'expired'
  access_count INTEGER DEFAULT 0,  -- Track how many times downloaded
  last_accessed_at TIMESTAMPTZ,

  -- Expiration
  expires_at TIMESTAMPTZ,  -- Auto-expire after X days

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,

  -- Constraints
  CONSTRAINT valid_share_status CHECK (share_status IN ('active', 'revoked', 'expired')),

  -- Prevent duplicate shares for same document/company/job combination
  UNIQUE(document_id, shared_with_company_id, shared_for_job_id)
);

-- Indexes for performance
CREATE INDEX idx_resume_shares_user ON resume_shares(user_id);
CREATE INDEX idx_resume_shares_company ON resume_shares(shared_with_company_id);
CREATE INDEX idx_resume_shares_job ON resume_shares(shared_for_job_id) WHERE shared_for_job_id IS NOT NULL;
CREATE INDEX idx_resume_shares_active ON resume_shares(user_id, share_status) WHERE share_status = 'active';
CREATE INDEX idx_resume_shares_expires ON resume_shares(expires_at) WHERE share_status = 'active';

-- Comment on table
COMMENT ON TABLE resume_shares IS 'Controls privacy for resume sharing with employers. Resumes are only accessible to companies with active shares';
COMMENT ON COLUMN resume_shares.expires_at IS 'Resume access automatically expires at this timestamp. Typically set to job close date or 30 days';
COMMENT ON COLUMN resume_shares.access_count IS 'Tracks how many times employer downloaded/viewed the resume';

-- ============================================================================
-- Grants (ensure proper permissions)
-- ============================================================================

-- Grant permissions to application user (assuming 'jobgraph_app' user)
-- Adjust if your database user is different
GRANT SELECT, INSERT, UPDATE, DELETE ON user_documents TO jobgraph_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON resume_parsed_data TO jobgraph_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON resume_autofill_suggestions TO jobgraph_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON resume_shares TO jobgraph_app;

-- ============================================================================
-- Migration Complete
-- ============================================================================

-- Verify tables created
SELECT 'Migration 004: Resume upload tables created successfully' AS status;
SELECT 'Tables created: user_documents, resume_parsed_data, resume_autofill_suggestions, resume_shares' AS details;
