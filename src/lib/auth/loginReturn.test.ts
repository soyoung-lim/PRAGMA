import { describe, expect, it } from "vitest";
import { loginPathFor, safeLoginReturnPath } from "./loginReturn";

describe("login return path", () => {
  it("preserves an internal demo route", () => {
    expect(safeLoginReturnPath("/demo/mission?step=intro#top")).toBe(
      "/demo/mission?step=intro#top",
    );
    expect(loginPathFor("/demo/mission")).toBe(
      "/student-login?next=%2Fdemo%2Fmission",
    );
  });

  it.each([null, "", "https://evil.example/demo", "//evil.example/demo"])(
    "rejects a non-local return target: %s",
    (value) => {
      expect(safeLoginReturnPath(value)).toBe("/learner/course");
    },
  );
});
