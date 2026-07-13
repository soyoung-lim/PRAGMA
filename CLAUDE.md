# L2 Pragmatic Translator

## 프로젝트 작업 원칙

### 작업 원칙

* 프론트와 Edge Function은 하나의 기능 단위로 보고 함께 수정할 수 있다.
* UI, 프론트 로직, Edge Function 코드, 타입, 테스트, 일반 버그 수정은 사전 승인 없이 진행한다.
* 수정 후 `typecheck`, `test`, `build`를 실행하고 `git diff` 요약을 보고한다.
* DB schema, migration, RLS, Auth, production 배포, 데이터 삭제 또는 대량 수정은 반드시 사전 승인을 받는다.
* Edge Function 코드 편집은 사전 승인 없이 가능하지만, `supabase functions deploy` 등 실제 배포는 production 배포에 해당하므로 반드시 사전 승인을 받는다.
* 요청과 무관한 리팩터링은 하지 않는다.
* 작업 범위가 예상보다 커지거나 위험 변경이 필요해지는 순간 멈추고 보고한다.
* 버그를 코드 수준에서 해결할 수 없고 DB schema 또는 RLS 변경이 필요하다고 확인되는 순간 수정하지 말고 보고한다.

### Git 운영

* 로컬 commit은 조건부로 자율 진행할 수 있다.
* 하나의 명확한 작업 단위가 완료되고 `typecheck`, `test`, `build`가 모두 통과한 경우에만 관련 변경을 묶어 commit한다.
* commit 전 변경 파일과 diff 범위가 사용자 요청과 일치하는지 확인한다.
* commit 메시지는 conventional commit 스타일을 사용한다.
* 여러 기능이나 관련 없는 변경을 하나의 commit에 섞지 않는다.
* push, merge, PR 생성은 반드시 사전 승인을 받는다.
* 검증이 실패하면 commit하지 않고 결과를 보고한다.
* 사용자가 "커밋하지 말라"고 지정하면 commit 없이 diff만 보고한다.
