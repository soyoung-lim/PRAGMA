import { getTargetFeature, SCALE4_LABELS, type Scale4Code } from "@/lib/pragma/targetFeatures";
import type { MissionV1, MpjItem } from "@/lib/pragma/missionSchema";

// 관리자 눈검사 뷰 — 생성된 mission_v1을 읽기 전용으로 전개한다.
// 학습자 러너와 달리 정답 대역·해설·교정 valid를 모두 펼쳐 보여준다(검토가 목적).
// 게이트1 눈검사(H1: 모든 후보가 불변항 통과 / H2: 부적절 근거가 초점 과소·적정·과잉)에 쓴다.

const box = "rounded-lg border border-[#EAE4D2] bg-white p-3";

function bandLabel(featureCode: string, code: string): string {
  return getTargetFeature(featureCode)?.band_schema.find((b) => b.code === code)?.label_ko ?? code;
}

const TYPE_LABEL: Record<string, string> = {
  scale4: "① 적절성 4점",
  judge3: "② 3분류 판정",
  fix_choice: "③ 판정+교정",
  reason_conf: "④ 판정+이유+확신",
  multi_judge: "⑤ 다중 발화",
};

export function MissionPreview({
  mission,
  warnings,
}: {
  mission: MissionV1;
  warnings?: string[];
}) {
  const feat = mission.unit.target_feature;
  const p = mission.provenance;
  return (
    <div className="mt-3 space-y-3 rounded-xl border border-[#D8D0BC] bg-[#FAF8F2] p-3.5 text-[13px]">
      {/* unit + provenance */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-semibold">이번 초점 · {mission.unit.learner_label}</span>
        <span className="text-muted-foreground">({feat} v{mission.unit.target_feature_version})</span>
        {p && (
          <span className="text-[11.5px] text-muted-foreground">
            provenance: {p.model} · {p.prompt_version} · 시도 {p.generation_attempt} · #{p.mission_content_hash.slice(0, 8)}
          </span>
        )}
      </div>
      <p className="text-[12.5px] text-muted-foreground">완료 원칙: {mission.unit.closing_ko}</p>

      {warnings && warnings.length > 0 && (
        <div className="rounded-md bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
          경고 {warnings.length}: {warnings.join(" · ")}
        </div>
      )}

      {/* MPJ 5문항 */}
      {mission.mpj_items.map((it) => (
        <MpjReview key={it.id} item={it} featureCode={feat} />
      ))}

      {/* DCT */}
      <div className={box}>
        <div className="text-[11.5px] font-semibold text-muted-foreground">
          산출 과제 (DCT · {mission.production_task.mode === "interpreting" ? "통역" : "번역"})
        </div>
        <p className="mt-1">{mission.production_task.situation_ko}</p>
        <p className="mt-1 text-muted-foreground">원문: {mission.production_task.source_text_ko}</p>
        <div className="mt-1.5">
          {mission.production_task.reference_alternatives.map((r, i) => (
            <p key={i} className="text-[12.5px]">
              <span className="text-[#2E7D5B]">참고안{i + 1}</span> {r.zh}{" "}
              <span className="text-muted-foreground">— {r.note_ko}</span>
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}

function MpjReview({ item, featureCode }: { item: MpjItem; featureCode: string }) {
  const accepted =
    item.type === "scale4"
      ? item.accepted_scale_codes.map((c) => SCALE4_LABELS[c as Scale4Code] ?? c)
      : item.type === "multi_judge"
        ? []
        : item.accepted_band_codes.map((c) => bandLabel(featureCode, c));
  return (
    <div className={box}>
      <div className="flex items-center justify-between">
        <span className="text-[11.5px] font-semibold text-muted-foreground">{TYPE_LABEL[item.type] ?? item.type}</span>
        {accepted.length > 0 && (
          <span className="rounded bg-[#E7F5EE] px-1.5 py-0.5 text-[11px] font-semibold text-[#2E7D5B]">
            정답 대역: {accepted.join(" / ")}
          </span>
        )}
      </div>
      <p className="mt-1 text-[12.5px] text-muted-foreground">{item.situation_ko}</p>
      <p className="mt-0.5 text-[12.5px]">원문: {item.source_ko}</p>

      {item.type !== "multi_judge" && (
        <p className="mt-1 font-medium">초안: {item.target_zh}</p>
      )}

      {item.type === "fix_choice" && (
        <ul className="mt-1 space-y-0.5">
          {item.corrections.map((c, i) => (
            <li key={i} className={c.is_valid ? "text-[#2E7D5B]" : "text-muted-foreground"}>
              {c.is_valid ? "✓" : "✗"} {c.zh} <span className="text-[11.5px]">— {c.note_ko}</span>
            </li>
          ))}
        </ul>
      )}
      {item.type === "reason_conf" && (
        <ul className="mt-1 space-y-0.5">
          {item.reasons.map((r) => (
            <li key={r.id} className={item.accepted_reason_ids.includes(r.id) ? "text-[#2E7D5B]" : "text-muted-foreground"}>
              {item.accepted_reason_ids.includes(r.id) ? "✓" : "·"} {r.text_ko}
            </li>
          ))}
        </ul>
      )}
      {item.type === "multi_judge" && (
        <ul className="mt-1 space-y-0.5">
          {item.candidates.map((c, i) => (
            <li key={i}>
              <span className="text-[#2E7D5B]">[{c.accepted_band_codes.map((b) => bandLabel(featureCode, b)).join("/")}]</span>{" "}
              {c.zh} <span className="text-[11.5px] text-muted-foreground">— {c.note_ko}</span>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-1 text-[12px] text-muted-foreground">해설: {item.explanation_ko}</p>
      <p className="mt-0.5 text-[12px] text-[#2E7D5B]">적절안: {item.recommended_example_zh}</p>
    </div>
  );
}

export default MissionPreview;
