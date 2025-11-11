-- Phase 1 MVP Migration: Make interview_id nullable in user_skill_scores
-- This allows manual skill score entry without requiring an interview
-- In Phase 2, when we implement real interviews, interview_id will be populated

-- Drop the foreign key constraint
ALTER TABLE user_skill_scores
DROP CONSTRAINT IF EXISTS user_skill_scores_interview_id_fkey;

-- Make interview_id nullable
ALTER TABLE user_skill_scores
ALTER COLUMN interview_id DROP NOT NULL;

-- Re-add the foreign key constraint (now allows NULL)
ALTER TABLE user_skill_scores
ADD CONSTRAINT user_skill_scores_interview_id_fkey
FOREIGN KEY (interview_id) REFERENCES interviews(interview_id) ON DELETE CASCADE;

-- Note: NULL interview_id indicates manual entry in Phase 1
-- In Phase 2, all new skill scores will have a valid interview_id
