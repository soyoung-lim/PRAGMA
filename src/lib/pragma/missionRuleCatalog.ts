export type MissionRuleStatus = "active" | "retired";

export type MissionRuleCatalogEntry = {
  ids: readonly MissionRuleId[];
  displayId: string;
  check: string;
  verdict: string;
  status: MissionRuleStatus;
};

export type MissionRuleId =
  | "R1"
  | "R1c"
  | "R2"
  | "R3"
  | "R4"
  | "R5"
  | "R6"
  | "R7"
  | "R8"
  | "R9"
  | "R10"
  | "R11"
  | "R12"
  | "R13"
  | "R14"
  | "R15"
  | "R16"
  | "R17"
  | "R18"
  | "R19"
  | "R20"
  | "R21"
  | "R22"
  | "R23"
  | "R24"
  | "R25"
  | "R26"
  | "R27"
  | "R28"
  | "R29"
  | "R30"
  | "R31"
  | "R32"
  | "R33";

// The wording mirrors §6.5 of the generation contract. A regression test keeps
// the checked-in catalogue and that canonical table aligned.
export const MISSION_RULE_CATALOG: readonly MissionRuleCatalogEntry[] = [
  { ids: ["R1", "R1c"], displayId: "R1 / R1c", check: "미션·코어 스키마, 현행 MJT5 순서, 축·대역 코드, theme/topic 구조", verdict: "fail", status: "active" },
  { ids: ["R2"], displayId: "R2", check: "native `judge3`의 비적정 대역 1개와 DCT 앵커 PDR 일치", verdict: "fail", status: "active" },
  { ids: ["R3"], displayId: "R3", check: "native FixChoice 3안·권장안 1개(legacy 계약은 별도 호환)", verdict: "fail", status: "active" },
  { ids: ["R4"], displayId: "R4", check: "Reason의 참조 ID·이유 역할·주원인·앵커 PDR", verdict: "fail(legacy 일부 warning)", status: "active" },
  { ids: ["R5"], displayId: "R5", check: "MultiJudge 역할·대역·중복·한 축 대비 및 길이 완전 분리", verdict: "구조 fail·길이 warning; §6.4 우선", status: "active" },
  { ids: ["R6"], displayId: "R6", check: "highlight가 실제 target 부분문자열인지", verdict: "fail", status: "active" },
  { ids: ["R7"], displayId: "R7", check: "Scale4 응답 구간·극성·참고 판정", verdict: "fail/warning", status: "active" },
  { ids: ["R8"], displayId: "R8", check: "native MJT5의 self-contained 장면(`preceding_turn=null`), legacy 응답형 인접쌍", verdict: "fail", status: "active" },
  { ids: ["R9"], displayId: "R9", check: "해설·note의 명시적 국가 단위 일반화 패턴", verdict: "fail; 의미 일반화 전수 판정은 아님", status: "active" },
  { ids: ["R10"], displayId: "R10", check: "direction·source/target/선행발화 언어", verdict: "명백한 혼입 fail·불확실한 후보 warning", status: "active" },
  { ids: ["R11"], displayId: "R11", check: "참고 산출안 1–2개·문항별 권장안 존재", verdict: "fail; 현행 스키마가 대부분 먼저 R1로 거부", status: "active" },
  { ids: ["R12"], displayId: "R12", check: "한 방향으로 예측 가능한 accepted 분포", verdict: "warning", status: "active" },
  { ids: ["R13"], displayId: "R13", check: "target feature 코드·version", verdict: "fail", status: "active" },
  { ids: ["R14"], displayId: "R14", check: "학습자 라벨·마무리 원칙의 카탈로그 복사", verdict: "fail", status: "active" },
  { ids: ["R15"], displayId: "R15", check: "target feature의 화행과 요청 화행 일치", verdict: "fail; domain/theme은 R1c가 담당", status: "active" },
  { ids: ["R16"], displayId: "R16", check: "번역/통역 modality와 통역 A/B/C 역할·이중언어 장면", verdict: "fail/warning", status: "active" },
  { ids: ["R17"], displayId: "R17", check: "산업 메타데이터는 work 도메인에서만 허용", verdict: "fail", status: "active" },
  { ids: ["R18"], displayId: "R18", check: "교정·이유 문제 문장이 비적정 대역인지", verdict: "fail", status: "active" },
  { ids: ["R19"], displayId: "R19", check: "한 미션 안의 MJT source·판정 후보 완전 중복", verdict: "warning; 배치 중복은 별도 hash/저장 계층 소관", status: "active" },
  { ids: ["R20"], displayId: "R20", check: "미션 provenance 필수값", verdict: "fail; 행 바깥 상태 정합은 DB/RPC 소관", status: "active" },
  { ids: ["R21"], displayId: "R21", check: "권장안이 부적절 target 또는 명시적 invalid 교정안과 동일한 기계적 모순", verdict: "fail", status: "active" },
  { ids: ["R22"], displayId: "R22", check: "**retired** — 과거 수준·HSK 휴리스틱", verdict: "§8.1 비차단 `hsk_lexical_audit`로 대체, 번호 재사용 금지", status: "retired" },
  { ids: ["R23"], displayId: "R23", check: "코어의 source·PDR·modality·direction·`usable_facts` 계승", verdict: "fail; DCT 장면은 새 사건이며 channel은 계승축 아님", status: "active" },
  { ids: ["R24"], displayId: "R24", check: "계획 target feature와 생성 feature 일치", verdict: "fail", status: "active" },
  { ids: ["R25"], displayId: "R25", check: "신규 코어 `context_spec`, 통역 A/B/C·PDR 역할 계약", verdict: "fail", status: "active" },
  { ids: ["R26"], displayId: "R26", check: "work 산업 라벨을 뒷받침하는 최소 분야 단서", verdict: "warning; miss에만 production runner가 core quality industry 축을 1회 호출", status: "active" },
  { ids: ["R27"], displayId: "R27", check: "현행 `X→A→A→A→Y→C` 상황 topology, X/A/Y/C 완전 중복, 학습자 장면 2문장·140자 이하", verdict: "topology·MJT 형식 fail, DCT 형식 warning", status: "active" },
  { ids: ["R28"], displayId: "R28", check: "번역은 email/messenger, 통역은 face-to-face/phone", verdict: "fail", status: "active" },
  { ids: ["R29"], displayId: "R29", check: "DCT 유효 글자 범위·focal segment·담화 전체 참고안 경고", verdict: "fail/warning; 길이 범위는 §2026-08-02 파일럿", status: "active" },
  { ids: ["R30"], displayId: "R30", check: "학생용 장면의 정답 평가 방향 노출", verdict: "fail", status: "active" },
  { ids: ["R31"], displayId: "R31", check: "적용 범위 mission_v5의 item lineage 구조·scope·provenance·미귀속 상한", verdict: "fail; covered pack에만 적용", status: "active" },
  { ids: ["R32"], displayId: "R32", check: "허용 상한 이하 `model_unattributed` claim", verdict: "warning", status: "active" },
  { ids: ["R33"], displayId: "R33", check: "현행 native MJT5의 복수 진단차원·근거 위치 구조", verdict: "fail; 선언의 의미 타당성은 AI/사람 검수", status: "active" },
] as const;

export const RETIRED_MISSION_RULE_IDS = MISSION_RULE_CATALOG
  .filter((entry) => entry.status === "retired")
  .flatMap((entry) => entry.ids);

export const MISSION_RULE_IDS = MISSION_RULE_CATALOG.flatMap((entry) => entry.ids);
