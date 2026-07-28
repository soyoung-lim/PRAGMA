import { describe, expect, it } from "vitest";
import { diffText } from "./textDiff";

describe("diffText", () => {
  it("keeps identical text as one equal part", () => {
    expect(diffText("可以吗？", "可以吗？")).toEqual([
      { kind: "equal", text: "可以吗？" },
    ]);
  });

  it("preserves both original and revised Chinese text", () => {
    const first = "你改一下。";
    const final = "麻烦你改一下。";
    const parts = diffText(first, final);

    expect(parts.filter((part) => part.kind !== "insert").map((part) => part.text).join("")).toBe(first);
    expect(parts.filter((part) => part.kind !== "delete").map((part) => part.text).join("")).toBe(final);
    expect(parts.some((part) => part.kind === "insert" && part.text.includes("麻烦"))).toBe(true);
  });

  it("preserves spaces and Korean text", () => {
    const first = "자료를 보내 주세요.";
    const final = "혹시 자료를 보내 주실 수 있을까요?";
    const parts = diffText(first, final);

    expect(parts.filter((part) => part.kind !== "insert").map((part) => part.text).join("")).toBe(first);
    expect(parts.filter((part) => part.kind !== "delete").map((part) => part.text).join("")).toBe(final);
    expect(parts.some((part) => part.kind === "insert")).toBe(true);
    expect(parts.some((part) => part.kind === "delete")).toBe(true);
  });

  it("falls back safely for unusually long pasted text", () => {
    const first = "가 ".repeat(250);
    const final = "나 ".repeat(250);

    expect(diffText(first, final)).toEqual([
      { kind: "delete", text: first },
      { kind: "insert", text: final },
    ]);
  });
});
