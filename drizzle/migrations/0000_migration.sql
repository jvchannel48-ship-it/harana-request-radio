-- RJ FM station storage (server-only; accessed through the service role)
CREATE TABLE IF NOT EXISTS public.morefm_state (
  storage_key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.morefm_state TO service_role;
ALTER TABLE public.morefm_state ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.morefm_listeners (
  listener_id text PRIMARY KEY,
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.morefm_listeners TO service_role;
ALTER TABLE public.morefm_listeners ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.songs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  artist text NOT NULL,
  youtube_id text NOT NULL UNIQUE,
  category text NOT NULL DEFAULT 'english',
  language text,
  decade text,
  picture text,
  duration_seconds integer NOT NULL CHECK (duration_seconds BETWEEN 60 AND 540),
  playlist_group text NOT NULL DEFAULT 'RJ TOP SONGS' CHECK (playlist_group IN ('RJ TOP SONGS', 'RJ PLAYED')),
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS songs_active_playlist_idx ON public.songs (is_active, playlist_group, sort_order);
GRANT ALL ON public.songs TO service_role;
ALTER TABLE public.songs ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'Listener',
  song_title text NOT NULL,
  artist text,
  message text,
  note text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'played', 'skipped')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS requests_status_created_idx ON public.requests (status, created_at DESC);
GRANT ALL ON public.requests TO service_role;
ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.top_played (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id uuid REFERENCES public.songs(id) ON DELETE SET NULL,
  youtube_id text NOT NULL UNIQUE,
  title text NOT NULL,
  artist text NOT NULL,
  play_count bigint NOT NULL DEFAULT 0 CHECK (play_count >= 0),
  last_played_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS top_played_rank_idx ON public.top_played (play_count DESC, last_played_at DESC);
GRANT ALL ON public.top_played TO service_role;
ALTER TABLE public.top_played ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.morefm_acquire_lease(_key text, _owner text, _expires_at bigint, _now bigint)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE got text;
BEGIN
  INSERT INTO public.morefm_state (storage_key, value, updated_at)
  VALUES (_key, jsonb_build_object('owner', _owner, 'expiresAt', _expires_at), now())
  ON CONFLICT (storage_key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
  WHERE CASE WHEN public.morefm_state.value->>'expiresAt' ~ '^[0-9]+$'
    THEN (public.morefm_state.value->>'expiresAt')::bigint ELSE 0 END <= _now
  RETURNING value->>'owner' INTO got;
  RETURN got IS NOT NULL AND got = _owner;
END $$;

CREATE OR REPLACE FUNCTION public.morefm_renew_lease(_key text, _owner text, _expires_at bigint, _now bigint)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int;
BEGIN
  UPDATE public.morefm_state
  SET value = jsonb_set(value, '{expiresAt}', to_jsonb(_expires_at), true), updated_at = now()
  WHERE storage_key = _key AND value->>'owner' = _owner
    AND CASE WHEN value->>'expiresAt' ~ '^[0-9]+$' THEN (value->>'expiresAt')::bigint ELSE 0 END > _now;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n = 1;
END $$;

CREATE OR REPLACE FUNCTION public.morefm_release_lease(_key text, _owner text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM public.morefm_state WHERE storage_key = _key AND value->>'owner' = _owner;
$$;

CREATE OR REPLACE FUNCTION public.morefm_register_listener(_id text, _active boolean, _limit integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE accepted boolean := true; total int; existing boolean;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('morefm_listener_admission'));
  DELETE FROM public.morefm_listeners WHERE last_seen_at < now() - interval '60 seconds';
  IF _active THEN
    SELECT EXISTS (SELECT 1 FROM public.morefm_listeners WHERE listener_id = _id) INTO existing;
    SELECT count(*) INTO total FROM public.morefm_listeners;
    IF NOT existing AND _limit > 0 AND total >= _limit THEN
      accepted := false;
    ELSE
      INSERT INTO public.morefm_listeners (listener_id, last_seen_at) VALUES (_id, now())
      ON CONFLICT (listener_id) DO UPDATE SET last_seen_at = now();
    END IF;
  ELSE
    DELETE FROM public.morefm_listeners WHERE listener_id = _id;
  END IF;
  SELECT count(*) INTO total FROM public.morefm_listeners;
  RETURN jsonb_build_object('accepted', accepted, 'listenersNow', total);
END $$;

CREATE OR REPLACE FUNCTION public.morefm_listener_count()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE total int;
BEGIN
  DELETE FROM public.morefm_listeners WHERE last_seen_at < now() - interval '60 seconds';
  SELECT count(*) INTO total FROM public.morefm_listeners;
  RETURN total;
END $$;

CREATE OR REPLACE FUNCTION public.morefm_storage_usage()
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = public, storage AS $$
  SELECT jsonb_build_object(
    'databaseBytes', pg_database_size(current_database()),
    'audioBytes', COALESCE((SELECT sum(NULLIF(metadata->>'size', '')::bigint) FROM storage.objects WHERE bucket_id = 'more-fm-media'), 0),
    'audioFiles', COALESCE((SELECT count(*) FROM storage.objects WHERE bucket_id = 'more-fm-media'), 0)
  );
$$;

REVOKE ALL ON FUNCTION public.morefm_acquire_lease(text, text, bigint, bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.morefm_renew_lease(text, text, bigint, bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.morefm_release_lease(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.morefm_register_listener(text, boolean, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.morefm_listener_count() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.morefm_storage_usage() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.morefm_acquire_lease(text, text, bigint, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.morefm_renew_lease(text, text, bigint, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.morefm_release_lease(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.morefm_register_listener(text, boolean, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.morefm_listener_count() TO service_role;
GRANT EXECUTE ON FUNCTION public.morefm_storage_usage() TO service_role;