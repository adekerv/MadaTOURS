-- v2: all mutations are bounded RPCs; direct clients cannot bypass moderation/rate limits.
CREATE SCHEMA IF NOT EXISTS mt_private;
REVOKE ALL ON SCHEMA mt_private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA mt_private TO authenticated;
ALTER TABLE public.mt_profiles ADD COLUMN IF NOT EXISTS email_verified_at timestamptz;
CREATE TABLE IF NOT EXISTS public.mt_public_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 80)
);
CREATE OR REPLACE FUNCTION public.mt_sync_display_name() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.mt_public_profiles(user_id,display_name)
  VALUES(NEW.id, left(coalesce(nullif(trim(regexp_replace(NEW.raw_user_meta_data->>'display_name','[<>[:cntrl:]]','','g')),''),'Explorer'),80))
  ON CONFLICT(user_id) DO UPDATE SET display_name=excluded.display_name;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.mt_sync_display_name() FROM PUBLIC;
DROP TRIGGER IF EXISTS mt_display_name_changed ON auth.users;
CREATE TRIGGER mt_display_name_changed AFTER INSERT OR UPDATE OF raw_user_meta_data ON auth.users FOR EACH ROW EXECUTE FUNCTION public.mt_sync_display_name();
INSERT INTO public.mt_public_profiles(user_id,display_name)
SELECT id,left(coalesce(nullif(trim(regexp_replace(raw_user_meta_data->>'display_name','[<>[:cntrl:]]','','g')),''),'Explorer'),80) FROM auth.users ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS public.mt_comment_blocks (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK(char_length(reason) BETWEEN 3 AND 500),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.mt_reviews (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  place_id bigint NOT NULL REFERENCES public.mt_places(id) ON DELETE CASCADE,
  rating smallint NOT NULL CHECK(rating BETWEEN 1 AND 5),
  body text NOT NULL CHECK(char_length(trim(body)) BETWEEN 10 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  moderated boolean NOT NULL DEFAULT false,
  UNIQUE(user_id,place_id)
);
CREATE INDEX IF NOT EXISTS mt_reviews_place_idx ON public.mt_reviews(place_id,created_at DESC);
CREATE TABLE IF NOT EXISTS public.mt_comments (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  place_id bigint NOT NULL REFERENCES public.mt_places(id) ON DELETE CASCADE,
  body text NOT NULL CHECK(char_length(trim(body)) BETWEEN 2 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mt_comments_place_idx ON public.mt_comments(place_id,created_at DESC);
CREATE INDEX IF NOT EXISTS mt_comments_user_idx ON public.mt_comments(user_id);
CREATE TABLE IF NOT EXISTS public.mt_checkins (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  place_id bigint NOT NULL REFERENCES public.mt_places(id) ON DELETE CASCADE,
  visited_on date NOT NULL DEFAULT ((now() AT TIME ZONE 'America/Martinique')::date),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id,place_id,visited_on)
);
CREATE INDEX IF NOT EXISTS mt_checkins_place_idx ON public.mt_checkins(place_id,user_id,visited_on);
ALTER TABLE public.mt_places ADD COLUMN IF NOT EXISTS community_rating numeric(3,2);
ALTER TABLE public.mt_places ADD COLUMN IF NOT EXISTS community_count integer NOT NULL DEFAULT 0;
CREATE OR REPLACE FUNCTION mt_private.update_community_rating() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE target bigint := coalesce(NEW.place_id,OLD.place_id);
BEGIN
  -- Serialize aggregate updates so concurrent reviews cannot overwrite a newer count.
  PERFORM 1 FROM public.mt_places WHERE id=target FOR UPDATE;
  UPDATE public.mt_places SET community_rating=(SELECT round(avg(rating),2) FROM public.mt_reviews WHERE place_id=target),
    community_count=(SELECT count(*) FROM public.mt_reviews WHERE place_id=target) WHERE id=target;
  RETURN NULL;
END; $$;
REVOKE ALL ON FUNCTION mt_private.update_community_rating() FROM PUBLIC;
DROP TRIGGER IF EXISTS mt_reviews_aggregate ON public.mt_reviews;
CREATE TRIGGER mt_reviews_aggregate AFTER INSERT OR UPDATE OR DELETE ON public.mt_reviews FOR EACH ROW EXECUTE FUNCTION mt_private.update_community_rating();

CREATE OR REPLACE FUNCTION mt_private.actor(kind text, ceiling integer DEFAULT 10, verified boolean DEFAULT false) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor_id uuid := auth.uid(); hits integer; rate_key text;
BEGIN
  IF actor_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.mt_profiles WHERE id=actor_id) THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF verified AND NOT EXISTS(SELECT 1 FROM public.mt_profiles WHERE id=actor_id AND email_verified_at IS NOT NULL) THEN RAISE EXCEPTION 'Email verification required' USING ERRCODE='42501'; END IF;
  rate_key := 'v2:'||kind||':'||actor_id;
  INSERT INTO public.mt_rate_limits(key,hits,expires_at) VALUES(rate_key,1,now()+interval '15 minutes')
  ON CONFLICT(key) DO UPDATE SET hits=CASE WHEN public.mt_rate_limits.expires_at < now() THEN 1 ELSE public.mt_rate_limits.hits+1 END,
    expires_at=CASE WHEN public.mt_rate_limits.expires_at < now() THEN now()+interval '15 minutes' ELSE public.mt_rate_limits.expires_at END
  RETURNING public.mt_rate_limits.hits INTO hits;
  IF hits > ceiling THEN RAISE EXCEPTION 'Too many attempts' USING ERRCODE='P0429'; END IF;
  RETURN actor_id;
END; $$;
REVOKE ALL ON FUNCTION mt_private.actor(text,integer,boolean) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.mt_community_write(action text, payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor_id uuid; target_place bigint := (payload->>'placeId')::bigint; target_id bigint := (payload->>'id')::bigint; result jsonb;
BEGIN
  actor_id := mt_private.actor('community',20);
  IF action IN ('review','comment','checkin') THEN
    IF NOT EXISTS(SELECT 1 FROM public.mt_places WHERE id=target_place AND published) THEN RAISE EXCEPTION 'Place unavailable' USING ERRCODE='23503'; END IF;
    IF action <> 'checkin' AND EXISTS(SELECT 1 FROM public.mt_comment_blocks WHERE user_id=actor_id) THEN RAISE EXCEPTION 'Commenting restricted' USING ERRCODE='42501'; END IF;
  END IF;
  CASE action
    WHEN 'review' THEN
      INSERT INTO public.mt_reviews(user_id,place_id,rating,body) VALUES(actor_id,target_place,(payload->>'rating')::smallint,trim(payload->>'body'))
      ON CONFLICT(user_id,place_id) DO UPDATE SET rating=excluded.rating,body=excluded.body,updated_at=now(),moderated=false RETURNING to_jsonb(mt_reviews.*) INTO result;
    WHEN 'comment' THEN
      INSERT INTO public.mt_comments(user_id,place_id,body) VALUES(actor_id,target_place,trim(payload->>'body')) RETURNING to_jsonb(mt_comments.*) INTO result;
    WHEN 'checkin' THEN
      INSERT INTO public.mt_checkins(user_id,place_id) VALUES(actor_id,target_place) ON CONFLICT DO NOTHING;
    WHEN 'delete-review' THEN
      DELETE FROM public.mt_reviews WHERE id=target_id AND (user_id=actor_id OR public.mt_is_admin());
    WHEN 'delete-comment' THEN
      DELETE FROM public.mt_comments WHERE id=target_id AND (user_id=actor_id OR public.mt_is_admin());
    WHEN 'moderate-review' THEN
      IF NOT public.mt_is_admin() THEN RAISE EXCEPTION 'Administrator required' USING ERRCODE='42501'; END IF;
      UPDATE public.mt_reviews SET body=trim(payload->>'body'),rating=(payload->>'rating')::smallint,moderated=true,updated_at=now() WHERE id=target_id;
    WHEN 'block-comments' THEN
      IF NOT public.mt_is_admin() THEN RAISE EXCEPTION 'Administrator required' USING ERRCODE='42501'; END IF;
      INSERT INTO public.mt_comment_blocks(user_id,reason) VALUES((payload->>'userId')::uuid,trim(payload->>'reason')) ON CONFLICT(user_id) DO UPDATE SET reason=excluded.reason;
    WHEN 'unblock-comments' THEN
      IF NOT public.mt_is_admin() THEN RAISE EXCEPTION 'Administrator required' USING ERRCODE='42501'; END IF;
      DELETE FROM public.mt_comment_blocks WHERE user_id=(payload->>'userId')::uuid;
    ELSE RAISE EXCEPTION 'Unknown community action' USING ERRCODE='22023';
  END CASE;
  RETURN coalesce(result,'{"success":true}'::jsonb);
END; $$;
REVOKE ALL ON FUNCTION public.mt_community_write(text,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mt_community_write(text,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.mt_place_community(target_place bigint, page_offset integer DEFAULT 0) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE result jsonb;
BEGIN
  IF page_offset < 0 OR page_offset > 10000 THEN RAISE EXCEPTION 'Invalid page'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.mt_places WHERE id=target_place AND published) THEN RETURN '{"reviews":[],"comments":[]}'::jsonb; END IF;
  SELECT jsonb_build_object(
    'reviews',coalesce((SELECT jsonb_agg(r) FROM (
      SELECT r.id,r.user_id,r.rating,r.body,r.created_at,r.updated_at,r.moderated,p.display_name,
      (SELECT count(*) FROM public.mt_checkins c WHERE c.user_id=r.user_id AND c.place_id=r.place_id AND c.visited_on >= date_trunc('year',now() AT TIME ZONE 'America/Martinique')::date) AS visits
      FROM public.mt_reviews r JOIN public.mt_public_profiles p ON p.user_id=r.user_id WHERE r.place_id=target_place ORDER BY r.created_at DESC,r.id DESC LIMIT 20 OFFSET page_offset) r),'[]'::jsonb),
    'comments',coalesce((SELECT jsonb_agg(c) FROM (
      SELECT c.id,c.user_id,c.body,c.created_at,p.display_name FROM public.mt_comments c JOIN public.mt_public_profiles p ON p.user_id=c.user_id WHERE c.place_id=target_place ORDER BY c.created_at DESC,c.id DESC LIMIT 20 OFFSET page_offset) c),'[]'::jsonb),
    'rating',(SELECT community_rating FROM public.mt_places WHERE id=target_place),
    'count',(SELECT community_count FROM public.mt_places WHERE id=target_place)
  ) INTO result;
  RETURN result;
END; $$;
REVOKE ALL ON FUNCTION public.mt_place_community(bigint,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mt_place_community(bigint,integer) TO anon, authenticated;

ALTER TABLE public.mt_public_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mt_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mt_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mt_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mt_comment_blocks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mt_public_profiles,public.mt_reviews,public.mt_comments,public.mt_checkins,public.mt_comment_blocks FROM anon,authenticated;
GRANT SELECT ON public.mt_public_profiles,public.mt_reviews,public.mt_comments,public.mt_checkins,public.mt_comment_blocks TO authenticated;
GRANT ALL ON public.mt_public_profiles,public.mt_reviews,public.mt_comments,public.mt_checkins,public.mt_comment_blocks TO service_role;
GRANT USAGE ON SEQUENCE public.mt_reviews_id_seq,public.mt_comments_id_seq TO service_role;
DROP POLICY IF EXISTS mt_profiles_directory ON public.mt_public_profiles;
CREATE POLICY mt_profiles_directory ON public.mt_public_profiles FOR SELECT TO authenticated USING(true);
DROP POLICY IF EXISTS mt_reviews_read ON public.mt_reviews;
CREATE POLICY mt_reviews_read ON public.mt_reviews FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()) OR (SELECT public.mt_is_admin()));
DROP POLICY IF EXISTS mt_comments_read ON public.mt_comments;
CREATE POLICY mt_comments_read ON public.mt_comments FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()) OR (SELECT public.mt_is_admin()));
DROP POLICY IF EXISTS mt_checkins_read ON public.mt_checkins;
CREATE POLICY mt_checkins_read ON public.mt_checkins FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()));
DROP POLICY IF EXISTS mt_blocks_admin ON public.mt_comment_blocks;
CREATE POLICY mt_blocks_admin ON public.mt_comment_blocks FOR SELECT TO authenticated USING((SELECT public.mt_is_admin()));
