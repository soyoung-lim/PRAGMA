-- Current mission_v5 item-level realization lineage hard gate.
-- Legacy mission_v5 rows remain readable; only the current prompt contract is gated.

ALTER TABLE public.llm_invocation_events
  DROP CONSTRAINT IF EXISTS llm_invocation_events_operation_check;

ALTER TABLE public.llm_invocation_events
  ADD CONSTRAINT llm_invocation_events_operation_check CHECK (operation IN (
    'core_generate',
    'core_repair',
    'mission_generate',
    'item_lineage_attribution',
    'core_critic',
    'mission_critic',
    'authentic_analyze',
    'legacy_outline',
    'legacy_scenario_generate',
    'learner_feedback'
  ));

CREATE OR REPLACE FUNCTION public.validate_current_mission_v5_item_lineage()
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
     OR v_mission->>'schema_version' IS DISTINCT FROM 'mission_v5'
     OR v_mission->>'direction' IS DISTINCT FROM 'ko_zh'
     OR v_mission->'provenance'->>'prompt_version'
        IS DISTINCT FROM 'mission_v5_mpj4_minidiscourse_v6_interpreter_roles'
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
     OR v_provenance->>'prompt_version' IS DISTINCT FROM 'item_lineage_attribution_v3_mission_v5'
     OR COALESCE(v_provenance->>'prompt_instance_hash', '') !~ '^[0-9a-f]{64}$'
     OR COALESCE((v_provenance->>'attribution_attempts')::integer, 0) < 1
     OR COALESCE((v_provenance->>'batch_count')::integer, 0) < 1
     OR jsonb_typeof(v_provenance->'calls') IS DISTINCT FROM 'array'
     OR jsonb_array_length(v_provenance->'calls') <> (v_provenance->>'batch_count')::integer THEN
    RAISE EXCEPTION 'Current covered mission_v5 requires valid pending item lineage provenance';
  END IF;

  SELECT
    count(*),
    count(*) FILTER (WHERE claim->>'attribution_status' = 'model_claimed'),
    count(*) FILTER (WHERE claim->>'attribution_status' = 'model_unattributed')
  INTO v_claim_count, v_claimed_count, v_unattributed_count
  FROM jsonb_array_elements(v_lineage->'claims') claim;

  SELECT
    jsonb_array_length(v_mission->'mpj_items') * 2
    + (
      SELECT COALESCE(sum(jsonb_array_length(COALESCE(item->'corrections', '[]'::jsonb))), 0)
           + COALESCE(sum(jsonb_array_length(COALESCE(item->'candidates', '[]'::jsonb))), 0)
      FROM jsonb_array_elements(v_mission->'mpj_items') item
    )
    + jsonb_array_length(v_mission->'production_task'->'reference_alternatives')
  INTO v_expected_count;

  IF v_claim_count = 0
     OR v_claim_count <> v_expected_count
     OR (v_summary->>'total_count')::integer <> v_claim_count
     OR (v_summary->>'claimed_count')::integer <> v_claimed_count
     OR (v_summary->>'unattributed_count')::integer <> v_unattributed_count
     OR v_unattributed_count::numeric / NULLIF(v_claim_count, 0)::numeric > 0.2
     OR EXISTS (
       SELECT 1
       FROM jsonb_array_elements(v_lineage->'claims') claim
       GROUP BY claim->>'claim_id'
       HAVING count(*) > 1 OR min(COALESCE(claim->>'claim_id', '')) = ''
     )
     OR EXISTS (
       SELECT 1
       FROM jsonb_array_elements(v_lineage->'claims') claim
       GROUP BY claim->>'target_path'
       HAVING count(*) > 1 OR min(COALESCE(claim->>'target_path', '')) = ''
     ) THEN
    RAISE EXCEPTION 'Current covered mission_v5 item lineage coverage is incomplete or inconsistent';
  END IF;

  IF EXISTS (
    WITH items AS (
      SELECT item, item_ordinality - 1 AS item_index
      FROM jsonb_array_elements(v_mission->'mpj_items') WITH ORDINALITY source(item, item_ordinality)
    ), expected(path) AS (
      SELECT format('mpj_items[%s].target', item_index) FROM items
      UNION ALL
      SELECT format('mpj_items[%s].recommended_example', item_index) FROM items
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
    )
    SELECT 1 FROM mismatch
  ) THEN
    RAISE EXCEPTION 'Current covered mission_v5 item lineage target paths do not match mission content';
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
    SELECT 1
    FROM jsonb_array_elements(v_lineage->'claims') claim
    WHERE COALESCE(claim->>'note_ko', '') = ''
       OR jsonb_typeof(COALESCE(claim->'rule_ids', 'null'::jsonb)) IS DISTINCT FROM 'array'
       OR jsonb_typeof(COALESCE(claim->'risk_ids', 'null'::jsonb)) IS DISTINCT FROM 'array'
       OR jsonb_typeof(COALESCE(claim->'evidence_ids', 'null'::jsonb)) IS DISTINCT FROM 'array'
       OR EXISTS (
         SELECT 1 FROM jsonb_array_elements_text(claim->'rule_ids') id(value)
         WHERE NOT (id.value = ANY(v_allowed_rules))
       )
       OR EXISTS (
         SELECT 1 FROM jsonb_array_elements_text(claim->'risk_ids') id(value)
         WHERE NOT (id.value = ANY(v_allowed_risks))
       )
       OR EXISTS (
         SELECT 1 FROM jsonb_array_elements_text(claim->'evidence_ids') id(value)
         WHERE NOT (id.value = ANY(v_allowed_evidence))
       )
       OR (
         claim->>'attribution_status' = 'model_claimed'
         AND (
           jsonb_array_length(claim->'rule_ids') + jsonb_array_length(claim->'risk_ids') = 0
           OR jsonb_array_length(claim->'evidence_ids') = 0
         )
       )
       OR (
         claim->>'attribution_status' = 'model_unattributed'
         AND (
           jsonb_array_length(claim->'rule_ids') + jsonb_array_length(claim->'risk_ids') > 0
           OR jsonb_array_length(claim->'evidence_ids') > 0
         )
       )
       OR COALESCE(claim->>'attribution_status', '') NOT IN ('model_claimed', 'model_unattributed')
  ) THEN
    RAISE EXCEPTION 'Current covered mission_v5 item lineage contains invalid scoped claims';
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
    RAISE EXCEPTION 'Current covered mission_v5 item lineage call provenance is inconsistent';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_current_mission_v5_item_lineage() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS validate_current_mission_v5_item_lineage_trg ON public.scenarios;
CREATE TRIGGER validate_current_mission_v5_item_lineage_trg
  BEFORE INSERT OR UPDATE OF mission_content ON public.scenarios
  FOR EACH ROW EXECUTE FUNCTION public.validate_current_mission_v5_item_lineage();
