# Git 기여 귀속 선택적 계정 연결 해제 기록

- 기록일: 2026-08-24
- 대상: PRAGMA Git history
- 처리 성격: GitHub 계정 연결형 표시와 raw Git provenance의 선택적 분리

## 원본과 귀속 분포

검증된 원본 archive bundle
`PRAGMA_reconstructed_original_all_heads_2026-08-24.bundle`에서 다시 시작했다.
이 bundle의 SHA-256은
`4BB33217AA2084D3DE1AE3EA06FEF6FD80A4D1B3C0E0852E30DEDBAECD10271C`이다.

원본 `main` 1,491개 commit의 Author 분포는 다음과 같다.

| Author | commit 수 |
|---|---:|
| 임소영 계정 연결 이메일을 사용한 Author | 540 |
| `gpt-engineer-app[bot]` | 951 |

`gpt-engineer-app[bot]`의 원본 Author 이메일은 GitHub에서 과거 Lovable
계정과 연결되어 Contributor로 표시되었다.

## 적용한 변경과 보존한 정보

원본에서 Author 이름이 `gpt-engineer-app[bot]`이고 Author 이메일이 정확히
`159125892+gpt-engineer-app[bot]@users.noreply.github.com`인 commit 951개만
선택했다. 이 951개의 **Author email만** 프로젝트 전용 비연결 주소
`159125892+gpt-engineer-app[bot]@users.noreply.github.invalid`로 변경했다.

다음 정보는 보존했다.

- Author 이름과 날짜·시각·시간대
- commit message
- tree와 실제 파일 내용
- Committer 이름·이메일·날짜·시각·시간대
- parent 수·순서와 merge graph
- Claude `Co-Authored-By` trailer: `main` 235개, 전체 보존 refs 합집합 242개

이는 Lovable의 개발 흔적을 삭제하거나 해당 commit을 임소영에게 재귀속한
것이 아니다. 개별 commit의 `gpt-engineer-app[bot]` Author 이름·시각·메시지와
코드 변경을 보존하면서 GitHub 계정 링크만 분리한 선택적 account de-linking이다.

## 서명과 tag

원본에는 GitHub `web-flow`가 GPG 서명한 merge commit 21개가 있었다. history
rewrite로 commit payload와 SHA가 바뀌어 원래 signature를 새 commit의 유효한
signature로 유지할 수 없으므로 해당 21개의 signature header를 제거했다. 원본
서명은 GitHub 공식 `web-flow` 키 지문
`968479A1AFF927E37D1A566BB5690EEEBB952194`로 21/21 검증했다.

- signed annotated tag: 0개
- archival history: branch 8개와 annotated tag 1개 보존
- 현재 public GitHub 계획: branch 8개, tag 0개 유지

archive의 annotated tag는 원본 보존용이며 public GitHub에 새로 push하지 않는다.

## SHA mapping과 추적 가능성

Author 메타데이터와 parent SHA가 바뀌면 commit SHA도 연쇄적으로 바뀐다. 따라서
SHA 자체를 보존한 것이 아니라 **old SHA → final SHA mapping을 통해 traceability를
보존했다.** 기존 문서와 생성 추적 메타데이터의 SHA 참조는 58개 파일에서
491건을 대응하는 final SHA로 바꿨다.

전체 mapping은 용량과 감사 산출물의 세대 관리를 고려해 공개 repository에는
넣지 않고, 원본·bundle과 함께 별도 offline audit archive에 보존한다. 이
repository에는 파일명과 검증 hash를 기록한다.

| audit artifact | 범위 | SHA-256 |
|---|---|---|
| `PRAGMA_selective_delink_final_mapping_manifest_2026-08-24.csv` | source generation, original/final full SHA·tree, 변경 사유, signature 제거 여부를 포함한 1,521행 전체 mapping | `4EE214F435C661C47648D5B59D7F7726AAF0EA399A9F5DE96FE33E277204C9DF` |
| `PRAGMA_history_mapping_archive_index_2026-08-24.csv` | original → no-Claude → single-contributor → selective-final 세대별 mapping 파일 4종의 위치·행 수·hash | `FC16AF10CA7655B8DC8C54E73DEA4875A2313A1A6BAAE4ECB464755FAE64DFD6` |
| `PRAGMA_selective_delink_signature_audit_2026-08-24.csv` | GitHub `web-flow` 서명 21개 검증과 제거 대응 | `997BD31675928B9AC322C610A66AB81BF72B442E24506D6BD8E57F0A38B23C8D` |
| `PRAGMA_selective_delink_strict_audit_2026-08-24.json` | 기존 rewritten history 1,521개 전수검증 | `50F9DCE28AC0BB23516DB9B08142C0C901A31CC55940CBF55B13A86EE17936C1` |
| `PRAGMA_selective_delink_remap_only_audit_2026-08-24.json` | 58개 파일·491건 SHA 치환의 byte-level 검증 | `264FD248F582B219EC68CFC536730E8CF03DB7B0CEF35A3027D0D01BF3899E69` |

이 문서를 추가하는 provenance commit은 원본 counterpart가 없는 신규 commit이므로
1,521행 old→new mapping과 분리해 final bundle 감사 보고서에 별도 기록한다.

## 해석 범위

GitHub의 Contributors·Contributions 숫자는 계정에 연결된 Git 메타데이터를
집계한 서비스 UI다. 학술 저자 순위나 연구 기여도 순위를 의미하지 않는다.
연구 설계·검수·승인·최종 책임과 AI 도구가 수행한 기술적 실행 기록은 이 구분에
따라 각각 설명한다.
