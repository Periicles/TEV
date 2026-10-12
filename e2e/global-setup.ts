import { execFileSync } from "node:child_process";
import { E2E_MEMBER, E2E_USER } from "./fixtures";

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

/** Makes sure the E2E accounts exist with the expected password, using the real CLI. */
export default function globalSetup() {
  for (const account of [E2E_USER, E2E_MEMBER]) {
    try {
      userScript("create", account.email, account.name);
    } catch {
      userScript("password", account.email);
    }
  }
}
