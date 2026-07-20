import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type RefObject,
} from "react";
import type { ContestWithImages } from "@/types/contest";
import {
  compilePreviewDebounced,
  renderPreviewPage,
  typstInitPromise,
  type PreviewDocumentUpdate,
  type TypstPreviewPage,
} from "@/compiler";

export type PreviewPageInfo = {
  currentPage: number;
  totalPages: number;
};

export type PreviewHandle = {
  jumpToPage: (page: number, behavior?: ScrollBehavior) => boolean;
  getCurrentPage: () => number;
  getPageCount: () => number;
};

type PreviewProps = {
  data: ContestWithImages;
  zoom: number;
  scrollRootRef: RefObject<HTMLDivElement | null>;
  onPageInfoChange?: (info: PreviewPageInfo) => void;
};

type PreviewPageProps = {
  index: number;
  page: TypstPreviewPage;
  revision: number;
  zoom: number;
  shouldRender: boolean;
  onPageNode: (index: number, node: HTMLDivElement | null) => void;
  onRenderError: (reason: unknown) => void;
};

const clampPage = (page: number, total: number) => {
  if (!Number.isFinite(page)) return 1;
  return Math.min(Math.max(1, Math.trunc(page)), Math.max(1, total));
};

const samePageSet = (left: Set<number>, right: Set<number>) => {
  if (left.size !== right.size) return false;
  for (const page of left) {
    if (!right.has(page)) return false;
  }
  return true;
};

const PreviewPage = memo(({
  index,
  page,
  revision,
  zoom,
  shouldRender,
  onPageNode,
  onRenderError,
}: PreviewPageProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [renderedRevision, setRenderedRevision] = useState(-1);

  const registerPageNode = useCallback((node: HTMLDivElement | null) => {
    onPageNode(index, node);
  }, [index, onPageNode]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!shouldRender) {
      setRenderedRevision(-1);
      return;
    }
    if (!canvas) return;

    let active = true;
    renderPreviewPage(index, canvas)
      .then(() => {
        if (active) setRenderedRevision(revision);
      })
      .catch((reason) => {
        if (active) onRenderError(reason);
      });

    return () => {
      active = false;
    };
  }, [index, onRenderError, revision, shouldRender, zoom]);

  return (
    <div
      ref={registerPageNode}
      className="preview-page relative w-full shrink-0 overflow-hidden bg-white shadow-sm ring-1 ring-black/5"
      data-page={index + 1}
      data-page-offset={page.pageOffset}
      style={{ aspectRatio: `${page.width} / ${page.height}` }}
    >
      {shouldRender && (
        <canvas
          ref={canvasRef}
          className="absolute inset-0 block h-full w-full"
          aria-label={`Preview page ${index + 1}`}
        />
      )}
      {shouldRender && renderedRevision !== revision && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60">
          <span className="loading loading-spinner loading-md" />
        </div>
      )}
    </div>
  );
});

PreviewPage.displayName = "PreviewPage";

