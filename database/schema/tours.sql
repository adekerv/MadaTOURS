-- Tours: routes an administrator curates, with the stops in order. Anyone can read a published tour; only
-- administrators can create, change or remove one (the same rule as places). The road route between the stops is
-- worked out once, when the stops are saved, and stored here as a GeoJSON line so the map just draws it.
CREATE TABLE IF NOT EXISTS public.mt_tours (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL CHECK(char_length(trim(name)) BETWEEN 3 AND 120),
  name_fr text CHECK(name_fr IS NULL OR char_length(trim(name_fr)) BETWEEN 3 AND 120),
  description text NOT NULL CHECK(char_length(trim(description)) BETWEEN 10 AND 2000),
  description_fr text CHECK(description_fr IS NULL OR char_length(trim(description_fr)) BETWEEN 10 AND 2000),
  -- Ordered: [{"placeId": 12, "minutes": 60}, ...]
  stops jsonb NOT NULL CHECK(jsonb_typeof(stops)='array' AND jsonb_array_length(stops) BETWEEN 2 AND 25),
  published boolean NOT NULL DEFAULT false,
  -- The road line as GeoJSON (a LineString), or NULL while only straight lines are known.
  route_geojson jsonb CHECK(route_geojson IS NULL OR route_geojson->>'type'='LineString'),
  route_distance_m integer CHECK(route_distance_m IS NULL OR route_distance_m >= 0),
  route_duration_s integer CHECK(route_duration_s IS NULL OR route_duration_s >= 0),
  -- A fingerprint of the stops the route was last worked out for, so unchanged stops never ask for a route again.
  route_stops_hash text,
  route_computed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mt_tours_published_idx ON public.mt_tours(published, id);

-- Every stop must be a place that exists, with a sensible visit length, and no place may appear twice.
CREATE OR REPLACE FUNCTION mt_private.check_tour() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE stop jsonb; seen bigint[] := '{}';
BEGIN
  NEW.updated_at := now();
  -- Only changed stops are checked, so a place removed later never blocks renaming or unpublishing the tour.
  IF TG_OP = 'UPDATE' AND NEW.stops IS NOT DISTINCT FROM OLD.stops THEN RETURN NEW; END IF;
  FOR stop IN SELECT value FROM jsonb_array_elements(NEW.stops) LOOP
    IF jsonb_typeof(stop->'placeId') <> 'number' OR jsonb_typeof(stop->'minutes') <> 'number'
       OR (stop->>'placeId') !~ '^[0-9]{1,15}$' OR (stop->>'minutes') !~ '^[0-9]{1,3}$'
       OR (stop->>'minutes')::int NOT BETWEEN 5 AND 720 THEN
      RAISE EXCEPTION 'Each stop needs a place and a visit time of 5 to 720 minutes' USING ERRCODE='22023';
    END IF;
    IF (stop->>'placeId')::bigint = ANY(seen) THEN RAISE EXCEPTION 'A place can appear once in a tour' USING ERRCODE='22023'; END IF;
    seen := seen || (stop->>'placeId')::bigint;
    IF NOT EXISTS(SELECT 1 FROM public.mt_places WHERE id=(stop->>'placeId')::bigint) THEN RAISE EXCEPTION 'Unknown place in tour' USING ERRCODE='23503'; END IF;
  END LOOP;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION mt_private.check_tour() FROM PUBLIC;
DROP TRIGGER IF EXISTS mt_tour_check ON public.mt_tours;
CREATE TRIGGER mt_tour_check BEFORE INSERT OR UPDATE ON public.mt_tours FOR EACH ROW EXECUTE FUNCTION mt_private.check_tour();

ALTER TABLE public.mt_tours ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mt_tours FROM anon, authenticated;
GRANT SELECT ON public.mt_tours TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.mt_tours TO authenticated;
GRANT ALL ON public.mt_tours TO service_role;
GRANT USAGE ON SEQUENCE public.mt_tours_id_seq TO authenticated;
DROP POLICY IF EXISTS mt_tours_read ON public.mt_tours;
CREATE POLICY mt_tours_read ON public.mt_tours FOR SELECT TO anon, authenticated USING (published OR (SELECT public.mt_is_admin()));
DROP POLICY IF EXISTS mt_tours_admin_insert ON public.mt_tours;
CREATE POLICY mt_tours_admin_insert ON public.mt_tours FOR INSERT TO authenticated WITH CHECK ((SELECT public.mt_is_admin()));
DROP POLICY IF EXISTS mt_tours_admin_update ON public.mt_tours;
CREATE POLICY mt_tours_admin_update ON public.mt_tours FOR UPDATE TO authenticated USING ((SELECT public.mt_is_admin())) WITH CHECK ((SELECT public.mt_is_admin()));
DROP POLICY IF EXISTS mt_tours_admin_delete ON public.mt_tours;
CREATE POLICY mt_tours_admin_delete ON public.mt_tours FOR DELETE TO authenticated USING ((SELECT public.mt_is_admin()));
