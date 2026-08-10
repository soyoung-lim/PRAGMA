import { describe, expect, it } from "vitest";
import {
  hskReferenceHref,
  hskReviewSummary,
  matchesHskReviewFilter,
  parseHskReviewFilter,
} from "./adminReviewHsk";

const content = {
  hsk_lexical_audit: {
    status: "complete",
    reference_ceiling: 5,
    distinct_token_count: 41,
    matched_token_count: 36,
    coverage_ratio: 0.878,
    out_of_reference_candidates: ["候选", "术语"],
  },
};

describe("admin HSK review helpers", () => {
  it("summarizes the stored non-blocking audit", () => {
    expect(hskReviewSummary(content)).toEqual({
      status: "complete",
      referenceCeiling: 5,
      distinctTokenCount: 41,
      matchedTokenCount: 36,
      coverageRatio: 0.878,
      candidates: ["候选", "术语"],
    });
  });

  it("filters candidate, clear, unavailable, and legacy rows separately", () => {
    expect(matchesHskReviewFilter(content, "candidates")).toBe(true);
    expect(matchesHskReviewFilter(content, "clear")).toBe(false);
    expect(matchesHskReviewFilter({
      hsk_lexical_audit: { ...content.hsk_lexical_audit, out_of_reference_candidates: [] },
    }, "clear")).toBe(true);
    expect(matchesHskReviewFilter({
      hsk_lexical_audit: { status: "unavailable" },
    }, "unavailable")).toBe(true);
    expect(matchesHskReviewFilter({}, "missing")).toBe(true);
  });

  it("normalizes URL filters and links back to the matching PRAGMA level", () => {
    expect(parseHskReviewFilter("candidates")).toBe("candidates");
    expect(parseHskReviewFilter("unknown")).toBe("all");
    expect(hskReferenceHref(5)).toBe("/admin/corpus#pragma-intermediate");
    expect(hskReferenceHref(null)).toBe("/admin/corpus");
  });
});
