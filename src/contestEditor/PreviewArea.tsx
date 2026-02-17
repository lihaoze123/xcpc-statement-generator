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

  const wrapperClass = isFullscreen
    ? "fixed inset-0 z-50 bg-[#F3F4F6] flex flex-col"
    : "h-full relative bg-[#F3F4F6] flex flex-col border-l border-gray-200";

  return (
    <div className={wrapperClass}>
      {/* Preview Content */}
      <div className="flex-1 overflow-y-auto custom-scroll relative" style={{ padding: '24px' }}>
        <div
          className="mx-auto bg-white shadow-sm transition-transform duration-200 origin-top"
          style={{
            width: '210mm',
            maxWidth: '100%',
            minHeight: '297mm',
            transform: `scale(${zoom / 100})`,
            marginBottom: isFullscreen ? '100px' : '0'
          }}
        >
          <Preview ref={previewRef} data={data} onPageInfoChange={handlePageInfoChange} />
        </div>
      </div>

      {/* Floating Control Bar */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur shadow-lg border border-gray-200 rounded-full px-4 py-2 flex items-center gap-4 z-10 transition-all hover:bg-white">
        {/* Zoom Controls */}
        <div className="flex items-center gap-2">
          <button
            className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-600 transition-colors"
            onClick={handleZoomOut}
            title="Zoom Out"
          >
            <FontAwesomeIcon icon={faMagnifyingGlassMinus} />
          </button>
          <span className="text-sm font-medium w-12 text-center text-gray-700">{zoom}%</span>
          <button
            className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-600 transition-colors"
            onClick={handleZoomIn}
            title="Zoom In"
          >
            <FontAwesomeIcon icon={faMagnifyingGlassPlus} />
          </button>
        </div>

        <div className="w-px h-6 bg-gray-300"></div>

        {/* Page Controls */}
        <div className="flex items-center gap-2">
          <button
            className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-600 transition-colors disabled:opacity-30"
            onClick={() => jumpTo(pageInfo.currentPage - 1)}
            disabled={pageInfo.currentPage <= 1}
            title="Previous Page"
          >
            <FontAwesomeIcon icon={faChevronLeft} />
          </button>
          <div className="flex items-center text-sm font-medium text-gray-700">
            <input
              type="text"
              className="w-8 text-center bg-transparent border-b border-gray-400 focus:border-[#1D71B7] outline-none"
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') jumpTo(Number(pageInput)); }}
              onBlur={() => jumpTo(Number(pageInput))}
            />
            <span className="mx-1">/</span>
            <span>{Math.max(1, pageInfo.totalPages)}</span>
          </div>
          <button
            className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-600 transition-colors disabled:opacity-30"
            onClick={() => jumpTo(pageInfo.currentPage + 1)}
            disabled={pageInfo.currentPage >= pageInfo.totalPages}
            title="Next Page"
          >
            <FontAwesomeIcon icon={faChevronRight} />
          </button>
        </div>

        <div className="w-px h-6 bg-gray-300"></div>

        {/* Fullscreen Toggle */}
        <button
          className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-600 transition-colors"
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
