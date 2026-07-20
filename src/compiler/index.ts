import axios from "axios";
import { createTypstRenderer, type RenderSession } from "@myriaddreamin/typst.ts";
import type { ContestWithImages, ImageData } from "../types/contest";
import fontUrlEntries, { fangZhengFontUrlEntries } from "virtual:typst-font-url-entries";
import TypstCompilerWasmUrl from "@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm?url";
import TypstRendererWasmUrl from "@myriaddreamin/typst-ts-renderer/pkg/typst_ts_renderer_bg.wasm?url";
import TypstWorker from "./compiler.worker?worker";

const worker = new TypstWorker();
const typstRenderer = createTypstRenderer();

export type TypstPreviewPage = {
  pageOffset: number;
  width: number;
  height: number;
};

export type PreviewDocumentUpdate = {
  revision: number;
  pages: TypstPreviewPage[];
};

type IncrementalVectorUpdate = {
  kind: "new" | "diff";
  revision: number;
  vector: Uint8Array;
};

type CachedPage = {
  canvas: HTMLCanvasElement;
  cacheKey?: string;
  revision: number;
};

let renderSession: RenderSession;
let currentPreviewRevision = -1;
let currentPreviewPages: TypstPreviewPage[] = [];
const pageCache = new Map<number, CachedPage>();
const maxCachedPages = 3;
let rendererQueue: Promise<void> = Promise.resolve();

const queueRendererOperation = <T>(operation: () => Promise<T> | T): Promise<T> => {
  const result = rendererQueue.then(operation, operation);
  rendererQueue = result.then(() => undefined, () => undefined);
  return result;
};

async function initializeRenderer(rendererWasm: ArrayBuffer): Promise<void> {
  await typstRenderer.init({ getModule: () => rendererWasm });

  let markReady: (() => void) | undefined;
  const ready = new Promise<void>((resolve) => {
    markReady = resolve;
  });

  void typstRenderer.runWithSession(async (session) => {
    renderSession = session;
    markReady?.();

    // Keep the callback alive while the application is open. typst.ts frees
    // the RenderSession when this callback returns.
    await new Promise<void>(() => undefined);
  });

  await ready;
}

const browserCache: Cache | undefined = await window.caches?.open("typst-assets");

async function downloadData(
  urls: string[],
  onProgress?: (info: { percent: number; loaded: number; total?: number }) => void
): Promise<ArrayBuffer[]> {
  const tasks = urls.map((url) => ({
    loaded: 0,
    total: undefined as number | undefined,
    async exec() {
      const cached = await browserCache?.match(url);
      if (cached) return cached.arrayBuffer();

      const res = await axios.get<ArrayBuffer>(url, {
        responseType: 'arraybuffer',
        onDownloadProgress: (e: any) => {
          this.loaded = e.loaded;
          this.total = e.total;
          if (onProgress) {
            const totalLoaded = tasks.reduce((a, b) => a + b.loaded, 0);
            const totalSize = tasks.reduce<number | undefined>(
              (a, b) => (a === undefined || b.total === undefined) ? undefined : a + b.total,
              0
            );
            onProgress({
              percent: totalSize ? (totalLoaded / totalSize) * 100 : 0,
              loaded: totalLoaded,
              total: totalSize
            });
          }
        }
      });

      browserCache?.put(url, new Response(res.data, {
        headers: { "Content-Type": "application/octet-stream" }
      }));
      return res.data;
    }
  }));

  return Promise.all(tasks.map(t => t.exec()));
}

type PromiseStatus = "pending" | "fulfilled" | "rejected";

export class TypstInitTask {
  status: PromiseStatus = "pending";
  loaded = 0;
  total: number | undefined;
  percent = 0;
  promise: Promise<void>;

  constructor(init: Promise<void>) {
    this.promise = init.then(
      () => { this.status = "fulfilled"; this.percent = 100; },
      (e) => { this.status = "rejected"; throw e; }
    );
  }

