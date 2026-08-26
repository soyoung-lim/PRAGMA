const DEFAULT_AFTER_LOGIN_PATH = "/learner/course";

/** 외부 URL·프로토콜 상대 URL을 막고 앱 내부 경로만 로그인 복귀 대상으로 허용한다. */
export function safeLoginReturnPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return DEFAULT_AFTER_LOGIN_PATH;
  }

  try {
    const parsed = new URL(value, "https://pragma.local");
    if (parsed.origin !== "https://pragma.local") return DEFAULT_AFTER_LOGIN_PATH;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return DEFAULT_AFTER_LOGIN_PATH;
  }
}

export function loginPathFor(returnPath: string): string {
  return `/student-login?next=${encodeURIComponent(safeLoginReturnPath(returnPath))}`;
}
