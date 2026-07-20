import type { ContestWithImages } from "../types/contest";
import {
  createTypstCompiler,
  FetchPackageRegistry,
  loadFonts,
  MemoryAccessModel,
} from "@myriaddreamin/typst.ts";
import {
  CompileFormatEnum,
  type IncrementalServer,
  type TypstCompiler,
} from "@myriaddreamin/typst.ts/compiler";
import type { PackageSpec } from "@myriaddreamin/typst.ts/internal.types";
import {
  disableDefaultFontAssets,
  withAccessModel,
  withPackageRegistry,
} from "@myriaddreamin/typst.ts/options.init";

import TypstTemplateLib from "typst-template/lib.typ?raw";

const workerScope = self as unknown as {
  postMessage(message: unknown, transfer: Transferable[]): void;
};

const RequiredPackages = [
  { name: "oxifmt", version: "1.0.0", url: "https://packages.typst.org/preview/oxifmt-1.0.0.tar.gz" },
  { name: "mitex", version: "0.2.6", url: "https://packages.typst.org/preview/mitex-0.2.6.tar.gz" },
  { name: "numbly", version: "0.1.0", url: "https://packages.typst.org/preview/numbly-0.1.0.tar.gz" },
  { name: "cmarker", version: "0.1.6", url: "https://packages.typst.org/preview/cmarker-0.1.6.tar.gz" }
];

let isInitialized = false;
let initPromise: Promise<void> | null = null;
let preloadedPackages: Map<string, ArrayBuffer>;
let typstCompiler: TypstCompiler;
let incrementalServer: IncrementalServer;
let incrementalRevision = 0;
let compilerQueue: Promise<void> = Promise.resolve();

const queueCompilerOperation = <T>(operation: () => Promise<T> | T): Promise<T> => {
  const result = compilerQueue.then(operation, operation);
  compilerQueue = result.then(() => undefined, () => undefined);
  return result;
};

// Images can arrive before compiler initialization, so retain them until the
// virtual filesystem is ready. Once mapped, they stay in WASM across compiles.
let registeredImages = new Map<string, ArrayBuffer>();
let mappedImageIds = new Set<string>();

const typstAccessModel = new MemoryAccessModel();

class PreloadedPackageRegistry extends FetchPackageRegistry {
  constructor(accessModel: MemoryAccessModel) {
    super(accessModel);
  }

  override pullPackageData(path: PackageSpec) {
    const pathStr = this.resolvePath(path);
    const preloaded = preloadedPackages.get(pathStr);
    if (preloaded) {
      return new Uint8Array(preloaded);
    }
    return undefined;
  }
}

const typstPackageRegistry = new PreloadedPackageRegistry(typstAccessModel);

async function downloadPackages(): Promise<Map<string, ArrayBuffer>> {
  const packages = await Promise.all(RequiredPackages.map(async (pkg) => {
    const response = await fetch(pkg.url);
    if (!response.ok) {
      throw new Error(`Failed to download ${pkg.name}: ${response.status}`);
    }
    return [pkg.url, await response.arrayBuffer()] as const;
  }));

  return new Map(packages);
}

// Start package downloads as soon as the worker is constructed. This overlaps
// them with the compiler/font downloads happening on the main thread.
let packageDownloadError: unknown;
const preloadedPackagesPromise = downloadPackages().catch((error) => {
  packageDownloadError = error;
  return new Map<string, ArrayBuffer>();
});

async function startIncrementalSession(compiler: TypstCompiler): Promise<void> {
  let markReady: (() => void) | undefined;
  const ready = new Promise<void>((resolve) => {
    markReady = resolve;
  });

  void compiler.withIncrementalServer(async (server) => {
    incrementalServer = server;
    markReady?.();

    // Keep the callback alive for the lifetime of this worker. typst.ts frees
    // the IncrementalServer as soon as the callback returns.
    await new Promise<void>(() => undefined);
  });

  await ready;
}

