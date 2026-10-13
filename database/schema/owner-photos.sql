-- Owner photos and photo reports (Phase 5 of the October 2026 photo audit).
-- A place photo that is not from Wikimedia Commons is published only with a recorded permission: who granted it,
-- for which business, under which licence text, when, through which channel, with a private copy of the evidence
-- and the SHA-256 of the exact file shown. Revoking or expiring a permission takes the photo down.

CREATE TABLE IF NOT EXISTS public.mt_photo_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id bigint NOT NULL REFERENCES public.mt_places(id) ON DELETE CASCADE,
  -- 'permission': the owner granted it. 'attestation': an administrator checked a source's licence and vouches for it.
  basis text NOT NULL CHECK (basis IN ('permission','attestation')),
  grantor_name text NOT NULL CHECK (char_length(grantor_name) BETWEEN 1 AND 200),
  grantor_role text CHECK (char_length(grantor_role) <= 120),
  business text CHECK (char_length(business) <= 200),
  licence_version text NOT NULL CHECK (char_length(licence_version) BETWEEN 1 AND 100),
  file_sha256 text NOT NULL CHECK (file_sha256 ~ '^[0-9a-f]{64}$'),
  image_path text NOT NULL CHECK (image_path ~ '^places/[0-9]+-[0-9a-f-]{36}\.jpg$'),
  evidence_path text CHECK (evidence_path ~ '^evidence/[0-9a-f-]{36}\.(jpg|png|pdf)$'),
  channel text NOT NULL CHECK (channel IN ('email','letter','form','in_person','message','source_site')),
  granted_on date NOT NULL,
  expires_on date CHECK (expires_on IS NULL OR expires_on > granted_on),
  revoked_at timestamptz,
  recorded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mt_photo_permissions_place ON public.mt_photo_permissions(place_id);
CREATE INDEX IF NOT EXISTS mt_photo_permissions_expiring ON public.mt_photo_permissions(expires_on) WHERE revoked_at IS NULL AND expires_on IS NOT NULL;

-- Notice-and-action (EU Digital Services Act, article 16): anyone can report a photo; administrators review it.
CREATE TABLE IF NOT EXISTS public.mt_photo_reports (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  place_id bigint NOT NULL REFERENCES public.mt_places(id) ON DELETE CASCADE,
  image text NOT NULL CHECK (char_length(image) <= 2000),
  reason text NOT NULL CHECK (reason IN ('not_this_place','copyright','privacy','offensive','other')),
  details text CHECK (char_length(details) <= 1000),
  contact text CHECK (char_length(contact) <= 200),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','dismissed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS mt_photo_reports_open ON public.mt_photo_reports(created_at) WHERE status = 'open';

-- Private moderation records: the API writes them with the service role; only administrators can read them.
ALTER TABLE public.mt_photo_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mt_photo_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mt_photo_permissions,public.mt_photo_reports FROM anon,authenticated;
GRANT SELECT ON public.mt_photo_permissions,public.mt_photo_reports TO authenticated;
GRANT ALL ON public.mt_photo_permissions,public.mt_photo_reports TO service_role;
DROP POLICY IF EXISTS mt_photo_permissions_admin ON public.mt_photo_permissions;
CREATE POLICY mt_photo_permissions_admin ON public.mt_photo_permissions FOR SELECT TO authenticated USING ((SELECT public.mt_is_admin()));
DROP POLICY IF EXISTS mt_photo_reports_admin ON public.mt_photo_reports;
CREATE POLICY mt_photo_reports_admin ON public.mt_photo_reports FOR SELECT TO authenticated USING ((SELECT public.mt_is_admin()));

-- Place photos are public and written only by the service role; evidence stays private.
-- Supabase Storage is absent from isolated PostgreSQL tests; its API is tested separately.
DO $$ BEGIN
 IF to_regclass('storage.buckets') IS NOT NULL THEN
  INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES('mt-place-photos','mt-place-photos',true,2097152,ARRAY['image/jpeg']) ON CONFLICT(id) DO NOTHING;
  INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES('mt-photo-evidence','mt-photo-evidence',false,4194304,ARRAY['image/jpeg','image/png','application/pdf']) ON CONFLICT(id) DO NOTHING;
 END IF;
END; $$;
