-- Upsert court + queue rows for GIS sync scripts (SECURITY DEFINER).
CREATE OR REPLACE FUNCTION public.upsert_court_location(
  p_id uuid DEFAULT NULL,
  p_name text DEFAULT NULL,
  p_address text DEFAULT NULL,
  p_latitude double precision DEFAULT NULL,
  p_longitude double precision DEFAULT NULL,
  p_court_type text DEFAULT 'tennis',
  p_num_courts integer DEFAULT 2,
  p_amenities text[] DEFAULT ARRAY['Tennis', 'Outdoor', 'Free']
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_court_id uuid;
BEGIN
  IF p_name IS NULL OR btrim(p_name) = '' THEN
    RAISE EXCEPTION 'Court name is required';
  END IF;

  v_court_id := p_id;

  IF v_court_id IS NULL THEN
    SELECT c.id INTO v_court_id
    FROM public.courts c
    WHERE lower(btrim(c.name)) = lower(btrim(p_name))
    LIMIT 1;
  END IF;

  IF v_court_id IS NULL THEN
    INSERT INTO public.courts (
      name, address, latitude, longitude, court_type, num_courts, amenities, is_active
    )
    VALUES (
      btrim(p_name),
      p_address,
      p_latitude,
      p_longitude,
      p_court_type,
      GREATEST(1, COALESCE(p_num_courts, 2)),
      COALESCE(p_amenities, ARRAY['Tennis', 'Outdoor', 'Free']),
      true
    )
    RETURNING id INTO v_court_id;
  ELSE
    UPDATE public.courts
    SET
      name = btrim(p_name),
      address = COALESCE(p_address, address),
      latitude = COALESCE(p_latitude, latitude),
      longitude = COALESCE(p_longitude, longitude),
      court_type = COALESCE(p_court_type, court_type),
      num_courts = GREATEST(1, COALESCE(p_num_courts, num_courts)),
      amenities = COALESCE(p_amenities, amenities),
      is_active = true
    WHERE id = v_court_id;
  END IF;

  INSERT INTO public.queues (court_id, is_active)
  VALUES (v_court_id, true)
  ON CONFLICT (court_id) DO UPDATE SET is_active = true;

  RETURN v_court_id;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_court_location(uuid, text, text, double precision, double precision, text, integer, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_court_location(uuid, text, text, double precision, double precision, text, integer, text[]) TO anon, authenticated, service_role;
