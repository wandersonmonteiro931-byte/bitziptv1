
CREATE TABLE public.custom_variables (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  var_key text NOT NULL UNIQUE,
  label text NOT NULL DEFAULT '',
  default_value text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.custom_variables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on custom_variables"
  ON public.custom_variables FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated read custom_variables"
  ON public.custom_variables FOR SELECT
  USING (true);

CREATE TRIGGER update_custom_variables_updated_at
  BEFORE UPDATE ON public.custom_variables
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
