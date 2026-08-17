# PRAGMA

> **AI 기반 한·중 통번역 학습 워크플로우 개발 연구**
> 박사학위논문 개발연구(2026)의 일환으로 설계·구현된 수업 연계형 학습 플랫폼

[![Live](https://img.shields.io/badge/live-pragma.up.railway.app-2ea44f?style=flat-square)](https://pragma.up.railway.app)
![Status](https://img.shields.io/badge/status-research_in_progress-blue?style=flat-square)
![Stack](https://img.shields.io/badge/React_18-TypeScript-3178c6?style=flat-square)
![Backend](https://img.shields.io/badge/Supabase-PostgreSQL-3ecf8e?style=flat-square)

PRAGMA는 동일한 의미가 상황과 대인 관계에 따라 다르게 표현되어야 한다는
화용적 적절성의 문제를 한·중 통번역 학습의 중심 과제로 다룹니다.
학습자는 여러 표현 후보의 맥락 적절성을 판단한 뒤 직접 번역·통역을 수행하고,
피드백을 검토하여 자신의 산출을 수정합니다.

| 메인 화면 — 학습자·교수자 진입 | 통합 워크플로우 개요 |
|---|---|
| ![PRAGMA 메인 화면](docs/screenshots/01-landing.png) | ![PRAGMA 통합 워크플로우](docs/screenshots/02-architecture.png) |

## 연구 설계와 시스템 구현

| 설계 원칙 | 시스템 구현 |
|---|---|
| 판단 과제와 산출 과제의 단계적 배열 | 각 미션은 맥락 적절성 판단(MPJ) 4문항 → 번역·통역 산출 → 피드백 검토 → 표적 수정의 순서로 진행됩니다 |
| AI 생성과 교수자 승인의 권한 분리 | 자동 생성·규칙 기반 검사·복수 모델 교차 검토는 후보를 제안할 뿐이며, 수업에는 교수자가 승인한 콘텐츠만 배치됩니다 |
| 학습 과정의 체계적 기록 | 판단, 선택 근거, 최초 산출안과 수정안이 맥락·버전 정보와 함께 저장되어 연구 자료의 기반이 됩니다 |
| 생성 조건의 추적 가능성 | 콘텐츠 생성에 사용된 프롬프트를 스냅숏과 해시로 고정하고, 그 불변성을 CI에서 상시 검증합니다 |

## 개발 현황

2026년 8월 기준이며, 학위논문 연구의 진행에 따라 계속 갱신됩니다.

| 구분 | 내용 |
|---|---|
| 구현 완료 | 학습자·교수자 워크플로우, 15주 강좌 편성, 학습 수행 기록 저장 |
| 구현 완료 | 콘텐츠 품질 관리 절차 — 규칙 기반 검사, 복수 AI 모델 교차 검토, 교수자 승인 |
| 진행 중 | 정식 학습 문항 대량 생성과 외부 전문가 검토 |
| 계획 | 학습 수행 데이터 수집과 생성 조건별 품질 분석 |

화면 구성과 일부 용어는 연구 진행에 따라 조정될 수 있습니다.

---

PRAGMA는 하나의 “최적 번역”을 자동으로 제시하는 번역기나 범용 LMS가 아닙니다. 화행과 상황 조건을 통제해 학습 콘텐츠를 생성하고, 교수자가 검수·승인한 미션만 수업에 배치하며, 학습자의 판단·산출·수정 과정을 버전과 함께 기록하는 교육 우선형 연구 플랫폼입니다.

## 연구·교육적 목적

PRAGMA는 다음 요소를 실제 학습 기능에 연결합니다.

- 요청·거절·감사·사과·제안·초대·반대·칭찬·직접 불만의 9개 화행
- 상대적 권력(Power), 사회적 거리(Distance), 상황 부담(Risk/Imposition)의 맥락 조건
- 한→중·중→한 언어 방향과 번역·통역 수행 방식
- 입문·중급·고급의 교육 지원 수준
- 상황 판단 → 직접 산출 → 피드백 검토 → 필요 시 수정 → 수행 기록의 학습 순환

P·D·R 코드와 참고 대역은 판단 전에 학습자에게 노출하지 않습니다. 대신 관계·접촉 이력·실제 부담을 자연어 장면으로 제시하고, 화행 명칭과 상황에 따라 표현이 달라지는 원리는 도입·피드백·수업 자료에서 명시적으로 가르칩니다.

PRAGMA의 수준 구분은 CEFR·ACTFL 또는 HSK 급수와 등치되지 않습니다. 동일한 화용 구인 아래에서 장면과 언어적 지원의 차이를 설계하기 위한 내부 교육 수준입니다.

## 핵심 워크플로우

### 콘텐츠 생성·검수

```text
화행·수준·모드·방향·P/D/R·주제 조건
→ 시나리오 코어 생성
→ 선택 코어를 Full Mission으로 조립
→ 규칙 기반 검사
→ 프롬프트 통제 기반 AI 검토
→ 교수자 검수·승인
→ 15주 강좌의 주차에 배치
```

- 시나리오 코어는 상황·관계·원문·선행 발화와 생성 조건을 담고, 판단 문항이나 참고안은 포함하지 않습니다.
- 코어 생성은 strict JSON Schema를 사용합니다. 구조 통과는 내용의 자연성이나 교육적 타당성을 보장하지 않습니다.
- 선택한 코어만 `mission_v5` Full Mission으로 조립합니다. 신규 미션은 생성 직후 `generated`이며, 교수자가 공개 가능하다고 판단한 뒤에만 `reviewed`가 됩니다.
- 규칙 검사와 AI 검토에는 승인 권한이 없습니다. AI 모델 간 독립 검토 결과도 읽기 전용 결함 탐지 자료이며, 이견은 연구자 판단으로 넘깁니다.
- 프롬프트·스키마·콘텐츠 계열이 바뀌면 지문과 release를 분리해 구세대 콘텐츠와 섞지 않습니다.

### 학습자 수행

공식 학습 경로는 교강사가 게시한 15주 수업입니다.

```text
수업·주차 선택
→ 도입 장면과 Can-do·예습 자료
→ 표현 감각 익히기(MPJ 4문항)
→ 직접 번역하기 또는 직접 통역하기(DCT 1회)
→ 의미·문법·상황 적절성 피드백
→ 필요 시 한 번 다듬기
→ 최초안·수정안·판단 기록 확인
```

현행 `mission_v5`는 **MPJ4 + DCT1**입니다. 숫자 5는 스키마 버전이며 문항 수가 아닙니다.

1. `Scale4`: 첫인상을 4점으로 판단하되 적절/부적절 방향을 중심으로 비교합니다.
2. `Judge3 + FixChoice`: 과소·적정·과잉을 판단한 뒤 서로 다른 적절한 수정안 두 개를 고릅니다.
3. `Reason`: 해당 표현이 상황에 맞지 않는 가장 큰 이유 하나를 고릅니다.
4. `MultiJudge`: 다섯 초안을 한 화면에서 비교해 BEST와 WORST를 하나씩 고릅니다.
5. `DCT`: 같은 화용 초점의 새 사건을 직접 번역하거나 통역합니다.

AI 피드백은 의미·의도 충실성, 명백한 문법·형식 문제, 상황 적절성을 분리합니다. 세 층이 모두 통과하면 수정을 강제하지 않고, 수정이 필요한 경우에는 최초안과 실질적으로 다른 답을 작성해야 완료할 수 있습니다. AI 판정과 다르다는 이유만으로 점수나 화용 능력 지표를 만들지 않으며, 학습자는 이견을 남길 수 있습니다.

학습자 화면의 `수업 | 기록 | 라운지` 세 탭도 구현돼 있습니다. 라운지는 핵심 미션과 분리된 저부담 공간으로, 현재 전용 DB·관리자 운영·연구 로그 없이 일부 상태만 브라우저에 저장합니다.

### 교수자 운영

관리자 화면은 콘텐츠 CRUD가 아니라 생성부터 수업 배치까지의 게이트를 운영합니다.

- 실제자료 분석과 콘텐츠 후보 추출
- 조건을 지정한 개별 코어 생성과 승인된 배치 실행
- 셀·상태별 라이브러리 탐색과 코어→미션 조립
- 규칙 검사·AI 검토 근거를 포함한 교수자 검수와 `reviewed` 승인
- 강좌 설정, AI 자동 편성, 주차별 조정을 통합한 15주 교과목 설계
- 학습자 접근·참여 상태와 수행·의사결정 기록 조회
- 프롬프트 지문과 AI 독립 검토 결과의 읽기 전용 확인

수업 자료 자동 생성과 사용자·권한 관리의 일부 화면은 아직 준비 중입니다. 화면이 존재하는
것과 실제 운영 기능이 완성된 것을 구분합니다.

## 연구 추적 구조

PRAGMA는 결과물뿐 아니라 결과가 만들어지고 검토된 조건을 연결해 남깁니다.

| 단계 | 남기는 핵심 기록 |
|---|---|
| 콘텐츠 생성 | generation run, 생성 조건, model/provider, schema·prompt version |
| 프롬프트 | Edge 실행 정본의 snapshot과 hash, 저장 콘텐츠와의 지문 일치 여부 |
| 자동 점검 | 결정론적 검사와 프롬프트 통제 기반 검토 |
| 사람 결정 | 생성 상태와 교수자 검수·승인 상태의 분리 |
| 학습 수행 | MPJ 선택 trace, 최초 산출, 피드백 snapshot, 수정 산출, 학습자 이견 |
| 설계 연구 | 설계 추적, 결정, 반복 개발, 증거 색인 |

호출 원장은 요청 그룹·operation·모델·토큰·프롬프트 지문 등 재현성 메타데이터를 기록하되,
프롬프트나 모델 출력 본문을 중복 저장하지 않습니다. 학습 이용과 연구 참여도 분리하며,
운영 로그가 존재한다는 이유만으로 연구 분석에 사용할 수 없습니다.

## 현재 구현 범위

2026-08-11 저장소 기준입니다. 날짜에 따라 바뀌는 배포·테스트 수치는 [ACTIVE_HANDOFF](docs/handoff/ACTIVE_HANDOFF.md)와 research trail의 시점 고정 증거에서 확인합니다.

### 구현됨

- 양방향 번역·통역을 지원하는 `mission_v5` MPJ4+DCT1 생성·렌더링·수행 기록
- 9화행과 P·D·R, 수준·모드·방향·도메인·주제를 다루는 코어 생성과 품질 점검
- 라이브러리, 미션 조립, 교수자 검수·승인, 15주 강좌 편성
- 주차 도입 아크, 예습·복습 학습 노트, 학습자 기록, 라운지 실화면
- 생성 run·프롬프트 지문·LLM 호출·학습자 판단과 수정의 추적
- Supabase와 Railway 기반 배포 구조, 인증·RLS·Edge Functions

### 제한적으로 운영·검증됨

- Railway 프론트엔드와 Supabase DB·Auth·Edge 배포 경로
- 소수 smoke·canary와 자동 회귀검사를 통한 생성·저장·재조회 경로
- AI 모델 간 독립 검토의 오프라인 실행 도구와 결과 열람 화면

### 아직 완료로 주장하지 않음

- 현재 DB의 생성 코어·미션은 생성 조건 LOCK 전의 개발·시험 콘텐츠입니다. 최종 생산 코퍼스나 내용 타당도 근거가 아닙니다.
- LOCK된 조건으로 전량 재생성·교수자 재승인한 정식 콘텐츠 세트
- 외부 전문가 형성 평가와 연구용 데이터 내보내기의 최종 운영 절차
- 학습 효과·광범위한 전이·지연 효과 또는 인과 효과의 검증
- 라운지 전용 콘텐츠 파이프라인, 서버 저장, 개인화·추천 기능

## 시스템 구조

```text
브라우저
└─ React SPA — Railway 정적 호스팅
   ├─ Supabase Auth — Google OAuth·관리자 로그인
   ├─ Supabase Postgres — RLS가 적용된 콘텐츠·수업·수행·추적 데이터
   └─ Supabase Edge Functions
      ├─ OpenAI — 코어·미션·검토·피드백·음성 전사
      └─ ElevenLabs / OpenAI — 음성 합성
```

Railway에는 공개 가능한 `VITE_*` 프론트엔드 설정만 주입합니다. OpenAI·ElevenLabs 키는 Supabase Edge Function secret으로 관리하며 브라우저 번들에 넣지 않습니다.

## 기술 스택

| 영역 | 현재 구성 |
|---|---|
| 프론트엔드 | React 18.3, Vite 5.4, TypeScript 5.8, React Router 6.30 |
| UI | Tailwind CSS 3.4, Radix UI·shadcn/ui 계열 컴포넌트 |
| 상태·데이터 | TanStack Query 5, Zod 3 |
| 백엔드 | Supabase JS 2.106, Postgres, Auth, RLS, Edge Functions |
| AI 콘텐츠 | OpenAI Chat Completions: `gpt-4.1-mini`, `gpt-4o`, `gpt-4.1` |
| 학습자 피드백 | `gpt-4.1-mini`, 가용성 대체 `gpt-4o-mini` |
| 음성 | OpenAI `gpt-4o-transcribe`, ElevenLabs `eleven_multilingual_v2`, OpenAI TTS 대체 경로 |
| 배포 | Railway 정적 프론트엔드 + Supabase 백엔드 |
| 검증 | Vitest 3, Testing Library, Playwright, ESLint, TypeScript |

이 저장소는 Lovable에서 시작됐기 때문에 `lovable-tagger`와 미사용 cloud-auth 패키지가 남아 있습니다. 현재 인증·AI·음성 런타임은 Lovable Gateway를 사용하지 않습니다.

## 핵심 데이터 구조

README는 전체 스키마 대신 현재 워크플로우를 이해하는 데 필요한 묶음만 제시합니다.

| 기능 | 핵심 테이블·뷰 |
|---|---|
| 계정·권한 | `profiles` |
| 코어·미션·검수 | `scenarios` |
| 15주 수업·편성 | `curriculum_outlines`, `curriculum_weeks`, `curriculum_week_scenarios` |
| 학습 수행·판단 | `learner_mission_logs`, `decision_traces` |
| LLM provenance | `llm_invocation_events`와 `scenarios`의 run·prompt hash 필드 |

프로덕션 프롬프트의 실행 정본은 Edge 소스입니다. `prompt_templates` 같은 DB 자료가 배포된
프롬프트를 자동으로 바꾸지는 않습니다.

## 로컬 실행

Node.js 22.x가 필요합니다.

```bash
npm install
npm run dev        # http://localhost:8080
npm run typecheck
npm test
npm run build
```

환경변수 이름은 [.env.example](.env.example)을 참고합니다. 실제 secret이나 운영 자격증명은 저장소에 커밋하지 않습니다. `npm run build`는 먼저 프롬프트 snapshot을 갱신한 뒤 production bundle을 생성합니다.

## 테스트·검증

- `npm run typecheck`: 애플리케이션 TypeScript 검사
- `npm test`: Vitest 단위·계약·회귀검사
- `npm run build`: 프롬프트 snapshot 생성과 production build
- `tests/`: Playwright 기반 시나리오 검증과 보조 스크립트
- `scripts/manual-checks/`: 음성 round-trip·피드백·품질 점검용 승인형 수동 검사

실제 모델 호출, DB 쓰기, migration 적용, Edge·Railway 배포와 대량 생성은 비용·데이터·운영
상태를 바꾸므로 별도 승인 게이트를 따릅니다.

## 저장소 구조

```text
src/
  pages/                 공개·인증·구조 설명 화면
  pages/learner/         수업·미션·기록·라운지
  pages/admin/           생성·조립·검수·편성·분석
  lib/                   미션·생성·품질·수업 도메인 로직
  integrations/supabase/ Supabase client와 생성 타입
supabase/
  functions/             생성·TTS·STT·자막 Edge Functions
  migrations/            DB schema·RLS·RPC 이력
scripts/                 프롬프트·독립 검토 자동화
tests/                   브라우저·DB 보조 검증
docs/                    현행 정본, 운영 기록, 연구 추적 증거
```

## 상세 문서

- [현행 정본 경로](docs/CANONICAL.md)
- [생성·평가·저장 계약](docs/contracts/PRAGMA_생성계약_정본.md)
- [학습자 구조](docs/product/PRAGMA_학습자구조_정본.md)
- [관리자 구조](docs/product/PRAGMA_관리자구조_정본.md)
- [제품·연구 정체성](docs/research/PRAGMA_PRODUCT_RESEARCH_IDENTITY_2026-07-28.md)
- [콘텐츠 refresh 실행 절차](docs/operations/CONTENT_REFRESH_RUNBOOK.md)
- [설계 추적](docs/research-trail/01_design_traceability.md) ·
  [결정 기록](docs/research-trail/02_decision_log.md) ·
  [반복 개발](docs/research-trail/03_iteration_log.md) ·
  [증거 색인](docs/research-trail/04_evidence_index.md)
- [현재 작업·배포 상태](docs/handoff/ACTIVE_HANDOFF.md)
- [Railway 배포 구성](DEPLOY.md)
- [AI 작업 규칙](AGENTS.md)
