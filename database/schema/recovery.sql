-- One-time recovery codes: a way to reset a forgotten password without sending any email.
-- Only hashes are stored. Neither guests nor signed-in browsers can touch the table or call the functions
-- below; only the server, using the service role, can. The readable codes exist once, when they are issued.
CREATE TABLE IF NOT EXISTS public.mt_recovery_codes (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code_hash text NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mt_recovery_codes_unused_idx ON public.mt_recovery_codes(user_id) WHERE used_at IS NULL;
ALTER TABLE public.mt_recovery_codes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mt_recovery_codes FROM anon, authenticated;
GRANT ALL ON public.mt_recovery_codes TO service_role;

-- Replaces every code of an account with a new set, in one step, so a failure never leaves it with none.
CREATE OR REPLACE FUNCTION public.mt_replace_recovery_codes(target uuid, hashes jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF jsonb_typeof(hashes) <> 'array' OR jsonb_array_length(hashes) NOT BETWEEN 1 AND 16 THEN RAISE EXCEPTION 'Invalid recovery codes' USING ERRCODE='22023'; END IF;
  DELETE FROM public.mt_recovery_codes WHERE user_id=target;
  INSERT INTO public.mt_recovery_codes(user_id,code_hash) SELECT target, value FROM jsonb_array_elements_text(hashes);
END; $$;

-- The unused codes of the account that owns an email address, for the server to check a code against.
CREATE OR REPLACE FUNCTION public.mt_recovery_candidates(account_email text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('userId',u.id,'codeId',c.id,'hash',c.code_hash)),'[]'::jsonb)
  FROM auth.users u JOIN public.mt_recovery_codes c ON c.user_id=u.id AND c.used_at IS NULL
  WHERE lower(u.email)=lower(account_email);
$$;

-- Uses a code up. True for exactly one caller, however many try at the same moment.
CREATE OR REPLACE FUNCTION public.mt_consume_recovery_code(code_id bigint) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE public.mt_recovery_codes SET used_at=now() WHERE id=code_id AND used_at IS NULL;
  RETURN FOUND;
END; $$;

CREATE OR REPLACE FUNCTION public.mt_recovery_codes_left(target uuid) RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT count(*)::integer FROM public.mt_recovery_codes WHERE user_id=target AND used_at IS NULL;
$$;

-- Signs an account out everywhere after its password was reset. The service role may not delete from
-- auth.sessions itself, so this runs as the function owner. A project without sessions is left alone.
CREATE OR REPLACE FUNCTION public.mt_revoke_user_sessions(target uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF to_regclass('auth.sessions') IS NOT NULL THEN EXECUTE 'DELETE FROM auth.sessions WHERE user_id=$1' USING target; END IF;
END; $$;

REVOKE ALL ON FUNCTION public.mt_replace_recovery_codes(uuid,jsonb), public.mt_recovery_candidates(text), public.mt_consume_recovery_code(bigint), public.mt_recovery_codes_left(uuid), public.mt_revoke_user_sessions(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mt_replace_recovery_codes(uuid,jsonb), public.mt_recovery_candidates(text), public.mt_consume_recovery_code(bigint), public.mt_recovery_codes_left(uuid), public.mt_revoke_user_sessions(uuid) TO service_role;

-- An email address nobody has checked can never count as verified. Clearing the flag in the same transaction
-- that changes the address means a change that fails, for example because the address is taken, costs nothing.
CREATE OR REPLACE FUNCTION public.mt_unverify_on_email_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email THEN UPDATE public.mt_profiles SET email_verified_at=NULL WHERE id=NEW.id; END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.mt_unverify_on_email_change() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS mt_email_changed ON auth.users;
CREATE TRIGGER mt_email_changed AFTER UPDATE OF email ON auth.users FOR EACH ROW EXECUTE FUNCTION public.mt_unverify_on_email_change();
