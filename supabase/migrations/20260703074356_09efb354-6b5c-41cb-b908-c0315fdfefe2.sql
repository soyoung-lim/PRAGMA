ALTER FUNCTION public.save_generated_scenario(jsonb) SECURITY DEFINER SET search_path = public;
REVOKE ALL ON FUNCTION public.save_generated_scenario(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_generated_scenario(jsonb) TO authenticated, service_role;