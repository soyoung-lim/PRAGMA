import { build } from "esbuild";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
const output = "supabase/functions/content-review/domain.generated.mjs";
const result = await build({ entryPoints: ["src/lib/pragma/contentReviewDomain.ts"], bundle: true,
  platform: "neutral", format: "esm", target: "es2022", minify: true, write: false,
  alias: { "@": resolve("src") }, metafile: true,
  banner: { js: "// Generated from app rules and materials. Run node scripts/build-content-review-domain.mjs; do not edit." },
});
if (Object.keys(result.metafile.inputs).some((path) => path.includes("integrations/supabase/client") || path.includes("node_modules/@supabase"))) {
  throw new Error("Browser/database dependencies must not enter the review domain bundle.");
}
const text = result.outputFiles[0].text;
if (process.argv.includes("--check")) {
  if ((await readFile(output, "utf8")).replace(/\r\n/g, "\n") !== text.replace(/\r\n/g, "\n")) throw new Error("Review domain bundle is stale. Rebuild before deploying Edge.");
} else await writeFile(output, text);
console.log(`Content review domain ${process.argv.includes("--check") ? "verified" : "built"} (${text.length} chars).`);
