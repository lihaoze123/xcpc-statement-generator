import { memo, useEffect, useRef, useState } from "react";
import type { ContestWithImages } from "@/types/contest";
import { compileToSvgDebounced, typstInitPromise } from "@/compiler";

const TypstPreviewContainer = memo<{ svg: string }>(({ svg }) => {
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
  }, [svg]);

  return <div ref={ref} />;
});

const Preview = ({ data }: { data: ContestWithImages }) => {
  const [error, setError] = useState<string>();
  const [svg, setSvg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const previewContainerRef = useRef<HTMLDivElement>(null);

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
        setError(e instanceof Error ? e.message : String(e));
        setLoading(false);
      });

    return () => { mounted = false; };
  }, [data]);

  // Show loading overlay over existing SVG instead of clearing it
  const showLoadingOverlay = loading && svg;

  useEffect(() => {
    const container = previewContainerRef.current;
    if (!container) return;

    let scrollRatio = 0;
    let preventScroll = false;

    const handleScroll = () => {
      if (preventScroll) {
        preventScroll = false;
      } else {
        scrollRatio = container.scrollTop / container.scrollHeight;
      }
    };

    const handleResize = () => {
      const scrollTop = scrollRatio * container.scrollHeight;
      if (scrollTop + container.clientHeight + 1 <= container.scrollHeight) {
        preventScroll = true;
        container.scrollTop = scrollTop;
      }
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    const observer = new ResizeObserver(handleResize);
    observer.observe(container);

    return () => {
      container.removeEventListener("scroll", handleScroll);
      observer.disconnect();
    };
  }, []);

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
          <TypstPreviewContainer svg={svg} />
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
};

export default Preview;
