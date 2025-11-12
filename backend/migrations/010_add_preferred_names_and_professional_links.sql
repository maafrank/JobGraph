-- Migration 010: Add preferred names and professional links table
-- Purpose: Better contact info management and flexible professional links

-- Add preferred name fields to users table
ALTER TABLE users
ADD COLUMN preferred_first_name VARCHAR(100),
ADD COLUMN preferred_last_name VARCHAR(100);

-- Create professional_links table (similar to education/work_experience)
-- This replaces the individual linkedin_url, portfolio_url, github_url columns
CREATE TABLE professional_links (
    link_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID NOT NULL REFERENCES candidate_profiles(profile_id) ON DELETE CASCADE,
    link_type VARCHAR(50) NOT NULL CHECK (link_type IN ('linkedin', 'github', 'portfolio', 'website', 'twitter', 'other')),
    url VARCHAR(500) NOT NULL,
    label VARCHAR(100), -- Optional custom label like "Personal Blog", "Design Portfolio", etc.
    display_order INTEGER DEFAULT 0, -- For sorting
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_professional_links_profile_id ON professional_links(profile_id);
CREATE INDEX idx_professional_links_type ON professional_links(link_type);

-- Add comments for documentation
COMMENT ON COLUMN users.preferred_first_name IS 'Name candidate prefers to go by (optional)';
COMMENT ON COLUMN users.preferred_last_name IS 'Last name candidate prefers to use (optional)';
COMMENT ON TABLE professional_links IS 'Professional URLs (LinkedIn, GitHub, portfolio, etc.) for candidates';
COMMENT ON COLUMN professional_links.link_type IS 'Type of link: linkedin, github, portfolio, website, twitter, other';
COMMENT ON COLUMN professional_links.label IS 'Optional custom label for the link';
COMMENT ON COLUMN professional_links.display_order IS 'Order to display links (lower numbers first)';

-- Migrate existing data from candidate_profiles to professional_links
INSERT INTO professional_links (profile_id, link_type, url, display_order)
SELECT profile_id, 'linkedin', linkedin_url, 1
FROM candidate_profiles
WHERE linkedin_url IS NOT NULL;

INSERT INTO professional_links (profile_id, link_type, url, display_order)
SELECT profile_id, 'portfolio', portfolio_url, 2
FROM candidate_profiles
WHERE portfolio_url IS NOT NULL;

INSERT INTO professional_links (profile_id, link_type, url, display_order)
SELECT profile_id, 'github', github_url, 3
FROM candidate_profiles
WHERE github_url IS NOT NULL;

-- Note: We'll keep the linkedin_url, portfolio_url, github_url columns in candidate_profiles
-- for backward compatibility during transition, but they're deprecated
-- Future phase can remove them after confirming all apps use professional_links
