import { execFileSync } from "node:child_process";
import { E2E_USER } from "./fixtures";

function userScript(...args: string[]) {
  execFileSync(
    "pnpm",
    ["-s", "tsx", "--env-file-if-exists=.env.local", "scripts/user.ts", ...args],
    {
      env: { ...process.env, TEV_PASSWORD: E2E_USER.password },
      stdio: "pipe",
    },
  );
}

/** Makes sure the E2E account exists with the expected password, using the real CLI. */
export default function globalSetup() {
  try {
    userScript("create", E2E_USER.email, E2E_USER.name);
  } catch {
    userScript("password", E2E_USER.email);
  }
}
