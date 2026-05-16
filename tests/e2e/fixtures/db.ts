import { execSync } from "node:child_process";

/**
 * Re-run the seed script synchronously to wipe and recreate fixture data.
 * Use sparingly — this is slow (~2-3s) and assumes the test runner is invoked
 * from the project root so `npm run db:seed` resolves correctly.
 */
export function resetDb(): void {
  try {
    execSync("npm run db:seed", {
      stdio: "pipe",
      cwd: process.cwd(),
      encoding: "utf8",
      env: process.env,
    });
  } catch (e: unknown) {
    const err = e as { stderr?: Buffer | string; stdout?: Buffer | string; message?: string };
    const stderr = err.stderr?.toString() ?? "";
    const stdout = err.stdout?.toString() ?? "";
    throw new Error(
      `db:seed failed: ${err.message ?? "unknown error"}\n` +
        `STDOUT:\n${stdout}\nSTDERR:\n${stderr}`,
    );
  }
}
