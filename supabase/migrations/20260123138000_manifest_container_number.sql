-- Add container tracking fields to manifests

ALTER TABLE public.manifests
ADD COLUMN IF NOT EXISTS container_number TEXT,
ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP WITH TIME ZONE;
