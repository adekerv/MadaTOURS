-- Photos attached to reviews. Reviews are public text, but their photos are for signed-in people only.
-- The rule is enforced in the database, not just hidden in the UI: guests have no grant on the table or
-- the function below, and the files sit in the private mt-submissions bucket, reachable only through
-- short-lived signed links that the API hands out to signed-in sessions.
CREATE TABLE IF NOT EXISTS public.mt_review_photos (
  id uuid PRIMARY KEY,
  review_id bigint NOT NULL REFERENCES public.mt_reviews(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  path text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK(path ~ '^[a-f0-9-]{36}/[a-f0-9-]{36}\.jpg$')
);
CREATE INDEX IF NOT EXISTS mt_review_photos_review_idx ON public.mt_review_photos(review_id);
CREATE INDEX IF NOT EXISTS mt_review_photos_user_idx ON public.mt_review_photos(user_id);

-- A photo belongs to its author's own review, and a review holds at most three. The review row is
-- locked first so two uploads at once cannot both slip past the limit.
CREATE OR REPLACE FUNCTION mt_private.check_review_photo() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM 1 FROM public.mt_reviews WHERE id=NEW.review_id AND user_id=NEW.user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Photos can only be added to your own review' USING ERRCODE='42501'; END IF;
  IF (SELECT count(*) FROM public.mt_review_photos WHERE review_id=NEW.review_id) >= 3 THEN
    RAISE EXCEPTION 'A review can have up to 3 photos' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION mt_private.check_review_photo() FROM PUBLIC;
DROP TRIGGER IF EXISTS mt_review_photo_check ON public.mt_review_photos;
CREATE TRIGGER mt_review_photo_check BEFORE INSERT ON public.mt_review_photos FOR EACH ROW EXECUTE FUNCTION mt_private.check_review_photo();

-- Deleting a photo, its review or its author's account queues the file for removal from storage.
CREATE OR REPLACE FUNCTION mt_private.queue_review_photo_deletion() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.mt_photo_deletions(path) VALUES(OLD.path) ON CONFLICT DO NOTHING;
  RETURN NULL;
END; $$;
REVOKE ALL ON FUNCTION mt_private.queue_review_photo_deletion() FROM PUBLIC;
DROP TRIGGER IF EXISTS mt_review_photo_deleted ON public.mt_review_photos;
CREATE TRIGGER mt_review_photo_deleted AFTER DELETE ON public.mt_review_photos FOR EACH ROW EXECUTE FUNCTION mt_private.queue_review_photo_deletion();

ALTER TABLE public.mt_review_photos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mt_review_photos FROM anon, authenticated;
GRANT SELECT ON public.mt_review_photos TO authenticated;
GRANT ALL ON public.mt_review_photos TO service_role;
DROP POLICY IF EXISTS mt_review_photos_signed_in ON public.mt_review_photos;
CREATE POLICY mt_review_photos_signed_in ON public.mt_review_photos FOR SELECT TO authenticated USING(true);

-- The photos on the same page of reviews that mt_place_community returns. Signed-in callers only.
-- The public mt_place_community function is left as it was and never mentions photos.
CREATE OR REPLACE FUNCTION public.mt_place_review_photos(target_place bigint, page_offset integer DEFAULT 0) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to see photos' USING ERRCODE='42501'; END IF;
  IF page_offset < 0 OR page_offset > 10000 THEN RAISE EXCEPTION 'Invalid page'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.mt_places WHERE id=target_place AND published) THEN RETURN '[]'::jsonb; END IF;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object('id',ph.id,'reviewId',ph.review_id,'path',ph.path) ORDER BY ph.created_at,ph.id)
    FROM public.mt_review_photos ph
    WHERE ph.review_id IN (SELECT r.id FROM public.mt_reviews r WHERE r.place_id=target_place ORDER BY r.created_at DESC,r.id DESC LIMIT 20 OFFSET page_offset)
  ),'[]'::jsonb);
END; $$;
REVOKE ALL ON FUNCTION public.mt_place_review_photos(bigint,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mt_place_review_photos(bigint,integer) TO authenticated;
