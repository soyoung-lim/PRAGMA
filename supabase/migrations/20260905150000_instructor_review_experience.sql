-- Add version-bound instructor observations. No batch approval or release policy change.
ALTER TABLE public.content_review_runs ADD COLUMN instructor_experience jsonb;
ALTER TABLE public.content_review_runs ADD COLUMN instructor_experience_by uuid REFERENCES auth.users(id);
ALTER TABLE public.content_review_runs ADD COLUMN instructor_experience_at timestamptz;

CREATE FUNCTION public.validate_instructor_experience(p_value jsonb, p_require_clear boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_ids text[] := ARRAY['scene','mjt-0','mjt-1','mjt-2','mjt-3','mjt-4','recap','dct'];
BEGIN
  IF jsonb_typeof(p_value) IS DISTINCT FROM 'object'
    OR p_value->>'version' IS DISTINCT FROM 'instructor_experience_v1'
    OR jsonb_typeof(p_value->'decisions') IS DISTINCT FROM 'array'
    OR jsonb_typeof(p_value->'active_seconds') IS DISTINCT FROM 'number' THEN
    RAISE EXCEPTION 'Invalid instructor experience';
  END IF;
  IF (p_value->>'active_seconds')::numeric < 0
    OR (p_value->>'active_seconds')::numeric <> trunc((p_value->>'active_seconds')::numeric)
    OR pg_column_size(p_value) > 24000
    OR jsonb_array_length(p_value->'decisions') > 8
    OR (SELECT count(DISTINCT d->>'section') FROM jsonb_array_elements(p_value->'decisions') d) <> jsonb_array_length(p_value->'decisions')
    OR EXISTS (SELECT 1 FROM jsonb_array_elements(p_value->'decisions') d WHERE
      jsonb_typeof(d) IS DISTINCT FROM 'object'
      OR NOT (COALESCE(d->>'section','') = ANY(v_ids))
      OR COALESCE(d->>'status','') NOT IN ('checked','revision_required','defer')
      OR jsonb_typeof(d->'note') IS DISTINCT FROM 'string'
      OR length(d->>'note') > 2000) THEN
    RAISE EXCEPTION 'Invalid instructor experience decisions';
  END IF;
  IF p_require_clear AND (jsonb_array_length(p_value->'decisions') <> 8 OR EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_value->'decisions') d WHERE d->>'status' <> 'checked')) THEN
    RAISE EXCEPTION 'Complete instructor experience; revision or defer cannot be approved';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.validate_instructor_experience(jsonb, boolean) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.save_instructor_experience(p_review_id uuid, p_content_hash text, p_experience jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_review public.content_review_runs; v_source jsonb;
BEGIN
  IF NOT COALESCE(public.is_admin(), false) THEN RAISE EXCEPTION 'Only admins can save instructor experience'; END IF;
  SELECT * INTO v_review FROM public.content_review_runs WHERE id = p_review_id FOR UPDATE;
  IF NOT FOUND OR v_review.kind <> 'mission' OR v_review.content_hash IS DISTINCT FROM p_content_hash THEN
    RAISE EXCEPTION 'Review target or content version mismatch';
  END IF;
  IF v_review.approved_at IS NOT NULL THEN RAISE EXCEPTION 'Approved review evidence is immutable'; END IF;
  v_source := public.content_review_source_internal(v_review.kind, v_review.target_id, v_review.week_no);
  IF v_source->>'source_hash' IS DISTINCT FROM v_review.source_hash THEN RAISE EXCEPTION 'Content changed; inspect the current version'; END IF;
  PERFORM public.validate_instructor_experience(p_experience);
  UPDATE public.content_review_runs SET instructor_experience = p_experience,
    instructor_experience_by = auth.uid(), instructor_experience_at = now() WHERE id = p_review_id;
  RETURN p_review_id;
END;
$$;
REVOKE ALL ON FUNCTION public.save_instructor_experience(uuid, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_instructor_experience(uuid, text, jsonb) TO authenticated;

-- Both mission finalization and retrospective approval pass through this trigger.
-- Existing approvals without an experience record retain their original basis.
CREATE FUNCTION public.guard_instructor_experience_approval()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.instructor_experience IS NOT NULL THEN
    PERFORM public.validate_instructor_experience(NEW.instructor_experience, NEW.approved_at IS NOT NULL);
  END IF;
  IF OLD.instructor_experience IS NOT NULL AND NEW.instructor_experience IS NULL THEN
    RAISE EXCEPTION 'Keep instructor experience decisions';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_instructor_experience_approval() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER guard_instructor_experience_approval_trg BEFORE UPDATE ON public.content_review_runs
  FOR EACH ROW EXECUTE FUNCTION public.guard_instructor_experience_approval();
