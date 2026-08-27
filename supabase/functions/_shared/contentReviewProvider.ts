import {
  buildReviewPrompt, CONTENT_REVIEW_VERSION, reviewHash, validateAdjudication, validateReviewResult,
  type Adjudication, type ContentReviewRun, type ModelReview, type ReviewResult,
} from "./contentReview.ts";

export async function callContentReviewer(options: {
  stage: "openai" | "claude" | "adjudication"; run: ContentReviewRun;
  apiKey: string; model: string; fetcher?: typeof fetch;
}): Promise<ModelReview<ReviewResult | Adjudication>> {
  const { stage, run, apiKey, model, fetcher = fetch } = options;
  const prompt = buildReviewPrompt(stage, run.snapshot, run);
  const anthropic = stage === "claude";
  const request = anthropic ? {
    model, max_tokens: 7000, system: prompt.system,
    messages: [{ role: "user", content: prompt.user }],
    output_config: { format: { type: "json_schema", schema: prompt.schema } },
  } : {
    model, temperature: 0, max_tokens: 7000,
    messages: [{ role: "system", content: prompt.system }, { role: "user", content: prompt.user }],
    response_format: { type: "json_schema", json_schema: { name: stage === "adjudication" ? "pragma_adjudication" : "pragma_content_review", strict: true, schema: prompt.schema } },
  };
  const response = await fetcher(anthropic ? "https://api.anthropic.com/v1/messages" : "https://api.openai.com/v1/chat/completions", {
    method: "POST", signal: AbortSignal.timeout(90_000),
    headers: anthropic ? { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" }
      : { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(request),
  });
  // Do not return/log provider bodies containing prompts or credentials.
  if (!response.ok) throw new Error(`${anthropic ? "Claude" : "OpenAI"} API 오류 (${response.status}). 자동 재호출하지 않았습니다.`);
  const body = await response.json();
  const completed = anthropic ? body.stop_reason === "end_turn" && !body.content?.some((block: any) => block.type === "refusal")
    : body.choices?.[0]?.finish_reason === "stop" && !body.choices[0].message?.refusal;
  if (!completed) throw new Error("모델 응답이 거절되었거나 잘렸습니다. 성공한 검수로 저장하지 않습니다.");
  const text = anthropic ? body.content.filter((block: any) => block.type === "text").map((block: any) => block.text).join("")
    : body.choices[0].message.content;
  if (typeof body.id !== "string" || typeof body.model !== "string") throw new Error("모델 호출 근거 메타데이터가 누락됐습니다.");
  const raw = JSON.parse(text);
  const result = stage === "adjudication" ? validateAdjudication(raw, run.claude_review!.result, run.snapshot)
    : validateReviewResult(raw, run.snapshot, stage);
  return { result, provider: anthropic ? "anthropic" : "openai", model: body.model, requested_model: model,
    response_id: body.id, usage: body.usage ?? {}, checked_at: new Date().toISOString(),
    prompt_version: `${CONTENT_REVIEW_VERSION}:${stage}`, input_hash: await reviewHash({ system: prompt.system, user: prompt.user }),
  };
}
