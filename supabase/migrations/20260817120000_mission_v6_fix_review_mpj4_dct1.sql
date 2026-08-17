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

-- The historical mission_v5 lineage trigger remains unchanged for old current-contract rows.
-- This second trigger fail-closes only newly generated covered mission_v6 rows.
CREATE OR REPLACE FUNCTION public.validate_current_mission_v6_item_lineage()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_mission jsonb := NEW.mission_content;
  v_lineage jsonb;
  v_summary jsonb;
  v_provenance jsonb;
  v_expected_count integer;
  v_claim_count integer;
  v_claimed_count integer;
  v_unattributed_count integer;
  v_allowed_rules text[];
  v_allowed_risks text[];
  v_allowed_evidence text[];
BEGIN
  IF v_mission IS NULL
     OR v_mission->>'schema_version' IS DISTINCT FROM 'mission_v6'
     OR v_mission->>'direction' IS DISTINCT FROM 'ko_zh'
     OR v_mission->'provenance'->>'prompt_version'
        IS DISTINCT FROM 'mission_v6_fix_review_mpj4_dct1_v2'
     OR NEW.speech_act::text NOT IN ('request', 'refusal', 'thanks') THEN
    RETURN NEW;
  END IF;

  v_lineage := v_mission->'item_lineage';
  v_summary := v_lineage->'coverage_summary';
  v_provenance := v_lineage->'attribution_provenance';
  IF jsonb_typeof(v_lineage) IS DISTINCT FROM 'object'
     OR v_lineage->>'schema_version' IS DISTINCT FROM 'mission_item_lineage_v1'
     OR v_lineage->>'claim_status' IS DISTINCT FROM 'model_attribution_pending_review'
     OR v_lineage->>'realization_pack_id' IS DISTINCT FROM 'pragma_ko_zh_request_refusal_thanks_v1'
     OR v_lineage->>'realization_pack_version' IS DISTINCT FROM '1.2.0'
     OR jsonb_typeof(v_lineage->'claims') IS DISTINCT FROM 'array'
     OR jsonb_typeof(v_summary) IS DISTINCT FROM 'object'
     OR jsonb_typeof(v_provenance) IS DISTINCT FROM 'object'
     OR v_provenance->>'provider' IS DISTINCT FROM 'openai'
     OR v_provenance->>'prompt_version' IS DISTINCT FROM 'item_lineage_attribution_v4_mission_v6'
     OR COALESCE(v_provenance->>'prompt_instance_hash', '') !~ '^[0-9a-f]{64}$'
     OR COALESCE((v_provenance->>'attribution_attempts')::integer, 0) < 1
     OR COALESCE((v_provenance->>'batch_count')::integer, 0) < 1
     OR jsonb_typeof(v_provenance->'calls') IS DISTINCT FROM 'array'
     OR jsonb_array_length(v_provenance->'calls') <> (v_provenance->>'batch_count')::integer THEN
    RAISE EXCEPTION 'Current covered mission_v6 requires valid pending item lineage provenance';
  END IF;

  SELECT
    count(*),
    count(*) FILTER (WHERE claim->>'attribution_status' = 'model_claimed'),
    count(*) FILTER (WHERE claim->>'attribution_status' = 'model_unattributed')
  INTO v_claim_count, v_claimed_count, v_unattributed_count
  FROM jsonb_array_elements(v_lineage->'claims') claim;

  WITH items AS (
    SELECT item, item_ordinality - 1 AS item_index
    FROM jsonb_array_elements(v_mission->'mpj_items') WITH ORDINALITY source(item, item_ordinality)
  ), expected(path) AS (
    SELECT format('mpj_items[%s].target', item_index)
    FROM items WHERE jsonb_typeof(item->'target') = 'string' AND COALESCE(item->>'target', '') <> ''
    UNION ALL
    SELECT format('mpj_items[%s].recommended_example', item_index)
    FROM items WHERE jsonb_typeof(item->'recommended_example') = 'string' AND COALESCE(item->>'recommended_example', '') <> ''
    UNION ALL
    SELECT format('mpj_items[%s].corrections[%s]', item_index, correction_ordinality - 1)
    FROM items
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(item->'corrections', '[]'::jsonb))
      WITH ORDINALITY correction(value, correction_ordinality)
    UNION ALL
    SELECT format('mpj_items[%s].candidates[%s]', item_index, candidate_ordinality - 1)
    FROM items
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(item->'candidates', '[]'::jsonb))
      WITH ORDINALITY candidate(value, candidate_ordinality)
    UNION ALL
    SELECT format('production_task.reference_alternatives[%s]', alternative_ordinality - 1)
    FROM jsonb_array_elements(v_mission->'production_task'->'reference_alternatives')
      WITH ORDINALITY alternative(value, alternative_ordinality)
  ) SELECT count(*) INTO v_expected_count FROM expected;

  IF v_claim_count = 0
     OR v_claim_count <> v_expected_count
     OR (v_summary->>'total_count')::integer <> v_claim_count
     OR (v_summary->>'claimed_count')::integer <> v_claimed_count
     OR (v_summary->>'unattributed_count')::integer <> v_unattributed_count
     OR v_unattributed_count::numeric / NULLIF(v_claim_count, 0)::numeric > 0.2
     OR EXISTS (
       SELECT 1 FROM jsonb_array_elements(v_lineage->'claims') claim
       GROUP BY claim->>'claim_id'
       HAVING count(*) > 1 OR min(COALESCE(claim->>'claim_id', '')) = ''
     )
     OR EXISTS (
       SELECT 1 FROM jsonb_array_elements(v_lineage->'claims') claim
       GROUP BY claim->>'target_path'
       HAVING count(*) > 1 OR min(COALESCE(claim->>'target_path', '')) = ''
     ) THEN
    RAISE EXCEPTION 'Current covered mission_v6 item lineage coverage is incomplete or inconsistent';
  END IF;

  IF EXISTS (
    WITH items AS (
      SELECT item, item_ordinality - 1 AS item_index
      FROM jsonb_array_elements(v_mission->'mpj_items') WITH ORDINALITY source(item, item_ordinality)
    ), expected(path) AS (
      SELECT format('mpj_items[%s].target', item_index)
      FROM items WHERE jsonb_typeof(item->'target') = 'string' AND COALESCE(item->>'target', '') <> ''
      UNION ALL
      SELECT format('mpj_items[%s].recommended_example', item_index)
      FROM items WHERE jsonb_typeof(item->'recommended_example') = 'string' AND COALESCE(item->>'recommended_example', '') <> ''
      UNION ALL
      SELECT format('mpj_items[%s].corrections[%s]', item_index, correction_ordinality - 1)
      FROM items
      CROSS JOIN LATERAL jsonb_array_elements(COALESCE(item->'corrections', '[]'::jsonb))
        WITH ORDINALITY correction(value, correction_ordinality)
      UNION ALL
      SELECT format('mpj_items[%s].candidates[%s]', item_index, candidate_ordinality - 1)
      FROM items
      CROSS JOIN LATERAL jsonb_array_elements(COALESCE(item->'candidates', '[]'::jsonb))
        WITH ORDINALITY candidate(value, candidate_ordinality)
      UNION ALL
      SELECT format('production_task.reference_alternatives[%s]', alternative_ordinality - 1)
      FROM jsonb_array_elements(v_mission->'production_task'->'reference_alternatives')
        WITH ORDINALITY alternative(value, alternative_ordinality)
    ), actual(path) AS (
      SELECT claim->>'target_path' FROM jsonb_array_elements(v_lineage->'claims') claim
    ), mismatch AS (
      (SELECT path FROM expected EXCEPT SELECT path FROM actual)
      UNION ALL
      (SELECT path FROM actual EXCEPT SELECT path FROM expected)
    ) SELECT 1 FROM mismatch
  ) THEN
    RAISE EXCEPTION 'Current covered mission_v6 item lineage target paths do not match mission content';
  END IF;

  v_allowed_rules := CASE NEW.speech_act::text
    WHEN 'request' THEN ARRAY['RR-KOZH-REQ-MODAL-QUESTION','RR-KOZH-REQ-CONDITIONAL-PREFACE','RR-KOZH-REQ-CHOICE-CLOSING','RR-KOZH-REQ-BURDEN-FOREWARNING']
    WHEN 'refusal' THEN ARRAY['RR-KOZH-REF-HEDGE','RR-KOZH-REF-REASON','RR-KOZH-REF-REGRET','RR-KOZH-REF-ALTERNATIVE','RR-KOZH-REF-PARTIAL-ACCEPTANCE']
    ELSE ARRAY['RR-KOZH-THX-INTENSIFIER','RR-KOZH-THX-SPECIFIC-BENEFIT','RR-KOZH-THX-REPETITION-RESTRAINT','RR-KOZH-THX-MINIMAL']
  END;
  v_allowed_risks := CASE NEW.speech_act::text
    WHEN 'request' THEN ARRAY['learner_verbosity','weak_internal_mitigation','hanja_interference','ba_imperative_overuse']
    WHEN 'refusal' THEN ARRAY['direct_negation_fronting','learner_verbosity','hanja_interference']
    ELSE ARRAY['hanja_interference','excessive_gratitude']
  END;
  v_allowed_evidence := CASE NEW.speech_act::text
    WHEN 'request' THEN ARRAY['EV-LI-TAGUCHI-2026-REQUEST-MODIFICATION','EV-TAGUCHI-LI-2020-L2-VERBOSITY','EV-OBS-KO-ZH-HANJA-INTERFERENCE','EV-OBS-ZH-BA-IMPERATIVE','EV-DESIGN-KO-ZH-CORE-PACK-V1']
    WHEN 'refusal' THEN ARRAY['EV-WU-ROEVER-2021-REFUSAL','EV-TAGUCHI-LI-2020-L2-VERBOSITY','EV-OBS-KO-ZH-HANJA-INTERFERENCE','EV-DESIGN-KO-ZH-CORE-PACK-V1']
    ELSE ARRAY['EV-DAI-2023-THANKING-INTENSITY','EV-YANG-2016-GRATITUDE-CONTEXT','EV-OBS-KO-ZH-HANJA-INTERFERENCE','EV-DESIGN-KO-ZH-CORE-PACK-V1']
  END;

  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_lineage->'claims') claim
    WHERE COALESCE(claim->>'note_ko', '') = ''
       OR jsonb_typeof(COALESCE(claim->'rule_ids', 'null'::jsonb)) IS DISTINCT FROM 'array'
       OR jsonb_typeof(COALESCE(claim->'risk_ids', 'null'::jsonb)) IS DISTINCT FROM 'array'
       OR jsonb_typeof(COALESCE(claim->'evidence_ids', 'null'::jsonb)) IS DISTINCT FROM 'array'
       OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(claim->'rule_ids') id(value) WHERE NOT (id.value = ANY(v_allowed_rules)))
       OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(claim->'risk_ids') id(value) WHERE NOT (id.value = ANY(v_allowed_risks)))
       OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(claim->'evidence_ids') id(value) WHERE NOT (id.value = ANY(v_allowed_evidence)))
       OR (claim->>'attribution_status' = 'model_claimed' AND (
         jsonb_array_length(claim->'rule_ids') + jsonb_array_length(claim->'risk_ids') = 0
         OR jsonb_array_length(claim->'evidence_ids') = 0
       ))
       OR (claim->>'attribution_status' = 'model_unattributed' AND (
         jsonb_array_length(claim->'rule_ids') + jsonb_array_length(claim->'risk_ids') > 0
         OR jsonb_array_length(claim->'evidence_ids') > 0
       ))
       OR COALESCE(claim->>'attribution_status', '') NOT IN ('model_claimed', 'model_unattributed')
  ) THEN
    RAISE EXCEPTION 'Current covered mission_v6 item lineage contains invalid scoped claims';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_provenance->'calls') WITH ORDINALITY call(value, ordinality)
    WHERE (call.value->>'batch_index')::integer <> call.ordinality
       OR (call.value->>'target_count')::integer NOT BETWEEN 1 AND 5
       OR (call.value->>'attempts')::integer < 1
       OR COALESCE(call.value->>'model', '') = ''
       OR COALESCE(call.value->>'prompt_instance_hash', '') !~ '^[0-9a-f]{64}$'
  ) OR (
    SELECT COALESCE(sum((call.value->>'target_count')::integer), 0)
    FROM jsonb_array_elements(v_provenance->'calls') call(value)
  ) <> v_claim_count THEN
    RAISE EXCEPTION 'Current covered mission_v6 item lineage call provenance is inconsistent';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_current_mission_v6_item_lineage() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS validate_current_mission_v6_item_lineage_trg ON public.scenarios;
CREATE TRIGGER validate_current_mission_v6_item_lineage_trg
  BEFORE INSERT OR UPDATE OF mission_content ON public.scenarios
  FOR EACH ROW EXECUTE FUNCTION public.validate_current_mission_v6_item_lineage();
