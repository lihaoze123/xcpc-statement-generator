import axios from "axios";
import type { ContestWithImages, ImageData } from "../types/contest";
import fontUrlEntries from "virtual:typst-font-url-entries";
import TypstCompilerWasmUrl from "@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm?url";
import TypstRendererWasmUrl from "@myriaddreamin/typst-ts-renderer/pkg/typst_ts_renderer_bg.wasm?url";
import TypstWorker from "./compiler.worker?worker";
import { createTypstRenderer, type TypstRenderer, type RenderSession } from "@myriaddreamin/typst.ts/dist/esm/renderer.mjs";

const worker = new TypstWorker();

// Store images for compilation
let imageDataMap: Map<string, ArrayBuffer> = new Map();

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

// Main thread renderer (for Canvas rendering)
let mainThreadRenderer: TypstRenderer | null = null;
let mainThreadRendererInitPromise: Promise<TypstRenderer> | null = null;

async function initMainThreadRenderer(): Promise<TypstRenderer> {
  if (mainThreadRenderer) return mainThreadRenderer;
  if (mainThreadRendererInitPromise) return mainThreadRendererInitPromise;

  mainThreadRendererInitPromise = (async () => {
    const renderer = createTypstRenderer();
    await renderer.init({
      getModule: () => fetch(TypstRendererWasmUrl).then(r => r.arrayBuffer()),
    });
    mainThreadRenderer = renderer;
    return renderer;
  })();

  return mainThreadRendererInitPromise;
}

export type CanvasPageInfo = {
  pageOffset: number;
  width: number;
  height: number;
};

// Render to Canvas with pagination - returns page info and data URLs
export const renderToCanvas = async (
  artifact: Uint8Array,
  pixelPerPt: number = 2
): Promise<{ pages: CanvasPageInfo[]; pageDataUrls: string[] }> => {
  const renderer = await initMainThreadRenderer();

  // Use runWithSession to create a session and render each page
  const result = await renderer.runWithSession(
    {
      format: "vector",
      artifactContent: artifact,
    },
    async (session: RenderSession) => {
      // Get page info using retrievePagesInfo
      const pageInfos = session.retrievePagesInfo();
      const pageCount = pageInfos.length;
      const pages: CanvasPageInfo[] = [];
      const pageDataUrls: string[] = [];

      // Render each page to canvas
      for (let i = 0; i < pageCount; i++) {
        const page = pageInfos[i];
        const width = Math.ceil(page.width * pixelPerPt);
        const height = Math.ceil(page.height * pixelPerPt);

        pages.push({
          pageOffset: page.pageOffset,
          width,
          height,
        });

        // Create canvas for this page
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Failed to get 2D context");

        // Render page to canvas
        await renderer.renderCanvas({
          renderSession: session,
          canvas: ctx,
          pageOffset: i,
          pixelPerPt,
          backgroundColor: "#ffffff",
        });

        // Convert to data URL
        const dataUrl = canvas.toDataURL("image/png");
        pageDataUrls.push(dataUrl);
      }

      return { pages, pageDataUrls };
    }
  );

  return result;
};

// Debounced version with delay
const DEBOUNCE_DELAY = 300; // ms

export const renderToCanvasDebounced = (() => {
  type Task = {
    args: { artifact: Uint8Array; pixelPerPt?: number };
    resolve: (v: { pages: CanvasPageInfo[]; pageDataUrls: string[] } | undefined) => void;
    reject: (e: unknown) => void;
  };

  let currentTask: Task | undefined;
  let waitingTask: Task | undefined;
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  const run = () => {
    if (currentTask || !waitingTask) return;
    currentTask = waitingTask;
    waitingTask = undefined;

    renderToCanvas(currentTask.args.artifact, currentTask.args.pixelPerPt)
      .then(currentTask.resolve)
      .catch(currentTask.reject)
      .finally(() => {
        currentTask = undefined;
        run();
      });
  };

  return (args: { artifact: Uint8Array; pixelPerPt?: number }): Promise<{ pages: CanvasPageInfo[]; pageDataUrls: string[] } | undefined> => {
    return new Promise((resolve, reject) => {
      // Clear existing timer
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      // Cancel waiting task
      if (waitingTask) {
        waitingTask.reject("Aborted");
      }

      // Set up new task with delay
      waitingTask = { args, resolve, reject };

      // Delay before starting render
      debounceTimer = setTimeout(() => {
        debounceTimer = undefined;
        run();
      }, DEBOUNCE_DELAY);
    });
  };
})();

export let fontAccessConfirmResolve: (() => void) | undefined;

function requestFontAccessConfirm(): Promise<void> {
  if (fontAccessConfirmResolve) throw new Error("Font access already requested");
  return new Promise((resolve) => {
    fontAccessConfirmResolve = () => {
      resolve();
      fontAccessConfirmResolve = undefined;
    };
  });
}

