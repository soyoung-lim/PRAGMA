import { readFileSync } from "node:fs";
import { execFileSync, execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputs = [
  "src/lib/pragma/promptSnapshot.generated.ts",
  "src/lib/pragma/packReleaseManifest.generated.ts",
];
const hashOutputs = () => Object.fromEntries(outputs.map((path) => [
  path,
  createHash("sha256").update(readFileSync(resolve(ROOT, path))).digest("hex"),
]));

const generate = () => execFileSync(process.execPath, [resolve(ROOT, "scripts/snapshot-prompts.mjs")], {
  cwd: ROOT,
  stdio: ["ignore", "pipe", "inherit"],
});
generate();
const first = hashOutputs();
generate();
const second = hashOutputs();
for (const path of outputs) {
  if (first[path] !== second[path]) throw new Error(`Snapshot is not deterministic: ${path}`);
}

const manifestSource = readFileSync(resolve(ROOT, outputs[1]), "utf8");
const match = manifestSource.match(/PACK_RELEASE_MANIFEST_DRAFT:[^=]+=[\s\S]*?({[\s\S]*}) as const;\s*$/);
if (!match) throw new Error("Generated pack manifest draft could not be parsed.");
const draft = JSON.parse(match[1]);
const head = execSync("git rev-parse HEAD", { cwd: ROOT, stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
if (draft.source_commit_ref !== head) throw new Error("Generated manifest commit does not match HEAD.");
if (process.env.CI && draft.git_dirty) throw new Error("CI manifest source is dirty.");

console.log(`deterministic snapshots: ${outputs.length} · commit=${head.slice(0, 12)}${draft.git_dirty ? " · source dirty" : " · source clean"}`);

