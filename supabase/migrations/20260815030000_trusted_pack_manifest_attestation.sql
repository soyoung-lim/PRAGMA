-- PRAGMA moat v1.2: a browser-computed hash prevents transcription errors but is not
-- authoritative. A pack release now requires an immutable manifest attestation that
-- only the deployment/CI service role can register. Admins can select and consume an
-- exact attestation, but cannot manufacture one from the browser.

CREATE TABLE public.pragma_pack_manifest_attestations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schema_version text NOT NULL DEFAULT 'pragma_pack_manifest_attestation_v1'
    CHECK (schema_version = 'pragma_pack_manifest_attestation_v1'),
  canonicalization_version text NOT NULL
    CHECK (canonicalization_version = 'pragma_canonical_json_v1'),
  pack_id text NOT NULL,
  pack_version text NOT NULL CHECK (pack_version ~ '^[0-9]+\.[0-9]+\.[0-9]+$'),
  artifact_hash text NOT NULL CHECK (artifact_hash ~ '^[0-9a-f]{64}$'),
  prompt_snapshot_hash text NOT NULL CHECK (prompt_snapshot_hash ~ '^[0-9a-f]{64}$'),
  evidence_snapshot_hash text NOT NULL CHECK (evidence_snapshot_hash ~ '^[0-9a-f]{64}$'),
  source_commit_ref text NOT NULL CHECK (source_commit_ref ~ '^[0-9a-f]{40}$'),
  build_run_ref text NOT NULL CHECK (length(btrim(build_run_ref)) > 0),
  attestation_method text NOT NULL DEFAULT 'ci_service_role'
    CHECK (attestation_method = 'ci_service_role'),
  attested_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (
    pack_id, pack_version, artifact_hash, prompt_snapshot_hash,
    evidence_snapshot_hash, source_commit_ref
  )
);

ALTER TABLE public.pragma_pack_manifest_attestations ENABLE ROW LEVEL SECURITY;
CREATE POLICY pragma_pack_manifest_attestations_admin_read
  ON public.pragma_pack_manifest_attestations FOR SELECT TO authenticated
  USING (public.is_admin());
GRANT SELECT ON public.pragma_pack_manifest_attestations TO authenticated;
GRANT ALL ON public.pragma_pack_manifest_attestations TO service_role;
REVOKE INSERT, UPDATE, DELETE ON public.pragma_pack_manifest_attestations FROM authenticated, anon;

CREATE OR REPLACE FUNCTION public.reject_pragma_pack_manifest_attestation_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Pack manifest attestations are append-only';
END;
$$;
REVOKE ALL ON FUNCTION public.reject_pragma_pack_manifest_attestation_mutation() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER pragma_pack_manifest_attestations_append_only
  BEFORE UPDATE OR DELETE ON public.pragma_pack_manifest_attestations
  FOR EACH ROW EXECUTE FUNCTION public.reject_pragma_pack_manifest_attestation_mutation();

ALTER TABLE public.pragma_realization_pack_releases
  ADD COLUMN manifest_attestation_id uuid
    REFERENCES public.pragma_pack_manifest_attestations(id) ON DELETE RESTRICT;
CREATE UNIQUE INDEX pragma_pack_release_one_attestation_idx
  ON public.pragma_realization_pack_releases(manifest_attestation_id)
  WHERE manifest_attestation_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.validate_pragma_realization_pack_release()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_previous public.pragma_realization_pack_releases%ROWTYPE;
  v_candidate public.pragma_improvement_candidates%ROWTYPE;
  v_attestation public.pragma_pack_manifest_attestations%ROWTYPE;
BEGIN
  SELECT * INTO v_attestation
  FROM public.pragma_pack_manifest_attestations
  WHERE id = NEW.manifest_attestation_id;
  IF NOT FOUND
     OR v_attestation.pack_id IS DISTINCT FROM NEW.pack_id
     OR v_attestation.pack_version IS DISTINCT FROM NEW.pack_version
     OR v_attestation.artifact_hash IS DISTINCT FROM NEW.artifact_hash
     OR v_attestation.prompt_snapshot_hash IS DISTINCT FROM NEW.prompt_snapshot_hash
     OR v_attestation.evidence_snapshot_hash IS DISTINCT FROM NEW.evidence_snapshot_hash
     OR v_attestation.source_commit_ref IS DISTINCT FROM NEW.source_commit_ref
  THEN
    RAISE EXCEPTION 'Pack release must exactly match a CI/service manifest attestation';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('pragma-pack:' || NEW.pack_id, 0));
  SELECT release.* INTO v_previous
  FROM public.pragma_realization_pack_releases release
  WHERE release.pack_id = NEW.pack_id
    AND NOT EXISTS (
      SELECT 1 FROM public.pragma_realization_pack_releases later
      WHERE later.supersedes_release_id = release.id
    )
  ORDER BY release.created_at DESC LIMIT 1;

  IF NOT FOUND THEN
    IF NEW.source_candidate_id IS NOT NULL OR NEW.supersedes_release_id IS NOT NULL THEN
      RAISE EXCEPTION 'The first pack release must be an unlinked baseline manifest';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.supersedes_release_id IS DISTINCT FROM v_previous.id
     OR NEW.source_candidate_id IS NULL
     OR NOT public.pragma_semver_is_greater(NEW.pack_version, v_previous.pack_version)
  THEN
    RAISE EXCEPTION 'Pack releases must form a contiguous, strictly increasing candidate-linked chain';
  END IF;
  SELECT * INTO v_candidate FROM public.pragma_improvement_candidates WHERE id = NEW.source_candidate_id;
  IF NOT FOUND OR v_candidate.realization_pack_id IS DISTINCT FROM NEW.pack_id
     OR v_candidate.realization_pack_version IS DISTINCT FROM v_previous.pack_version
     OR NOT EXISTS (
       SELECT 1 FROM public.pragma_improvement_decisions decision
       WHERE decision.candidate_id = NEW.source_candidate_id AND decision.decision = 'approve'
     )
  THEN
    RAISE EXCEPTION 'Pack release candidate must be approved and scoped to the current pack';
  END IF;
  RETURN NEW;
