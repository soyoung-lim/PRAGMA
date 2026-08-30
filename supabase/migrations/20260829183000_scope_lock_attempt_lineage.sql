-- Scope Lock P0: course → week → assignment → mission → attempt → content hash.
-- Legacy rows remain valid; the full tuple is mandatory only when a course context is present.

ALTER TABLE public.learner_mission_logs
  ADD COLUMN IF NOT EXISTS course_id uuid REFERENCES public.curriculum_outlines(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS week_no smallint CHECK (week_no BETWEEN 1 AND 15),
  ADD COLUMN IF NOT EXISTS assignment_id uuid REFERENCES public.curriculum_week_scenarios(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS attempt_id uuid,
  ADD COLUMN IF NOT EXISTS content_hash text;

ALTER TABLE public.learner_mission_logs
  ADD CONSTRAINT learner_mission_logs_course_context_complete
  CHECK (
    (course_id IS NULL AND week_no IS NULL AND assignment_id IS NULL)
    OR
    (course_id IS NOT NULL AND week_no IS NOT NULL AND assignment_id IS NOT NULL
      AND attempt_id IS NOT NULL AND content_hash ~ '^[0-9a-f]{64}$')
  ) NOT VALID;

CREATE UNIQUE INDEX IF NOT EXISTS learner_mission_logs_attempt_unique
  ON public.learner_mission_logs(attempt_id)
  WHERE attempt_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS learner_mission_logs_course_week_idx
  ON public.learner_mission_logs(course_id, week_no, completed_at DESC)
  WHERE course_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS learner_mission_logs_assignment_idx
  ON public.learner_mission_logs(assignment_id, completed_at DESC)
  WHERE assignment_id IS NOT NULL;

COMMENT ON COLUMN public.learner_mission_logs.assignment_id IS
  'curriculum_week_scenarios.id. 공개 교과목 수행의 필수 귀속값이며 scenario ID와 구분한다.';
COMMENT ON COLUMN public.learner_mission_logs.content_hash IS
  '학습자가 실제 실행한 reviewed/released mission lineage의 mission_content_hash.';

ALTER TABLE public.learner_mission_events
  ADD COLUMN IF NOT EXISTS course_id uuid REFERENCES public.curriculum_outlines(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS week_no smallint CHECK (week_no BETWEEN 1 AND 15),
  ADD COLUMN IF NOT EXISTS assignment_id uuid REFERENCES public.curriculum_week_scenarios(id) ON DELETE SET NULL;

ALTER TABLE public.learner_mission_events
  ADD CONSTRAINT learner_mission_events_course_context_complete
  CHECK (
    (course_id IS NULL AND week_no IS NULL AND assignment_id IS NULL)
    OR
    (course_id IS NOT NULL AND week_no IS NOT NULL AND assignment_id IS NOT NULL
      AND content_hash ~ '^[0-9a-f]{64}$')
  ) NOT VALID;

CREATE INDEX IF NOT EXISTS learner_mission_events_course_week_idx
  ON public.learner_mission_events(course_id, week_no, recorded_at DESC)
  WHERE course_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS learner_mission_events_assignment_idx
  ON public.learner_mission_events(assignment_id, event_seq)
  WHERE assignment_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.assert_learner_course_assignment(
  p_course_id uuid,
  p_week_no smallint,
  p_assignment_id uuid,
  p_scenario_id uuid,
  p_content_hash text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_course_id IS NULL AND p_week_no IS NULL AND p_assignment_id IS NULL THEN
    RETURN;
  END IF;
  IF p_course_id IS NULL OR p_week_no IS NULL OR p_assignment_id IS NULL
     OR p_scenario_id IS NULL OR COALESCE(p_content_hash, '') !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'Complete course/week/assignment/mission/content-hash context is required';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.curriculum_week_scenarios assignment
    JOIN public.curriculum_outlines course ON course.id = assignment.outline_id
    WHERE assignment.id = p_assignment_id
      AND assignment.outline_id = p_course_id
      AND assignment.week_no = p_week_no
      AND assignment.scenario_id = p_scenario_id
      AND course.status = 'published'
  ) THEN
    RAISE EXCEPTION 'Course assignment context does not match the mission';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.mission_lineage_versions lineage
    WHERE lineage.scenario_id = p_scenario_id
      AND lineage.mission_content_hash = p_content_hash
      AND lineage.stage IN ('reviewed', 'released')
  ) THEN
    RAISE EXCEPTION 'Reviewed mission lineage does not match content hash';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_learner_course_assignment(uuid, smallint, uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assert_learner_course_assignment(uuid, smallint, uuid, uuid, text)
  TO service_role;

CREATE OR REPLACE FUNCTION public.tg_validate_learner_mission_log_course_context()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_learner_course_assignment(
    NEW.course_id,
    NEW.week_no,
    NEW.assignment_id,
    NEW.cell_id,
    NEW.content_hash
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_learner_mission_log_course_context
  ON public.learner_mission_logs;
CREATE TRIGGER trg_validate_learner_mission_log_course_context
  BEFORE INSERT OR UPDATE OF course_id, week_no, assignment_id, cell_id, content_hash
  ON public.learner_mission_logs
  FOR EACH ROW EXECUTE FUNCTION public.tg_validate_learner_mission_log_course_context();

CREATE OR REPLACE FUNCTION public.append_learner_mission_event(p_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_user_id uuid := auth.uid();
  v_profile_id uuid;
  v_approval_status public.approval_status;
  v_anonymous_participant_id text;
  v_consent_data_use boolean;
  v_consent_anonymous_analysis boolean;
  v_profile_consent_version text;
  v_attempt_id uuid := (p_payload->>'attempt_id')::uuid;
  v_scenario_id uuid := NULLIF(p_payload->>'scenario_id', '')::uuid;
  v_content_hash text := NULLIF(p_payload->>'content_hash', '');
  v_course_id uuid := NULLIF(p_payload->>'course_id', '')::uuid;
  v_week_no smallint := NULLIF(p_payload->>'week_no', '')::smallint;
  v_assignment_id uuid := NULLIF(p_payload->>'assignment_id', '')::uuid;
  v_lineage_version_id uuid;
  v_event_seq integer;
  v_id uuid;
BEGIN
  IF v_auth_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;

  SELECT id, approval_status, anonymous_participant_id,
         consent_data_use, consent_anonymous_analysis, research_consent_version
    INTO v_profile_id, v_approval_status, v_anonymous_participant_id,
         v_consent_data_use, v_consent_anonymous_analysis, v_profile_consent_version
  FROM public.profiles
  WHERE user_id = v_auth_user_id;
  IF v_profile_id IS NULL THEN RAISE EXCEPTION 'Profile not found'; END IF;
  IF v_approval_status <> 'approved' OR v_anonymous_participant_id IS NULL THEN
    RAISE EXCEPTION 'Approved research participant profile is required';
  END IF;
  IF NOT COALESCE(v_consent_data_use, false)
     OR NOT COALESCE(v_consent_anonymous_analysis, false) THEN
    RAISE EXCEPTION 'Research data consent is required';
  END IF;
  IF v_profile_consent_version IS NULL
     OR v_profile_consent_version <> p_payload->>'consent_version' THEN
    RAISE EXCEPTION 'Research consent version is missing or stale';
  END IF;
  IF p_payload->>'policy_version' <> 'policy_v1_2026-07-21' THEN
    RAISE EXCEPTION 'Unsupported learning policy version';
  END IF;

  PERFORM public.assert_learner_course_assignment(
    v_course_id, v_week_no, v_assignment_id, v_scenario_id, v_content_hash
  );

  IF v_scenario_id IS NOT NULL AND v_content_hash IS NOT NULL THEN
    SELECT id INTO v_lineage_version_id
    FROM public.mission_lineage_versions
    WHERE scenario_id = v_scenario_id
      AND mission_content_hash = v_content_hash
      AND stage IN ('reviewed', 'released')
    ORDER BY version_no DESC
    LIMIT 1;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_attempt_id::text, 0));
  SELECT COALESCE(max(event_seq), 0) + 1 INTO v_event_seq
  FROM public.learner_mission_events
  WHERE attempt_id = v_attempt_id;

  INSERT INTO public.learner_mission_events (
    attempt_id, event_seq, profile_id, auth_user_id,
    scenario_id, lineage_version_id, mission_id, event_type, event_payload,
    feature_id, speech_act, direction, task_mode,
    content_version, content_hash, policy_version, consent_version,
    course_id, week_no, assignment_id, occurred_at
  ) VALUES (
    v_attempt_id, v_event_seq, v_profile_id, v_auth_user_id,
    v_scenario_id, v_lineage_version_id, p_payload->>'mission_id',
    p_payload->>'event_type', COALESCE(p_payload->'event_payload', '{}'::jsonb),
    NULLIF(p_payload->>'feature_id', ''), NULLIF(p_payload->>'speech_act', ''),
    NULLIF(p_payload->>'direction', ''), NULLIF(p_payload->>'task_mode', ''),
    NULLIF(p_payload->>'content_version', ''), v_content_hash,
    p_payload->>'policy_version', p_payload->>'consent_version',
    v_course_id, v_week_no, v_assignment_id,
    (p_payload->>'occurred_at')::timestamptz
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.append_learner_mission_event(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.append_learner_mission_event(jsonb) TO authenticated, service_role;

-- Existing rows are intentionally preserved; validation applies to future writes immediately.