const Preview = forwardRef<PreviewHandle, PreviewProps>(({
  data,
  zoom,
  scrollRootRef,
  onPageInfoChange,
}, ref) => {
  const [document, setDocument] = useState<PreviewDocumentUpdate>();
  const [currentPage, setCurrentPage] = useState(1);
  const [renderablePages, setRenderablePages] = useState<Set<number>>(() => new Set([0]));
  const [error, setError] = useState<string>();
  const [compiling, setCompiling] = useState(true);
  const pageNodesRef = useRef(new Map<number, HTMLDivElement>());
  const pageInfoRef = useRef<PreviewPageInfo>({ currentPage: 1, totalPages: 1 });

  const publishPageInfo = useCallback((page: number, total: number) => {
    const next = {
      currentPage: clampPage(page, total),
      totalPages: Math.max(1, total),
    };
    const previous = pageInfoRef.current;
    if (previous.currentPage === next.currentPage && previous.totalPages === next.totalPages) return;
    pageInfoRef.current = next;
    onPageInfoChange?.(next);
  }, [onPageInfoChange]);

  const registerPageNode = useCallback((index: number, node: HTMLDivElement | null) => {
    if (node) pageNodesRef.current.set(index, node);
    else pageNodesRef.current.delete(index);
  }, []);

  const jumpToPage = useCallback((page: number, behavior: ScrollBehavior = "smooth") => {
    const total = document?.pages.length ?? 0;
    const scrollRoot = scrollRootRef.current;
    if (total === 0 || !scrollRoot) return false;

    const targetPage = clampPage(page, total);
    const targetNode = pageNodesRef.current.get(targetPage - 1);
    if (!targetNode) return false;

    const rootRect = scrollRoot.getBoundingClientRect();
    const targetRect = targetNode.getBoundingClientRect();
    scrollRoot.scrollTo({
      top: scrollRoot.scrollTop + targetRect.top - rootRect.top - 24,
      behavior,
    });
    return true;
  }, [document?.pages.length, scrollRootRef]);

  useImperativeHandle(ref, () => ({
    jumpToPage,
    getCurrentPage: () => pageInfoRef.current.currentPage,
    getPageCount: () => pageInfoRef.current.totalPages,
  }), [jumpToPage]);

  useEffect(() => {
    let active = true;
    setCompiling(true);

    typstInitPromise
      .then(() => compilePreviewDebounced(data))
      .then((update) => {
        if (!active) return;
        setDocument(update);
        setError(undefined);
        setCompiling(false);
      })
      .catch((reason) => {
        if (!active || String(reason) === "Aborted") return;
        setError(reason instanceof Error ? reason.message : String(reason));
        setCompiling(false);
      });

    return () => {
      active = false;
    };
  }, [data]);

  useEffect(() => {
    publishPageInfo(currentPage, document?.pages.length ?? 0);
  }, [currentPage, document?.pages.length, publishPageInfo]);

  useEffect(() => {
    if (!document?.pages.length) return;

    const scrollRoot = scrollRootRef.current;
    const visiblePages = new Set<number>();
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const pageIndex = Number((entry.target as HTMLElement).dataset.pageIndex);
        if (entry.isIntersecting) visiblePages.add(pageIndex);
        else visiblePages.delete(pageIndex);
      }

      const next = new Set(visiblePages);
      if (next.size === 0) next.add(clampPage(pageInfoRef.current.currentPage, document.pages.length) - 1);
      setRenderablePages((previous) => samePageSet(previous, next) ? previous : next);
    }, {
      root: scrollRoot,
      rootMargin: "35% 0px",
      threshold: 0,
    });

    for (const [index, node] of pageNodesRef.current) {
      node.dataset.pageIndex = String(index);
      observer.observe(node);
    }

    return () => observer.disconnect();
  }, [document, scrollRootRef]);

  useEffect(() => {
    if (!document?.pages.length) return;

    const scrollRoot = scrollRootRef.current;
    if (!scrollRoot) return;
    let animationFrame = 0;

    const updateCurrentPage = () => {
      animationFrame = 0;
      const rootRect = scrollRoot.getBoundingClientRect();
      const anchor = rootRect.top + Math.min(rootRect.height * 0.35, 240);
      let closestPage = 0;
      let closestDistance = Number.POSITIVE_INFINITY;

      for (const [index, node] of pageNodesRef.current) {
        const pageRect = node.getBoundingClientRect();
        const distance = pageRect.top <= anchor && pageRect.bottom >= anchor
          ? 0
          : Math.min(Math.abs(pageRect.top - anchor), Math.abs(pageRect.bottom - anchor));
        if (distance < closestDistance) {
          closestDistance = distance;
          closestPage = index;
        }
      }

      setCurrentPage((previous) => previous === closestPage + 1 ? previous : closestPage + 1);
    };

    const scheduleUpdate = () => {
      if (!animationFrame) animationFrame = requestAnimationFrame(updateCurrentPage);
    };

    scrollRoot.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
    scheduleUpdate();

    return () => {
      scrollRoot.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      if (animationFrame) cancelAnimationFrame(animationFrame);
    };
  }, [document, scrollRootRef]);

  const handleRenderError = useCallback((reason: unknown) => {
    setError(reason instanceof Error ? reason.message : String(reason));
  }, []);

  return (
    <div className="preview relative flex w-full flex-col gap-6 pb-2">
      {error && (
        <div className="alert alert-error sticky top-2 z-20 mx-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 shrink-0 stroke-current" fill="none" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <div className="font-bold">渲染出错</div>
            <div className="whitespace-pre-wrap text-xs">{error}</div>
          </div>
        </div>
      )}

      {!document?.pages.length && compiling && (
        <div
          className="flex items-center justify-center bg-white shadow-sm"
          style={{ aspectRatio: "210 / 297" }}
        >
          <span className="loading loading-spinner loading-lg" />
          <span className="ml-2">正在编译...</span>
        </div>
      )}

      {document?.pages.map((page, index) => (
        <PreviewPage
          key={page.pageOffset}
          index={index}
          page={page}
          revision={document.revision}
          zoom={zoom}
          shouldRender={renderablePages.has(index)}
          onPageNode={registerPageNode}
          onRenderError={handleRenderError}
        />
      ))}
    </div>
  );
});

Preview.displayName = "Preview";

export default Preview;
