# 2026-09-05 미사용 라운지·UI 소스 정리

- 분류: 단독 진행 적합. 동작 변화 없는 정리이며, 사용자 요청과 제공된 후보를 최신 main `82c3abee5333079864f039ef5ef006cacc6c5987`에서 재검증했다.
- 삭제: `LoungeHome.tsx` 80줄, `LoungeCorner.tsx` 479줄, `mockLounge.ts` 275줄, `components/ui/alert.tsx` 43줄. 합계 4파일 877줄.
- 근거: tracked 소스 참조 검색에서 구 라운지 두 페이지를 불러오는 실행 경로가 없고 mockLounge는 해당 두 페이지만 참조했다. Alert·AlertTitle·AlertDescription은 해당 파일에서만 선언·사용했다. `alert-dialog`는 별개로 사용 중이므로 유지한다. 동적 경로의 현행 라운지는 App의 LoungeHub·LoungeModulePage다.
- 원 분석과의 차이: 학습자 정본 8.2에 구 라운지 소스를 삭제하지 말라는 보존 문구가 있었다. 사용자 코드 정리 요청에 따라 소스 트리에서 제거하되, 삭제 전 커밋의 세 파일 링크로 이력 확인을 유지한다. 당시 dev-log와 증거 색인은 과거 기록으로 유지한다.
- 보존: 연구 증거에 인용된 cross-vendor-review.mjs·validate-hsk-audit.mjs·capture-architecture.mjs, 설정·타입 선언, 현행 라운지와 의존성 전체.
- 후속 개선: levelPolicy.ts는 import가 없지만 promoteMission.ts의 LEVEL_POLICY와 원격 테스트 fixture의 HSK 포함 문구가 다르다. 이번 정리에서 삭제·정책 통합·프롬프트 변경을 하지 않는다.
- 학습설계·현행 라운지 경로·DB·생성계약 변경 없음. 연구 기록에는 구 소스의 보존 위치만 추가한다.

## 검증

- 전체 727 tests 통과·9 skip(122파일 통과). 기존 LoungeHub·LoungeModulePage·loungeCatalog·production route 회귀를 포함한다.
- typecheck·production build(1,973 modules)·diff check 통과. 삭제한 컴포넌트·mock 이름의 src 참조 0건.
- 운영 번들에 현행 LoungeHub·LoungeModulePage가 유지됨을 확인했다. 기존 CSS minify 경고는 유지한다.
- 유료 API·DB 변경·실학습자 데이터 쓰기는 수행하지 않았다. 운영 배포와 인증 브라우저 종단 확인을 이 로컬 검증으로 주장하지 않는다.
