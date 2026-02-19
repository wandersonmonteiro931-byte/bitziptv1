
-- Function to get next BITZ code
CREATE OR REPLACE FUNCTION public.next_bitz_code()
RETURNS text
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT 'BITZ' || LPAD((COALESCE(MAX(
    CASE WHEN iptv_client_code ~ '^BITZ[0-9]{4,}$' 
    THEN CAST(SUBSTRING(iptv_client_code FROM 5) AS integer) 
    ELSE 0 END
  ), 0) + 1)::text, 4, '0')
  FROM public.profiles;
$$;

-- Trigger function to auto-assign code on insert
CREATE OR REPLACE FUNCTION public.assign_bitz_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.iptv_client_code IS NULL OR NEW.iptv_client_code = '' THEN
    NEW.iptv_client_code := public.next_bitz_code();
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger
CREATE TRIGGER trg_assign_bitz_code
BEFORE INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.assign_bitz_code();
