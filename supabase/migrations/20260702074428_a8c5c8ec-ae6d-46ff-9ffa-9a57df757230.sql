REVOKE EXECUTE ON FUNCTION public.ensure_test_dev_profile() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_test_dev_profile() TO service_role;