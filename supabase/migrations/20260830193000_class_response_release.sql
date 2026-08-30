-- 교수자 제어 학급 응답 공개.
-- course + mission 단위로 마감 시점의 익명 집계만 동결하고, 학습자에게는 본인 완료 뒤 공개한다.

CREATE TABLE public.class_response_releases (
  course_id uuid NOT NULL REFERENCES public.curriculum_outlines(id) ON DELETE CASCADE,
  mission_id uuid NOT NULL REFERENCES public.scenarios(scenario_id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'collecting'
    CHECK (status IN ('collecting', 'closed', 'released')),
  snapshot_pattern jsonb,
  snapshot_learner_count integer NOT NULL DEFAULT 0
    CHECK (snapshot_learner_count >= 0),
  snapshot_dissent_count integer NOT NULL DEFAULT 0
    CHECK (snapshot_dissent_count >= 0),
  closed_at timestamptz,
  released_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (course_id, mission_id),
  CHECK (
    (status = 'collecting' AND snapshot_pattern IS NULL AND closed_at IS NULL AND released_at IS NULL)
    OR
    (status = 'closed' AND snapshot_pattern IS NOT NULL AND closed_at IS NOT NULL AND released_at IS NULL)
    OR
    (status = 'released' AND snapshot_pattern IS NOT NULL AND closed_at IS NOT NULL AND released_at IS NOT NULL)
  )
);

ALTER TABLE public.class_response_releases ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.class_response_releases TO authenticated;
GRANT ALL ON public.class_response_releases TO service_role;

CREATE POLICY class_response_releases_admin_read
  ON public.class_response_releases FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE TRIGGER class_response_releases_updated_at
  BEFORE UPDATE ON public.class_response_releases
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE OR REPLACE FUNCTION public.admin_close_class_responses(
  p_course_id uuid,
  p_mission_id uuid,
  p_snapshot_pattern jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
  v_dissents integer;
  v_row public.class_response_releases;
BEGIN
  IF NOT COALESCE(public.is_admin(), false) THEN
    RAISE EXCEPTION 'Admin required';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.curriculum_week_scenarios
    WHERE outline_id = p_course_id AND scenario_id = p_mission_id
  ) THEN
    RAISE EXCEPTION 'Mission is not assigned to this course';
  END IF;
  IF jsonb_typeof(p_snapshot_pattern) IS DISTINCT FROM 'object'
    OR p_snapshot_pattern->>'missionId' IS DISTINCT FROM p_mission_id::text
    OR jsonb_typeof(p_snapshot_pattern->'items') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Invalid anonymous response snapshot';
  END IF;

  BEGIN
    v_count := (p_snapshot_pattern->>'learners')::integer;
    v_dissents := COALESCE((p_snapshot_pattern->>'dissents')::integer, 0);
  EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
    RAISE EXCEPTION 'Invalid anonymous response counts';
  END;
  IF v_count < 0 OR v_dissents < 0 THEN
    RAISE EXCEPTION 'Invalid anonymous response counts';
  END IF;

  INSERT INTO public.class_response_releases (
    course_id, mission_id, status, snapshot_pattern,
    snapshot_learner_count, snapshot_dissent_count,
    closed_at, released_at, created_by
  ) VALUES (
    p_course_id, p_mission_id, 'closed', p_snapshot_pattern,
    v_count, v_dissents, now(), NULL, auth.uid()
  )
  ON CONFLICT (course_id, mission_id) DO UPDATE SET
    status = 'closed',
    snapshot_pattern = EXCLUDED.snapshot_pattern,
    snapshot_learner_count = EXCLUDED.snapshot_learner_count,
    snapshot_dissent_count = EXCLUDED.snapshot_dissent_count,
    closed_at = now(),
    released_at = NULL
  WHERE public.class_response_releases.status = 'collecting'
  RETURNING * INTO v_row;

  IF v_row.course_id IS NULL THEN
    SELECT * INTO v_row FROM public.class_response_releases
    WHERE course_id = p_course_id AND mission_id = p_mission_id;
  END IF;
  RETURN to_jsonb(v_row);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_reopen_class_responses(
  p_course_id uuid,
  p_mission_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_row public.class_response_releases;
BEGIN
  IF NOT COALESCE(public.is_admin(), false) THEN
    RAISE EXCEPTION 'Admin required';
  END IF;
  UPDATE public.class_response_releases SET
    status = 'collecting', snapshot_pattern = NULL,
    snapshot_learner_count = 0, snapshot_dissent_count = 0,
    closed_at = NULL, released_at = NULL
  WHERE course_id = p_course_id AND mission_id = p_mission_id AND status = 'closed'
  RETURNING * INTO v_row;
  IF v_row.course_id IS NULL THEN
    RAISE EXCEPTION 'Only a closed response set can be reopened';
  END IF;
  RETURN to_jsonb(v_row);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_release_class_responses(
  p_course_id uuid,
  p_mission_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_row public.class_response_releases;
BEGIN
  IF NOT COALESCE(public.is_admin(), false) THEN
    RAISE EXCEPTION 'Admin required';
  END IF;
  SELECT * INTO v_row FROM public.class_response_releases
  WHERE course_id = p_course_id AND mission_id = p_mission_id FOR UPDATE;
  IF v_row.course_id IS NULL OR v_row.status = 'collecting' THEN
    RAISE EXCEPTION 'Close responses before release';
  END IF;
  IF v_row.snapshot_learner_count < 5 THEN
    RAISE EXCEPTION 'At least five learner responses are required';
  END IF;
  IF v_row.status = 'closed' THEN
    UPDATE public.class_response_releases SET status = 'released', released_at = now()
    WHERE course_id = p_course_id AND mission_id = p_mission_id
    RETURNING * INTO v_row;
  END IF;
  RETURN to_jsonb(v_row);
END;
$$;

CREATE OR REPLACE FUNCTION public.learner_get_peer_responses(
  p_course_id uuid,
  p_mission_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_row public.class_response_releases;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('state', 'unavailable');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.curriculum_week_scenarios assignment
    JOIN public.curriculum_outlines outline ON outline.id = assignment.outline_id
    WHERE assignment.outline_id = p_course_id
      AND assignment.scenario_id = p_mission_id
      AND outline.status = 'published'
  ) THEN
    RETURN jsonb_build_object('state', 'unavailable');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.learner_mission_logs
    WHERE auth_user_id = auth.uid()
      AND mission_id = p_mission_id::text
      AND mission_completed = true
  ) THEN
    RETURN jsonb_build_object('state', 'completion_required');
  END IF;

  SELECT * INTO v_row FROM public.class_response_releases
  WHERE course_id = p_course_id AND mission_id = p_mission_id;
  IF v_row.course_id IS NULL OR v_row.status = 'collecting' THEN
    RETURN jsonb_build_object('state', 'awaiting_release');
  END IF;
  IF v_row.snapshot_learner_count < 5 THEN
    RETURN jsonb_build_object(
      'state', 'minimum_not_met',
      'learnerCount', v_row.snapshot_learner_count
    );
  END IF;
  IF v_row.status <> 'released' THEN
    RETURN jsonb_build_object('state', 'awaiting_release');
  END IF;
  RETURN jsonb_build_object(
    'state', 'released',
    'learnerCount', v_row.snapshot_learner_count,
    'releasedAt', v_row.released_at,
    'pattern', v_row.snapshot_pattern
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_close_class_responses(uuid, uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_reopen_class_responses(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_release_class_responses(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.learner_get_peer_responses(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_close_class_responses(uuid, uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reopen_class_responses(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_release_class_responses(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.learner_get_peer_responses(uuid, uuid) TO authenticated;

COMMENT ON TABLE public.class_response_releases IS
  'Course+mission response state and immutable anonymous snapshot used for professor-controlled peer comparison.';
