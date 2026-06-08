REVOKE SELECT (researcher_notes) ON public.archive_items FROM anon;
REVOKE SELECT (researcher_notes) ON public.archive_items FROM authenticated;
REVOKE SELECT (researcher_notes) ON public.archive_items FROM PUBLIC;