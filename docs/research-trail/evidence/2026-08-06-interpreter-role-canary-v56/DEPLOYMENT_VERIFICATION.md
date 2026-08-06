# v56 `_03` 통역 역할 Edge 배포 정합성

- 확인일: 2026-08-06
- 대상: Supabase Edge `generate-scenario`
- release: `pragma_content_candidate_20260806_03`
- 로컬 기준: `main@812c099`, clean, `origin/main`보다 5커밋 앞섬
- GitHub 원격 `main`: `5a2c5d5d7088abfa0146378bb34495704e6b5206`
- Railway production: `5a2c5d5`, deployment `01a9cf65-2212-4394-b938-210772a0de96`,
  `SUCCESS`·`RUNNING` — 이번 작업에서 배포하지 않음

## Edge 배포

- 사용자 승인 뒤 `generate-scenario`만 `--use-api`로 배포했다.
- 2026-08-06 16:07:25 KST 기준 version `56`, `ACTIVE`, `verify_jwt=true`다.
- Supabase bundle SHA-256:
  `6ed9f8055907d3daa6e5c01281a276cc9461730aecf88e82a709f12f19817f3c`
- 업로드 자산은 엔트리 1개와 `_shared` 6개다. DB migration, Railway 배포, Git push는 없다.

## 배포 소스 재다운로드 대조

배포 뒤 CLI API로 v56 소스를 별도 임시 폴더에 다시 내려받고, CRLF/LF를 LF로 정규화한
SHA-256을 로컬과 비교했다.

| 파일 | SHA-256 | 결과 |
|---|---|---|
| `generate-scenario/index.ts` | `3FEE8AEA29B4DAE7FAF55F43A90258F4C0AF862767AF874B2F681246974ACDFB` | MATCH |
| `_shared/contentRelease.ts` | `66EBC47D2D6E3AC9DA3619201387EF729ED80BD240C81EC60D112A5FEBEC8BBB` | MATCH |
| `_shared/openaiRequestContract.ts` | `16A231F74B94BF21E277C6D3445B0316728FF67E47F38B0221F62FA54EC80106` | MATCH |
| `_shared/coreLengthPolicy.ts` | `5D5B96C7AC17F500D1BCB501580E0C22AF62BE872332AB1DCF6A8AF7EE6C781B` | MATCH |
| `_shared/coreSourceRepair.ts` | `0C6D8B7013488EEF04A71F54A86D03B75BFE3D6DB05E5D3617EF024F3B727B82` | MATCH |
| `_shared/feedbackLayerRepair.ts` | `6E1A354BBDB50A84DFC653A9F40B323F176B7A37A4CB06997C21DC17A0965AEA` | MATCH |
| `_shared/feedbackRequestLimits.ts` | `B05F95052E6908BF932AC80757C675C6A6B8B183231597701AC0A14E2FDE3EA3` | MATCH |

결론: 운영 v56과 로컬 `_03` 배포 대상은 7/7 일치한다.
