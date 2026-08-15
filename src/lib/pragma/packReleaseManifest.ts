import type { PackReleaseManifestDraft } from "@/lib/pragma/packReleaseManifest.generated";
import { PROMPT_SNAPSHOT } from "@/lib/pragma/promptSnapshot.generated";
import type { RealizationPack } from "@/lib/pragma/realizationPack";

export const PACK_CANONICALIZATION_VERSION = "pragma_canonical_json_v1" as const;

function normalizeString(value: string): string {
  return value.replace(/\r\n?/g, "\n").normalize("NFC");
}

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "string") return JSON.stringify(normalizeString(value));
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("Canonical JSON does not allow NaN or Infinity.");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    if (Object.keys(value).length !== value.length) throw new TypeError("Canonical JSON does not allow sparse arrays.");
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (typeof value !== "object" || value === undefined) {
    throw new TypeError(`Canonical JSON does not allow ${typeof value}.`);
  }
  const record = value as Record<string, unknown>;
  const normalizedKeys = Object.keys(record).map((key) => [normalizeString(key), key] as const);
  if (new Set(normalizedKeys.map(([key]) => key)).size !== normalizedKeys.length) {
    throw new TypeError("Canonical JSON key normalization collision.");
  }
  return `{${normalizedKeys
    .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
    .map(([normalized, original]) => `${JSON.stringify(normalized)}:${canonicalJson(record[original])}`)
    .join(",")}}`;
}

export function buildPackArtifactSurface(pack: RealizationPack) {
  return {
    canonicalization_version: PACK_CANONICALIZATION_VERSION,
    surface_schema_version: "pragma_pack_artifact_surface_v1",
    schema_version: pack.schema_version,
    pack_id: pack.pack_id,
    version: pack.version,
    direction: pack.direction,
    status: pack.status,
    scope: pack.scope,
    resources: pack.resources.map((resource) => ({
      rule_id: resource.rule_id,
      version: resource.version,
      speech_act: resource.speech_act,
      target_feature: resource.target_feature,
      prompt_label_ko: resource.prompt_label_ko,
      forms_zh: resource.forms_zh,
      pragmatic_function_ko: resource.pragmatic_function_ko,
      supports_band_codes: resource.supports_band_codes,
      misuse_risk_band_codes: resource.misuse_risk_band_codes,
      applicability: resource.applicability,
      constraints_ko: resource.constraints_ko,
      positive_example_zh: resource.positive_example_zh,
      counterexample_zh: resource.counterexample_zh,
      evidence_ids: resource.evidence_ids,
      review: { status: resource.review.status },
    })),
    risks: pack.risks.map((risk) => ({
      risk_id: risk.risk_id,
      version: risk.version,
      description_ko: risk.description_ko,
      speech_acts: risk.speech_acts,
      legacy_prompt_speech_acts: risk.legacy_prompt_speech_acts,
      target_features: risk.target_features,
      risk_axis: risk.risk_axis,
      band_risks_by_feature: risk.band_risks_by_feature,
      applicability: risk.applicability,
      approved_example: risk.approved_example,
      evidence_ids: risk.evidence_ids,
      review: { status: risk.review.status },
    })),
  };
}

export function buildPackEvidenceSurface(pack: RealizationPack) {
  return {
    canonicalization_version: PACK_CANONICALIZATION_VERSION,
    surface_schema_version: "pragma_pack_evidence_surface_v1",
    schema_version: pack.schema_version,
    pack_id: pack.pack_id,
    pack_version: pack.version,
    evidence: pack.evidence,
  };
}

export async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function verifyPackReleaseManifestDraft(
  pack: RealizationPack,
  draft: PackReleaseManifestDraft,
): Promise<{ valid: boolean; artifact_hash: string; evidence_snapshot_hash: string }> {
  const artifactHash = await sha256Hex(canonicalJson(buildPackArtifactSurface(pack)));
  const evidenceHash = await sha256Hex(canonicalJson(buildPackEvidenceSurface(pack)));
  return {
    valid:
      draft.canonicalization_version === PACK_CANONICALIZATION_VERSION &&
      draft.pack_id === pack.pack_id &&
      draft.pack_version === pack.version &&
      JSON.stringify(draft.scope_speech_acts) === JSON.stringify(pack.scope.speech_acts) &&
      draft.artifact_hash === artifactHash &&
      draft.evidence_snapshot_hash === evidenceHash &&
      draft.prompt_snapshot_hash === PROMPT_SNAPSHOT.pack_prompt_surface_hash,
    artifact_hash: artifactHash,
    evidence_snapshot_hash: evidenceHash,
  };
}

export function semverGreater(next: string, previous: string): boolean {
  const pattern = /^\d+\.\d+\.\d+$/;
  if (!pattern.test(next) || !pattern.test(previous)) return false;
  const a = next.split(".").map(Number);
  const b = previous.split(".").map(Number);
  return a[0] > b[0] || (a[0] === b[0] && (a[1] > b[1] || (a[1] === b[1] && a[2] > b[2])));
}

export function packManifestReleaseScopeMatches(
  draft: Pick<PackReleaseManifestDraft, "pack_id" | "pack_version">,
  latestRelease: { pack_id: string; pack_version: string } | null,
  candidate: { realization_pack_id: string | null; realization_pack_version: string | null } | null,
): boolean {
  if (!latestRelease) return true;
  return !!candidate
    && latestRelease.pack_id === draft.pack_id
    && candidate.realization_pack_id === draft.pack_id
    && candidate.realization_pack_version === latestRelease.pack_version
    && semverGreater(draft.pack_version, latestRelease.pack_version);
}
