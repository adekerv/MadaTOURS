CREATE TABLE IF NOT EXISTS public.mt_submission_photos (
 id uuid PRIMARY KEY,
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 path text NOT NULL UNIQUE,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(path ~ '^[a-f0-9-]{36}/[a-f0-9-]{36}\.jpg$')
);
CREATE INDEX IF NOT EXISTS mt_submission_photos_user_idx ON public.mt_submission_photos(user_id);
CREATE TABLE IF NOT EXISTS public.mt_submissions (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 photo_id uuid NOT NULL UNIQUE REFERENCES public.mt_submission_photos(id) ON DELETE CASCADE,
 name text NOT NULL CHECK(char_length(trim(name)) BETWEEN 3 AND 160),
 type text NOT NULL CHECK(type IN ('restaurant','activity','cultural')),
 lat double precision NOT NULL CHECK(lat BETWEEN 14.35 AND 14.95),
 lng double precision NOT NULL CHECK(lng BETWEEN -61.3 AND -60.75),
 address text NOT NULL CHECK(char_length(trim(address)) BETWEEN 5 AND 200),
 description text NOT NULL CHECK(char_length(trim(description)) BETWEEN 40 AND 3000),
 language text NOT NULL CHECK(language IN ('en','fr')),
 source_url text CHECK(source_url IS NULL OR (source_url LIKE 'https://%' AND char_length(source_url)<=1000)),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
 rejection_reason text,
 place_id bigint REFERENCES public.mt_places(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 decided_at timestamptz
);
CREATE INDEX IF NOT EXISTS mt_submissions_owner_idx ON public.mt_submissions(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS mt_submissions_queue_idx ON public.mt_submissions(status,created_at);
CREATE INDEX IF NOT EXISTS mt_submissions_place_idx ON public.mt_submissions(place_id);
CREATE TABLE IF NOT EXISTS public.mt_notifications (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 kind text NOT NULL CHECK(kind IN ('submission-approved','submission-rejected')),
 data jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 read_at timestamptz
);
CREATE INDEX IF NOT EXISTS mt_notifications_user_idx ON public.mt_notifications(user_id,created_at DESC);
CREATE TABLE IF NOT EXISTS public.mt_photo_deletions (
 path text PRIMARY KEY,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.mt_places ADD COLUMN IF NOT EXISTS submitted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS mt_places_submitter_idx ON public.mt_places(submitted_by);
CREATE OR REPLACE FUNCTION mt_private.queue_photo_deletion() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 INSERT INTO public.mt_photo_deletions(path) VALUES(OLD.path) ON CONFLICT DO NOTHING;
 UPDATE public.mt_places SET image=NULL,photo_credit=NULL WHERE image='/photos/community/'||OLD.id||'.jpg';
 RETURN NULL;
END; $$;
REVOKE ALL ON FUNCTION mt_private.queue_photo_deletion() FROM PUBLIC;
DROP TRIGGER IF EXISTS mt_photo_deleted ON public.mt_submission_photos;
CREATE TRIGGER mt_photo_deleted AFTER DELETE ON public.mt_submission_photos FOR EACH ROW EXECUTE FUNCTION mt_private.queue_photo_deletion();
CREATE OR REPLACE FUNCTION public.mt_submission_write(action text,payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor_id uuid; photo public.mt_submission_photos; submission public.mt_submissions; result jsonb; published_id bigint; author_name text;
BEGIN
 actor_id:=mt_private.actor('submissions',CASE WHEN action='create' THEN 3 ELSE 30 END);
 IF action='create' THEN
  SELECT * INTO photo FROM public.mt_submission_photos WHERE id=(payload->>'photoId')::uuid AND user_id=actor_id FOR UPDATE;
  IF NOT FOUND OR coalesce((payload->>'photoRights')::boolean,false)=false THEN RAISE EXCEPTION 'Owned photo required' USING ERRCODE='42501'; END IF;
  INSERT INTO public.mt_submissions(user_id,photo_id,name,type,lat,lng,address,description,language,source_url)
  VALUES(actor_id,photo.id,trim(payload->>'name'),payload->>'type',(payload->>'lat')::float8,(payload->>'lng')::float8,trim(payload->>'address'),trim(payload->>'description'),payload->>'language',nullif(payload->>'sourceUrl','')) RETURNING to_jsonb(mt_submissions.*) INTO result;
 ELSIF action IN ('approve','reject') THEN
  IF NOT public.mt_is_admin() THEN RAISE EXCEPTION 'Administrator required' USING ERRCODE='42501'; END IF;
  SELECT * INTO submission FROM public.mt_submissions WHERE id=(payload->>'id')::bigint AND status='pending' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Submission already reviewed' USING ERRCODE='22023'; END IF;
  IF action='reject' THEN
   IF coalesce(char_length(trim(payload->>'reason')),0) NOT BETWEEN 10 AND 1000 THEN RAISE EXCEPTION 'Rejection reason required' USING ERRCODE='22023'; END IF;
   UPDATE public.mt_submissions SET status='rejected',rejection_reason=trim(payload->>'reason'),decided_at=now() WHERE id=submission.id;
   INSERT INTO public.mt_notifications(user_id,kind,data) VALUES(submission.user_id,'submission-rejected',jsonb_build_object('submissionId',submission.id,'name',submission.name,'reason',trim(payload->>'reason')));
  ELSE
   IF coalesce(char_length(trim(payload->>'description')),0) NOT BETWEEN 40 AND 3000 OR coalesce(char_length(trim(payload->>'descriptionFr')),0) NOT BETWEEN 40 AND 3000 THEN RAISE EXCEPTION 'Both descriptions required' USING ERRCODE='22023'; END IF;
   SELECT display_name INTO author_name FROM public.mt_public_profiles WHERE user_id=submission.user_id;
   INSERT INTO public.mt_places(name,type,lat,lng,location,description,description_fr,tags,image,photo_credit,sources,submitted_by)
   VALUES(submission.name,CASE WHEN submission.type='restaurant' THEN 'restaurant' ELSE 'activity' END,submission.lat,submission.lng,left(submission.address,160),trim(payload->>'description'),trim(payload->>'descriptionFr'),CASE WHEN submission.type='cultural' THEN '["culture"]'::jsonb ELSE '[]'::jsonb END,'/photos/community/'||submission.photo_id||'.jpg',
    jsonb_build_object('author',author_name,'license','User contribution','sourceUrl',payload->>'origin'||'/photos/community/'||submission.photo_id||'.jpg','licenseUrl',payload->>'origin'||'/terms','caption','Submitted with permission'),
    CASE WHEN submission.source_url IS NULL THEN '[]'::jsonb ELSE jsonb_build_array(jsonb_build_object('url',submission.source_url,'title','Contributor source','checkedAt',current_date::text,'fields',jsonb_build_array('description','location'))) END,submission.user_id) RETURNING id INTO published_id;
   UPDATE public.mt_submissions SET status='approved',place_id=published_id,decided_at=now() WHERE id=submission.id;
   INSERT INTO public.mt_notifications(user_id,kind,data) VALUES(submission.user_id,'submission-approved',jsonb_build_object('submissionId',submission.id,'name',submission.name,'placeId',published_id));
  END IF;
 ELSIF action='read-notifications' THEN UPDATE public.mt_notifications SET read_at=now() WHERE user_id=actor_id AND read_at IS NULL;
 ELSE RAISE EXCEPTION 'Unknown submission action' USING ERRCODE='22023';
 END IF;
 RETURN coalesce(result,'{"success":true}'::jsonb);
END; $$;
REVOKE ALL ON FUNCTION public.mt_submission_write(text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.mt_submission_write(text,jsonb) TO authenticated;
ALTER TABLE public.mt_submission_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mt_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mt_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mt_photo_deletions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mt_submission_photos,public.mt_submissions,public.mt_notifications,public.mt_photo_deletions FROM anon,authenticated;
GRANT SELECT ON public.mt_submission_photos,public.mt_submissions,public.mt_notifications TO authenticated;
GRANT ALL ON public.mt_submission_photos,public.mt_submissions,public.mt_notifications,public.mt_photo_deletions TO service_role;
GRANT USAGE ON SEQUENCE public.mt_submissions_id_seq,public.mt_notifications_id_seq TO service_role;
DROP POLICY IF EXISTS mt_photo_owners ON public.mt_submission_photos;
CREATE POLICY mt_photo_owners ON public.mt_submission_photos FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()) OR (SELECT public.mt_is_admin()));
DROP POLICY IF EXISTS mt_submission_owners ON public.mt_submissions;
CREATE POLICY mt_submission_owners ON public.mt_submissions FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()) OR (SELECT public.mt_is_admin()));
DROP POLICY IF EXISTS mt_notification_owner ON public.mt_notifications;
CREATE POLICY mt_notification_owner ON public.mt_notifications FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()));
-- Supabase Storage is absent from isolated PostgreSQL tests; its API is tested separately.
DO $$ BEGIN
 IF to_regclass('storage.buckets') IS NOT NULL THEN
  INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES('mt-submissions','mt-submissions',false,2097152,ARRAY['image/jpeg']) ON CONFLICT(id) DO NOTHING;
 END IF;
END; $$;
