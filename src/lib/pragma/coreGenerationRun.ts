/**
 * 단일 생성 화면의 한 번의 "선택 개요 → 코어 생성" 실행을 식별한다.
 *
 * 같은 조건을 다시 생성하는 것은 이전 실행의 재개가 아니라 새 실행이다. 입력 조건을
 * 해시하면 서로 다른 클릭이 같은 generation_run_id를 공유해 DB 멱등키와 충돌하므로,
 * 매 실행마다 UUID를 발급한다. 테스트에서는 UUID 공급자를 주입할 수 있다.
 */
export function createCoreGenerationRunId(
  randomUuid: () => string = () => crypto.randomUUID(),
): string {
  return `gen-${randomUuid()}`;
}
