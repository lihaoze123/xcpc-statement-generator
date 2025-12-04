import { memo, useEffect, useRef, useState } from "react";
import type { Contest } from "@/types/contest";
import { compileToSvgDebounced, typstInitPromise } from "@/compiler";
import { Alert, Spin } from "antd";
import { isEqual } from "lodash";

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

const Preview = memo<{ data: Contest }>(({ data }) => {
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
        <Alert
          message="渲染出错"
          description={error}
          type="error"
          showIcon
          style={{ margin: 16, position: "absolute", top: 0, left: 0, width: "calc(100% - 32px)", zIndex: 10 }}
        />
      )}
      {loading && !svg && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", minHeight: 200 }}>
          <Spin size="large" tip="正在编译..." />
        </div>
      )}
      {svg && (
        <div className="preview-container" ref={previewContainerRef}>
          <TypstPreviewContainer svg={svg} />
        </div>
      )}
    </div>
  );
}, isEqual);

export default Preview;
