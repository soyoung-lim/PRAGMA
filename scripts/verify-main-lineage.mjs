import { spawnSync } from "node:child_process";

const mainRef = process.env.PRAGMA_MAIN_REF || "origin/main";
const commits = process.argv.slice(2);

const fail = (message) => {
  console.error(`[main-lineage] ${message}`);
  process.exitCode = 1;
};

if (commits.length === 0) {
  fail("Provide every required feature commit: npm run release:lineage -- <sha> [sha ...]");
} else {
  const missing = [];
  const invalid = [];

  for (const commit of commits) {
    const exists = spawnSync("git", ["cat-file", "-e", `${commit}^{commit}`], {
      stdio: "ignore",
    });

    if (exists.status !== 0) {
      invalid.push(commit);
      continue;
    }

    const contained = spawnSync("git", ["merge-base", "--is-ancestor", commit, mainRef], {
      stdio: "ignore",
    });

    if (contained.status !== 0) {
      missing.push(commit);
    }
  }

  if (invalid.length > 0) {
    fail(`Unknown commit(s): ${invalid.join(", ")}`);
  } else if (missing.length > 0) {
    fail(`Not contained in ${mainRef}: ${missing.join(", ")}`);
  } else {
    console.log(`[main-lineage] verified ${commits.length} required commit(s) in ${mainRef}`);
  }
}
