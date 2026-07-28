import { describe, expect, it } from "vitest";

import {
  buildOpenAIChatRequest,
  CORE_RESPONSE_FORMAT_LABEL,
  CORE_RESPONSE_SCHEMA_NAME,
  CORE_STRUCTURED_RESPONSE_FORMAT,
  OPENAI_JSON_OBJECT_RESPONSE_FORMAT,
  OPENAI_MODEL_ROUTES,
} from "../../../supabase/functions/_shared/openaiRequestContract";

describe("OpenAI request contract", () => {
  it("keeps the current model roles explicit and centralized", () => {
    expect(OPENAI_MODEL_ROUTES).toEqual({
      default: {
        primary: "gpt-4.1-mini",
        fallback: "gpt-4o-mini",
      },
      mission: {
        primary: "gpt-4o",
        fallback: "gpt-4.1-mini",
      },
      critic: {
        primary: "gpt-4.1",
        fallback: "gpt-4.1-mini",
      },
    });
  });

  it("uses JSON mode by default without changing existing non-core actions", () => {
    const request = buildOpenAIChatRequest({
      model: OPENAI_MODEL_ROUTES.default.primary,
      system: "system",
      user: "user",
      temperature: 0.2,
      maxCompletionTokens: 512,
    });

    expect(request.response_format).toBe(OPENAI_JSON_OBJECT_RESPONSE_FORMAT);
    expect(request.max_completion_tokens).toBe(512);
  });

  it("defines a strict, closed schema for core model output", () => {
    expect(CORE_RESPONSE_FORMAT_LABEL).toBe(
      `json_schema:${CORE_RESPONSE_SCHEMA_NAME}`,
    );
    expect(CORE_STRUCTURED_RESPONSE_FORMAT.type).toBe("json_schema");
    expect(CORE_STRUCTURED_RESPONSE_FORMAT.json_schema.strict).toBe(true);

    const schema = CORE_STRUCTURED_RESPONSE_FORMAT.json_schema.schema;
    expect(schema.additionalProperties).toBe(false);
    expect([...schema.required].sort()).toEqual(
      Object.keys(schema.properties).sort(),
    );
    expect(schema.properties.preceding_turn.type).toEqual(["string", "null"]);
  });

  it("places the strict schema in an explicit core request", () => {
    const request = buildOpenAIChatRequest({
      model: OPENAI_MODEL_ROUTES.default.primary,
      system: "system",
      user: "user",
      temperature: 0.7,
      responseFormat: CORE_STRUCTURED_RESPONSE_FORMAT,
    });

    expect(request.response_format).toBe(CORE_STRUCTURED_RESPONSE_FORMAT);
    expect("max_completion_tokens" in request).toBe(false);
  });
});