  updateProgress(info: { percent: number; loaded: number; total?: number }) {
    this.loaded = info.loaded;
    this.total = info.total;
    this.percent = info.percent;
  }
}

let fontBuffers: ArrayBuffer[];

type LocalFontData = {
  family: string;
  fullName: string;
  postscriptName: string;
  style: string;
  blob: () => Promise<Blob>;
};

type LocalCjkFontSelection = {
  buffers: ArrayBuffer[];
  hasCompleteFangZhengFamily: boolean;
};

type EnhancedFontPreference = "download" | "fallback";

const sourceHanSansUrl =
  "https://cdn.jsdelivr.net/gh/adobe-fonts/source-han-sans@2.005R/SubsetOTF/CN/SourceHanSansCN-Regular.otf";
const enhancedFontPreferenceKey = "xcpc-enhanced-font-preference";
const fangZhengPostscriptNames = [
  "FZShuSong-Z01",
  "FZHei-B01",
  "FZKai-Z03",
  "FZXiaoBiaoSong-B05",
] as const;

const localCjkFontPreferences = [
  ["FZShuSong-Z01", "FZShuSong", "SimSun", "NSimSun", "FangSong", "Songti SC", "Noto Serif CJK SC", "Noto Serif SC", "Source Han Serif"],
  ["FZHei-B01", "FZHei", "Microsoft YaHei", "Microsoft YaHei UI", "SimHei", "DengXian", "Noto Sans CJK SC", "Noto Sans SC", "Source Han Sans"],
  ["FZKai-Z03", "FZKai", "KaiTi", "KaiTi GB2312", "Kaiti SC", "FangSong"],
  ["FZXiaoBiaoSong-B05", "FZXiaoBiaoSong", "Microsoft YaHei Bold", "SimHei", "DengXian", "Noto Sans CJK SC Bold", "Noto Sans SC Bold", "Source Han Sans Bold"],
] as const;

const normalizeFontName = (name: string) => name.toLowerCase().replace(/[\s_-]+/g, "");

function selectLocalCjkFonts(fonts: LocalFontData[]): LocalFontData[] {
  const selected = new Map<string, LocalFontData>();

  for (const [roleIndex, rolePreferences] of localCjkFontPreferences.entries()) {
    let match: LocalFontData | undefined;
    for (const preferredName of rolePreferences) {
      const normalizedPreference = normalizeFontName(preferredName);
      const candidates = fonts.filter((font) => [font.postscriptName, font.fullName, font.family]
        .some((name) => normalizeFontName(name) === normalizedPreference));
      const wantsBold = roleIndex === localCjkFontPreferences.length - 1;
      match = candidates.find((font) => wantsBold
        ? /bold|semibold|demibold/i.test(font.style)
        : /regular|normal|book/i.test(font.style)) ?? candidates[0];
      if (match) break;
    }
    if (match) selected.set(match.postscriptName, match);
  }

  return [...selected.values()];
}

export let fontAccessConfirmResolve: (() => void) | undefined;
export let fontDownloadConfirmResolve: ((download: boolean) => void) | undefined;

function requestFontAccessConfirm(): Promise<void> {
  if (fontAccessConfirmResolve) throw new Error("Font access already requested");
  return new Promise((resolve) => {
    fontAccessConfirmResolve = () => {
      resolve();
      fontAccessConfirmResolve = undefined;
    };
  });
}

function getEnhancedFontPreference(): EnhancedFontPreference | undefined {
  try {
    const preference = localStorage.getItem(enhancedFontPreferenceKey);
    return preference === "download" || preference === "fallback" ? preference : undefined;
  } catch {
    return undefined;
  }
}

function setEnhancedFontPreference(preference: EnhancedFontPreference): void {
  try {
    localStorage.setItem(enhancedFontPreferenceKey, preference);
  } catch {
    // Storage can be unavailable in private or restricted browser contexts.
  }
}

