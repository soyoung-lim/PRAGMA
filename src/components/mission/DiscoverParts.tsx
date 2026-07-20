import { Badge } from "@/components/ui/badge";
import {
  RECEIVER_PERSPECTIVE,
  MAPPING_SITUATION_OPTIONS,
  MAPPING_REFLECTED_OPTIONS,
  CONTRAST_ADJUSTED,
  CONTRAST_BOUNDARY,
  XRAY_SEGMENTS,
} from "@/lib/mission/mockPracticeMission";

// "차이 발견" 화면을 이루는 네 블록. 학습자에게는 한 화면으로 보이지만
// 내부적으로는 수신자 관점 / 2단 진단 / 3종 대조 / 엑스레이 네 단위다.

/** ③ 수신자 관점 — 프로토타입 .recv + .fidcheck */
export const ReceiverPerspectiveCard = () => (
  <div className="rounded-xl border border-[#2563EB]/30 bg-[#EFF4FB] p-4">
    <div className="text-[11px] font-semibold text-[#2563EB]">받는 사람 입장에서는…</div>
    <ul className="mt-2 space-y-1 text-[13px]">
      {RECEIVER_PERSPECTIVE.points.map((p) => (
        <li key={p}>· {p}</li>
      ))}
    </ul>
    <div className="mt-2 rounded-md border border-[#EAE4D2] bg-white px-3 py-2 text-[12px] text-muted-foreground">
      {RECEIVER_PERSPECTIVE.fidelityCheck}
    </div>
  </div>
);

const PickRow = ({
  label,
  options,
  value,
  onPick,
}: {
  label: string;
  options: readonly string[];
  value: string | null;
  onPick: (v: string) => void;
}) => (
  <div>
    <div className="text-[12px] text-muted-foreground">{label}</div>
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onPick(o)}
          className={[
            "rounded-md border px-2.5 py-1 text-[12px]",
            value === o
              ? "border-[#15202B] bg-[#15202B] text-white"
              : "border-[#EAE4D2] hover:bg-muted",
          ].join(" ")}
        >
          {o}
        </button>
      ))}
    </div>
  </div>
);

/** ④ 상황 판단 / 표현 실현 2단 진단 — 채점 아님, 자기 성찰용. */
export const MappingDiagnosis = ({
  situationCall,
  productionReflected,
  onSituationCall,
  onProductionReflected,
}: {
  situationCall: string | null;
  productionReflected: string | null;
  onSituationCall: (v: string) => void;
  onProductionReflected: (v: string) => void;
}) => (
  <div className="space-y-3 rounded-xl border border-[#EAE4D2] bg-white p-4">
    <div className="text-[13px] font-semibold">상황 판단 / 표현 실현</div>
    <PickRow
      label="① 상황을 어떻게 읽었나요"
      options={MAPPING_SITUATION_OPTIONS}
      value={situationCall}
      onPick={onSituationCall}
    />
    <PickRow
      label="② 그 판단이 내 번역에 반영됐나요"
      options={MAPPING_REFLECTED_OPTIONS}
      value={productionReflected}
      onPick={onProductionReflected}
    />
  </div>
);

/** ⑤ 3종 대조 — 정답 선택이 아니라 차이 발견용. */
export const ContrastTriad = ({
  draft,
  focusedDifference,
  onFocus,
}: {
  draft: string;
  focusedDifference: string | null;
  onFocus: (key: string) => void;
}) => (
  <div className="rounded-xl border border-[#EAE4D2] bg-white p-4">
    <div className="text-[13px] font-semibold">같은 부탁을, 한 가지만 바꿔서 나란히 놓아봤어요</div>
    <p className="mt-1 text-[12px] text-muted-foreground">
      정답을 고르는 화면이 아니에요 — 눌러서 차이를 확인해 보세요.
    </p>
    <div className="mt-3 space-y-2.5">
      <div className="rounded-lg border border-[#EAE4D2] bg-[#FAF7EE] p-3">
        <Badge variant="outline" className="text-[11px]">
          내 표현
        </Badge>
        <p className="mt-1.5 text-[15px]">{draft || "(아직 작성한 표현이 없어요)"}</p>
      </div>

      <button
        type="button"
        onClick={() => onFocus(CONTRAST_ADJUSTED.label)}
        className={[
          "w-full rounded-lg border p-3 text-left transition-colors",
          focusedDifference === CONTRAST_ADJUSTED.label
            ? "border-emerald-500 bg-emerald-50"
            : "border-[#EAE4D2] hover:bg-muted",
        ].join(" ")}
      >
        <Badge className="bg-emerald-100 text-[11px] text-emerald-900 hover:bg-emerald-100">
          {CONTRAST_ADJUSTED.label}
        </Badge>
        <p className="mt-1.5 text-[15px]">{CONTRAST_ADJUSTED.zh}</p>
        {focusedDifference === CONTRAST_ADJUSTED.label && (
          <p className="mt-1.5 text-[12px] text-emerald-800">차이: {CONTRAST_ADJUSTED.feature}</p>
        )}
      </button>

      <button
        type="button"
        onClick={() => onFocus(CONTRAST_BOUNDARY.label)}
        className={[
          "w-full rounded-lg border p-3 text-left transition-colors",
          focusedDifference === CONTRAST_BOUNDARY.label
            ? "border-destructive bg-destructive/5"
            : "border-[#EAE4D2] hover:bg-muted",
        ].join(" ")}
      >
        <Badge className="bg-red-100 text-[11px] text-red-900 hover:bg-red-100">
          {CONTRAST_BOUNDARY.label}
        </Badge>
        <p className="mt-1.5 text-[15px]">{CONTRAST_BOUNDARY.zh}</p>
        {focusedDifference === CONTRAST_BOUNDARY.label && (
          <ul className="mt-1.5 text-[12px] text-destructive">
            {CONTRAST_BOUNDARY.features.map((f) => (
              <li key={f}>· {f}</li>
            ))}
          </ul>
        )}
      </button>
    </div>
  </div>
);

/** ⑥ 메시지 엑스레이 — 산출을 전략 기능 단위로 분해(mock 고정). */
export const MessageXray = () => (
  <div className="rounded-xl border border-[#EAE4D2] bg-white p-4">
    <div className="text-[13px] font-semibold">메시지 엑스레이 (내 표현)</div>
    <div className="mt-2 flex flex-wrap gap-1.5">
      {XRAY_SEGMENTS.map((s) => (
        <span
          key={s.label}
          className={[
            "rounded-full border px-2.5 py-1 text-[11px]",
            s.present
              ? "border-emerald-300 bg-emerald-50 text-emerald-800"
              : "border-[#EAE4D2] bg-muted text-muted-foreground",
          ].join(" ")}
        >
          {s.present ? "✓" : "–"} {s.label}
        </span>
      ))}
    </div>
    <ul className="mt-2 space-y-1 text-[12px] text-muted-foreground">
      {XRAY_SEGMENTS.filter((s) => !s.present).map((s) => (
        <li key={s.label}>· {s.note}</li>
      ))}
    </ul>
  </div>
);
