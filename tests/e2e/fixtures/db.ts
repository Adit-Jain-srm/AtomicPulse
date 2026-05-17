import { execSync } from "node:child_process";

/**
 * Re-run the seed script synchronously to wipe and recreate fixture data.
 * Retries once on failure (handles SQLite lock contention in single-worker mode).
 */
export function resetDb(): void {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      execSync("npm run db:seed", {
        stdio: "pipe",
        cwd: process.cwd(),
        encoding: "utf8",
        env: { ...process.env, FORCE_COLOR: "0" },
        timeout: 30_000,
      });
      return;
    } catch (e: unknown) {
      if (attempt === 0) {
        // Wait briefly for any DB lock to clear, then retry
        execSync("node -e \"setTimeout(()=>{},500)\"", { stdio: "pipe" });
        continue;
      }
      const err = e as { stderr?: Buffer | string; stdout?: Buffer | string; message?: string };
      const stderr = err.stderr?.toString() ?? "";
      const stdout = err.stdout?.toString() ?? "";
      throw new Error(
        `db:seed failed: ${err.message ?? "unknown error"}\n` +
          `STDOUT:\n${stdout}\nSTDERR:\n${stderr}`,
      );
    }
  }
}
