-- Recreate the missing signup trigger (lost during remix)
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill profile rows for users who signed up while the trigger was missing
INSERT INTO public.profiles (user_id, email, role, approval_status, profile_completed)
SELECT u.id, u.email, 'learner', 'pending_approval', false
FROM auth.users u
LEFT JOIN public.profiles p ON p.user_id = u.id
WHERE p.user_id IS NULL;