function syncImagesToCompiler(): void {
  if (!isInitialized) return;

  for (const uuid of mappedImageIds) {
    if (!registeredImages.has(uuid)) {
      typstCompiler.unmapShadow(`/asset/${uuid}`);
      mappedImageIds.delete(uuid);
    }
  }

  for (const [uuid, buffer] of registeredImages) {
    if (mappedImageIds.has(uuid)) continue;
    typstCompiler.mapShadow(`/asset/${uuid}`, new Uint8Array(buffer));
    mappedImageIds.add(uuid);
  }
}

async function initializeTypst(fontBuffers: ArrayBuffer[], compilerWasm: ArrayBuffer) {
  if (isInitialized) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    preloadedPackages = await preloadedPackagesPromise;
    if (packageDownloadError) throw packageDownloadError;

    typstCompiler = createTypstCompiler();
    await typstCompiler.init({
      getModule: () => compilerWasm,
      beforeBuild: [
        disableDefaultFontAssets(),
        loadFonts(fontBuffers.map(buf => new Uint8Array(buf))),
        withAccessModel(typstAccessModel),
        withPackageRegistry(typstPackageRegistry),
      ],
    });

    typstCompiler.addSource("/lib.typ", TypstTemplateLib);
    await startIncrementalSession(typstCompiler);

    isInitialized = true;
    syncImagesToCompiler();
  })();

  return initPromise;
}

function escapeTypstString(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r');
}

function buildTypstDocument(contest: ContestWithImages, problemKey?: string, userTemplate?: string): string {
  let problems = contest.problems;

  // 如果指定了 problemKey，则只编译该题目
  if (problemKey) {
    problems = problems.filter(p => p.key === problemKey);
  }

  const data = {
    title: contest.meta.title,
    subtitle: contest.meta.subtitle,
    author: contest.meta.author,
    date: contest.meta.date,
    language: contest.meta.language,
    problems: problems.map((p) => ({
      problem: {
        display_name: p.problem.display_name,
        format: p.problem.format || "latex",
        samples: p.problem.samples.map(s => ({ input: s.input, output: s.output })),
        limits: (p.problem.limits || []).map(l => ({ key: l.key, value: l.value })),
      },
      statement: {
        description: p.statement.description,
        input: p.statement.input || null,
        output: p.statement.output || null,
        notes: p.statement.notes || null
      }
    })),
    // 导出单题时禁用标题页和题号列表
    enableTitlepage: problemKey ? false : contest.meta.enable_titlepage,
    enableHeaderFooter: problemKey ? false : contest.meta.enable_header_footer,
    enableProblemList: problemKey ? false : contest.meta.enable_problem_list,
    titlepageLanguage: contest.meta.titlepage_language || "auto",
    problemLanguage: contest.meta.problem_language || "auto"
  };

  const showRule = `#show: contest-conf.with(
  title: "${escapeTypstString(data.title)}",
  subtitle: "${escapeTypstString(data.subtitle)}",
  author: "${escapeTypstString(data.author)}",
  date: "${escapeTypstString(data.date)}",
  language: "${data.language}",
  problems: (${data.problems.map((p) => `(
    problem: (
      display_name: "${escapeTypstString(p.problem.display_name)}",
      format: "${p.problem.format}",
      samples: (${p.problem.samples.map((s) => `(input: "${escapeTypstString(s.input)}", output: "${escapeTypstString(s.output)}")`).join(", ")}${p.problem.samples.length === 1 ? ',' : ''})
      ${p.problem.limits && p.problem.limits.length > 0
        ? `,
      limits: (${p.problem.limits.map((l) => `(key: "${escapeTypstString(l.key)}", value: "${escapeTypstString(l.value)}")`).join(", ")}${p.problem.limits.length === 1 ? ',' : ''})`
        : ""}
    ),
    statement: (
      description: "${escapeTypstString(p.statement.description)}",
      ${p.statement.input ? `input: "${escapeTypstString(p.statement.input)}",` : ""}
      ${p.statement.output ? `output: "${escapeTypstString(p.statement.output)}",` : ""}
      ${p.statement.notes ? `notes: "${escapeTypstString(p.statement.notes)}"` : ""}
    )
  )`).join(", ")}${data.problems.length === 1 ? ',' : ''}),
  enable-titlepage: ${data.enableTitlepage},
  enable-header-footer: ${data.enableHeaderFooter},
  enable-problem-list: ${data.enableProblemList},
  titlepage-language: ${data.titlepageLanguage === "auto" ? "auto" : `"${data.titlepageLanguage}"`},
  problem-language: ${data.problemLanguage === "auto" ? "auto" : `"${data.problemLanguage}"`}
)`;

  if (userTemplate) {
    return userTemplate + "\n\n" + showRule;
  }

  return `#import "/lib.typ": contest-conf
` + showRule;
}

