/**
 * Manages accounts from the command line (sign-up is disabled in the app).
 *
 *   pnpm user:create <email> <name>
 *   pnpm user:password <email>
 *
 * The password is prompted without echo, or read from TEV_PASSWORD for non-interactive use.
 */
import { createInterface } from "node:readline";
import { Writable } from "node:stream";
import { createUser, setUserPassword } from "@/lib/users";

function promptHidden(question: string): Promise<string> {
  let muted = false;
  const output = new Writable({
    write(chunk, _encoding, callback) {
      if (!muted) process.stdout.write(chunk);
      callback();
    },
  });
  const rl = createInterface({ input: process.stdin, output, terminal: true });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
    muted = true;
  });
}

async function readPassword() {
  if (process.env.TEV_PASSWORD) return process.env.TEV_PASSWORD;
  const password = await promptHidden("Password: ");
  if (password !== (await promptHidden("Confirm password: "))) {
    throw new Error("The passwords do not match.");
  }
  return password;
}

async function main() {
  const [command, email, ...nameParts] = process.argv.slice(2);
  if (command === "create" && email && nameParts.length > 0) {
    const user = await createUser({
      email,
      name: nameParts.join(" "),
      password: await readPassword(),
    });
    console.log(`Created ${user.email}.`);
  } else if (command === "password" && email) {
    const user = await setUserPassword({ email, password: await readPassword() });
    console.log(`Password updated for ${user.email}; all their sessions were signed out.`);
  } else {
    console.error("Usage: pnpm user:create <email> <name> | pnpm user:password <email>");
    process.exitCode = 1;
  }
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => process.exit());
