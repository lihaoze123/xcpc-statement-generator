import {
  memo,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type { ContestWithImages } from "@/types/contest";
import { compileToSvgDebounced, typstInitPromise } from "@/compiler";

export type PreviewPageInfo = {
  currentPage: number;
  totalPages: number;
};

export type PreviewHandle = {
  jumpToPage: (page: number) => boolean;
  getCurrentPage: () => number;
  getPageCount: () => number;
};

const TypstPreviewContainer = memo<{ svg: string; onRendered?: (host: HTMLDivElement) => void }>(({ svg, onRendered }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = ref.current;
    if (!host || host.shadowRoot) return;
    host.attachShadow({ mode: "open" });
  }, []);

  useEffect(() => {
    if (!ref.current?.shadowRoot) return;
    ref.current.shadowRoot.innerHTML = `
      ${svg}
      <style>
        .typst-doc { width: 100%; height: auto; }
      </style>
    `;
    onRendered?.(ref.current);
  }, [onRendered, svg]);

  return <div ref={ref} />;
});

const isScrollable = (element: HTMLElement) => {
  const style = window.getComputedStyle(element);
  const overflowY = style.overflowY;
  const canScrollByStyle = overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay";
  return canScrollByStyle && element.scrollHeight > element.clientHeight + 1;
};

const findScrollableContainer = (start: HTMLElement | null): HTMLElement | null => {
  let node = start;
  while (node) {
    if (isScrollable(node)) return node;
    node = node.parentElement;
  }
  return start;
};

const collectPageNodes = (shadowRoot: ShadowRoot): Element[] => {
  const directPages = Array.from(shadowRoot.children).filter((el) => {
    if (el.tagName.toLowerCase() === "style") return false;
    if (el.classList.contains("typst-page")) return true;
    if (el.hasAttribute("data-page") || el.hasAttribute("data-page-number")) return true;
    return el.tagName.toLowerCase() === "svg";
  });
  if (directPages.length > 1) return directPages;

  const selectors = [
    ".typst-page",
    ".typst-dom-page",
    "[data-page-number]",
    "[data-page]",
    "svg.typst-doc > g.typst-page",
    "svg.typst-doc > g[data-page-number]",
    "svg.typst-doc > g[data-page]",
  ];

  for (const selector of selectors) {
    const nodes = Array.from(shadowRoot.querySelectorAll(selector));
    if (nodes.length > 0) return nodes;
  }

  const fallbackSvg = Array.from(shadowRoot.querySelectorAll("svg"));
  if (fallbackSvg.length > 0) return fallbackSvg;

  return [];
};

const clampPage = (page: number, total: number) => {
  if (!Number.isFinite(page)) return 1;
  const normalized = Math.trunc(page);
  return Math.min(Math.max(1, normalized), Math.max(1, total));
};

type PreviewProps = {
  data: ContestWithImages;
  onPageInfoChange?: (info: PreviewPageInfo) => void;
};

