-- Final learning-content contract: MPJ4 + independent DCT1 + revision recheck.
-- Existing mission_v1..v5 rows remain readable and are not rewritten or deleted.

ALTER TABLE public.scenarios DROP CONSTRAINT IF EXISTS scenarios_mission_ck;
ALTER TABLE public.scenarios ADD CONSTRAINT scenarios_mission_ck
  CHECK (
    (mission_content IS NULL AND mission_status IS NULL)
    OR (
      mission_content IS NOT NULL
      AND mission_status IN ('generated', 'reviewed', 'released')
      AND mission_content->>'schema_version' IN (
        'mission_v1', 'mission_v2', 'mission_v3', 'mission_v4', 'mission_v5', 'mission_v6'
      )
      AND target_feature IS NOT NULL
      AND target_feature_version IS NOT NULL
    )
  );

ALTER TABLE public.learner_mission_events
  DROP CONSTRAINT IF EXISTS learner_mission_events_event_type_check;
ALTER TABLE public.learner_mission_events
  ADD CONSTRAINT learner_mission_events_event_type_check
  CHECK (event_type IN (
    'mission_session_opened',
    'mission_resumed',
    'mpj_response_submitted',
    'context_judgment_submitted',
    'first_response_submitted',
    'feedback_received',
    'learner_dissent_submitted',
    'revision_submitted',
    'revision_rechecked',
    'mission_completed'
  ));

COMMENT ON CONSTRAINT scenarios_mission_ck ON public.scenarios IS
  'Legacy mission_v1..v5 plus current mission_v6. New generation uses mission_v6 only.';
