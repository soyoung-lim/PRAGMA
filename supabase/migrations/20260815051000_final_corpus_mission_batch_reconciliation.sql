-- Recover a committed mission save when the browser loses the subsequent
-- result-RPC response. The immutable generated lineage is the authority.

CREATE OR REPLACE FUNCTION public.reconcile_pragma_final_corpus_mission_batch(p_batch_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted integer;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Only admins can reconcile final mission batches'; END IF;
  INSERT INTO public.pragma_final_corpus_mission_item_results (
    claim_id, result, lineage_version_id, generation_attempt_count,
    rule_result, quality_verdict, actor_id
  )
  SELECT claim.id, 'succeeded', lineage.id, lineage.generation_attempt,
         lineage.validation_result->>'result', lineage.ai_quality_result->>'verdict', auth.uid()
  FROM public.pragma_final_corpus_mission_item_claims claim
  JOIN public.pragma_final_corpus_mission_batches batch ON batch.id = claim.batch_id
  JOIN public.pragma_final_corpus_generation_runs run ON run.id = batch.generation_run_id
  JOIN public.pragma_final_corpus_generation_locks lock ON lock.id = run.generation_lock_id
  JOIN LATERAL (
    SELECT candidate.* FROM public.mission_lineage_versions candidate
    WHERE candidate.scenario_id = claim.scenario_id
      AND candidate.stage = 'generated'
      AND candidate.created_at >= claim.claimed_at
    ORDER BY candidate.version_no DESC LIMIT 1
  ) lineage ON true
  LEFT JOIN public.pragma_final_corpus_mission_item_results result ON result.claim_id = claim.id
  WHERE claim.batch_id = p_batch_id
    AND claim.claimed_by = auth.uid()
    AND result.id IS NULL
    AND lineage.actor_id = auth.uid()
    AND lineage.coverage_status = 'covered'
    AND lineage.realization_pack_id = lock.pack_id
    AND lineage.realization_pack_version = lock.pack_version
    AND lineage.generation_attempt BETWEEN 1 AND 3
    AND lineage.validation_result->>'result' IN ('pass','warning')
    AND lineage.ai_quality_result->>'verdict' IN ('pass','warning')
    AND COALESCE(lineage.mission_content_hash, '') ~ '^[0-9a-f]{64}$'
    AND COALESCE(lineage.prompt_snapshot_hash, '') ~ '^[0-9a-f]{64}$'
    AND lineage.item_lineage IS NOT NULL
  ON CONFLICT (claim_id) DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
END;
$$;
REVOKE ALL ON FUNCTION public.reconcile_pragma_final_corpus_mission_batch(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reconcile_pragma_final_corpus_mission_batch(uuid)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.complete_pragma_final_corpus_mission_batch(
  p_batch_id uuid,
  p_rationale_ko text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_batch public.pragma_final_corpus_mission_batches%ROWTYPE;
  v_generated bigint;
  v_succeeded bigint;
  v_id uuid;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Only admins can complete final mission batches'; END IF;
  IF length(btrim(COALESCE(p_rationale_ko, ''))) = 0 THEN RAISE EXCEPTION 'Completion rationale is required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('pragma-final-mission-batch:' || p_batch_id::text, 0));
  SELECT * INTO v_batch FROM public.pragma_final_corpus_mission_batches WHERE id = p_batch_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Final mission batch not found'; END IF;
  PERFORM public.reconcile_pragma_final_corpus_mission_batch(p_batch_id);
  SELECT count(*) INTO v_generated FROM public.scenarios
  WHERE final_corpus_generation_run_id = v_batch.generation_run_id
    AND dataset_class = 'final_candidate' AND mission_content IS NOT NULL;
  SELECT count(DISTINCT claim.scenario_id) INTO v_succeeded
  FROM public.pragma_final_corpus_mission_item_results result
  JOIN public.pragma_final_corpus_mission_item_claims claim ON claim.id = result.claim_id
  WHERE claim.batch_id = v_batch.id AND result.result = 'succeeded';
  IF v_generated <> v_batch.target_count OR v_succeeded <> v_batch.target_count THEN
    RAISE EXCEPTION 'Mission batch cannot complete until all 504 claimed items succeed';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.pragma_final_corpus_mission_item_claims claim
    LEFT JOIN public.pragma_final_corpus_mission_item_results result ON result.claim_id = claim.id
    WHERE claim.batch_id = v_batch.id AND result.id IS NULL AND claim.lease_expires_at > now()
  ) THEN RAISE EXCEPTION 'Mission batch cannot complete with active leases'; END IF;
  INSERT INTO public.pragma_final_corpus_mission_batch_events (
    batch_id, event_type, rationale_ko, actor_id
  ) VALUES (v_batch.id, 'completed', p_rationale_ko, auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.complete_pragma_final_corpus_mission_batch(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_pragma_final_corpus_mission_batch(uuid, text)
  TO authenticated, service_role;
