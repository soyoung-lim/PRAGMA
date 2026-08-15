import { describe, expect, it } from "vitest";

import { PACK_RELEASE_MANIFEST_DRAFT } from "./packReleaseManifest.generated";
import {
  PACK_CANONICALIZATION_VERSION,
  buildPackArtifactSurface,
  canonicalJson,
  packManifestReleaseScopeMatches,
  semverGreater,
  verifyPackReleaseManifestDraft,
} from "./packReleaseManifest";
import { PROMPT_SNAPSHOT } from "./promptSnapshot.generated";
import { KO_ZH_CORE_REALIZATION_PACK } from "./realizationPack";

describe("realization pack release manifest", () => {
  it("matches the exact current pack and evidence surface", async () => {
    const result = await verifyPackReleaseManifestDraft(
      KO_ZH_CORE_REALIZATION_PACK,
      PACK_RELEASE_MANIFEST_DRAFT,
    );
    expect(result.valid).toBe(true);
    expect(PACK_RELEASE_MANIFEST_DRAFT.prompt_snapshot_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(PACK_RELEASE_MANIFEST_DRAFT.canonicalization_version).toBe(PACK_CANONICALIZATION_VERSION);
    expect(PACK_RELEASE_MANIFEST_DRAFT.scope_speech_acts).toEqual(KO_ZH_CORE_REALIZATION_PACK.scope.speech_acts);
    expect(PACK_RELEASE_MANIFEST_DRAFT.prompt_snapshot_hash).toBe(PROMPT_SNAPSHOT.pack_prompt_surface_hash);
    expect(PACK_RELEASE_MANIFEST_DRAFT.source_commit_ref).toMatch(/^[0-9a-f]{40}$/);
    expect(PACK_RELEASE_MANIFEST_DRAFT.source_paths).toContain("src/lib/pragma/realizationPack.ts");
    expect(JSON.stringify(buildPackArtifactSurface(KO_ZH_CORE_REALIZATION_PACK))).not.toContain("reviewer_ids");
    expect(JSON.stringify(buildPackArtifactSurface(KO_ZH_CORE_REALIZATION_PACK))).not.toContain("reviewed_at");
  });

  it("sorts object keys but preserves array order", () => {
    expect(canonicalJson({ b: 2, a: ["x", "y"] })).toBe('{"a":["x","y"],"b":2}');
    expect(canonicalJson({ a: ["y", "x"], b: 2 })).not.toBe(canonicalJson({ b: 2, a: ["x", "y"] }));
    expect(canonicalJson({ text: "e\u0301\r\nline" })).toBe(canonicalJson({ text: "é\nline" }));
    expect(() => canonicalJson({ invalid: undefined })).toThrow(/does not allow undefined/);
    expect(() => canonicalJson([, "x"])).toThrow(/sparse arrays/);
    expect(() => canonicalJson(Number.NaN)).toThrow(/NaN or Infinity/);
  });

  it("requires a strictly greater three-part semver", () => {
    expect(semverGreater("1.3.0", "1.2.9")).toBe(true);
    expect(semverGreater("1.2.0", "1.2.0")).toBe(false);
    expect(semverGreater("1.1.9", "1.2.0")).toBe(false);
    expect(semverGreater("v2", "1.2.0")).toBe(false);
  });

  it("allows an unlinked baseline but requires a current-pack candidate afterward", () => {
    const draft = { pack_id: "pack-a", pack_version: "1.3.0" };
    expect(packManifestReleaseScopeMatches(draft, null, null)).toBe(true);
    expect(packManifestReleaseScopeMatches(draft, { pack_id: "pack-a", pack_version: "1.2.0" }, null)).toBe(false);
    expect(packManifestReleaseScopeMatches(
      draft,
      { pack_id: "pack-a", pack_version: "1.2.0" },
      { realization_pack_id: "pack-a", realization_pack_version: "1.2.0" },
    )).toBe(true);
    expect(packManifestReleaseScopeMatches(
      draft,
      { pack_id: "pack-a", pack_version: "1.2.0" },
      { realization_pack_id: "pack-a", realization_pack_version: "1.1.0" },
    )).toBe(false);
  });
});
