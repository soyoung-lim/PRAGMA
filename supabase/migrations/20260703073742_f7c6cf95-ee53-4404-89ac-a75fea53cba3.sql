
ALTER TABLE public.scenarios
  ADD COLUMN IF NOT EXISTS generation_provider text,
  ADD COLUMN IF NOT EXISTS generator_model text,
  ADD COLUMN IF NOT EXISTS generation_prompt_version text;

CREATE OR REPLACE FUNCTION public.save_generated_scenario(p_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_scenario_id uuid;
  v_cand jsonb;
  v_order int := 0;
  v_scenario jsonb := p_payload->'scenario';
  v_meta jsonb := p_payload->'meta';
  v_form jsonb := p_payload->'form';
  v_feedback jsonb := v_scenario->'feedback';
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can save generated scenarios';
  END IF;

  INSERT INTO public.scenarios (
    title, source_text, topic,
    speech_act, genre, learner_level, interaction_context,
    industry_sector, business_function,
    scenario_p, scenario_d, scenario_r,
    review_status, usage_assignment,
    generation_provider, generator_model, generation_prompt_version
  ) VALUES (
    v_scenario->>'title',
    v_scenario->>'source_text',
    v_scenario->>'situation',
    (v_form->>'speech_act')::public.speech_act,
    v_form->>'genre',
    v_form->>'level',
    v_form->>'context',
    v_form->>'industry',
    v_form->>'func',
    v_form->>'pdr_power',
    v_form->>'pdr_distance',
    v_form->>'pdr_burden',
    'needs_review'::public.review_status,
    'archived_only'::public.usage_assignment,
    v_meta->>'provider',
    v_meta->>'model',
    v_meta->>'prompt_version'
  )
  RETURNING scenario_id INTO v_scenario_id;

  FOR v_cand IN SELECT * FROM jsonb_array_elements(v_scenario->'candidates')
  LOOP
    INSERT INTO public.scenario_candidates (
      scenario_id, candidate_text, directness_level,
      appropriateness_label, failed_challenge, rationale, display_order
    ) VALUES (
      v_scenario_id,
      v_cand->>'candidate_text',
      NULLIF(v_cand->>'directness_level','')::int,
      v_cand->>'appropriateness_label',
      CASE
        WHEN v_cand->'failed_challenge' IS NULL THEN NULL
        ELSE ARRAY(SELECT jsonb_array_elements_text(v_cand->'failed_challenge'))
      END,
      v_cand->>'rationale',
      v_order
    );
    v_order := v_order + 1;
  END LOOP;

  INSERT INTO public.scenario_feedback (
    scenario_id, teacher_perspective, recipient_perspective, field_expert_perspective
  ) VALUES (
    v_scenario_id,
    v_feedback->>'teacher',
    v_feedback->>'native',
    v_feedback->>'field_expert'
  );

  RETURN v_scenario_id;
END;
$$;

REVOKE ALL ON FUNCTION public.save_generated_scenario(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_generated_scenario(jsonb) TO authenticated;