function requestFontDownloadConfirm(): Promise<boolean> {
  if (fontDownloadConfirmResolve) throw new Error("Font download confirmation already requested");
  return new Promise((resolve) => {
    fontDownloadConfirmResolve = (download) => {
      setEnhancedFontPreference(download ? "download" : "fallback");
      resolve(download);
      fontDownloadConfirmResolve = undefined;
    };
  });
}

async function loadPreferredLocalCjkFonts(): Promise<LocalCjkFontSelection> {
  const queryLocalFonts = (window as Window & {
    queryLocalFonts?: () => Promise<LocalFontData[]>;
  }).queryLocalFonts;
  if (!queryLocalFonts) return { buffers: [], hasCompleteFangZhengFamily: false };

  try {
    const permission = await navigator.permissions?.query({
      name: "local-fonts" as PermissionName,
    });
    if (permission?.state === "denied") {
      return { buffers: [], hasCompleteFangZhengFamily: false };
    }
    if (permission?.state !== "granted") await requestFontAccessConfirm();

    const localFonts = await queryLocalFonts.call(window);
    const selectedFonts = selectLocalCjkFonts(localFonts);
    const availableNames = new Set(localFonts.flatMap((font) => [
      font.postscriptName,
      font.fullName,
      font.family,
    ]).map(normalizeFontName));
    const hasCompleteFangZhengFamily = fangZhengPostscriptNames.every((fontName) =>
      availableNames.has(normalizeFontName(fontName))
    );
    const buffers = await Promise.all(selectedFonts.map(async (font) => {
      const blob = await font.blob();
      return blob.arrayBuffer();
    }));
    return { buffers, hasCompleteFangZhengFamily };
  } catch {
    return { buffers: [], hasCompleteFangZhengFamily: false };
  }
}

const wasmBuffersPromise = downloadData(
  [TypstCompilerWasmUrl, TypstRendererWasmUrl],
  (info) => typstInitInfo.compiler.updateProgress(info),
);

export const typstInitInfo: Record<"compiler" | "font" | "package", TypstInitTask> = {
  compiler: new TypstInitTask(
    wasmBuffersPromise.then(() => undefined)
  ),

  font: new TypstInitTask(
    (async () => {
      const bundledFontsPromise = downloadData(
        fontUrlEntries.map(([, url]) => url),
        (info) => typstInitInfo.font.updateProgress(info),
      );
      const localCjkFonts = await loadPreferredLocalCjkFonts();
      const storedPreference = getEnhancedFontPreference();
      const shouldDownloadFangZheng = !localCjkFonts.hasCompleteFangZhengFamily && (
        storedPreference === "download" ||
        (storedPreference === undefined && await requestFontDownloadConfirm())
      );
      const downloadedFangZhengFonts = shouldDownloadFangZheng
        ? await downloadData(
          fangZhengFontUrlEntries.map(([, url]) => url),
          (info) => typstInitInfo.font.updateProgress(info),
        )
        : [];
      const preferredCjkFonts = shouldDownloadFangZheng
        ? downloadedFangZhengFonts
        : localCjkFonts.buffers;
      const fallbackCjkFonts = preferredCjkFonts.length > 0
        ? []
        : await downloadData([sourceHanSansUrl], (info) => typstInitInfo.font.updateProgress(info));

      fontBuffers = [
        ...await bundledFontsPromise,
        ...preferredCjkFonts,
        ...fallbackCjkFonts,
      ];
    })()
  ),

  package: new TypstInitTask(Promise.resolve())
};

export let typstInitStatus: PromiseStatus = "pending";

