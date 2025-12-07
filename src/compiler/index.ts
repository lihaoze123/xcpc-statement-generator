import axios from "axios";
import type { ContestWithImages, ImageData } from "../types/contest";
import fontUrlEntries from "virtual:typst-font-url-entries";
import TypstCompilerWasmUrl from "@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm?url";
import TypstRendererWasmUrl from "@myriaddreamin/typst-ts-renderer/pkg/typst_ts_renderer_bg.wasm?url";
import TypstWorker from "./compiler.worker?worker";

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
