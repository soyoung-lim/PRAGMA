# 2026-08-04 콘텐츠 카나리 증거

이 폴더는 후보 `_01`~`_04`의 DB 무저장 카나리 결과 중 dev-log와 evidence index에서
연구 근거로 채택한 JSON을 보존한다. 실행 시 임시 출력 위치는 `.tmp/content-canary`였지만,
그 위치는 Git에서 제외되고 일반 캐시 청소로 삭제될 수 있어 채택된 결과를 이곳으로 승격했다.

- 승격일: 2026-08-04 KST
- 원본과 보존본을 SHA-256으로 대조한 뒤 임시 원본을 제거했다.
- 폴더 내부 `.gitattributes`에서 JSON의 줄바꿈 변환을 막아 checkout 뒤에도 원본 바이트를 보존한다.
- 여섯 JSON에서 credential·authorization·password 계열 문자열은 검출되지 않았다.
- 이후 카나리도 실행 중에는 `.tmp`를 사용할 수 있으나, 연구 기록에서 인용하기 전에
  추적 가능한 증거 폴더로 복사하고 해시를 기록한다.

| 파일 | 바이트 | SHA-256 |
|---|---:|---|
| `pragma_content_candidate_20260804_01.json` | 87,090 | `AE1A52F5AD165F83DF1961B65C07137B39ADB3D6257447B216ECA91FA8DE04E6` |
| `pragma_content_candidate_20260804_02.json` | 32,663 | `FD5B96DCB9B99C43C0F389DDB006C5C75C23346D8BD260AD88E3ED5A61A3A0C3` |
| `pragma_content_candidate_20260804_02.mission-replay.json` | 89,221 | `8066EE61898266D052D8E32EDA4B47EA319F581902F1AA9A033FA927EB08E94F` |
| `pragma_content_candidate_20260804_03.core-only.json` | 23,103 | `B22CE72A9DD7A3DB9F389C099C83C64F035E3D6BCF6D0E01C8FD69775796D8AD` |
| `pragma_content_candidate_20260804_03.core-only.thanks-zh_ko-stt_interpreting.json` | 4,195 | `A15CC8E5880192FF54291EFD910F84E19990EF4584EC3CD6E8879E38F92B3610` |
| `pragma_content_candidate_20260804_04.core-only.thanks-zh_ko-stt_interpreting.json` | 4,338 | `F97C07BAE2D0D8728B99E17E5790C3902CE2A82241E254945E2A83E5A0004D78` |