export const typstInitPromise = Promise.all(
  Object.values(typstInitInfo).map(x => x.promise)
).then(async () => {
  const [compilerWasm, rendererWasm] = await wasmBuffersPromise;
  const messageId = crypto.randomUUID();

  const workerInitPromise = new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Worker init timeout")), 30000);

    const handler = (event: MessageEvent) => {
      if (event.data?.id === messageId) {
        clearTimeout(timeout);
        worker.removeEventListener('message', handler);
        event.data.success ? resolve() : reject(new Error(event.data.error));
      }
    };

    worker.addEventListener('message', handler);
    worker.postMessage({
      id: messageId,
      type: "init",
      data: { fontBuffers, compilerWasm }
    }, [compilerWasm, ...fontBuffers]);
  });

  await Promise.all([
    workerInitPromise,
    initializeRenderer(rendererWasm),
  ]);
  typstInitStatus = "fulfilled";
}).catch((err) => {
  typstInitStatus = "rejected";
  throw new Error("Typst initialization failed", { cause: err });
});

function sendMessage<T>(type: string, data: any, transfer?: Transferable[]): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = crypto.randomUUID();
    const timeout = setTimeout(() => reject(new Error("Timeout")), 60000);

    const handler = (event: MessageEvent) => {
      if (event.data?.id === id) {
        clearTimeout(timeout);
        worker.removeEventListener('message', handler);
        event.data.success ? resolve(event.data.data) : reject(new Error(event.data.error));
      }
    };

    worker.addEventListener('message', handler);
    if (transfer) {
      worker.postMessage({ id, type, data }, transfer);
    } else {
      worker.postMessage({ id, type, data });
    }
  });
}

// Register images for compilation (call before compile)
export const registerImages = async (images: ImageData[]): Promise<void> => {
  // Fetch all blob URLs to get ArrayBuffers
  const imageBuffers: { uuid: string; buffer: ArrayBuffer }[] = [];
  for (const img of images) {
    try {
      const response = await fetch(img.url);
      const buffer = await response.arrayBuffer();
      imageBuffers.push({ uuid: img.uuid, buffer });
    } catch (e) {
      console.error(`Failed to load image ${img.uuid}:`, e);
    }
  }

  const imagesObj: Record<string, ArrayBuffer> = {};
  for (const { uuid, buffer } of imageBuffers) {
    imagesObj[uuid] = buffer;
  }
  await sendMessage(
    "registerImages",
    { images: imagesObj },
    imageBuffers.map(({ buffer }) => buffer),
  );
};

export const compileToPdf = (data: ContestWithImages): Promise<Uint8Array> =>
  sendMessage("compileTypst", data);

export const compileProblemToPdf = (data: ContestWithImages, problemKey: string): Promise<Uint8Array> =>
  sendMessage("compileProblem", { contest: data, problemKey });

const applyIncrementalVector = (
  update: IncrementalVectorUpdate,
): Promise<PreviewDocumentUpdate> => queueRendererOperation(() => {
  if (update.kind === "new") {
    renderSession.reset();
    pageCache.clear();
  }

  renderSession.manipulateData({ action: "merge", data: update.vector });
  currentPreviewRevision = update.revision;
  currentPreviewPages = renderSession.retrievePagesInfo();

  const liveOffsets = new Set(currentPreviewPages.map((page) => page.pageOffset));
  for (const pageOffset of pageCache.keys()) {
    if (!liveOffsets.has(pageOffset)) pageCache.delete(pageOffset);
  }

  return {
    revision: currentPreviewRevision,
    pages: currentPreviewPages.map((page) => ({ ...page })),
  };
});

const compilePreview = async (data: ContestWithImages): Promise<PreviewDocumentUpdate> => {
  const update = await sendMessage<IncrementalVectorUpdate>("compilePreview", data);
  return applyIncrementalVector(update);
};

