ALTER TABLE public.requests DROP CONSTRAINT IF EXISTS requests_status_check;
ALTER TABLE public.requests ADD CONSTRAINT requests_status_check CHECK (status IN ('pending', 'review', 'played', 'skipped'));
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS heard text;
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS confidence text;
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS candidate jsonb;