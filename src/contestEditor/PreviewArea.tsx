import { type FC, useState, useCallback } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faExpand, faCompress, faMagnifyingGlassPlus, faMagnifyingGlassMinus, faChevronLeft, faChevronRight } from "@fortawesome/free-solid-svg-icons";
import Preview, { type PreviewHandle, type PreviewPageInfo } from "./Preview";
import type { ContestWithImages } from "@/types/contest";

interface PreviewAreaProps {
  data: ContestWithImages;
  previewRef: React.RefObject<PreviewHandle | null>;
  isFullscreen: boolean;
  setFullscreen: (val: boolean) => void;
}

const PreviewArea: FC<PreviewAreaProps> = ({ data, previewRef, isFullscreen, setFullscreen }) => {
  const [zoom, setZoom] = useState(100);
  const [pageInfo, setPageInfo] = useState<PreviewPageInfo>({ currentPage: 1, totalPages: 1 });
  const [pageInput, setPageInput] = useState("1");

  const handlePageInfoChange = useCallback((info: PreviewPageInfo) => {
    setPageInfo(info);
    setPageInput(String(info.currentPage));
  }, []);

  const handleZoomIn = () => setZoom(z => Math.min(200, z + 10));
  const handleZoomOut = () => setZoom(z => Math.max(50, z - 10));

  const jumpTo = (page: number) => {
    const target = Math.min(Math.max(1, page), Math.max(1, pageInfo.totalPages));
    previewRef.current?.jumpToPage(target);
    setPageInput(String(target));
  };

  const handlePageInputCommit = () => {
    const parsed = Number(pageInput);
    if (!Number.isFinite(parsed)) {
      setPageInput(String(pageInfo.currentPage));
      return;
    }
    jumpTo(parsed);
  };

  const wrapperClass = isFullscreen
    ? "fixed inset-0 z-50 bg-[#F3F4F6] flex flex-col min-h-0"
    : "h-full relative bg-[#F3F4F6] flex flex-col min-h-0 border-l border-gray-200";

  return (
    <div className={wrapperClass}>
      {/* Preview Content */}
      <div className="relative flex-1 min-h-0">
        <Preview ref={previewRef} data={data} zoom={zoom} onPageInfoChange={handlePageInfoChange} />
      </div>

      {/* Floating Control Bar */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 flex items-center gap-2 z-10">
        {/* Zoom Controls */}
        <div className="flex items-center gap-1">
          <button
            className="w-8 h-8 rounded-lg hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D71B7]/30 flex items-center justify-center text-slate-600 transition-colors"
            onClick={handleZoomOut}
            title="Zoom Out"
          >
            <FontAwesomeIcon icon={faMagnifyingGlassMinus} />
          </button>
          <span className="text-sm font-semibold w-12 text-center text-slate-700">{zoom}%</span>
          <button
            className="w-8 h-8 rounded-lg hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D71B7]/30 flex items-center justify-center text-slate-600 transition-colors"
            onClick={handleZoomIn}
            title="Zoom In"
          >
            <FontAwesomeIcon icon={faMagnifyingGlassPlus} />
          </button>
        </div>

        <div className="w-px h-6 bg-gray-200"></div>

        {/* Page Controls */}
        <div className="flex items-center gap-1">
          <button
            className="w-8 h-8 rounded-lg hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D71B7]/30 flex items-center justify-center text-slate-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            onClick={() => jumpTo(pageInfo.currentPage - 1)}
            disabled={pageInfo.currentPage <= 1}
            title="Previous Page"
          >
            <FontAwesomeIcon icon={faChevronLeft} />
          </button>
          <div className="flex items-center text-sm font-medium text-slate-700 px-2">
            <input
              type="text"
              className="w-9 h-7 text-center bg-white/75 rounded-md border border-slate-200 focus:border-[#1D71B7] focus:ring-2 focus:ring-[#1D71B7]/10 outline-none"
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value.replace(/[^\d]/g, ""))}
              onKeyDown={(e) => { if (e.key === 'Enter') handlePageInputCommit(); }}
              onBlur={handlePageInputCommit}
            />
            <span className="mx-1 text-slate-400">/</span>
            <span>{Math.max(1, pageInfo.totalPages)}</span>
          </div>
          <button
            className="w-8 h-8 rounded-lg hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D71B7]/30 flex items-center justify-center text-slate-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            onClick={() => jumpTo(pageInfo.currentPage + 1)}
            disabled={pageInfo.currentPage >= pageInfo.totalPages}
            title="Next Page"
          >
            <FontAwesomeIcon icon={faChevronRight} />
          </button>
        </div>

        <div className="w-px h-6 bg-gray-200"></div>

        {/* Fullscreen Toggle */}
        <button
          className="w-8 h-8 rounded-lg hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D71B7]/30 flex items-center justify-center text-slate-600 transition-colors"
          onClick={() => setFullscreen(!isFullscreen)}
          title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
        >
          <FontAwesomeIcon icon={isFullscreen ? faCompress : faExpand} />
        </button>
      </div>
    </div>
  );
};

export default PreviewArea;
