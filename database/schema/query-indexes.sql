-- Match the ownership filter and deterministic ordering of saved-list queries.
CREATE INDEX IF NOT EXISTS mt_saved_places_user_kind_created_idx
  ON public.mt_saved_places(user_id, kind, created_at, place_id);
-- Published catalogue pages do not scan unpublished entries.
CREATE INDEX IF NOT EXISTS mt_places_published_id_idx
  ON public.mt_places(id) WHERE published;
-- Expired rate-limit cleanup runs during authentication attempts.
CREATE INDEX IF NOT EXISTS mt_rate_limits_expires_idx
  ON public.mt_rate_limits(expires_at);
