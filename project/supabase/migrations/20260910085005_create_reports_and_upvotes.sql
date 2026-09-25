/*
# Create reports and upvotes tables for Road Complaint Platform

1. New Tables

- `reports`
  - `id` (uuid, primary key, auto-generated)
  - `category` (enum: pothole, broken_road, waterlogging, signage, streetlight, other)
  - `description` (text, raw user description of the road issue)
  - `ai_draft` (text, AI-generated formal grievance text)
  - `severity` (enum: low, medium, high — AI-assigned)
  - `department_suggested` (text, e.g. "MoRTH", "State PWD", "Municipal Corporation")
  - `latitude` (numeric, not null)
  - `longitude` (numeric, not null)
  - `address` (text, human-readable location)
  - `photo_url` (text, nullable — path to uploaded photo in storage)
  - `status` (enum: submitted_locally, filed_on_portal, resolved)
  - `grievance_ref_number` (text, nullable — user-entered after filing on official portal)
  - `upvotes` (integer, default 0 — denormalized count for fast reads)
  - `session_id` (text, not null — anonymous session identifier)
  - `created_at` (timestamptz, default now())
  - `updated_at` (timestamptz, default now())

- `upvotes`
  - `id` (uuid, primary key)
  - `report_id` (uuid, foreign key to reports, ON DELETE CASCADE)
  - `session_id` (text, not null — which session upvoted)
  - `created_at` (timestamptz, default now())
  - UNIQUE constraint on (report_id, session_id) to prevent duplicate upvotes

2. Enums

- `report_category`: pothole, broken_road, waterlogging, signage, streetlight, other
- `report_severity`: low, medium, high
- `report_status`: submitted_locally, filed_on_portal, resolved

3. Indexes

- `idx_reports_category` on reports(category) for category filtering
- `idx_reports_status` on reports(status) for status filtering
- `idx_reports_created_at` on reports(created_at DESC) for chronological listing
- `idx_reports_location` on reports(latitude, longitude) for bounding box queries
- `idx_upvotes_report_session` UNIQUE index on upvotes(report_id, session_id)

4. Security (RLS)

This is a single-tenant public app — no sign-in required. Citizens report anonymously via session ID.
All policies use `TO anon, authenticated` with `USING (true)` / `WITH CHECK (true)` because all data
is intentionally public/shared (anyone can see all reports, anyone can submit reports).

Reports:
- SELECT: anon + authenticated can read all reports (public dashboard)
- INSERT: anon + authenticated can create reports (anonymous submission)
- UPDATE: anon + authenticated can update report status / add grievance ref number
- DELETE: anon + authenticated can delete reports

Upvotes:
- SELECT: anon + authenticated can read all upvotes
- INSERT: anon + authenticated can add upvotes
- DELETE: anon + authenticated can remove upvotes (for toggle behavior)

5. Storage

A public storage bucket `report-photos` is created for road issue photos.
Storage policies allow anon + authenticated to upload and read photos.
*/

-- Create enums
DO $$ BEGIN
  CREATE TYPE report_category AS ENUM ('pothole', 'broken_road', 'waterlogging', 'signage', 'streetlight', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE report_severity AS ENUM ('low', 'medium', 'high');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE report_status AS ENUM ('submitted_locally', 'filed_on_portal', 'resolved');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Create reports table
CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category report_category NOT NULL DEFAULT 'other',
  description text NOT NULL,
  ai_draft text,
  severity report_severity DEFAULT 'low',
  department_suggested text,
  latitude numeric NOT NULL,
  longitude numeric NOT NULL,
  address text,
  photo_url text,
  status report_status NOT NULL DEFAULT 'submitted_locally',
  grievance_ref_number text,
  upvotes integer NOT NULL DEFAULT 0,
  session_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create upvotes table
CREATE TABLE IF NOT EXISTS upvotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  session_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(report_id, session_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_reports_category ON reports(category);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_location ON reports(latitude, longitude);

-- Enable RLS
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE upvotes ENABLE ROW LEVEL SECURITY;

-- Reports policies
DROP POLICY IF EXISTS "anon_select_reports" ON reports;
CREATE POLICY "anon_select_reports" ON reports FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_reports" ON reports;
CREATE POLICY "anon_insert_reports" ON reports FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_reports" ON reports;
CREATE POLICY "anon_update_reports" ON reports FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_reports" ON reports;
CREATE POLICY "anon_delete_reports" ON reports FOR DELETE
  TO anon, authenticated USING (true);

-- Upvotes policies
DROP POLICY IF EXISTS "anon_select_upvotes" ON upvotes;
CREATE POLICY "anon_select_upvotes" ON upvotes FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_upvotes" ON upvotes;
CREATE POLICY "anon_insert_upvotes" ON upvotes FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_upvotes" ON upvotes;
CREATE POLICY "anon_delete_upvotes" ON upvotes FOR DELETE
  TO anon, authenticated USING (true);

-- Create storage bucket for report photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('report-photos', 'report-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for report-photos bucket
DROP POLICY IF EXISTS "anon_upload_report_photos" ON storage.objects;
CREATE POLICY "anon_upload_report_photos" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'report-photos');

DROP POLICY IF EXISTS "anon_read_report_photos" ON storage.objects;
CREATE POLICY "anon_read_report_photos" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'report-photos');

-- Function to auto-increment/decrement upvotes count on reports
CREATE OR REPLACE FUNCTION update_report_upvote_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE reports SET upvotes = upvotes + 1 WHERE id = NEW.report_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE reports SET upvotes = upvotes - 1 WHERE id = OLD.report_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_upvote_count ON upvotes;
CREATE TRIGGER trigger_upvote_count
  AFTER INSERT OR DELETE ON upvotes
  FOR EACH ROW EXECUTE FUNCTION update_report_upvote_count();

-- Function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_reports_updated_at ON reports;
CREATE TRIGGER trigger_reports_updated_at
  BEFORE UPDATE ON reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();