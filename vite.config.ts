import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type UserConfig } from "vite";
import react from "@vitejs/plugin-react";
import { exec } from "node:child_process";

// https://vite.dev/config/
export default defineConfig(async (): Promise<UserConfig> => {
  const gitCommitHash = await new Promise<undefined | string>((resolve) =>
    exec("git rev-parse --short HEAD", (err, stdout) => {
      if (err) resolve(undefined);
      else resolve(stdout.trim());
    }),
  );
  const isDirty = await new Promise<boolean>((resolve) =>
    exec("git diff-index --quiet HEAD", (err) => resolve(Boolean(err))),
  );
  return {
    base: "./",
    plugins: [
      react(),
    ],
    resolve: {
      alias: [
        { find: "@", replacement: resolve("src") },
        { find: "typst-template", replacement: resolve("typst-template") },
      ],
    },
    define: {
      GIT_COMMIT_INFO: JSON.stringify(
        gitCommitHash === undefined
          ? "unknown"
          : gitCommitHash + (isDirty ? "-dirty" : ""),
      ),
    },
    server: {
      port: 4481,
    },
    worker: {
      format: "es",
    },
  };
});