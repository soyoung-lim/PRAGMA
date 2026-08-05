# 2026-08-05 미구현 원자료 취득 경로 제거 (YouTube 자막 · Source Bank 잔여)

## 배경

논문 4장은 관리자 화면 캡처를 도판으로 쓴다. 캡처를 찍기 전에 **실제로 동작하지 않는 기능이
화면에 남아 있는지** 점검했다. 남아 있으면 논문 도판과 디펜스 시연에 그대로 찍힌다.

`feature/admin-generator` 브랜치에 관련 제거 작업(`72e67ca`·`de26643`)이 있었지만 main에
병합되지 않은 상태였다. 다만 그 브랜치가 지우려던 `AdminYoutubeSources.tsx`(324줄)와 소스 모드
선택 UI는 **이미 main에서 다른 경로로 제거돼 있었다**(2026-07-25·07-30). 남은 잔여만 정리했다.

## 확인된 잔여

| 위치 | 무엇 | 사용자에게 보이나 |
|---|---|---|
| `AuthenticImportPanel.tsx` | 「YouTube 자막」 입력 탭 + `youtube-transcript`(supadata) Edge 호출 | **보였다** |
| `AdminGenerator.tsx:521` | `SourceMode` union의 죽은 `"bank"` 멤버 | 안 보임(선택 UI는 07-25에 제거됨) |

YouTube 탭은 `SUPADATA_API_KEY`가 배포 환경에 없어 실제로 동작하지 않았고, 코드에 그 사실을
안내하는 에러 문구까지 들어 있었다. 원자료 취득은 이미지 추출·문구 입력으로 수행해 왔다.

## 변경

- `AuthenticImportPanel.tsx` — `InputTab`에서 `"youtube"` 제거, `youtubeUrl`·`ytLoading` 상태와
  `fetchCaption()`(Edge 호출) 삭제, 탭 스트립 3칸 → **2칸**, YouTube 입력 패널 삭제.
- `AdminGenerator.tsx` — `SourceMode`를 `"ai" | "manual"`로 축소.

## 의도적으로 남긴 것 — 지우면 기존 데이터가 깨진다

| 남긴 것 | 이유 |
|---|---|
| `coreSchema.ts`의 `authentic_youtube` enum | 이 출처로 저장된 기존 코어의 provenance 검증이 깨진다. 주석에 **읽기 전용·레거시**로 표시 |
| `AdminBrowser.tsx`의 `authentic_youtube: "YouTube 자막"` 라벨 | 기존 행을 표시할 때 필요 |
| `coreProvenance.test.ts`의 관련 회귀 | 레거시 provenance 보존을 계속 고정 |
| `App.tsx`의 `/admin/youtube-sources` → `/admin/generator` 리다이렉트 | 옛 북마크 404 방지. 화면이 아니라 가드다 |
| `types.ts`의 `youtube_sources` 테이블 타입 | Supabase 생성 타입. DB에 테이블이 실제로 있다 |
| `AdminGenerator`의 「HSK 3.0 Source Bank 활용 중」 배지 | **다른 기능이다.** HSK 어휘 소스 뱅크는 실제로 동작 중(`/admin/corpus`) |

## 검증

- `npm run typecheck` 통과.
- 전체 Vitest **262 pass / 7 skip** (변경 전과 동일).
- `npm run build` 통과.
- ESLint: `AdminGenerator.tsx`의 `no-explicit-any` 2건은 **변경 전에도 있던 것**이며 이번 변경과
  무관하다(stash 대조로 확인). 범위 밖이라 손대지 않았다.
- localhost 8096 `/admin/authentic` 실화면에서 탭이 **「이미지에서 추출」·「문구 직접 입력」 2개**
  뿐임을 확인. 콘솔 오류 0건. `/admin/generator`의 HSK 배지는 그대로 있다.

## DB·계약·콘텐츠

변경하지 않았다. Edge 함수 `youtube-transcript`도 삭제하지 않았다(호출부만 없어졌다).

## 논문 반영 필요

- 4.3.1·4.3.2에서 원자료 취득 경로를 **이미지 추출·문구 직접 입력 2종**으로 서술한다.
  YouTube 자막 경로는 "구현했다가 배포 환경 제약으로 제거"로 쓸 수 있으나, 실제 사용 실적이
  없으므로 개발 이력으로만 다룬다. `[확인 필요]` — 4.3 집필 시 화면과 대조.
