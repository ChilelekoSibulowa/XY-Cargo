-- Add link and image_url columns to marketing_social_posts for Meta API publishing
ALTER TABLE marketing_social_posts
  ADD COLUMN IF NOT EXISTS link TEXT,
  ADD COLUMN IF NOT EXISTS image_url TEXT;
