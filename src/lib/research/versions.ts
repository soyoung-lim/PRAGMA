// D1 (2026-07-21): 버전 스탬프의 단일 출처.
// 모든 학습자 로그 행에 policy_ver를 붙여 재현성·실증 동결을 보장한다.
// 실증(9월) 기간에는 이 값을 고정한다 — 바꾸면 처치(treatment)가 바뀌는 것.
// content_ver는 콘텐츠(패키지)에서 오므로 여기서 관리하지 않는다(= package_ver).

// 미션 엔진의 모드·수준 정책 묶음 버전. 정책 로직을 바꿀 때만 올린다.
export const POLICY_VERSION = "policy_v1_2026-07-21";

// 연구 프로토콜(측정 설계·동의) 버전. 실증 프로토콜을 바꿀 때만 올린다.
export const CONSENT_VERSION = "consent_v1_2026-07-21";
