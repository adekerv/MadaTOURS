-- Administration: the activity log, the contact inbox, editable site content, featured tours, and the read and
-- write functions behind the admin dashboard. Every admin function checks mt_is_admin() itself, so a signed-in
-- person who is not an administrator gets nothing even when calling the database directly. Apply after the other
-- schema files: it needs community.sql (mt_private), social.sql, submissions.sql, review-photos.sql and tours.sql
-- (it adds columns to mt_tours). Every statement can be run again safely.

CREATE OR REPLACE FUNCTION mt_private.require_admin() RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.mt_is_admin() THEN RAISE EXCEPTION 'Administrator required' USING ERRCODE='42501'; END IF;
  RETURN auth.uid();
END; $$;
REVOKE ALL ON FUNCTION mt_private.require_admin() FROM PUBLIC, anon, authenticated;

-- Search text becomes a LIKE pattern with its wildcards escaped, so "50%" finds "50%" and not everything.
CREATE OR REPLACE FUNCTION mt_private.search_pattern(search_text text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT '%'||replace(replace(replace(left(trim(coalesce(search_text,'')),100),'\','\\'),'%','\%'),'_','\_')||'%';
$$;
REVOKE ALL ON FUNCTION mt_private.search_pattern(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION mt_private.check_page(page_offset integer, page_size integer) RETURNS void
LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
BEGIN
  IF page_offset IS NULL OR page_size IS NULL OR page_offset < 0 OR page_offset > 100000 OR page_size < 1 OR page_size > 100 THEN
    RAISE EXCEPTION 'Invalid page' USING ERRCODE='22023';
  END IF;
END; $$;
REVOKE ALL ON FUNCTION mt_private.check_page(integer,integer) FROM PUBLIC, anon, authenticated;

-- Activity log: append-only. Rows are written through mt_admin_log_write, which records who acted from the session,
-- so an entry can never claim another administrator did something.
CREATE TABLE IF NOT EXISTS public.mt_admin_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email text NOT NULL,
  action text NOT NULL CHECK(action ~ '^[a-z][a-z-]{1,30}\.[a-z][a-z-]{1,30}$'),
  target_type text CHECK(target_type IS NULL OR char_length(target_type) <= 40),
  target_id text CHECK(target_id IS NULL OR char_length(target_id) <= 80),
  summary text NOT NULL CHECK(char_length(summary) BETWEEN 1 AND 300),
  details jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(details)='object'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mt_admin_log_created_idx ON public.mt_admin_log(created_at DESC, id DESC);

CREATE OR REPLACE FUNCTION public.mt_admin_log_write(action text, target_type text, target_id text, summary text, details jsonb DEFAULT '{}') RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor uuid := mt_private.require_admin();
BEGIN
  INSERT INTO public.mt_admin_log(actor_id,actor_email,action,target_type,target_id,summary,details)
  SELECT actor, coalesce(u.email,'unknown'), action, target_type, target_id, left(summary,300), coalesce(details,'{}')
  FROM (SELECT 1) one LEFT JOIN auth.users u ON u.id=actor;
END; $$;
REVOKE ALL ON FUNCTION public.mt_admin_log_write(text,text,text,text,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mt_admin_log_write(text,text,text,text,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.mt_admin_log_list(search_text text DEFAULT '', area text DEFAULT '', page_offset integer DEFAULT 0, page_size integer DEFAULT 25) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE pattern text := mt_private.search_pattern(search_text);
BEGIN
  PERFORM mt_private.require_admin();
  PERFORM mt_private.check_page(page_offset, page_size);
  RETURN (WITH listed AS (
    SELECT l.id,l.actor_email,l.action,l.target_type,l.target_id,l.summary,l.details,l.created_at FROM public.mt_admin_log l
    WHERE (coalesce(area,'')='' OR split_part(l.action,'.',1)=area)
      AND (coalesce(search_text,'')='' OR l.summary ILIKE pattern OR l.actor_email ILIKE pattern)
  )
  SELECT jsonb_build_object('total',(SELECT count(*) FROM listed),
    'rows',coalesce((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.created_at DESC, r.id DESC) FROM (
      SELECT * FROM listed ORDER BY created_at DESC, id DESC LIMIT page_size OFFSET page_offset) r),'[]'::jsonb)));
END; $$;
REVOKE ALL ON FUNCTION public.mt_admin_log_list(text,text,integer,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mt_admin_log_list(text,text,integer,integer) TO authenticated;

-- Contact inbox. Messages arrive through the Laravel API (rate limited) with the service role; only administrators
-- read, mark or delete them.
CREATE TABLE IF NOT EXISTS public.mt_contact_messages (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL CHECK(char_length(trim(name)) BETWEEN 1 AND 80),
  email text NOT NULL CHECK(char_length(email) BETWEEN 3 AND 254),
  subject text NOT NULL CHECK(char_length(trim(subject)) BETWEEN 3 AND 120),
  message text NOT NULL CHECK(char_length(trim(message)) BETWEEN 10 AND 4000),
  status text NOT NULL DEFAULT 'new' CHECK(status IN ('new','read','handled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  handled_at timestamptz
);
CREATE INDEX IF NOT EXISTS mt_contact_messages_status_idx ON public.mt_contact_messages(status, created_at DESC);

CREATE OR REPLACE FUNCTION public.mt_admin_messages(search_text text DEFAULT '', status_filter text DEFAULT '', sort_key text DEFAULT 'newest', page_offset integer DEFAULT 0, page_size integer DEFAULT 20) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE pattern text := mt_private.search_pattern(search_text);
BEGIN
  PERFORM mt_private.require_admin();
  PERFORM mt_private.check_page(page_offset, page_size);
  RETURN (WITH listed AS (
    SELECT m.* FROM public.mt_contact_messages m
    WHERE (coalesce(status_filter,'')='' OR m.status=status_filter)
      AND (coalesce(search_text,'')='' OR m.name ILIKE pattern OR m.email ILIKE pattern OR m.subject ILIKE pattern OR m.message ILIKE pattern)
  ), ordered AS (
    SELECT l.*, row_number() OVER (ORDER BY
      CASE WHEN sort_key='oldest' THEN l.created_at END ASC,
      CASE WHEN sort_key='status' THEN array_position(ARRAY['new','read','handled'], l.status) END ASC,
      l.created_at DESC, l.id DESC) AS position
    FROM listed l
  )
  SELECT jsonb_build_object('total',(SELECT count(*) FROM listed),
    'unread',(SELECT count(*) FROM public.mt_contact_messages WHERE status='new'),
    'rows',coalesce((SELECT jsonb_agg(to_jsonb(o) - 'position' ORDER BY o.position) FROM (
      SELECT * FROM ordered ORDER BY position LIMIT page_size OFFSET page_offset) o),'[]'::jsonb)));
END; $$;
REVOKE ALL ON FUNCTION public.mt_admin_messages(text,text,text,integer,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mt_admin_messages(text,text,text,integer,integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.mt_admin_message_write(action text, target bigint) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE result jsonb;
BEGIN
  PERFORM mt_private.require_admin();
  IF action = 'delete' THEN
    DELETE FROM public.mt_contact_messages WHERE id=target RETURNING jsonb_build_object('id',id,'subject',subject) INTO result;
  ELSIF action IN ('new','read','handled') THEN
    UPDATE public.mt_contact_messages SET status=action, handled_at=CASE WHEN action='handled' THEN now() END
    WHERE id=target RETURNING to_jsonb(mt_contact_messages.*) INTO result;
  ELSE
    RAISE EXCEPTION 'Unknown action' USING ERRCODE='22023';
  END IF;
  IF result IS NULL THEN RAISE EXCEPTION 'Message not found' USING ERRCODE='23503'; END IF;
  RETURN result;
END; $$;
REVOKE ALL ON FUNCTION public.mt_admin_message_write(text,bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mt_admin_message_write(text,bigint) TO authenticated;

-- Site content an administrator edits without touching code: the homepage hero, contact details, social links and
-- an announcement banner. One row; anyone may read it, administrators change it.
CREATE TABLE IF NOT EXISTS public.mt_site_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK(id = 1),
  content jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(content)='object' AND octet_length(content::text) <= 20000),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.mt_site_settings(id) VALUES(1) ON CONFLICT DO NOTHING;

-- Tours: a cover image and a flag that puts the tour first on the homepage.
ALTER TABLE public.mt_tours ADD COLUMN IF NOT EXISTS featured boolean NOT NULL DEFAULT false;
ALTER TABLE public.mt_tours ADD COLUMN IF NOT EXISTS image text CHECK(image IS NULL OR (char_length(image) <= 2000 AND (image LIKE 'https://%' OR image LIKE '/photos/%')));

-- Reviews: hidden ones stay stored but leave the place page and its community rating (see community.sql).
CREATE OR REPLACE FUNCTION public.mt_admin_reviews(search_text text DEFAULT '', rating_filter integer DEFAULT 0, visibility text DEFAULT '', sort_key text DEFAULT 'newest', page_offset integer DEFAULT 0, page_size integer DEFAULT 20) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE pattern text := mt_private.search_pattern(search_text);
BEGIN
  PERFORM mt_private.require_admin();
  PERFORM mt_private.check_page(page_offset, page_size);
  RETURN (WITH listed AS (
    SELECT r.id,r.user_id,r.place_id,r.rating,r.body,r.hidden,r.moderated,r.created_at,r.updated_at,
      pl.name AS place_name, coalesce(pp.display_name,'Explorer') AS author, u.email AS author_email,
      (SELECT count(*) FROM public.mt_review_photos ph WHERE ph.review_id=r.id) AS photos
    FROM public.mt_reviews r JOIN public.mt_places pl ON pl.id=r.place_id
    LEFT JOIN public.mt_public_profiles pp ON pp.user_id=r.user_id LEFT JOIN auth.users u ON u.id=r.user_id
    WHERE (coalesce(rating_filter,0)=0 OR r.rating=rating_filter)
      AND (coalesce(visibility,'')='' OR (visibility='hidden') = r.hidden)
      AND (coalesce(search_text,'')='' OR r.body ILIKE pattern OR pl.name ILIKE pattern OR pp.display_name ILIKE pattern OR u.email ILIKE pattern)
  ), ordered AS (
    SELECT l.*, row_number() OVER (ORDER BY
      CASE WHEN sort_key='oldest' THEN l.created_at END ASC,
      CASE WHEN sort_key='lowest' THEN l.rating END ASC,
      CASE WHEN sort_key='highest' THEN l.rating END DESC,
      l.created_at DESC, l.id DESC) AS position
    FROM listed l
  )
  SELECT jsonb_build_object('total',(SELECT count(*) FROM listed),
    'rows',coalesce((SELECT jsonb_agg(to_jsonb(o) - 'position' ORDER BY o.position) FROM (
      SELECT * FROM ordered ORDER BY position LIMIT page_size OFFSET page_offset) o),'[]'::jsonb)));
END; $$;
REVOKE ALL ON FUNCTION public.mt_admin_reviews(text,integer,text,text,integer,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mt_admin_reviews(text,integer,text,text,integer,integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.mt_admin_review_write(action text, target bigint) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE result jsonb;
BEGIN
  PERFORM mt_private.require_admin();
  IF action IN ('hide','show') THEN
    UPDATE public.mt_reviews SET hidden=(action='hide') WHERE id=target
    RETURNING jsonb_build_object('id',id,'placeId',place_id,'hidden',hidden) INTO result;
  ELSIF action = 'delete' THEN
    DELETE FROM public.mt_reviews WHERE id=target RETURNING jsonb_build_object('id',id,'placeId',place_id) INTO result;
  ELSE
    RAISE EXCEPTION 'Unknown action' USING ERRCODE='22023';
  END IF;
  IF result IS NULL THEN RAISE EXCEPTION 'Review not found' USING ERRCODE='23503'; END IF;
  RETURN result;
END; $$;
REVOKE ALL ON FUNCTION public.mt_admin_review_write(text,bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mt_admin_review_write(text,bigint) TO authenticated;

-- Accounts. Suspending, deleting and password resets go through the Supabase Auth admin API; these functions only
-- read accounts and change roles. Nobody can change their own role, so the last administrator can never demote
-- themselves out of the dashboard.
CREATE OR REPLACE FUNCTION public.mt_admin_users(search_text text DEFAULT '', role_filter text DEFAULT '', status_filter text DEFAULT '', sort_key text DEFAULT 'newest', page_offset integer DEFAULT 0, page_size integer DEFAULT 20) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE pattern text := mt_private.search_pattern(search_text);
BEGIN
  PERFORM mt_private.require_admin();
  PERFORM mt_private.check_page(page_offset, page_size);
  RETURN (WITH listed AS (
    SELECT u.id,u.email,u.created_at,u.last_sign_in_at,
      coalesce(pp.display_name, split_part(u.email,'@',1)) AS name,
      p.role, p.email_verified_at IS NOT NULL AS verified,
      coalesce(u.raw_app_meta_data->'providers','[]'::jsonb) AS providers,
      coalesce(u.banned_until > now(), false) AS suspended
    FROM auth.users u JOIN public.mt_profiles p ON p.id=u.id LEFT JOIN public.mt_public_profiles pp ON pp.user_id=u.id
    WHERE (coalesce(role_filter,'')='' OR p.role=role_filter)
      AND (coalesce(status_filter,'')='' OR (status_filter='suspended') = coalesce(u.banned_until > now(), false))
      AND (coalesce(search_text,'')='' OR u.email ILIKE pattern OR pp.display_name ILIKE pattern)
  ), ordered AS (
    SELECT l.*, row_number() OVER (ORDER BY
      CASE WHEN sort_key='name' THEN lower(l.name) END ASC,
      CASE WHEN sort_key='email' THEN l.email END ASC,
      CASE WHEN sort_key='oldest' THEN l.created_at END ASC,
      CASE WHEN sort_key='active' THEN l.last_sign_in_at END DESC NULLS LAST,
      l.created_at DESC, l.id) AS position
    FROM listed l
  )
  SELECT jsonb_build_object('total',(SELECT count(*) FROM listed),
    'rows',coalesce((SELECT jsonb_agg(to_jsonb(o) - 'position' ORDER BY o.position) FROM (
      SELECT * FROM ordered ORDER BY position LIMIT page_size OFFSET page_offset) o),'[]'::jsonb)));
END; $$;
REVOKE ALL ON FUNCTION public.mt_admin_users(text,text,text,text,integer,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mt_admin_users(text,text,text,text,integer,integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.mt_admin_user(target uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE result jsonb;
BEGIN
  PERFORM mt_private.require_admin();
  SELECT jsonb_build_object(
    'id',u.id,'email',u.email,'name',coalesce(pp.display_name, split_part(u.email,'@',1)),'role',p.role,
    'verified',p.email_verified_at IS NOT NULL,'createdAt',u.created_at,'lastSignInAt',u.last_sign_in_at,
    'suspended',coalesce(u.banned_until > now(), false),'providers',coalesce(u.raw_app_meta_data->'providers','[]'::jsonb),
    'commentBlock',(SELECT to_jsonb(b) - 'user_id' FROM public.mt_comment_blocks b WHERE b.user_id=u.id),
    'meetups',coalesce((SELECT jsonb_agg(e ORDER BY e.starts_at DESC) FROM (
      SELECT e.id,e.title,e.starts_at,e.status FROM public.mt_events e WHERE e.creator_id=u.id ORDER BY e.starts_at DESC LIMIT 20) e),'[]'::jsonb),
    'requests',coalesce((SELECT jsonb_agg(a ORDER BY a.created_at DESC) FROM (
      SELECT a.event_id,a.status,a.created_at,e.title,e.starts_at FROM public.mt_event_applications a JOIN public.mt_events e ON e.id=a.event_id
      WHERE a.user_id=u.id ORDER BY a.created_at DESC LIMIT 20) a),'[]'::jsonb),
    'reviews',coalesce((SELECT jsonb_agg(r ORDER BY r.created_at DESC) FROM (
      SELECT r.id,r.rating,r.body,r.hidden,r.created_at,pl.name AS place_name FROM public.mt_reviews r JOIN public.mt_places pl ON pl.id=r.place_id
      WHERE r.user_id=u.id ORDER BY r.created_at DESC LIMIT 20) r),'[]'::jsonb),
    'counts',jsonb_build_object(
      'reviews',(SELECT count(*) FROM public.mt_reviews WHERE user_id=u.id),
      'comments',(SELECT count(*) FROM public.mt_comments WHERE user_id=u.id),
      'saved',(SELECT count(*) FROM public.mt_saved_places WHERE user_id=u.id),
      'submissions',(SELECT count(*) FROM public.mt_submissions WHERE user_id=u.id))
  ) INTO result
  FROM auth.users u JOIN public.mt_profiles p ON p.id=u.id LEFT JOIN public.mt_public_profiles pp ON pp.user_id=u.id
  WHERE u.id=target;
  IF result IS NULL THEN RAISE EXCEPTION 'Account not found' USING ERRCODE='23503'; END IF;
  RETURN result;
END; $$;
REVOKE ALL ON FUNCTION public.mt_admin_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mt_admin_user(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.mt_admin_set_role(target uuid, new_role text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor uuid := mt_private.require_admin(); result jsonb;
BEGIN
  IF target = actor THEN RAISE EXCEPTION 'Administrators cannot change their own role' USING ERRCODE='42501'; END IF;
  IF new_role NOT IN ('user','admin') THEN RAISE EXCEPTION 'Unknown role' USING ERRCODE='22023'; END IF;
  UPDATE public.mt_profiles SET role=new_role WHERE id=target RETURNING jsonb_build_object('id',id,'role',role) INTO result;
  IF result IS NULL THEN RAISE EXCEPTION 'Account not found' USING ERRCODE='23503'; END IF;
  RETURN result;
END; $$;
REVOKE ALL ON FUNCTION public.mt_admin_set_role(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mt_admin_set_role(uuid,text) TO authenticated;

-- Meet-ups stand in for bookings: a meet-up has a date, a price, a capacity and join requests with a status.
CREATE OR REPLACE FUNCTION public.mt_admin_meetups(search_text text DEFAULT '', status_filter text DEFAULT '', from_date date DEFAULT NULL, to_date date DEFAULT NULL, place_filter bigint DEFAULT NULL, sort_key text DEFAULT 'soonest', page_offset integer DEFAULT 0, page_size integer DEFAULT 20) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE pattern text := mt_private.search_pattern(search_text);
BEGIN
  PERFORM mt_private.require_admin();
  PERFORM mt_private.check_page(page_offset, page_size);
  RETURN (WITH listed AS (
    SELECT e.id,e.title,e.location,e.place_id,pl.name AS place_name,e.starts_at,e.price,e.capacity,e.status,e.created_at,
      coalesce(pp.display_name,'Explorer') AS host, u.email AS host_email,
      (SELECT count(*) FROM public.mt_event_applications a WHERE a.event_id=e.id AND a.status='accepted') AS accepted,
      (SELECT count(*) FROM public.mt_event_applications a WHERE a.event_id=e.id AND a.status='pending') AS pending,
      (SELECT count(*) FROM public.mt_event_reports r WHERE r.event_id=e.id) AS reports
    FROM public.mt_events e LEFT JOIN public.mt_places pl ON pl.id=e.place_id
    LEFT JOIN public.mt_public_profiles pp ON pp.user_id=e.creator_id LEFT JOIN auth.users u ON u.id=e.creator_id
    WHERE (coalesce(status_filter,'')='' OR e.status=status_filter)
      AND (from_date IS NULL OR (e.starts_at AT TIME ZONE 'America/Martinique')::date >= from_date)
      AND (to_date IS NULL OR (e.starts_at AT TIME ZONE 'America/Martinique')::date <= to_date)
      AND (place_filter IS NULL OR e.place_id=place_filter)
      AND (coalesce(search_text,'')='' OR e.title ILIKE pattern OR e.location ILIKE pattern OR pp.display_name ILIKE pattern OR u.email ILIKE pattern)
  ), ordered AS (
    SELECT l.*, row_number() OVER (ORDER BY
      CASE WHEN sort_key='latest' THEN l.starts_at END DESC,
      CASE WHEN sort_key='created' THEN l.created_at END DESC,
      CASE WHEN sort_key='price' THEN l.price END DESC,
      l.starts_at ASC, l.id) AS position
    FROM listed l
  )
  SELECT jsonb_build_object('total',(SELECT count(*) FROM listed),
    'rows',coalesce((SELECT jsonb_agg(to_jsonb(o) - 'position' ORDER BY o.position) FROM (
      SELECT * FROM ordered ORDER BY position LIMIT page_size OFFSET page_offset) o),'[]'::jsonb)));
END; $$;
REVOKE ALL ON FUNCTION public.mt_admin_meetups(text,text,date,date,bigint,text,integer,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mt_admin_meetups(text,text,date,date,bigint,text,integer,integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.mt_admin_meetup(target bigint) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE result jsonb;
BEGIN
  PERFORM mt_private.require_admin();
  SELECT to_jsonb(e) || jsonb_build_object(
    'place_name',(SELECT name FROM public.mt_places WHERE id=e.place_id),
    'host',coalesce((SELECT display_name FROM public.mt_public_profiles WHERE user_id=e.creator_id),'Explorer'),
    'host_email',(SELECT email FROM auth.users WHERE id=e.creator_id),
    'requests',coalesce((SELECT jsonb_agg(a ORDER BY a.created_at) FROM (
      SELECT a.user_id,a.status,a.created_at,coalesce(pp.display_name,'Explorer') AS name,u.email
      FROM public.mt_event_applications a LEFT JOIN public.mt_public_profiles pp ON pp.user_id=a.user_id LEFT JOIN auth.users u ON u.id=a.user_id
      WHERE a.event_id=e.id) a),'[]'::jsonb),
    'reports',coalesce((SELECT jsonb_agg(r ORDER BY r.created_at DESC) FROM (
      SELECT r.reason,r.created_at,coalesce(pp.display_name,'Explorer') AS reporter
      FROM public.mt_event_reports r LEFT JOIN public.mt_public_profiles pp ON pp.user_id=r.user_id WHERE r.event_id=e.id) r),'[]'::jsonb)
  ) INTO result FROM public.mt_events e WHERE e.id=target;
  IF result IS NULL THEN RAISE EXCEPTION 'Meet-up not found' USING ERRCODE='23503'; END IF;
  RETURN result;
END; $$;
REVOKE ALL ON FUNCTION public.mt_admin_meetup(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mt_admin_meetup(bigint) TO authenticated;

-- One row per join request, for the CSV export.
CREATE OR REPLACE FUNCTION public.mt_admin_meetup_export(search_text text DEFAULT '', status_filter text DEFAULT '', from_date date DEFAULT NULL, to_date date DEFAULT NULL, place_filter bigint DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE pattern text := mt_private.search_pattern(search_text);
BEGIN
  PERFORM mt_private.require_admin();
  RETURN coalesce((SELECT jsonb_agg(x ORDER BY x.starts_at, x.meetup_id, x.requested_at) FROM (
    SELECT e.id AS meetup_id,e.title,e.starts_at,e.location,pl.name AS place_name,e.price,e.capacity,e.status AS meetup_status,
      coalesce(hp.display_name,'Explorer') AS host,hu.email AS host_email,
      coalesce(ap.display_name,'Explorer') AS participant,au.email AS participant_email,a.status AS request_status,a.created_at AS requested_at
    FROM public.mt_events e JOIN public.mt_event_applications a ON a.event_id=e.id
    LEFT JOIN public.mt_places pl ON pl.id=e.place_id
    LEFT JOIN public.mt_public_profiles hp ON hp.user_id=e.creator_id LEFT JOIN auth.users hu ON hu.id=e.creator_id
    LEFT JOIN public.mt_public_profiles ap ON ap.user_id=a.user_id LEFT JOIN auth.users au ON au.id=a.user_id
    WHERE (coalesce(status_filter,'')='' OR e.status=status_filter)
      AND (from_date IS NULL OR (e.starts_at AT TIME ZONE 'America/Martinique')::date >= from_date)
      AND (to_date IS NULL OR (e.starts_at AT TIME ZONE 'America/Martinique')::date <= to_date)
      AND (place_filter IS NULL OR e.place_id=place_filter)
      AND (coalesce(search_text,'')='' OR e.title ILIKE pattern OR e.location ILIKE pattern OR hp.display_name ILIKE pattern OR hu.email ILIKE pattern)
    ORDER BY e.starts_at, e.id, a.created_at LIMIT 5000) x),'[]'::jsonb);
END; $$;
REVOKE ALL ON FUNCTION public.mt_admin_meetup_export(text,text,date,date,bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mt_admin_meetup_export(text,text,date,date,bigint) TO authenticated;

CREATE OR REPLACE FUNCTION public.mt_admin_meetup_write(action text, target bigint, member uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE event_row public.mt_events; result jsonb;
BEGIN
  PERFORM mt_private.require_admin();
  SELECT * INTO event_row FROM public.mt_events WHERE id=target FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Meet-up not found' USING ERRCODE='23503'; END IF;
  IF action = 'cancel' THEN
    UPDATE public.mt_events SET status='cancelled' WHERE id=target;
  ELSIF action = 'reopen' THEN
    -- Only a meet-up that has not started can be offered again.
    IF event_row.starts_at <= now() OR event_row.expires_at <= now() THEN RAISE EXCEPTION 'Meet-up has ended' USING ERRCODE='22023'; END IF;
    UPDATE public.mt_events SET status='live' WHERE id=target;
  ELSIF action IN ('pending','accepted','declined') THEN
    IF member IS NULL THEN RAISE EXCEPTION 'Choose a participant' USING ERRCODE='22023'; END IF;
    -- The host takes one of the places, as in mt_social_write.
    IF action = 'accepted' AND (SELECT count(*) FROM public.mt_event_applications WHERE event_id=target AND status='accepted' AND user_id<>member) >= event_row.capacity-1 THEN
      RAISE EXCEPTION 'Event is full' USING ERRCODE='22023';
    END IF;
    UPDATE public.mt_event_applications SET status=action WHERE event_id=target AND user_id=member RETURNING jsonb_build_object('status',status) INTO result;
    IF result IS NULL THEN RAISE EXCEPTION 'Request not found' USING ERRCODE='23503'; END IF;
  ELSE
    RAISE EXCEPTION 'Unknown action' USING ERRCODE='22023';
  END IF;
  RETURN jsonb_build_object('id',target,'title',event_row.title);
END; $$;
REVOKE ALL ON FUNCTION public.mt_admin_meetup_write(text,bigint,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mt_admin_meetup_write(text,bigint,uuid) TO authenticated;

-- The dashboard's figures in one call.
CREATE OR REPLACE FUNCTION public.mt_admin_overview() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE month_start timestamptz := date_trunc('month', now() AT TIME ZONE 'America/Martinique') AT TIME ZONE 'America/Martinique';
BEGIN
  PERFORM mt_private.require_admin();
  RETURN jsonb_build_object(
    'users',(SELECT count(*) FROM public.mt_profiles),
    'usersThisMonth',(SELECT count(*) FROM auth.users WHERE created_at >= month_start),
    'admins',(SELECT count(*) FROM public.mt_profiles WHERE role='admin'),
    'suspended',(SELECT count(*) FROM auth.users WHERE banned_until > now()),
    'places',(SELECT count(*) FROM public.mt_places WHERE published),
    'tours',(SELECT count(*) FROM public.mt_tours),
    'toursPublished',(SELECT count(*) FROM public.mt_tours WHERE published),
    'meetups',(SELECT count(*) FROM public.mt_events),
    'meetupsThisMonth',(SELECT count(*) FROM public.mt_events WHERE created_at >= month_start),
    'meetupsUpcoming',(SELECT count(*) FROM public.mt_events WHERE status='live' AND starts_at > now()),
    'requestsPending',(SELECT count(*) FROM public.mt_event_applications a JOIN public.mt_events e ON e.id=a.event_id WHERE a.status='pending' AND e.status='live'),
    'requestsAccepted',(SELECT count(*) FROM public.mt_event_applications WHERE status='accepted'),
    'reviews',(SELECT count(*) FROM public.mt_reviews),
    'reviewsThisMonth',(SELECT count(*) FROM public.mt_reviews WHERE created_at >= month_start),
    'reviewsHidden',(SELECT count(*) FROM public.mt_reviews WHERE hidden),
    'submissionsPending',(SELECT count(*) FROM public.mt_submissions WHERE status='pending'),
    'messagesNew',(SELECT count(*) FROM public.mt_contact_messages WHERE status='new'),
    'eventReports',(SELECT count(*) FROM public.mt_event_reports),
    'mostSaved',coalesce((SELECT jsonb_agg(s ORDER BY s.saves DESC, s.name) FROM (
      SELECT p.id,p.name,count(*) AS saves FROM public.mt_saved_places sp JOIN public.mt_places p ON p.id=sp.place_id
      GROUP BY p.id,p.name ORDER BY count(*) DESC, p.name LIMIT 5) s),'[]'::jsonb),
    'mostReviewed',coalesce((SELECT jsonb_agg(s ORDER BY s.reviews DESC, s.name) FROM (
      SELECT p.id,p.name,p.community_rating AS rating,count(*) AS reviews FROM public.mt_reviews r JOIN public.mt_places p ON p.id=r.place_id
      WHERE NOT r.hidden GROUP BY p.id,p.name,p.community_rating ORDER BY count(*) DESC, p.name LIMIT 5) s),'[]'::jsonb),
    -- Tours ranked by how many people saved their stops: the closest thing to popularity without bookings.
    'popularTours',coalesce((SELECT jsonb_agg(s ORDER BY s.saves DESC, s.name) FROM (
      SELECT t.id,t.name,t.published,(SELECT count(*) FROM public.mt_saved_places sp
        WHERE sp.place_id IN (SELECT (stop->>'placeId')::bigint FROM jsonb_array_elements(t.stops) stop)) AS saves
      FROM public.mt_tours t ORDER BY saves DESC, t.name LIMIT 5) s),'[]'::jsonb),
    'recentUsers',coalesce((SELECT jsonb_agg(s ORDER BY s.created_at DESC) FROM (
      SELECT u.id,u.email,u.created_at,coalesce(pp.display_name, split_part(u.email,'@',1)) AS name
      FROM auth.users u LEFT JOIN public.mt_public_profiles pp ON pp.user_id=u.id ORDER BY u.created_at DESC LIMIT 5) s),'[]'::jsonb),
    'recentActivity',coalesce((SELECT jsonb_agg(s ORDER BY s.created_at DESC, s.id DESC) FROM (
      SELECT id,actor_email,action,summary,created_at FROM public.mt_admin_log ORDER BY created_at DESC, id DESC LIMIT 8) s),'[]'::jsonb)
  );
END; $$;
REVOKE ALL ON FUNCTION public.mt_admin_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mt_admin_overview() TO authenticated;

-- The signed-in person's own activity for the account page: meet-ups they host, meet-ups they asked to join, and
-- their reviews. Nothing about anyone else.
CREATE OR REPLACE FUNCTION public.mt_my_activity() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE me uuid := auth.uid();
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  RETURN jsonb_build_object(
    'meetups',coalesce((SELECT jsonb_agg(m ORDER BY m.starts_at DESC) FROM (
      SELECT e.id,e.title,e.location,e.starts_at,e.price,e.capacity,e.status,
        (SELECT count(*) FROM public.mt_event_applications a WHERE a.event_id=e.id AND a.status='accepted') AS accepted,
        (SELECT count(*) FROM public.mt_event_applications a WHERE a.event_id=e.id AND a.status='pending') AS pending
      FROM public.mt_events e WHERE e.creator_id=me ORDER BY e.starts_at DESC LIMIT 30) m),'[]'::jsonb),
    'requests',coalesce((SELECT jsonb_agg(r ORDER BY r.starts_at DESC) FROM (
      SELECT e.id,e.title,e.location,e.starts_at,e.price,e.status AS meetup_status,a.status,a.created_at
      FROM public.mt_event_applications a JOIN public.mt_events e ON e.id=a.event_id
      WHERE a.user_id=me ORDER BY e.starts_at DESC LIMIT 30) r),'[]'::jsonb),
    'reviews',coalesce((SELECT jsonb_agg(r ORDER BY r.created_at DESC) FROM (
      SELECT r.id,r.place_id,p.name AS place_name,r.rating,r.body,r.hidden,r.created_at
      FROM public.mt_reviews r JOIN public.mt_places p ON p.id=r.place_id
      WHERE r.user_id=me ORDER BY r.created_at DESC LIMIT 30) r),'[]'::jsonb)
  );
END; $$;
REVOKE ALL ON FUNCTION public.mt_my_activity() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mt_my_activity() TO authenticated;

ALTER TABLE public.mt_admin_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mt_contact_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mt_site_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mt_admin_log, public.mt_contact_messages, public.mt_site_settings FROM anon, authenticated;
GRANT SELECT ON public.mt_site_settings TO anon, authenticated;
GRANT UPDATE(content, updated_at) ON public.mt_site_settings TO authenticated;
GRANT ALL ON public.mt_admin_log, public.mt_contact_messages, public.mt_site_settings TO service_role;
GRANT USAGE ON SEQUENCE public.mt_admin_log_id_seq, public.mt_contact_messages_id_seq TO service_role;
DROP POLICY IF EXISTS mt_site_settings_read ON public.mt_site_settings;
CREATE POLICY mt_site_settings_read ON public.mt_site_settings FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS mt_site_settings_admin ON public.mt_site_settings;
CREATE POLICY mt_site_settings_admin ON public.mt_site_settings FOR UPDATE TO authenticated USING ((SELECT public.mt_is_admin())) WITH CHECK ((SELECT public.mt_is_admin()));