const Preview = forwardRef<PreviewHandle, PreviewProps>(({ data, onPageInfoChange }, ref) => {
  const [error, setError] = useState<string>();
  const [svg, setSvg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLElement | null>(null);
  const pageNodesRef = useRef<Element[]>([]);
  const pageInfoRef = useRef<PreviewPageInfo>({ currentPage: 1, totalPages: 1 });
  const pendingJumpRef = useRef<number | null>(null);

  const resolveScrollContainer = useCallback(() => {
    const container = findScrollableContainer(previewContainerRef.current);
    scrollContainerRef.current = container;
    return container;
  }, []);

  const updatePageInfo = useCallback(() => {
    const container = scrollContainerRef.current ?? resolveScrollContainer();
    const pages = pageNodesRef.current;
    const totalPages = Math.max(1, pages.length);

    if (!container || pages.length === 0) {
      const fallbackInfo = { currentPage: 1, totalPages };
      const previous = pageInfoRef.current;
      if (
        previous.currentPage !== fallbackInfo.currentPage ||
        previous.totalPages !== fallbackInfo.totalPages
      ) {
        pageInfoRef.current = fallbackInfo;
        onPageInfoChange?.(fallbackInfo);
      }
      return fallbackInfo;
    }

    const containerRect = container.getBoundingClientRect();
    const viewportAnchor = containerRect.top + Math.max(16, container.clientHeight * 0.25);
    let currentPage = 1;

    for (let i = 0; i < pages.length; i += 1) {
      const rect = pages[i].getBoundingClientRect();
      if (rect.top <= viewportAnchor) currentPage = i + 1;
      if (rect.top > viewportAnchor) break;
    }

    const nextInfo = { currentPage, totalPages };
    const previous = pageInfoRef.current;
    if (previous.currentPage !== nextInfo.currentPage || previous.totalPages !== nextInfo.totalPages) {
      pageInfoRef.current = nextInfo;
      onPageInfoChange?.(nextInfo);
    }

    return nextInfo;
  }, [onPageInfoChange, resolveScrollContainer]);

  const jumpToPageInternal = useCallback((page: number, behavior: ScrollBehavior) => {
    const container = scrollContainerRef.current ?? resolveScrollContainer();
    if (!container) return false;

    const pages = pageNodesRef.current;
    const totalPages = Math.max(1, pages.length);
    const targetPage = clampPage(page, totalPages);

    if (pages.length === 0) {
      pendingJumpRef.current = targetPage;
      return false;
    }

    const targetNode = pages[targetPage - 1] ?? pages[pages.length - 1];
    const containerRect = container.getBoundingClientRect();
    const targetRect = targetNode.getBoundingClientRect();
    const rawTop = container.scrollTop + (targetRect.top - containerRect.top);
    const maxTop = Math.max(0, container.scrollHeight - container.clientHeight);
    const targetTop = Math.min(Math.max(0, rawTop), maxTop);

    container.scrollTo({ top: targetTop, behavior });
    requestAnimationFrame(() => updatePageInfo());
    return true;
  }, [resolveScrollContainer, updatePageInfo]);

  useImperativeHandle(ref, () => ({
    jumpToPage: (page: number) => jumpToPageInternal(page, "smooth"),
    getCurrentPage: () => pageInfoRef.current.currentPage,
    getPageCount: () => pageInfoRef.current.totalPages,
  }), [jumpToPageInternal]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);

    typstInitPromise
      .then(() => compileToSvgDebounced(data))
      .then((result) => {
        if (!mounted) return;
        if (result) {
          setSvg(result);
          setError(undefined);
        } else {
          setError("编译返回空结果");
        }
        setLoading(false);
      })
      .catch((e) => {
        if (!mounted) return;
        if (String(e) === "Aborted") return;
        setError(e instanceof Error ? e.message : String(e));
        setLoading(false);
      });

    return () => { mounted = false; };
  }, [data]);

  // Show loading overlay over existing SVG instead of clearing it
  const showLoadingOverlay = loading && svg;

  const handleSvgRendered = useCallback((host: HTMLDivElement) => {
    const root = host.shadowRoot;
    if (!root) return;

    pageNodesRef.current = collectPageNodes(root);
    resolveScrollContainer();
    updatePageInfo();

    const pendingPage = pendingJumpRef.current;
    if (pendingPage !== null) {
      pendingJumpRef.current = null;
      jumpToPageInternal(pendingPage, "auto");
    }
  }, [jumpToPageInternal, resolveScrollContainer, updatePageInfo]);

  useEffect(() => {
    const container = resolveScrollContainer();
    if (!container) return;

    let scrollRatio = 0;
    let preventScroll = false;

    const updateRatio = () => {
      const scrollableHeight = Math.max(1, container.scrollHeight - container.clientHeight);
      scrollRatio = container.scrollTop / scrollableHeight;
    };

    const handleScroll = () => {
      if (preventScroll) {
        preventScroll = false;
      } else {
        updateRatio();
      }
      updatePageInfo();
    };

    const handleResize = () => {
      const scrollableHeight = Math.max(0, container.scrollHeight - container.clientHeight);
      const scrollTop = scrollRatio * scrollableHeight;
      if (Math.abs(scrollTop - container.scrollTop) > 1) {
        preventScroll = true;
        container.scrollTop = scrollTop;
      }
      updatePageInfo();
    };

    updateRatio();
    updatePageInfo();

    container.addEventListener("scroll", handleScroll, { passive: true });
    const observer = new ResizeObserver(handleResize);
    observer.observe(container);
    if (previewContainerRef.current && previewContainerRef.current !== container) {
      observer.observe(previewContainerRef.current);
    }

    return () => {
      container.removeEventListener("scroll", handleScroll);
      observer.disconnect();
    };
  }, [resolveScrollContainer, svg, updatePageInfo]);

  return (
    <div className="preview">
      {error && (
        <div className="alert alert-error m-4 absolute top-0 left-0 right-0 z-10">
          <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <div className="font-bold">渲染出错</div>
            <div className="text-xs">{error}</div>
          </div>
        </div>
      )}
      {/* Initial loading state - show spinner only when no SVG */}
      {loading && !svg && (
        <div className="flex justify-center items-center h-full min-h-[200px]">
          <span className="loading loading-spinner loading-lg"></span>
          <span className="ml-2">正在编译...</span>
        </div>
      )}
      {/* Show SVG with loading overlay - no flickering */}
      {svg && (
        <div className="preview-container relative" ref={previewContainerRef}>
          <TypstPreviewContainer svg={svg} onRendered={handleSvgRendered} />
          {showLoadingOverlay && (
            <div className="absolute inset-0 bg-white/50 flex items-center justify-center">
              <span className="loading loading-spinner loading-md"></span>
              <span className="ml-2 text-sm">正在重新编译...</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

Preview.displayName = "Preview";

export default Preview;
