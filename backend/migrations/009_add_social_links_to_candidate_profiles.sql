-- Migration 009: Add social links to candidate_profiles
-- Purpose: Enhanced candidate registration with LinkedIn, Portfolio, GitHub URLs

-- Add social link columns to candidate_profiles table
ALTER TABLE candidate_profiles
ADD COLUMN linkedin_url VARCHAR(255),
ADD COLUMN portfolio_url VARCHAR(255),
ADD COLUMN github_url VARCHAR(255);

-- Add indexes for better query performance
CREATE INDEX idx_candidate_profiles_linkedin ON candidate_profiles(linkedin_url) WHERE linkedin_url IS NOT NULL;
CREATE INDEX idx_candidate_profiles_portfolio ON candidate_profiles(portfolio_url) WHERE portfolio_url IS NOT NULL;
CREATE INDEX idx_candidate_profiles_github ON candidate_profiles(github_url) WHERE github_url IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN candidate_profiles.linkedin_url IS 'Candidate LinkedIn profile URL';
COMMENT ON COLUMN candidate_profiles.portfolio_url IS 'Candidate portfolio/personal website URL';
COMMENT ON COLUMN candidate_profiles.github_url IS 'Candidate GitHub profile URL';
