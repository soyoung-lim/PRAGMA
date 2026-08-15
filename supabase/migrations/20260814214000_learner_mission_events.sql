-- PRAGMA moat v1: append-only, version-linked learner event stream.
-- 완료 snapshot(learner_mission_logs)은 유지하고, 판단→산출→피드백→수정의
-- 핵심 사건만 별도로 기록한다. 원본 오디오와 불필요한 클릭은 저장하지 않는다.

-- 동의 boolean만으로는 어떤 연구 프로토콜에 동의했는지 증명할 수 없으므로
-- 프로필 완료 시 실제로 제시된 동의문 버전을 함께 고정한다. 기존 동의를 임의
-- backfill하지 않는다. null인 기존 참여자는 최신 동의문을 다시 확인해야 한다.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS research_consent_version text;

COMMENT ON COLUMN public.profiles.research_consent_version IS
  '학습자가 실제 확인한 연구 동의문 버전. 클라이언트 event 값과 서버에서 일치 여부를 검증한다.';

CREATE TABLE public.learner_mission_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL,
  event_seq integer NOT NULL CHECK (event_seq > 0),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  auth_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scenario_id uuid REFERENCES public.scenarios(scenario_id) ON DELETE SET NULL,
  lineage_version_id uuid REFERENCES public.mission_lineage_versions(id) ON DELETE SET NULL,
  mission_id text NOT NULL,

  event_type text NOT NULL CHECK (event_type IN (
    'mission_session_opened',
    'mission_resumed',
    'mpj_response_submitted',
    'context_judgment_submitted',
    'first_response_submitted',
    'feedback_received',
    'learner_dissent_submitted',
    'revision_submitted',
    'mission_completed'
  )),
  event_payload jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(event_payload) = 'object'),

  feature_id text,
  speech_act text,
  direction text CHECK (direction IN ('ko_zh', 'zh_ko')),
  task_mode text CHECK (task_mode IN ('translation', 'interpreting')),
  content_version text,
  content_hash text,
  policy_version text NOT NULL,
  consent_version text NOT NULL,

  occurred_at timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (attempt_id, event_seq)
);

CREATE INDEX learner_mission_events_attempt_idx
  ON public.learner_mission_events(attempt_id, event_seq);
CREATE INDEX learner_mission_events_scenario_idx
  ON public.learner_mission_events(scenario_id, recorded_at)
  WHERE scenario_id IS NOT NULL;
CREATE INDEX learner_mission_events_lineage_idx
  ON public.learner_mission_events(lineage_version_id, event_seq)
  WHERE lineage_version_id IS NOT NULL;
CREATE INDEX learner_mission_events_type_idx
  ON public.learner_mission_events(event_type, recorded_at);

GRANT SELECT ON public.learner_mission_events TO authenticated;
GRANT ALL ON public.learner_mission_events TO service_role;
REVOKE INSERT, UPDATE, DELETE ON public.learner_mission_events FROM authenticated, anon;

ALTER TABLE public.learner_mission_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "learner_read_own_mission_events"
  ON public.learner_mission_events FOR SELECT
  TO authenticated
  USING (auth_user_id = auth.uid());

CREATE POLICY "admin_read_all_mission_events"
  ON public.learner_mission_events FOR SELECT
  TO authenticated
  USING (public.is_admin());

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
  v_lineage_version_id uuid;
  v_event_seq integer;
  v_id uuid;
