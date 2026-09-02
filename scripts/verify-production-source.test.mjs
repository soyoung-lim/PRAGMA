import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { verifyProductionSource } from "./verify-production-source.mjs";

const railwayProduction = {
  RAILWAY_PROJECT_ID: "project-id",
  RAILWAY_ENVIRONMENT_ID: "environment-id",
  RAILWAY_ENVIRONMENT_NAME: "production",
};

describe("verifyProductionSource", () => {
  it("does not constrain local or non-production builds", () => {
    assert.deepEqual(verifyProductionSource({}), { enforced: false });
    assert.deepEqual(
      verifyProductionSource({
        RAILWAY_PROJECT_ID: "project-id",
        RAILWAY_ENVIRONMENT_NAME: "preview",
      }),
      { enforced: false },
    );
  });

  it("rejects a direct CLI upload to Railway production", () => {
    assert.throws(
      () => verifyProductionSource(railwayProduction),
      /GitHub commit metadata is missing/,
    );
  });

  it("rejects a production deployment from a feature branch", () => {
    assert.throws(
      () => verifyProductionSource({
        ...railwayProduction,
        RAILWAY_GIT_COMMIT_SHA: "abc123",
        RAILWAY_GIT_BRANCH: "codex/feature",
        RAILWAY_GIT_REPO_OWNER: "sylim-research",
        RAILWAY_GIT_REPO_NAME: "PRAGMA",
      }),
      /expected branch main/,
    );
  });

  it("rejects an unexpected GitHub repository", () => {
    assert.throws(
      () => verifyProductionSource({
        ...railwayProduction,
        RAILWAY_GIT_COMMIT_SHA: "abc123",
        RAILWAY_GIT_BRANCH: "main",
        RAILWAY_GIT_REPO_OWNER: "someone-else",
        RAILWAY_GIT_REPO_NAME: "PRAGMA",
      }),
      /expected GitHub source sylim-research\/PRAGMA/,
    );
  });

  it("accepts a GitHub-triggered main deployment", () => {
    assert.deepEqual(
      verifyProductionSource({
        ...railwayProduction,
        RAILWAY_GIT_COMMIT_SHA: "abc123",
        RAILWAY_GIT_BRANCH: "main",
        RAILWAY_GIT_REPO_OWNER: "sylim-research",
        RAILWAY_GIT_REPO_NAME: "PRAGMA",
      }),
      {
        enforced: true,
        branch: "main",
        commitSha: "abc123",
        repository: "sylim-research/PRAGMA",
      },
    );
  });
});
