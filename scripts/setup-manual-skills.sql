-- Setup for manual skill entry in MVP (Phase 1)
-- Creates a special "Manual Entry" interview template and interview record
-- to satisfy foreign key constraints for user_skill_scores table

-- Create a special interview template for manual skill entry
-- This is a placeholder since Phase 1 doesn't have real interviews yet
INSERT INTO interview_templates (
    template_id,
    skill_id,
    name,
    description,
    difficulty_level,
    duration_minutes,
    active
) VALUES (
    '00000000-0000-0000-0000-000000000001',  -- Special UUID for manual entry template
    (SELECT skill_id FROM skills LIMIT 1),    -- Use first skill as placeholder
    'Manual Entry (MVP)',
    'Placeholder template for manual skill score entry in Phase 1 MVP',
    'beginner',
    0,
    FALSE  -- Not active since it's just a placeholder
) ON CONFLICT DO NOTHING;

-- Create a placeholder interview record for manual entries
-- All manual skill scores will reference this interview_id
INSERT INTO interviews (
    interview_id,
    user_id,
    skill_id,
    template_id,
    status,
    started_at,
    completed_at,
    valid_until
) VALUES (
    '00000000-0000-0000-0000-000000000000',  -- Special UUID for manual entry interview
    (SELECT user_id FROM users WHERE role = 'admin' LIMIT 1),  -- Use admin user as placeholder
    (SELECT skill_id FROM skills LIMIT 1),  -- Use first skill as placeholder
    '00000000-0000-0000-0000-000000000001', -- Reference template above
    'completed',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP + INTERVAL '100 years'  -- Far future date so it never expires
) ON CONFLICT DO NOTHING;

-- Note: In Phase 2, when we implement real interviews, we'll migrate away from this approach
