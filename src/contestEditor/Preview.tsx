import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type { ContestWithImages } from "@/types/contest";
import { getArtifactDebounced, renderToCanvasDebounced, typstInitPromise } from "@/compiler";

export type PreviewPageInfo = {
  currentPage: number;
  totalPages: number;
};

export type PreviewHandle = {
  jumpToPage: (page: number) => boolean;
  getCurrentPage: () => number;
  getPageCount: () => number;
};

const clampPage = (page: number, total: number) => {
  if (!Number.isFinite(page)) return 1;
  const normalized = Math.trunc(page);
  return Math.min(Math.max(1, normalized), Math.max(1, total));
};

type PreviewProps = {
  data: ContestWithImages;
  zoom?: number;
  onPageInfoChange?: (info: PreviewPageInfo) => void;
};

const Preview = forwardRef<PreviewHandle, PreviewProps>(({ data, zoom = 100, onPageInfoChange }, ref) => {
  const [error, setError] = useState<string>();
  const [pages, setPages] = useState<{ pageOffset: number; width: number; height: number }[]>([]);
  const [pageDataUrls, setPageDataUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const pageInfoRef = useRef<PreviewPageInfo>({ currentPage: 1, totalPages: 1 });
  const pendingJumpRef = useRef<number | null>(null);
  const zoomScale = Math.min(200, Math.max(50, zoom)) / 100;

  const jumpToPageInternal = useCallback((page: number, behavior: ScrollBehavior) => {
    const container = containerRef.current;
    if (!container) return false;

    const totalPages = Math.max(1, pages.length);
    const targetPage = clampPage(page, totalPages);

    if (pages.length === 0) {
      pendingJumpRef.current = targetPage;
      return false;
    }

    // Find the target page element
    const pageElements = container.querySelectorAll('.preview-page');
    const targetElement = pageElements[targetPage - 1] as HTMLElement | undefined;
    if (!targetElement) return false;

    const containerRect = container.getBoundingClientRect();
    const targetRect = targetElement.getBoundingClientRect();
    const rawTop = container.scrollTop + (targetRect.top - containerRect.top) - 12;
    const maxTop = Math.max(0, container.scrollHeight - container.clientHeight);
    const targetTop = Math.min(Math.max(0, rawTop), maxTop);

    container.scrollTo({ top: targetTop, behavior });
    const nextInfo = { currentPage: targetPage, totalPages };
    pageInfoRef.current = nextInfo;
    onPageInfoChange?.(nextInfo);
    return true;
  }, [pages, onPageInfoChange]);

  const updatePageInfo = useCallback(() => {
    const container = containerRef.current;
    if (!container || pages.length === 0) {
      const fallbackInfo = { currentPage: 1, totalPages: pages.length || 1 };
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

    const pageElements = container.querySelectorAll('.preview-page');
    for (let i = 0; i < pageElements.length; i += 1) {
      const rect = pageElements[i].getBoundingClientRect();
      if (rect.top <= viewportAnchor) currentPage = i + 1;
      if (rect.top > viewportAnchor) break;
    }

    const nextInfo = { currentPage, totalPages: pages.length };
    const previous = pageInfoRef.current;
    if (previous.currentPage !== nextInfo.currentPage || previous.totalPages !== nextInfo.totalPages) {
      pageInfoRef.current = nextInfo;
      onPageInfoChange?.(nextInfo);
    }

    return nextInfo;
  }, [pages, onPageInfoChange]);

  useImperativeHandle(ref, () => ({
    jumpToPage: (page: number) => jumpToPageInternal(page, "smooth"),
    getCurrentPage: () => pageInfoRef.current.currentPage,
    getPageCount: () => pageInfoRef.current.totalPages,
  }), [jumpToPageInternal]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);

    // First get the artifact, then render to canvas
    typstInitPromise
      .then(() => getArtifactDebounced(data))
      .then((artifact) => {
        if (!mounted || !artifact) return;
        return renderToCanvasDebounced({ artifact, pixelPerPt: 2 });
      })
      .then((result) => {
        if (!mounted) return;
        if (result && result.pages.length > 0) {
          setPages(result.pages);
          setPageDataUrls(result.pageDataUrls);
          setError(undefined);
        } else {
          setError("渲染返回空结果");
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

  // Handle pending page jumps
  useEffect(() => {
    if (!loading && pages.length > 0 && pendingJumpRef.current !== null) {
      const pendingPage = pendingJumpRef.current;
      pendingJumpRef.current = null;
      jumpToPageInternal(pendingPage, "auto");
    }
  }, [loading, pages.length, jumpToPageInternal]);

  // Track scroll position for page info
  useEffect(() => {
    const container = containerRef.current;
    if (!container || pages.length === 0) return;

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

    return () => {
      container.removeEventListener("scroll", handleScroll);
      observer.disconnect();
    };
  }, [pages.length, updatePageInfo]);

  return (
    <div className="preview preview-surface">
      {error && (
        <div className="alert alert-error absolute top-4 left-4 right-4 z-10 shadow-md pointer-events-none">
          <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-5 w-5" fill="none" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="flex-1">
            <div className="font-semibold text-sm">渲染出错</div>
            <div className="text-xs opacity-80 truncate">{error}</div>
          </div>
        </div>
      )}
      {/* Show canvas pages */}
      {pages.length > 0 && (
        <div className="preview-container custom-scroll relative" ref={containerRef}>
          <div className="preview-pages">
            {pages.map((page, index) => (
              <div
                key={index}
                className="preview-page"
                style={{
                  width: `${(page.width / 2) * zoomScale}px`,
                  height: `${(page.height / 2) * zoomScale}px`,
                  flexShrink: 0,
                }}
              >
                <img
                  src={pageDataUrls[index]}
                  alt={`Page ${index + 1}`}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    display: 'block',
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      )}
      {loading && (
        <div className="preview-loading-overlay pointer-events-none">
          <span className={`loading loading-spinner ${pages.length > 0 ? "loading-md" : "loading-lg"} text-primary`}></span>
          <span className="ml-2 text-sm">{pages.length > 0 ? "正在重新编译..." : "正在编译预览..."}</span>
        </div>
      )}
    </div>
  );
});

Preview.displayName = "Preview";

export default Preview;
