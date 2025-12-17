import { resolve } from "node:path";
import { defineConfig, type UserConfig, type PluginOption } from "vite";
import react from "@vitejs/plugin-react";
import { exec } from "node:child_process";

export default defineConfig(async (): Promise<UserConfig> => {
  const TypstFontUrlEntriesPlugin = (): PluginOption => {
    const name = "typst-font-url-entries-plugin";
    const virtualModuleId = "virtual:typst-font-url-entries";
    const resolvedVirtualModuleId = "\0" + virtualModuleId;
    let pluginLoadResult: string | undefined = undefined;

    return {
      name,
      resolveId(id) {
        if (id === virtualModuleId) {
          return resolvedVirtualModuleId;
        }
      },
      async load(id) {
        if (id !== resolvedVirtualModuleId) return;

        if (!pluginLoadResult) {
          const fs = await import("node:fs/promises");
          const files = await fs.readdir("assets/fonts");

          const fontAssetsUrls = await Promise.all(
            files
              .filter((file) =>
                [".woff2", ".woff", ".ttf", ".otf"].some((ext) =>
                  file.endsWith(ext),
                ),
              )
              .map(async (file) => {
                const fontkit = await import("fontkit");
                const fontBuffer = await fs.readFile("assets/fonts/" + file);
                const fontInfo = fontkit.create(fontBuffer);

                if (!("postscriptName" in fontInfo))
                  throw new Error(
                    `Font file ${file} does not have a PostScript name.`,
                  );

                return [fontInfo.postscriptName, `assets/fonts/${file}`];
              }),
          );

          pluginLoadResult =
            fontAssetsUrls
              .map(
                ([, url], index) => `import font${index}Url from "${url}?url";\n`,
              )
              .join("") +
            "\n" +
            "const fontUrlEntries = [\n" +
            fontAssetsUrls
              .map(([name], index) => `  ["${name}", font${index}Url],\n`)
              .join("") +
            "];\n" +
            "\n" +
            "export default fontUrlEntries;\n";
        }
        return pluginLoadResult;
      },
    };
  };

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
    base: "/",
    plugins: [react(), TypstFontUrlEntriesPlugin()],
    resolve: {
      alias: [
        { find: "@", replacement: resolve("src") },
        { find: "typst-template", replacement: resolve("typst-template") },
        { find: "assets", replacement: resolve("assets") },
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
      port: 4482,
      headers: {
        "Cross-Origin-Embedder-Policy": "require-corp",
        "Cross-Origin-Opener-Policy": "same-origin",
      },
    },
    worker: {
      format: "es",
    },
    optimizeDeps: {
      exclude: [
        "@myriaddreamin/typst.ts",
        "@myriaddreamin/typst-ts-web-compiler",
        "@myriaddreamin/typst-ts-renderer",
      ],
    },
  };
});
