import type { ContestWithImages } from "../types/contest";
import {
  $typst,
  createTypstCompiler,
  createTypstRenderer,
  FetchPackageRegistry,
  loadFonts,
  MemoryAccessModel,
} from "@myriaddreamin/typst.ts";
import type { PackageSpec } from "@myriaddreamin/typst.ts/internal.types";
import {
  disableDefaultFontAssets,
  withAccessModel,
  withPackageRegistry,
} from "@myriaddreamin/typst.ts/options.init";

import TypstTemplateLib from "typst-template/lib.typ?raw";
import TypstCompilerWasmUrl from "@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm?url";
import TypstRendererWasmUrl from "@myriaddreamin/typst-ts-renderer/pkg/typst_ts_renderer_bg.wasm?url";

const RequiredPackages = [
  { name: "oxifmt", version: "1.0.0", url: "https://packages.typst.org/preview/oxifmt-1.0.0.tar.gz" },
  { name: "mitex", version: "0.2.6", url: "https://packages.typst.org/preview/mitex-0.2.6.tar.gz" },
  { name: "numbly", version: "0.1.0", url: "https://packages.typst.org/preview/numbly-0.1.0.tar.gz" },
  { name: "cmarker", version: "0.1.6", url: "https://packages.typst.org/preview/cmarker-0.1.6.tar.gz" }
];

let isInitialized = false;
let initPromise: Promise<void> | null = null;
let preloadedPackages: Map<string, ArrayBuffer>;

// Store registered images (uuid -> ArrayBuffer)
let registeredImages: Map<string, ArrayBuffer> = new Map();

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
  const packages = new Map<string, ArrayBuffer>();

  for (const pkg of RequiredPackages) {
    const response = await fetch(pkg.url);
    if (!response.ok) {
      throw new Error(`Failed to download ${pkg.name}: ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    packages.set(pkg.url, arrayBuffer);
  }

  return packages;
}

async function initializeTypst(fontBuffers: ArrayBuffer[]) {
  if (isInitialized) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    preloadedPackages = await downloadPackages();

    const [compilerWasm, rendererWasm] = await Promise.all([
      fetch(TypstCompilerWasmUrl).then(r => r.arrayBuffer()),
      fetch(TypstRendererWasmUrl).then(r => r.arrayBuffer())
    ]);

    const typstCompiler = createTypstCompiler();
    const typstRenderer = createTypstRenderer();

    await Promise.all([
      typstCompiler.init({
        getModule: () => compilerWasm,
        beforeBuild: [
          disableDefaultFontAssets(),
          loadFonts(fontBuffers.map(buf => new Uint8Array(buf))),
          withAccessModel(typstAccessModel),
          withPackageRegistry(typstPackageRegistry),
        ],
      }),
      typstRenderer.init({
        getModule: () => rendererWasm,
      }),
    ]);

    $typst.setCompiler(typstCompiler);
    $typst.setRenderer(typstRenderer);
    $typst.addSource("/lib.typ", TypstTemplateLib);

    isInitialized = true;
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

// Add images to virtual filesystem using mapShadow
async function addImagesToFilesystem(contest: ContestWithImages): Promise<void> {
  for (const img of contest.images) {
    const buffer = registeredImages.get(img.uuid);
    if (buffer) {
      // Add image to virtual filesystem at /asset/{uuid}
      // Using mapShadow to map the path to binary content
      $typst.mapShadow(`/asset/${img.uuid}`, new Uint8Array(buffer));
    }
  }
}

function buildTypstDocument(contest: ContestWithImages): string {
  const data = {
    title: contest.meta.title,
    subtitle: contest.meta.subtitle,
    author: contest.meta.author,
    date: contest.meta.date,
    language: contest.meta.language,
    problems: contest.problems.map((p) => ({
      problem: {
        display_name: p.problem.display_name,
        format: p.problem.format || "latex",
        samples: p.problem.samples.map(s => ({ input: s.input, output: s.output }))
      },
      statement: {
        description: p.statement.description,
        input: p.statement.input || null,
        output: p.statement.output || null,
        notes: p.statement.notes || null
      }
    })),
    enableTitlepage: contest.meta.enable_titlepage,
    enableHeaderFooter: contest.meta.enable_header_footer,
    enableProblemList: contest.meta.enable_problem_list
  };

  return `#import "/lib.typ": contest-conf

#show: contest-conf.with(
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
  enable-problem-list: ${data.enableProblemList}
)`;
}

async function compileToPdf(contest: ContestWithImages): Promise<Uint8Array> {
  if (!isInitialized) throw new Error("Typst compiler not initialized");

  // Add images to virtual filesystem
  await addImagesToFilesystem(contest);

  const doc = buildTypstDocument(contest);
  $typst.addSource("/main.typ", doc);

  const pdf = await $typst.pdf({ mainFilePath: "/main.typ" });
  if (!pdf) throw new Error("PDF compilation returned empty result");
  return pdf;
}

async function renderToSvg(contest: ContestWithImages): Promise<string> {
  if (!isInitialized) throw new Error("Typst compiler not initialized");

  // Add images to virtual filesystem
  await addImagesToFilesystem(contest);

  const doc = buildTypstDocument(contest);
  $typst.addSource("/main.typ", doc);

  const svg = await $typst.svg({ mainFilePath: "/main.typ" });
  return svg;
}

// Message handler
self.addEventListener('message', async (event) => {
  const { id, type, data } = event.data;
  if (!id || !type) return;

  try {
    switch (type) {
      case "init":
        await initializeTypst(data.fontBuffers || []);
        self.postMessage({ id, success: true });
        break;

      case "registerImages":
        // Register images for compilation
        registeredImages.clear();
        if (data.images) {
          for (const [uuid, buffer] of Object.entries(data.images)) {
            registeredImages.set(uuid, buffer as ArrayBuffer);
          }
        }
        self.postMessage({ id, success: true });
        break;

      case "compileTypst":
        const pdf = await compileToPdf(data as ContestWithImages);
        self.postMessage({ id, success: true, data: pdf });
        break;

      case "renderTypst":
        const svg = await renderToSvg(data as ContestWithImages);
        self.postMessage({ id, success: true, data: svg });
        break;

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