export const typstInitInfo: Record<"compiler" | "font" | "package", TypstInitTask> = {
  compiler: new TypstInitTask(
    downloadData([TypstCompilerWasmUrl, TypstRendererWasmUrl], (x) =>
      typstInitInfo.compiler.updateProgress(x)
    ).then(() => {
      // WASM files are downloaded in worker directly
    })
  ),

  font: new TypstInitTask(
    (async () => {
      const localFontDatas: { name: string; blob: () => Promise<Blob> }[] = [];
      const uncachedFonts: [string, string][] = [];

      await Promise.all(
        fontUrlEntries.map(async ([name, url]) => {
          const cached = await browserCache?.match(url);
          if (cached) {
            localFontDatas.push({ name, blob: () => cached.blob() });
          } else {
            uncachedFonts.push([name, url]);
          }
        })
      );

      if (uncachedFonts.length && (window as any).queryLocalFonts) {
        await requestFontAccessConfirm();
        try {
          const localFonts = await (window as any).queryLocalFonts({
            postscriptNames: uncachedFonts.map(x => x[0])
          });
          for (const font of localFonts) {
            const url = uncachedFonts.find(v => v[0] === font.postscriptName)?.[1];
            localFontDatas.push({
              name: font.postscriptName,
              blob: async () => {
                const blob = await font.blob();
                if (url) browserCache?.put(url, new Response(blob));
                return blob;
              }
            });
          }
        } catch { /* ignore */ }
      }

      const localPromises: Promise<ArrayBuffer>[] = [];
      const remoteUrls: string[] = [];

      for (const [name, url] of fontUrlEntries as [string, string][]) {
        const local = localFontDatas.find(x => x.name === name);
        if (local) {
          localPromises.push(local.blob().then(b => b.arrayBuffer()));
        } else {
          remoteUrls.push(url);
        }
      }

      fontBuffers = (await Promise.all([
        ...localPromises,
        downloadData(remoteUrls, (x) => typstInitInfo.font.updateProgress(x))
      ])).flat();
    })()
  ),

  package: new TypstInitTask(Promise.resolve())
};

export let typstInitStatus: PromiseStatus = "pending";

export const typstInitPromise = Promise.all(
  Object.values(typstInitInfo).map(x => x.promise)
).then(async () => {
  const messageId = crypto.randomUUID();

  const initPromise = new Promise<void>((resolve, reject) => {
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
      data: { fontBuffers }
    }, fontBuffers);
  });

  await initPromise;
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
  imageDataMap.clear();

  // Fetch all blob URLs to get ArrayBuffers
  const imageBuffers: { uuid: string; buffer: ArrayBuffer }[] = [];
  for (const img of images) {
    try {
      const response = await fetch(img.url);
      const buffer = await response.arrayBuffer();
      imageBuffers.push({ uuid: img.uuid, buffer });
      imageDataMap.set(img.uuid, buffer);
    } catch (e) {
      console.error(`Failed to load image ${img.uuid}:`, e);
    }
  }

  // Send images to worker
  if (imageBuffers.length > 0) {
    const imagesObj: Record<string, ArrayBuffer> = {};
    for (const { uuid, buffer } of imageBuffers) {
      imagesObj[uuid] = buffer;
    }
    await sendMessage("registerImages", { images: imagesObj });
  }
};

export const compileToPdf = (data: ContestWithImages): Promise<Uint8Array> =>
  sendMessage("compileTypst", data);

export const getArtifact = (data: ContestWithImages): Promise<Uint8Array> =>
  sendMessage("getArtifact", data);

// Debounced version of getArtifact with delay
export const getArtifactDebounced = (() => {
  type Task = {
    args: ContestWithImages;
    resolve: (v: Uint8Array | undefined) => void;
    reject: (e: unknown) => void;
  };

  let currentTask: Task | undefined;
  let waitingTask: Task | undefined;
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  const run = () => {
    if (currentTask || !waitingTask) return;
    currentTask = waitingTask;
    waitingTask = undefined;

    getArtifact(currentTask.args)
      .then(currentTask.resolve)
      .catch(currentTask.reject)
      .finally(() => {
        currentTask = undefined;
        run();
      });
  };

  return (args: ContestWithImages): Promise<Uint8Array | undefined> => {
    return new Promise((resolve, reject) => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      if (waitingTask) {
        waitingTask.reject("Aborted");
      }

      waitingTask = { args, resolve, reject };

      debounceTimer = setTimeout(() => {
        debounceTimer = undefined;
        run();
      }, DEBOUNCE_DELAY);
    });
  };
})();

export const compileProblemToPdf = (data: ContestWithImages, problemKey: string): Promise<Uint8Array> =>
  sendMessage("compileProblem", { contest: data, problemKey });

export const compileToSvg = (data: ContestWithImages): Promise<string> =>
  sendMessage("renderTypst", data);

export const compileToSvgDebounced = (() => {
  type Task = {
    args: ContestWithImages;
    resolve: (v: string | undefined) => void;
    reject: (e: unknown) => void;
  };

  let currentTask: Task | undefined;
  let waitingTask: Task | undefined;

  const run = () => {
    if (currentTask || !waitingTask) return;
    currentTask = waitingTask;
    waitingTask = undefined;

    compileToSvg(currentTask.args)
      .then(currentTask.resolve)
      .catch(currentTask.reject)
      .finally(() => {
        currentTask = undefined;
        run();
      });
  };

  return (args: ContestWithImages): Promise<string | undefined> => {
    return new Promise((resolve, reject) => {
      if (waitingTask) waitingTask.reject("Aborted");
      waitingTask = { args, resolve, reject };
      run();
    });
  };
})();