export const compilePreviewDebounced = (() => {
  type Task = {
    args: ContestWithImages;
    requestedAt: number;
    resolve: (value: PreviewDocumentUpdate) => void;
    reject: (e: unknown) => void;
  };

  let currentTask: Task | undefined;
  let waitingTask: Task | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const debounceMs = 80;

  const run = () => {
    if (currentTask || !waitingTask) return;
    const delay = currentPreviewRevision < 0
      ? 0
      : Math.max(0, debounceMs - (performance.now() - waitingTask.requestedAt));

    clearTimeout(timer);
    timer = setTimeout(() => {
      if (currentTask || !waitingTask) return;
      currentTask = waitingTask;
      waitingTask = undefined;

      compilePreview(currentTask.args)
        .then(currentTask.resolve)
        .catch(currentTask.reject)
        .finally(() => {
          currentTask = undefined;
          run();
        });
    }, delay);
  };

  return (args: ContestWithImages): Promise<PreviewDocumentUpdate> => {
    return new Promise((resolve, reject) => {
      if (waitingTask) waitingTask.reject("Aborted");
      waitingTask = {
        args,
        requestedAt: performance.now(),
        resolve,
        reject,
      };
      run();
    });
  };
})();

const renderPageIntoCache = async (
  pageIndex: number,
  pixelPerPt: number,
): Promise<CachedPage> => {
  const page = currentPreviewPages[pageIndex];
  if (!page) throw new Error(`Preview page ${pageIndex + 1} does not exist`);

  let cached = pageCache.get(page.pageOffset);
  if (!cached) {
    cached = {
      canvas: document.createElement("canvas"),
      revision: -1,
    };
  }

  const targetWidth = Math.ceil(page.width * pixelPerPt);
  const targetHeight = Math.ceil(page.height * pixelPerPt);
  if (
    cached.revision !== currentPreviewRevision ||
    cached.canvas.width !== targetWidth ||
    cached.canvas.height !== targetHeight
  ) {
    if (cached.canvas.width !== targetWidth || cached.canvas.height !== targetHeight) {
      cached.canvas.width = targetWidth;
      cached.canvas.height = targetHeight;
      cached.cacheKey = undefined;
    }
    const cachedContext = cached.canvas.getContext("2d");
    if (!cachedContext) throw new Error("Canvas 2D context is unavailable");
    const result = await renderSession.renderCanvas({
      canvas: cachedContext,
      pageOffset: page.pageOffset,
      cacheKey: cached.cacheKey,
      backgroundColor: "#ffffff",
      pixelPerPt,
    });
    cached.cacheKey = result.cacheKey;
    cached.revision = currentPreviewRevision;
  }

  pageCache.delete(page.pageOffset);
  pageCache.set(page.pageOffset, cached);
  while (pageCache.size > maxCachedPages) {
    const oldestPageOffset = pageCache.keys().next().value;
    if (oldestPageOffset === undefined) break;
    pageCache.delete(oldestPageOffset);
  }

  return cached;
};

export const renderPreviewPage = (
  pageIndex: number,
  destination: HTMLCanvasElement,
): Promise<void> => queueRendererOperation(async () => {
  const page = currentPreviewPages[pageIndex];
  if (!page) throw new Error(`Preview page ${pageIndex + 1} does not exist`);

  const cssWidth = destination.clientWidth || page.width * 4 / 3;
  const requiredPixelPerPt = cssWidth * window.devicePixelRatio / page.width;
  const pixelPerPt = Math.min(3, Math.max(1, Math.ceil(requiredPixelPerPt * 4) / 4));
  const cached = await renderPageIntoCache(pageIndex, pixelPerPt);
  const context = destination.getContext("2d");
  if (!context) throw new Error("Canvas 2D context is unavailable");

  destination.width = cached.canvas.width;
  destination.height = cached.canvas.height;
  destination.dataset.page = String(pageIndex + 1);
  destination.dataset.pageOffset = String(page.pageOffset);
  destination.dataset.revision = String(currentPreviewRevision);
  context.clearRect(0, 0, destination.width, destination.height);
  context.drawImage(cached.canvas, 0, 0);
});
