import { describe, expect, it } from "vitest";

import {
  groundCriticFinding,
  resolveCriticTarget,
} from "../../../supabase/functions/_shared/criticGrounding";

const mission = {
  mpj_items: [
    {
      target: "请给我改一下。",
      corrections: [{ text: "麻烦您改一下，可以吗？" }],
    },
  ],
};

describe("critic finding grounding", () => {
  it("accepts an exact excerpt at a current path", () => {
    expect(groundCriticFinding(mission, {
      where: "mpj_items[0].corrections[0]",
      evidence_excerpt: "麻烦您改一下",
    })).toEqual({
      ok: true,
      where: "mpj_items[0].corrections[0]",
      evidenceExcerpt: "麻烦您改一下",
    });
  });

  it("rejects stale paths and stale excerpts", () => {
    expect(groundCriticFinding(mission, {
      where: "mpj_items[2].target",
      evidence_excerpt: "旧文本",
    }).ok).toBe(false);
    expect(groundCriticFinding(mission, {
      where: "mpj_items[0].target",
      evidence_excerpt: "旧文本",
    }).ok).toBe(false);
  });

  it("does not traverse prototype paths", () => {
    expect(resolveCriticTarget(mission, "constructor.prototype")).toBeUndefined();
  });
});
