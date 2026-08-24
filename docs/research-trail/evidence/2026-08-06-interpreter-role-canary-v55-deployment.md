# `_02` 통역 역할 후보 운영 배포 정합성

- 실행일: 2026-08-06
- 승인 범위: Git push, Railway 자동 배포, `generate-scenario` Edge 재배포와 읽기 전용 정합성 검증
- 제외 범위: AI 생성, 콘텐츠 DB 저장, 미션 생성, 상태 승격, Claude/Fable 요청

## Git·Railway

- 배포 기준 HEAD: `e96c5016d9b6c6c383c2b6f5312773781f44f79c`
- push: `origin/main` `4fdaa8c..e96c501`
- Railway environment/service: production / PRAGMA
- 승인 작업의 deployment: `8de5e60f-7daf-4429-a6a7-0fda13df6f98`
- created/status: 2026-08-06 15:01:56 KST / `SUCCESS`, 후속 배포 뒤 `REMOVED`
- commit/image: `e96c5016d9b6c6c383c2b6f5312773781f44f79c` /
  `sha256:bbe79bc5c48bca868292ec751af1fc527693fd97cb9ab731a16f55c47bf981b5`

### 동시 후속 push

- 15:03 KST에 Lovable bot이 `205080d`(`bun.lock` 추가)와
  `5319153`(`src/integrations/supabase/types.ts` 축소)를 연속 push했다.
- 현재 Railway deployment: `01a9cf65-2212-4394-b938-210772a0de96`
- current commit/status: `5319153ddb9c0834737a5760eedcee8ab9cc315f` / `SUCCESS`
- current image digest: `sha256:4c3f5b1ed7fca58fdbe5aeb2bb43f21fab9beecebf2aa86c85b233ef5ebb544c`
- 두 후속 커밋은 아래 Edge 엔트리·공유 자산 7개를 변경하지 않았다.

## Supabase Edge

- function: `generate-scenario`
- function ID: `895a57b2-fe86-4f98-a040-14f1bf1b32f7`
- version/status: v55 / `ACTIVE`
- updated: 2026-08-06 15:02:08 KST
- `verify_jwt`: `true`
- bundle SHA-256: `2c3cc34482e38b37c959ea0933f3037d67874e1d54962af046d7f72dc31d8207`

## 운영 다운로드–HEAD 대조

배포 뒤 CLI API 다운로드로 운영 소스를 다시 받았다. Windows 다운로드가 CRLF로 물질화되므로
LF로 정규화한 뒤 `git show HEAD:<path>`의 canonical bytes와 비교했다. 7개 모두 일치했다.

| source | canonical SHA-256 | result |
|---|---|---|
| `supabase/functions/generate-scenario/index.ts` | `1343BBC77877A789AC7767C6306B8D46CCB1B41206A166791A9020ABC9E4D0D4` | MATCH |
| `supabase/functions/_shared/contentRelease.ts` | `B13CD4FEBD791DF84753ECEA7A398404516B3ECA0EC138EB46F3D005B05B5F1C` | MATCH |
| `supabase/functions/_shared/openaiRequestContract.ts` | `16A231F74B94BF21E277C6D3445B0316728FF67E47F38B0221F62FA54EC80106` | MATCH |
| `supabase/functions/_shared/coreLengthPolicy.ts` | `5D5B96C7AC17F500D1BCB501580E0C22AF62BE872332AB1DCF6A8AF7EE6C781B` | MATCH |
| `supabase/functions/_shared/coreSourceRepair.ts` | `2A5C290CDBBD0FE1547B0A4A9A97677616793DBC809A06D07294F4A967008574` | MATCH |
| `supabase/functions/_shared/feedbackLayerRepair.ts` | `6E1A354BBDB50A84DFC653A9F40B323F176B7A37A4CB06997C21DC17A0965AEA` | MATCH |
| `supabase/functions/_shared/feedbackRequestLimits.ts` | `B05F95052E6908BF932AC80757C675C6A6B8B183231597701AC0A14E2FDE3EA3` | MATCH |

## 판정

- 승인된 Railway 배포와 Edge v55는 `e96c501`에서 일치했다. 현재 Railway HEAD는 후속
  `5319153`지만 Edge 관련 7개 파일은 `e96c501`과 동일하므로 생성 표면 정합성은 유지된다.
- Lovable이 축소한 Supabase 타입 파일의 타당성은 이 배포 증거와 별도 검증 대상으로 남긴다.
- Edge에서 동작하는 후보 ID는 `pragma_content_candidate_20260806_02`, repair prompt version은
  `core_v10_interpreter_role_contract_v1_repair_v2`다.
- 이번 배포만으로 모델 출력 개선을 주장하지 않는다. 다음 증거는 별도 승인된 DB 미저장
  통역 core-only 18건 재카나리와 독립 사람 판정에서 만들어야 한다.