async function compileToPdf(contest: ContestWithImages, problemKey?: string): Promise<Uint8Array> {
  if (!isInitialized) throw new Error("Typst compiler not initialized");

  const doc = buildTypstDocument(contest, problemKey, contest.template);
  typstCompiler.addSource("/main.typ", doc);

  const result = await typstCompiler.compile({
    mainFilePath: "/main.typ",
    format: CompileFormatEnum.pdf,
    diagnostics: "full",
  });
  if (!result.result) throw new Error(formatDiagnostics(result.diagnostics));
  return result.result;
}

type IncrementalVectorUpdate = {
  kind: "new" | "diff";
  revision: number;
  vector: Uint8Array;
};

function formatDiagnostics(diagnostics: unknown[] | undefined): string {
  if (!diagnostics?.length) return "Typst compilation returned no output";

  return diagnostics.map((diagnostic) => {
    if (typeof diagnostic === "string") return diagnostic;
    if (!diagnostic || typeof diagnostic !== "object") return String(diagnostic);
    const item = diagnostic as Record<string, unknown>;
    const location = [item.path, item.range].filter(Boolean).join(":");
    const message = String(item.message || "Typst compilation failed");
    return location ? `${location}: ${message}` : message;
  }).join("\n");
}

async function compileIncrementalVector(contest: ContestWithImages): Promise<IncrementalVectorUpdate> {
  if (!isInitialized) throw new Error("Typst compiler not initialized");

  const doc = buildTypstDocument(contest, undefined, contest.template);
  typstCompiler.addSource("/main.typ", doc);

  const result = await typstCompiler.compile({
    mainFilePath: "/main.typ",
    incrementalServer,
    diagnostics: "full",
  });
  if (!result.result) throw new Error(formatDiagnostics(result.diagnostics));

  const vector = new Uint8Array(result.result);
  const revision = incrementalRevision;
  incrementalRevision += 1;
  return {
    kind: revision === 0 ? "new" : "diff",
    revision,
    vector,
  };
}

// Message handler
self.addEventListener('message', async (event) => {
  const { id, type, data } = event.data;
  if (!id || !type) return;

  try {
    switch (type) {
      case "init":
        await initializeTypst(data.fontBuffers || [], data.compilerWasm);
        self.postMessage({ id, success: true });
        break;

      case "registerImages":
        await queueCompilerOperation(() => {
          registeredImages.clear();
          if (data.images) {
            for (const [uuid, buffer] of Object.entries(data.images)) {
              registeredImages.set(uuid, buffer as ArrayBuffer);
            }
          }
          syncImagesToCompiler();
        });
        self.postMessage({ id, success: true });
        break;

      case "compileTypst":
        {
          const pdf = new Uint8Array(await queueCompilerOperation(
            () => compileToPdf(data as ContestWithImages),
          ));
          workerScope.postMessage(
            { id, success: true, data: pdf },
            [pdf.buffer as ArrayBuffer],
          );
        }
        break;

      case "compileProblem": {
        const { contest, problemKey } = data;
        const pdf = new Uint8Array(await queueCompilerOperation(
          () => compileToPdf(contest, problemKey),
        ));
        workerScope.postMessage(
          { id, success: true, data: pdf },
          [pdf.buffer as ArrayBuffer],
        );
        break;
      }

      case "compilePreview": {
        const update = await queueCompilerOperation(
          () => compileIncrementalVector(data as ContestWithImages),
        );
        workerScope.postMessage(
          { id, success: true, data: update },
          [update.vector.buffer as ArrayBuffer],
        );
        break;
      }

      default:
        self.postMessage({ id, success: false, error: `Unknown type: ${type}` });
    }
  } catch (error) {
    self.postMessage({
      id,
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
});