END;
$$;

DROP FUNCTION public.record_pragma_realization_pack_release(text, text, text, text, text, text, text, uuid);
CREATE FUNCTION public.record_pragma_realization_pack_release(
  p_pack_id text,
  p_pack_version text,
  p_artifact_hash text,
  p_prompt_snapshot_hash text,
  p_evidence_snapshot_hash text,
  p_source_commit_ref text,
  p_release_note_ko text,
  p_manifest_attestation_id uuid,
  p_source_candidate_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_previous public.pragma_realization_pack_releases%ROWTYPE;
  v_candidate public.pragma_improvement_candidates%ROWTYPE;
  v_id uuid;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Only admins can record pack releases'; END IF;
  IF p_pack_version !~ '^[0-9]+\.[0-9]+\.[0-9]+$'
     OR p_artifact_hash !~ '^[0-9a-f]{64}$'
     OR p_prompt_snapshot_hash !~ '^[0-9a-f]{64}$'
     OR p_evidence_snapshot_hash !~ '^[0-9a-f]{64}$'
     OR p_source_commit_ref !~ '^[0-9a-f]{40}$'
     OR length(btrim(COALESCE(p_release_note_ko, ''))) = 0
     OR p_manifest_attestation_id IS NULL
  THEN RAISE EXCEPTION 'Pack release requires exact hashes, full commit, CI attestation, and note'; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('pragma-pack:' || p_pack_id, 0));
  SELECT release.* INTO v_previous
  FROM public.pragma_realization_pack_releases release
  WHERE release.pack_id = p_pack_id
    AND NOT EXISTS (
      SELECT 1 FROM public.pragma_realization_pack_releases later
      WHERE later.supersedes_release_id = release.id
    )
  ORDER BY release.created_at DESC LIMIT 1;

  IF FOUND THEN
    IF p_source_candidate_id IS NULL OR NOT public.pragma_semver_is_greater(p_pack_version, v_previous.pack_version) THEN
      RAISE EXCEPTION 'A subsequent pack release needs an approved candidate and strictly greater semver';
    END IF;
    SELECT * INTO v_candidate FROM public.pragma_improvement_candidates WHERE id = p_source_candidate_id;
    IF NOT FOUND OR v_candidate.realization_pack_id IS DISTINCT FROM p_pack_id
       OR v_candidate.realization_pack_version IS DISTINCT FROM v_previous.pack_version
       OR NOT EXISTS (
         SELECT 1 FROM public.pragma_improvement_decisions decision
         WHERE decision.candidate_id = p_source_candidate_id AND decision.decision = 'approve'
       )
    THEN RAISE EXCEPTION 'Pack release candidate must be approved and scoped to the current pack'; END IF;
  ELSIF p_source_candidate_id IS NOT NULL THEN
    RAISE EXCEPTION 'The first pack release is a baseline manifest and cannot claim an improvement candidate';
  END IF;

  INSERT INTO public.pragma_realization_pack_releases (
    pack_id, pack_version, artifact_hash, prompt_snapshot_hash, evidence_snapshot_hash,
    source_commit_ref, release_note_ko, source_candidate_id, supersedes_release_id,
    manifest_attestation_id, created_by
  ) VALUES (
    p_pack_id, p_pack_version, p_artifact_hash, p_prompt_snapshot_hash, p_evidence_snapshot_hash,
    p_source_commit_ref, p_release_note_ko, p_source_candidate_id, v_previous.id,
    p_manifest_attestation_id, auth.uid()
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_pragma_realization_pack_release(text, text, text, text, text, text, text, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_pragma_realization_pack_release(text, text, text, text, text, text, text, uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.validate_pragma_applied_pack_attestation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.decision = 'applied' AND NOT EXISTS (
    SELECT 1
    FROM public.pragma_realization_pack_releases release
    JOIN public.pragma_pack_manifest_attestations attestation
      ON attestation.id = release.manifest_attestation_id
     AND attestation.pack_id = release.pack_id
     AND attestation.pack_version = release.pack_version
     AND attestation.artifact_hash = release.artifact_hash
     AND attestation.prompt_snapshot_hash = release.prompt_snapshot_hash
     AND attestation.evidence_snapshot_hash = release.evidence_snapshot_hash
     AND attestation.source_commit_ref = release.source_commit_ref
    WHERE release.id = NEW.resulting_pack_release_id
  ) THEN
    RAISE EXCEPTION 'Applied requires an exactly attested CI/service pack manifest';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.validate_pragma_applied_pack_attestation() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER validate_pragma_applied_pack_attestation_trg
  BEFORE INSERT ON public.pragma_improvement_decisions
  FOR EACH ROW EXECUTE FUNCTION public.validate_pragma_applied_pack_attestation();
