import type { Json } from "@/integrations/supabase/types";
import { DIRECTION_LANGS, type LanguageDirection } from "@/lib/pragma/enums";
import type { RuntimeFeedback } from "@/lib/pragma/feedbackSchema";
import type { MissionRuntime } from "@/lib/pragma/missionSchema";
import { POLICY_VERSION } from "@/lib/research/versions";

export interface SaveAttemptInput {
  mission: MissionRuntime;
  /** DB 미션이면 scenarios.scenario_id(uuid), 샘플이면 null */
  scenarioId: string | null;
  speechAct: string | null;
  level: string | null;
  /** 학습 전(피드백 전) 산출 = 최초 번역/통역 */
  firstResponse: string;
  /** 다듬은 최종 산출(없으면 최초와 동일) */
  revisedResponse: string;
  /** 학습자에게 실제로 제시된 feedback_v1 스냅샷. 호출 실패 시 생략한다. */
  feedback?: RuntimeFeedback;
  /** 컴포넌트 마운트 시각(ISO) */
  startedAtIso: string;
  /**
   * 학습자 이견 기록(0-r·104). 판정을 바꾸지 않는다 — 결함 문항 발견과
   * 채점키 캘리브레이션 보조 자료로만 쓴다. 남기지 않으면 undefined.
   */
  contextJudgment?: LearnerDissent;
}

/** 이견 채널 저장 형태 — context_judgment jsonb에 그대로 들어간다. */
export interface LearnerDissent extends Record<string, Json | undefined> {
  kind: "learner_dissent";
  /** 어느 화면에서 남겼는가 */
  at: "feedback";
  /** 다르게 본 조건(복수 선택, 코드) */
  conditions: string[];
  /** 한 줄 이유(선택) */
  reason_ko: string;
  created_at: string;
}

/**
 * DB I/O와 분리한 학습 로그 행 조립.
 * 버전 스탬프와 방향 매핑이 빠지지 않는지 결정론적으로 회귀 검사한다.
 */
export function buildMissionAttemptRow(
  input: SaveAttemptInput,
  profileId: string,
  authUserId: string,
  completedAtIso = new Date().toISOString(),
) {
  const dir = input.mission.direction as LanguageDirection;
  const langs = DIRECTION_LANGS[dir];
  const pt = input.mission.production_task;
  const taskType = pt.mode === "interpreting" ? "interpreting" : "translation";
  const feedback = input.feedback;
  const semanticStatus = feedback
    ? {
        preserved: "pass",
        minor_loss: "warning",
        distorted: "fail",
      }[feedback.verdicts.semantic_fidelity]
    : null;

  return {
    profile_id: profileId,
    auth_user_id: authUserId,
    mission_id: input.scenarioId ?? `sample:${input.mission.unit.target_feature}`,
    cell_id: input.scenarioId,
    feature_id: input.mission.unit.target_feature,
    speech_act: input.speechAct,
    level: input.level,
    mode: "학습",
    task_type: taskType,
    source_lang: langs.source,
    target_lang: langs.target,
    source_text: pt.source_text,
    first_response: input.firstResponse,
    revised_response: input.revisedResponse,
    revision_target_selected: feedback?.revision_scope ?? null,
    revision_target_source: feedback ? "system_assigned" : "learner_free",
    target_feature_observed: feedback
      ? ({
          schema_version: feedback.schema_version,
          rubric_version: feedback.rubric_version,
          verdicts: feedback.verdicts,
          revision_scope: feedback.revision_scope,
          blocks: feedback.blocks,
          uncertainty_flags: feedback.uncertainty_flags,
          provenance: feedback.provenance,
        } as unknown as Json)
      : null,
    semantic_fidelity_status: semanticStatus,
    example_shown: true,
    mission_completed: true,
    content_ver: input.mission.unit.target_feature_version ?? null,
    policy_ver: POLICY_VERSION,
    context_judgment: input.contextJudgment ?? null,
    started_at: input.startedAtIso,
    completed_at: completedAtIso,
  };
}
