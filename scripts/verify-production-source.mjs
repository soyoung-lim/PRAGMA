import path from "node:path";
import { fileURLToPath } from "node:url";

const EXPECTED_BRANCH = "main";
const EXPECTED_REPOSITORY = {
  owner: "sylim-research",
  name: "PRAGMA",
};

const normalized = (value) => String(value ?? "").trim().toLowerCase();

export const verifyProductionSource = (env = process.env) => {
  const isRailway = Boolean(
    env.RAILWAY_PROJECT_ID ||
    env.RAILWAY_ENVIRONMENT_ID ||
    env.RAILWAY_DEPLOYMENT_ID,
  );
  const environmentName = normalized(env.RAILWAY_ENVIRONMENT_NAME);

  if (!isRailway || environmentName !== "production") {
    return { enforced: false };
  }

  const commitSha = String(env.RAILWAY_GIT_COMMIT_SHA ?? "").trim();
  const branch = normalized(env.RAILWAY_GIT_BRANCH);
  const owner = normalized(env.RAILWAY_GIT_REPO_OWNER);
  const repository = normalized(env.RAILWAY_GIT_REPO_NAME);

  if (!commitSha) {
    throw new Error(
      "Production deploy rejected: GitHub commit metadata is missing. " +
      "Deploy PRAGMA production from the GitHub main branch; direct Railway CLI uploads are not allowed.",
    );
  }

  if (branch !== EXPECTED_BRANCH) {
    throw new Error(
      `Production deploy rejected: expected branch ${EXPECTED_BRANCH}, received ${branch || "(missing)"}.`,
    );
  }

  if (
    owner !== normalized(EXPECTED_REPOSITORY.owner) ||
    repository !== normalized(EXPECTED_REPOSITORY.name)
  ) {
    throw new Error(
      "Production deploy rejected: expected GitHub source " +
      `${EXPECTED_REPOSITORY.owner}/${EXPECTED_REPOSITORY.name}.`,
    );
  }

  return {
    enforced: true,
    branch: EXPECTED_BRANCH,
    commitSha,
    repository: `${EXPECTED_REPOSITORY.owner}/${EXPECTED_REPOSITORY.name}`,
  };
};

const isDirectInvocation =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectInvocation) {
  try {
    const result = verifyProductionSource();
    if (result.enforced) {
      console.log(
        `[production-source] verified ${result.repository}@${result.commitSha} (${result.branch})`,
      );
    }
  } catch (error) {
    console.error(`[production-source] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
