// 디펜스용 대표 미션의 단일 진입 계약.
// 실제 실행기는 CanonicalMissionRun을 그대로 쓰고, UUID만 이 파일에서 고정한다.

const DEFAULT_REPRESENTATIVE_MISSION_ID = "e5d5e841-df2e-4f45-b938-68524f9562b1";

export const REPRESENTATIVE_MISSION_PATH = "/demo/mission";

export const REPRESENTATIVE_MISSION_SCENARIO_ID =
  import.meta.env.VITE_DEMO_MISSION_ID?.trim() || DEFAULT_REPRESENTATIVE_MISSION_ID;
