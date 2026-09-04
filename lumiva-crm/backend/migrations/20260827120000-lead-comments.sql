-- Rich comments on leads (mentions/likes/replies), same shape as Project.comments.
ALTER TABLE leads ADD COLUMN IF NOT EXISTS comments JSONB;
