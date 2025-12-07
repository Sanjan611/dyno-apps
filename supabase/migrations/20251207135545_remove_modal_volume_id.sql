-- Remove modal_volume_id column from projects table
-- Modal Volumes are no longer used; projects now use in-memory sandbox storage

ALTER TABLE public.projects DROP COLUMN IF EXISTS modal_volume_id;
