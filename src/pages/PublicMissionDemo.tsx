import { CanonicalMissionRunner } from "@/pages/learner/CanonicalMissionRun";
import { CANONICAL_MISSION_PREVIEW } from "@/lib/mission/canonicalMissionPreview";

/** Public, bundled example. Never receives a database mission or runtime context. */
export default function PublicMissionDemo() {
  return <CanonicalMissionRunner mission={CANONICAL_MISSION_PREVIEW} isDevPreview={false} demoMode />;
}