BEGIN
  IF v_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT id, approval_status, anonymous_participant_id,
         consent_data_use, consent_anonymous_analysis, research_consent_version
    INTO v_profile_id, v_approval_status, v_anonymous_participant_id,
         v_consent_data_use, v_consent_anonymous_analysis, v_profile_consent_version
  FROM public.profiles
  WHERE user_id = v_auth_user_id;
  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;
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

  -- 실행 시점의 정확한 불변 mission snapshot을 연결한다. migration 이전 콘텐츠나
  -- hash가 없는 레거시 미션은 null로 남겨 거짓 lineage를 만들지 않는다.
  IF v_scenario_id IS NOT NULL AND v_content_hash IS NOT NULL THEN
    SELECT id INTO v_lineage_version_id
    FROM public.mission_lineage_versions
    WHERE scenario_id = v_scenario_id
      AND mission_content_hash = v_content_hash
      AND stage IN ('reviewed', 'released')
    ORDER BY version_no DESC
    LIMIT 1;
  END IF;

  -- 한 attempt의 sequence를 직렬화해 새로고침·빠른 연속 입력에서도 순서를 보존한다.
  PERFORM pg_advisory_xact_lock(hashtextextended(v_attempt_id::text, 0));
  SELECT COALESCE(max(event_seq), 0) + 1 INTO v_event_seq
  FROM public.learner_mission_events
  WHERE attempt_id = v_attempt_id;

  INSERT INTO public.learner_mission_events (
    attempt_id, event_seq, profile_id, auth_user_id,
    scenario_id, lineage_version_id, mission_id, event_type, event_payload,
    feature_id, speech_act, direction, task_mode,
    content_version, content_hash, policy_version, consent_version,
    occurred_at
  ) VALUES (
    v_attempt_id,
    v_event_seq,
    v_profile_id,
    v_auth_user_id,
    v_scenario_id,
    v_lineage_version_id,
    p_payload->>'mission_id',
    p_payload->>'event_type',
    COALESCE(p_payload->'event_payload', '{}'::jsonb),
    NULLIF(p_payload->>'feature_id', ''),
    NULLIF(p_payload->>'speech_act', ''),
    NULLIF(p_payload->>'direction', ''),
    NULLIF(p_payload->>'task_mode', ''),
    NULLIF(p_payload->>'content_version', ''),
    v_content_hash,
    p_payload->>'policy_version',
    p_payload->>'consent_version',
    (p_payload->>'occurred_at')::timestamptz
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.append_learner_mission_event(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.append_learner_mission_event(jsonb) TO authenticated, service_role;

CREATE TABLE public.research_data_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  export_schema_version text NOT NULL,
  dataset_type text NOT NULL CHECK (dataset_type IN ('learner_mission_events')),
  filter_spec jsonb NOT NULL DEFAULT '{}'::jsonb,
  row_count integer NOT NULL CHECK (row_count >= 0),
  requested_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.research_data_exports TO authenticated;
GRANT ALL ON public.research_data_exports TO service_role;
REVOKE INSERT, UPDATE, DELETE ON public.research_data_exports FROM authenticated, anon;
ALTER TABLE public.research_data_exports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_read_research_data_exports"
  ON public.research_data_exports FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- 직접 식별자(profile/auth user)는 제외하고 승인 시 발급한 연구용 가명키만 반환한다.
-- 이 키는 원 DB에서 재연결 가능하므로 익명화가 아니라 가명화이며, UI에도 그렇게 표시한다.
CREATE OR REPLACE FUNCTION public.export_learner_mission_events(
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_count integer;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can export research data';
  END IF;

  SELECT
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'export_schema_version', 'mission_event_export_v1',
          'participant_key', p.anonymous_participant_id,
          'attempt_id', e.attempt_id,
          'event_seq', e.event_seq,
          'scenario_id', e.scenario_id,
          'lineage_version_id', e.lineage_version_id,
          'mission_id', e.mission_id,
          'event_type', e.event_type,
          'event_payload', e.event_payload,
          'feature_id', e.feature_id,
          'speech_act', e.speech_act,
          'direction', e.direction,
          'task_mode', e.task_mode,
          'content_version', e.content_version,
          'content_hash', e.content_hash,
          'policy_version', e.policy_version,
          'consent_version', e.consent_version,
          'occurred_at', e.occurred_at,
          'recorded_at', e.recorded_at
        )
        ORDER BY e.attempt_id, e.event_seq
      ),
      '[]'::jsonb
    ),
    count(*)
  INTO v_result, v_count
  FROM public.learner_mission_events e
  JOIN public.profiles p ON p.id = e.profile_id
  WHERE (p_from IS NULL OR e.occurred_at >= p_from)
    AND (p_to IS NULL OR e.occurred_at <= p_to)
    AND p.consent_data_use = true
    AND p.consent_anonymous_analysis = true
    AND p.research_consent_version = e.consent_version
    AND p.anonymous_participant_id IS NOT NULL;

  INSERT INTO public.research_data_exports (
    export_schema_version, dataset_type, filter_spec, row_count, requested_by
  ) VALUES (
    'mission_event_export_v1',
    'learner_mission_events',
    jsonb_build_object('from', p_from, 'to', p_to),
    v_count,
    auth.uid()
  );

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.export_learner_mission_events(timestamptz, timestamptz)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.export_learner_mission_events(timestamptz, timestamptz)
  TO authenticated, service_role;
