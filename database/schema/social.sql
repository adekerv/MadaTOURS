CREATE TABLE IF NOT EXISTS public.mt_user_blocks (
  blocker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(blocker_id,blocked_id), CHECK(blocker_id<>blocked_id)
);
CREATE INDEX IF NOT EXISTS mt_user_blocks_target_idx ON public.mt_user_blocks(blocked_id,blocker_id);
CREATE TABLE IF NOT EXISTS public.mt_follows (
  follower_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','declined')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(follower_id,following_id), CHECK(follower_id<>following_id)
);
CREATE INDEX IF NOT EXISTS mt_follows_target_idx ON public.mt_follows(following_id,status,follower_id);
CREATE TABLE IF NOT EXISTS public.mt_activity (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  place_id bigint NOT NULL REFERENCES public.mt_places(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK(kind IN ('checkin','favorite','plan')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mt_activity_user_idx ON public.mt_activity(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS mt_activity_place_idx ON public.mt_activity(place_id);
CREATE OR REPLACE FUNCTION mt_private.not_blocked(other_user uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT auth.uid() IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.mt_user_blocks WHERE (blocker_id=auth.uid() AND blocked_id=other_user) OR (blocker_id=other_user AND blocked_id=auth.uid()));
$$;
CREATE OR REPLACE FUNCTION mt_private.email_verified() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM public.mt_profiles WHERE id=auth.uid() AND email_verified_at IS NOT NULL);
$$;
CREATE OR REPLACE FUNCTION mt_private.can_read_activity(owner_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT auth.uid() IS NOT NULL AND (owner_id=auth.uid() OR (mt_private.not_blocked(owner_id) AND EXISTS(SELECT 1 FROM public.mt_follows WHERE follower_id=auth.uid() AND following_id=owner_id AND status='accepted')));
$$;
REVOKE ALL ON FUNCTION mt_private.not_blocked(uuid),mt_private.email_verified(),mt_private.can_read_activity(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION mt_private.not_blocked(uuid),mt_private.email_verified(),mt_private.can_read_activity(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION mt_private.record_activity() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF TG_TABLE_NAME='mt_checkins' THEN
    INSERT INTO public.mt_activity(user_id,place_id,kind) VALUES(NEW.user_id,NEW.place_id,'checkin');
  ELSIF TG_OP='DELETE' AND OLD.kind='favorites' THEN
    DELETE FROM public.mt_activity WHERE user_id=OLD.user_id AND place_id=OLD.place_id AND kind='favorite';
  ELSIF TG_OP='INSERT' AND NEW.kind='favorites' THEN
    INSERT INTO public.mt_activity(user_id,place_id,kind) VALUES(NEW.user_id,NEW.place_id,'favorite');
  END IF;
  RETURN NULL;
END; $$;
REVOKE ALL ON FUNCTION mt_private.record_activity() FROM PUBLIC;
DROP TRIGGER IF EXISTS mt_checkin_activity ON public.mt_checkins;
CREATE TRIGGER mt_checkin_activity AFTER INSERT ON public.mt_checkins FOR EACH ROW EXECUTE FUNCTION mt_private.record_activity();
DROP TRIGGER IF EXISTS mt_saved_activity ON public.mt_saved_places;
CREATE TRIGGER mt_saved_activity AFTER INSERT OR DELETE ON public.mt_saved_places FOR EACH ROW EXECUTE FUNCTION mt_private.record_activity();

CREATE TABLE IF NOT EXISTS public.mt_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  creator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL CHECK(char_length(trim(title)) BETWEEN 3 AND 120),
  place_id bigint REFERENCES public.mt_places(id) ON DELETE SET NULL,
  location text NOT NULL CHECK(char_length(trim(location)) BETWEEN 3 AND 200),
  lat double precision NOT NULL CHECK(lat BETWEEN 14.35 AND 14.95),
  lng double precision NOT NULL CHECK(lng BETWEEN -61.3 AND -60.75),
  starts_at timestamptz NOT NULL,
  price numeric(8,2) NOT NULL DEFAULT 0 CHECK(price BETWEEN 0 AND 10000),
  capacity integer NOT NULL CHECK(capacity BETWEEN 2 AND 100),
  description text NOT NULL CHECK(char_length(trim(description)) BETWEEN 20 AND 2000),
  expires_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'live' CHECK(status IN ('live','expired','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mt_events_live_idx ON public.mt_events(expires_at,starts_at) WHERE status='live';
CREATE INDEX IF NOT EXISTS mt_events_creator_idx ON public.mt_events(creator_id);
CREATE INDEX IF NOT EXISTS mt_events_place_idx ON public.mt_events(place_id);
CREATE TABLE IF NOT EXISTS public.mt_event_applications (
  event_id bigint NOT NULL REFERENCES public.mt_events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','declined')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(event_id,user_id)
);
CREATE INDEX IF NOT EXISTS mt_applications_user_idx ON public.mt_event_applications(user_id,event_id);
CREATE TABLE IF NOT EXISTS public.mt_event_reports (
  event_id bigint NOT NULL REFERENCES public.mt_events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK(char_length(trim(reason)) BETWEEN 10 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(event_id,user_id)
);
CREATE INDEX IF NOT EXISTS mt_event_reports_user_idx ON public.mt_event_reports(user_id);
CREATE OR REPLACE FUNCTION public.mt_social_write(action text,payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor_id uuid; target uuid := (payload->>'userId')::uuid; target_event bigint := (payload->>'eventId')::bigint; event_row public.mt_events; place_row public.mt_places; ttl integer; result jsonb;
BEGIN
  actor_id:=mt_private.actor(CASE WHEN action='create-event' THEN 'create-event' ELSE 'social' END,CASE WHEN action='create-event' THEN 3 ELSE 20 END,action IN ('apply','report'));
  IF target IS NOT NULL AND target=actor_id THEN RAISE EXCEPTION 'Choose another account' USING ERRCODE='22023'; END IF;
  IF action IN ('follow','accept-follow','decline-follow','approve','decline') AND NOT mt_private.not_blocked(target) THEN RAISE EXCEPTION 'Account unavailable' USING ERRCODE='42501'; END IF;
  CASE action
    WHEN 'follow' THEN
      INSERT INTO public.mt_follows(follower_id,following_id) VALUES(actor_id,target) ON CONFLICT DO NOTHING;
    WHEN 'accept-follow' THEN UPDATE public.mt_follows SET status='accepted' WHERE follower_id=target AND following_id=actor_id AND status='pending';
    WHEN 'decline-follow' THEN UPDATE public.mt_follows SET status='declined' WHERE follower_id=target AND following_id=actor_id;
    WHEN 'unfollow' THEN DELETE FROM public.mt_follows WHERE follower_id=actor_id AND following_id=target;
    WHEN 'remove-follower' THEN DELETE FROM public.mt_follows WHERE following_id=actor_id AND follower_id=target;
    WHEN 'block' THEN
      INSERT INTO public.mt_user_blocks(blocker_id,blocked_id) VALUES(actor_id,target) ON CONFLICT DO NOTHING;
      DELETE FROM public.mt_follows WHERE (follower_id=actor_id AND following_id=target) OR (follower_id=target AND following_id=actor_id);
      UPDATE public.mt_event_applications a SET status='declined' FROM public.mt_events e WHERE e.id=a.event_id AND ((e.creator_id=actor_id AND a.user_id=target) OR (e.creator_id=target AND a.user_id=actor_id));
    WHEN 'unblock' THEN DELETE FROM public.mt_user_blocks WHERE blocker_id=actor_id AND blocked_id=target;
    WHEN 'share-plan' THEN
      IF jsonb_typeof(payload->'placeIds')<>'array' OR jsonb_array_length(payload->'placeIds') NOT BETWEEN 1 AND 15 THEN RAISE EXCEPTION 'Invalid route' USING ERRCODE='22023'; END IF;
      DELETE FROM public.mt_activity WHERE user_id=actor_id AND kind='plan';
      INSERT INTO public.mt_activity(user_id,place_id,kind) SELECT actor_id,p.id,'plan' FROM public.mt_places p WHERE published AND access<>'restricted' AND p.id IN (SELECT value::bigint FROM jsonb_array_elements_text(payload->'placeIds'));
    WHEN 'clear-plan' THEN DELETE FROM public.mt_activity WHERE user_id=actor_id AND kind='plan';
    WHEN 'create-event' THEN
      ttl:=(payload->>'lifetimeHours')::integer;
      IF ttl NOT IN (3,6,24,168) OR (payload->>'startsAt')::timestamptz<=now() OR (payload->>'startsAt')::timestamptz>now()+interval '90 days' THEN RAISE EXCEPTION 'Invalid event dates' USING ERRCODE='22023'; END IF;
      IF payload->>'placeId' IS NOT NULL THEN SELECT * INTO place_row FROM public.mt_places WHERE id=(payload->>'placeId')::bigint AND published AND access<>'restricted'; IF NOT FOUND THEN RAISE EXCEPTION 'Place unavailable' USING ERRCODE='23503'; END IF; END IF;
      INSERT INTO public.mt_events(creator_id,title,place_id,location,lat,lng,starts_at,price,capacity,description,expires_at)
      VALUES(actor_id,trim(payload->>'title'),place_row.id,coalesce(place_row.name,trim(payload->>'location')),coalesce(place_row.lat,(payload->>'lat')::float8),coalesce(place_row.lng,(payload->>'lng')::float8),(payload->>'startsAt')::timestamptz,(payload->>'price')::numeric,(payload->>'capacity')::integer,trim(payload->>'description'),now()+make_interval(hours=>ttl)) RETURNING to_jsonb(mt_events.*) INTO result;
    WHEN 'cancel-event' THEN UPDATE public.mt_events SET status='cancelled' WHERE id=target_event AND (creator_id=actor_id OR public.mt_is_admin());
    WHEN 'apply','approve','decline','leave-event','report' THEN
      SELECT * INTO event_row FROM public.mt_events WHERE id=target_event FOR UPDATE;
      IF NOT FOUND OR NOT mt_private.not_blocked(event_row.creator_id) THEN RAISE EXCEPTION 'Event unavailable' USING ERRCODE='42501'; END IF;
      IF action='leave-event' THEN DELETE FROM public.mt_event_applications WHERE event_id=target_event AND user_id=actor_id;
      ELSIF action='report' THEN
        IF event_row.status<>'live' OR event_row.expires_at<=now() THEN RAISE EXCEPTION 'Event unavailable' USING ERRCODE='42501'; END IF;
        INSERT INTO public.mt_event_reports(event_id,user_id,reason) VALUES(target_event,actor_id,trim(payload->>'reason')) ON CONFLICT DO NOTHING;
      ELSE
        IF event_row.status<>'live' OR event_row.expires_at<=now() OR event_row.starts_at<=now() THEN RAISE EXCEPTION 'Event has ended' USING ERRCODE='22023'; END IF;
        IF action='apply' THEN
          IF event_row.creator_id=actor_id THEN RAISE EXCEPTION 'Already hosting' USING ERRCODE='22023'; END IF;
          INSERT INTO public.mt_event_applications(event_id,user_id) VALUES(target_event,actor_id) ON CONFLICT DO NOTHING;
        ELSE
          IF event_row.creator_id<>actor_id THEN RAISE EXCEPTION 'Host required' USING ERRCODE='42501'; END IF;
          IF action='approve' THEN
            IF NOT EXISTS(SELECT 1 FROM public.mt_profiles WHERE id=target AND email_verified_at IS NOT NULL) THEN RAISE EXCEPTION 'Applicant must verify email' USING ERRCODE='42501'; END IF;
            IF (SELECT count(*) FROM public.mt_event_applications WHERE event_id=target_event AND status='accepted' AND user_id<>target)>=event_row.capacity-1 THEN RAISE EXCEPTION 'Event is full' USING ERRCODE='22023'; END IF;
          END IF;
          UPDATE public.mt_event_applications SET status=CASE WHEN action='approve' THEN 'accepted' ELSE 'declined' END WHERE event_id=target_event AND user_id=target;
        END IF;
      END IF;
    ELSE RAISE EXCEPTION 'Unknown social action' USING ERRCODE='22023';
  END CASE;
  RETURN coalesce(result,'{"success":true}'::jsonb);
END; $$;
REVOKE ALL ON FUNCTION public.mt_social_write(text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.mt_social_write(text,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.mt_expire_events() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE affected integer;
BEGIN
  UPDATE public.mt_events SET status='expired' WHERE status='live' AND (expires_at<=now() OR starts_at+interval '12 hours'<=now());
  GET DIAGNOSTICS affected=ROW_COUNT;
  DELETE FROM public.mt_activity WHERE created_at<now()-interval '90 days';
  RETURN affected;
END; $$;
REVOKE ALL ON FUNCTION public.mt_expire_events() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mt_expire_events() TO service_role;

ALTER TABLE public.mt_user_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mt_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mt_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mt_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mt_event_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mt_event_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mt_user_blocks,public.mt_follows,public.mt_activity,public.mt_events,public.mt_event_applications,public.mt_event_reports FROM anon,authenticated;
GRANT SELECT ON public.mt_user_blocks,public.mt_follows,public.mt_activity,public.mt_events,public.mt_event_applications,public.mt_event_reports TO authenticated;
GRANT ALL ON public.mt_user_blocks,public.mt_follows,public.mt_activity,public.mt_events,public.mt_event_applications,public.mt_event_reports TO service_role;
GRANT USAGE ON SEQUENCE public.mt_activity_id_seq,public.mt_events_id_seq TO service_role;
DROP POLICY IF EXISTS mt_own_blocks ON public.mt_user_blocks;
CREATE POLICY mt_own_blocks ON public.mt_user_blocks FOR SELECT TO authenticated USING(blocker_id=(SELECT auth.uid()));
DROP POLICY IF EXISTS mt_follow_parties ON public.mt_follows;
CREATE POLICY mt_follow_parties ON public.mt_follows FOR SELECT TO authenticated USING(follower_id=(SELECT auth.uid()) OR following_id=(SELECT auth.uid()));
DROP POLICY IF EXISTS mt_accepted_activity ON public.mt_activity;
CREATE POLICY mt_accepted_activity ON public.mt_activity FOR SELECT TO authenticated USING(mt_private.can_read_activity(user_id) AND created_at>now()-interval '90 days');
DROP POLICY IF EXISTS mt_visible_events ON public.mt_events;
CREATE POLICY mt_visible_events ON public.mt_events FOR SELECT TO authenticated USING(creator_id=(SELECT auth.uid()) OR (SELECT public.mt_is_admin()) OR ((SELECT mt_private.email_verified()) AND mt_private.not_blocked(creator_id) AND status='live' AND expires_at>now() AND starts_at+interval '12 hours'>now()));
DROP POLICY IF EXISTS mt_application_visibility ON public.mt_event_applications;
CREATE POLICY mt_application_visibility ON public.mt_event_applications FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()) OR EXISTS(SELECT 1 FROM public.mt_events e WHERE e.id=event_id AND (e.creator_id=(SELECT auth.uid()) OR (mt_event_applications.status='accepted' AND (SELECT mt_private.email_verified()) AND mt_private.not_blocked(mt_event_applications.user_id)))));
DROP POLICY IF EXISTS mt_reports_moderation ON public.mt_event_reports;
CREATE POLICY mt_reports_moderation ON public.mt_event_reports FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()) OR (SELECT public.mt_is_admin()));

CREATE OR REPLACE FUNCTION public.mt_social_dashboard(search_text text DEFAULT '',page_offset integer DEFAULT 0) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF page_offset NOT BETWEEN 0 AND 10000 OR char_length(search_text)>80 THEN RAISE EXCEPTION 'Invalid page' USING ERRCODE='22023'; END IF;
  RETURN jsonb_build_object(
    'people',coalesce((SELECT jsonb_agg(p) FROM (SELECT user_id,display_name FROM public.mt_public_profiles WHERE char_length(trim(search_text))>=2 AND position(lower(trim(search_text)) in lower(display_name))>0 AND user_id<>auth.uid() AND mt_private.not_blocked(user_id) ORDER BY display_name,user_id LIMIT 20 OFFSET page_offset) p),'[]'::jsonb),
    'connections',coalesce((SELECT jsonb_agg(f) FROM (SELECT f.*,p.display_name FROM public.mt_follows f JOIN public.mt_public_profiles p ON p.user_id=CASE WHEN f.follower_id=auth.uid() THEN f.following_id ELSE f.follower_id END ORDER BY f.created_at DESC LIMIT 20 OFFSET page_offset) f),'[]'::jsonb),
    'activity',coalesce((SELECT jsonb_agg(a) FROM (SELECT a.*,p.display_name,l.name AS place_name FROM public.mt_activity a JOIN public.mt_public_profiles p ON p.user_id=a.user_id JOIN public.mt_places l ON l.id=a.place_id WHERE a.user_id<>auth.uid() ORDER BY a.created_at DESC,a.id DESC LIMIT 20 OFFSET page_offset) a),'[]'::jsonb),
    'blocked',coalesce((SELECT jsonb_agg(b) FROM (SELECT b.blocked_id,p.display_name FROM public.mt_user_blocks b JOIN public.mt_public_profiles p ON p.user_id=b.blocked_id ORDER BY b.created_at DESC LIMIT 20 OFFSET page_offset) b),'[]'::jsonb),
    'events',coalesce((SELECT jsonb_agg(e) FROM (SELECT e.*,p.display_name,
      coalesce((SELECT jsonb_agg(a) FROM (SELECT a.user_id,a.status,p.display_name FROM public.mt_event_applications a JOIN public.mt_public_profiles p ON p.user_id=a.user_id WHERE a.event_id=e.id ORDER BY a.created_at LIMIT 100) a),'[]'::jsonb) AS applications
      FROM public.mt_events e JOIN public.mt_public_profiles p ON p.user_id=e.creator_id ORDER BY e.created_at DESC,e.id DESC LIMIT 20 OFFSET page_offset) e),'[]'::jsonb),
    'reports',coalesce((SELECT jsonb_agg(r) FROM (SELECT * FROM public.mt_event_reports WHERE public.mt_is_admin() ORDER BY created_at DESC LIMIT 20 OFFSET page_offset) r),'[]'::jsonb)
  );
END; $$;
REVOKE ALL ON FUNCTION public.mt_social_dashboard(text,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.mt_social_dashboard(text,integer) TO authenticated;
