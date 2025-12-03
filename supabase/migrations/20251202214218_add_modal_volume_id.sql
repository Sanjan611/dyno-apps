-- Add modal_volume_id column to projects table for Modal Volume persistence
ALTER TABLE public.projects ADD COLUMN modal_volume_id text;

