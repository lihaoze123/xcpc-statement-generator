import { type FC, useEffect, useState, useMemo, Suspense, use, useRef, useCallback } from "react";
import { useImmer } from "use-immer";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faFileArrowDown,
  faFileImport,
  faFileExport,
  faChevronDown,
  faChevronLeft,
  faChevronRight,
  faFolderOpen,
  faExpand,
  faCompress,
  faMagnifyingGlassPlus,
  faMagnifyingGlassMinus
} from "@fortawesome/free-solid-svg-icons";
import { debounce } from "lodash";
import { useTranslation } from "react-i18next";
import { Allotment } from "allotment";
import "allotment/dist/style.css";

import type { ContestWithImages, ImageData } from "@/types/contest";
import { exampleStatements } from "./exampleStatements";
import { compileToPdf, typstInitPromise, registerImages } from "@/compiler";
import { saveConfigToDB, loadConfigFromDB, exportConfig, importConfig, clearDB, saveImageToDB } from "@/utils/indexedDBUtils";
import { loadPolygonPackage } from "@/utils/polygonConverter";
import { useToast } from "@/components/ToastProvider";
import ConfigPanel from "./ConfigPanel";
import Preview, { type PreviewHandle, type PreviewPageInfo } from "./Preview";

import "./index.css";

const ContestEditorImpl: FC<{ initialData: ContestWithImages }> = ({ initialData }) => {
  const [contestData, updateContestData] = useImmer<ContestWithImages>(initialData);
  const [exportDisabled, setExportDisabled] = useState(true);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [confirmModalContent, setConfirmModalContent] = useState({ title: '', content: '' });
  const [previewFullscreen, setPreviewFullscreen] = useState(false);
  const [previewZoom, setPreviewZoom] = useState(100);
  const [previewPageInfo, setPreviewPageInfo] = useState<PreviewPageInfo>({ currentPage: 1, totalPages: 1 });
  const [previewPageInput, setPreviewPageInput] = useState("1");
  const [isPageInputFocused, setIsPageInputFocused] = useState(false);
  const previewRef = useRef<PreviewHandle>(null);
  const { t } = useTranslation();
  const { showToast } = useToast();
  const totalPages = Math.max(1, previewPageInfo.totalPages);

  const handlePreviewPageInfoChange = useCallback((info: PreviewPageInfo) => {
    setPreviewPageInfo((prev) => {
      if (prev.currentPage === info.currentPage && prev.totalPages === info.totalPages) {
        return prev;
      }
      return info;
    });
    if (!isPageInputFocused) {
      setPreviewPageInput(String(info.currentPage));
    }
  }, [isPageInputFocused]);

  const handleJumpToPage = useCallback(() => {
    const parsed = Number(previewPageInput);
    const total = Math.max(1, previewPageInfo.totalPages);
    const current = Math.max(1, previewPageInfo.currentPage);

    if (!Number.isFinite(parsed)) {
      setPreviewPageInput(String(current));
      return;
    }

    const target = Math.min(total, Math.max(1, Math.trunc(parsed)));
    setPreviewPageInput(String(target));
    previewRef.current?.jumpToPage(target);
  }, [previewPageInfo.currentPage, previewPageInfo.totalPages, previewPageInput]);

  const handlePrevPage = useCallback(() => {
    if (previewPageInfo.currentPage <= 1) return;
    const target = previewPageInfo.currentPage - 1;
    setPreviewPageInput(String(target));
    previewRef.current?.jumpToPage(target);
  }, [previewPageInfo.currentPage]);

  const handleNextPage = useCallback(() => {
    if (previewPageInfo.currentPage >= totalPages) return;
    const target = previewPageInfo.currentPage + 1;
    setPreviewPageInput(String(target));
    previewRef.current?.jumpToPage(target);
  }, [previewPageInfo.currentPage, totalPages]);

  // Debounced auto-save
  const debouncedSave = useMemo(() =>
    debounce(async (data: ContestWithImages) => {
      try { await saveConfigToDB(data); }
      catch (e) { console.error("Auto-save failed:", e); }
    }, 500),
    []
  );

  useEffect(() => { debouncedSave(contestData); }, [contestData, debouncedSave]);

  // Register images with compiler when images change
  useEffect(() => {
    registerImages(contestData.images).catch((e) =>
      console.error("Failed to register images:", e)
    );
  }, [contestData.images]);

  // Enable export after Typst init
  useEffect(() => {
    let mounted = true;
    typstInitPromise.then(() => { if (mounted) setExportDisabled(false); });
    return () => { mounted = false; };
  }, []);

  const handleLoadExample = async (key: string) => {
    setConfirmModalContent({
      title: t('messages:loadExampleConfirm.title'),
      content: t('messages:loadExampleConfirm.content'),
    });

    const confirmed = await new Promise<boolean>((resolve) => {
      setPendingAction(() => resolve(true));
      setShowConfirmModal(true);
    });

    if (!confirmed) return;

    // Revoke old blob URLs
    for (const img of contestData.images) {
      URL.revokeObjectURL(img.url);
    }

    const problemsWithKeys = exampleStatements[key].problems.map((problem) => ({
      ...problem,
      key: problem.key || crypto.randomUUID(),
    }));

    const exampleData: ContestWithImages = {
      ...exampleStatements[key],
      problems: problemsWithKeys,
      images: []
    };
    updateContestData(() => exampleData);
    await clearDB();
    await saveConfigToDB(exampleData);
    showToast(t('messages:exampleLoaded'));
  };

  const handleImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const { data, images } = importConfig(text);

        // Revoke old blob URLs
        for (const img of contestData.images) {
          URL.revokeObjectURL(img.url);
        }

        // Create blob URLs for imported images and save to DB
        const imageList: ImageData[] = [];
        for (const imgMeta of data.images || []) {
          const blob = images.get(imgMeta.uuid);
          if (blob) {
            const url = URL.createObjectURL(blob);
            imageList.push({ uuid: imgMeta.uuid, name: imgMeta.name, url });
            await saveImageToDB(imgMeta.uuid, blob);
          }
        }

        const problemsWithKeys = data.problems.map((problem) => ({
          ...problem,
          key: problem.key || crypto.randomUUID(),
        }));

        const contestWithImages: ContestWithImages = {
          meta: data.meta,
          problems: problemsWithKeys,
          images: imageList,
        };

        // Register images with compiler first to avoid race condition
        await registerImages(imageList);

        updateContestData(() => contestWithImages);
        await saveConfigToDB(contestWithImages);
        showToast(t('messages:configImportSuccess'));
      } catch (err) {
        showToast(t('messages:importFailed') + ': ' + (err instanceof Error ? err.message : String(err)), 'error');
      }
    };
    input.click();
  };

  const handleImportPolygonPackage = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".zip";
    // @ts-ignore - webkitdirectory is not in the type definition
    input.webkitdirectory = false;
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        // Revoke old blob URLs
        for (const img of contestData.images) {
          URL.revokeObjectURL(img.url);
        }

        const data = await loadPolygonPackage([file]);

        const problemsWithKeys = data.problems.map((problem) => ({
          ...problem,
          key: problem.key || crypto.randomUUID(),
        }));

        const contestWithImages: ContestWithImages = {
          ...data,
          problems: problemsWithKeys,
          images: []
        };
        updateContestData(() => contestWithImages);
        await saveConfigToDB(contestWithImages);
        showToast(t('messages:polygonImportSuccess'), 'success');
      } catch (err) {
        showToast(t('messages:importFailed') + ': ' + (err instanceof Error ? err.message : String(err)), 'error');
      }
    };
    input.click();
  };

  const handleExport = async () => {
    try {
      const json = await exportConfig(contestData);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${contestData.meta.title || "contest"}-config.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast(t('messages:configExportSuccess'));
    } catch (err) {
      showToast(t('messages:exportFailed') + ': ' + (err instanceof Error ? err.message : String(err)), 'error');
    }
  };

  const handleExportPdf = async () => {
    if (exportDisabled) return;
    setExportDisabled(true);
    try {
      const pdf = await compileToPdf(contestData);
      if (!pdf) throw new Error(t('messages:compilationError'));

      const blob = new Blob([new Uint8Array(pdf)], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${contestData.meta.title || "statement"}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      showToast(t('messages:pdfExportFailed') + ': ' + (err instanceof Error ? err.message : String(err)), 'error');
    }
    setExportDisabled(false);
  };

  return (
    <div className="contest-editor flex flex-col h-full">
      {/* Top Toolbar */}
      <div className="editor-toolbar">
        <div className="editor-toolbar-left custom-scroll">
          {/* Group A: Config/Data */}
          <div className="dropdown">
            <button tabIndex={0} className="btn-ghost whitespace-nowrap toolbar-action-btn">
              <span className="toolbar-btn-label">{t('common:loadExample')}</span>
              <FontAwesomeIcon icon={faChevronDown} className="ml-1 text-[10px]" />
            </button>
            <ul tabIndex={0} className="dropdown-content menu p-2 shadow-lg bg-white rounded-lg w-52 border border-gray-200">
              {Object.keys(exampleStatements).map((k) => (
                <li key={k}><a onClick={() => handleLoadExample(k)} className="text-sm">{k}</a></li>
              ))}
            </ul>
          </div>
          <button className="btn-ghost whitespace-nowrap toolbar-action-btn" onClick={handleImportPolygonPackage}>
            <FontAwesomeIcon icon={faFolderOpen} className="mr-1.5 text-sm" />
            <span className="toolbar-btn-label toolbar-btn-label-optional">{t('common:importPolygonPackage')}</span>
          </button>
          <button className="btn-ghost whitespace-nowrap toolbar-action-btn" onClick={handleImport}>
            <FontAwesomeIcon icon={faFileImport} className="mr-1.5 text-sm" />
            <span className="toolbar-btn-label toolbar-btn-label-optional">{t('common:importConfig')}</span>
          </button>
          <button className="btn-ghost whitespace-nowrap toolbar-action-btn" onClick={handleExport}>
            <FontAwesomeIcon icon={faFileExport} className="mr-1.5 text-sm" />
            <span className="toolbar-btn-label toolbar-btn-label-optional">{t('common:exportConfig')}</span>
          </button>
        </div>

        {/* Group B: View/Main Action */}
        <div className="editor-toolbar-right">
          {previewFullscreen && (
            <div className="toolbar-pill">
              <button
                className="toolbar-icon-btn"
                onClick={() => setPreviewZoom(Math.max(50, previewZoom - 10))}
                title="Zoom Out"
                aria-label="Zoom Out"
              >
                <FontAwesomeIcon icon={faMagnifyingGlassMinus} className="text-sm" />
              </button>
              <span className="toolbar-zoom-value">{previewZoom}%</span>
              <button
                className="toolbar-icon-btn"
                onClick={() => setPreviewZoom(Math.min(200, previewZoom + 10))}
                title="Zoom In"
                aria-label="Zoom In"
              >
                <FontAwesomeIcon icon={faMagnifyingGlassPlus} className="text-sm" />
              </button>
            </div>
          )}

          <button
            className="btn-ghost whitespace-nowrap toolbar-fullscreen-btn toolbar-action-btn"
            onClick={() => setPreviewFullscreen(!previewFullscreen)}
            title={previewFullscreen ? t('common:exitFullscreen') : t('common:fullscreen')}
          >
            <FontAwesomeIcon icon={previewFullscreen ? faCompress : faExpand} className="mr-1.5 text-sm" />
            <span className="toolbar-fullscreen-label">
              {previewFullscreen ? t('common:exitFullscreen') : t('common:fullscreen')}
            </span>
          </button>

          <div className="toolbar-pager" role="group" aria-label={t('common:page')}>
            <button
              className="toolbar-pager-btn"
              onClick={handlePrevPage}
              disabled={previewPageInfo.currentPage <= 1}
              title="Previous Page"
              aria-label="Previous Page"
            >
              <FontAwesomeIcon icon={faChevronLeft} className="text-[11px]" />
            </button>
            <div className="toolbar-pager-center">
              <input
                type="number"
                min={1}
                max={totalPages}
                className="toolbar-page-current-input"
                value={previewPageInput}
                onChange={(e) => setPreviewPageInput(e.target.value)}
                onFocus={() => setIsPageInputFocused(true)}
                onBlur={() => {
                  setIsPageInputFocused(false);
                  if (previewPageInput.trim() === "") {
                    setPreviewPageInput(String(previewPageInfo.currentPage));
                    return;
                  }
                  handleJumpToPage();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleJumpToPage();
                    (e.currentTarget as HTMLInputElement).blur();
                  }
                }}
                aria-label={t('common:goToPage')}
              />
              <span className="toolbar-page-separator">/</span>
              <span className="toolbar-page-total">{totalPages}</span>
            </div>
            <button
              className="toolbar-pager-btn"
              onClick={handleNextPage}
              disabled={previewPageInfo.currentPage >= totalPages}
              title="Next Page"
              aria-label="Next Page"
            >
              <FontAwesomeIcon icon={faChevronRight} className="text-[11px]" />
            </button>
          </div>

          <div className="toolbar-section-divider" aria-hidden="true"></div>

          <button
            className="btn-primary toolbar-primary-btn shadow-sm"
            onClick={handleExportPdf}
            disabled={exportDisabled}
          >
            <FontAwesomeIcon icon={faFileArrowDown} className="mr-1.5 text-sm" />
            <span className="toolbar-primary-label">{t('common:exportPdf')}</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      {previewFullscreen ? (
        <div className="flex-1 custom-scroll overflow-y-auto" style={{ backgroundColor: '#F3F4F6', padding: '24px' }}>
          <div className="a4-paper min-h-[297mm] p-8 transition-transform duration-200" style={{ transform: `scale(${previewZoom / 100})`, transformOrigin: 'top center' }}>
            <Preview ref={previewRef} data={contestData} onPageInfoChange={handlePreviewPageInfoChange} />
          </div>
        </div>
      ) : (
        <Allotment className="flex-1">
          <Allotment.Pane minSize={300}>
            <div className="custom-scroll h-full overflow-y-auto p-4 border-r border-gray-200 bg-white">
              <ConfigPanel contestData={contestData} updateContestData={updateContestData} />
            </div>
          </Allotment.Pane>
          <Allotment.Pane>
            <div className="custom-scroll h-full overflow-y-auto" style={{ backgroundColor: '#F3F4F6', padding: '24px' }}>
              <div className="a4-paper min-h-[297mm] p-8 transition-transform duration-200" style={{ transform: `scale(${previewZoom / 100})`, transformOrigin: 'top center' }}>
                <Preview ref={previewRef} data={contestData} onPageInfoChange={handlePreviewPageInfoChange} />
              </div>
            </div>
          </Allotment.Pane>
        </Allotment>
      )}

      {/* Custom Modal */}
      {showConfirmModal && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">{confirmModalContent.title}</h3>
            <p className="py-4">{confirmModalContent.content}</p>
            <div className="modal-action">
              <button className="btn btn-ghost" onClick={() => { setShowConfirmModal(false); pendingAction?.(); }}>
                {t('common:cancel')}
              </button>
              <button className="btn btn-primary" onClick={() => { setShowConfirmModal(false); pendingAction?.(); }}>
                {t('common:continue')}
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setShowConfirmModal(false)}></div>
        </div>
      )}
    </div>
  );
};

const ContestEditorWithPromise: FC<{ promise: Promise<ContestWithImages> }> = ({ promise }) => {
  const initialData = use(promise);
  return <ContestEditorImpl initialData={initialData} />;
};

const ContestEditor: FC = () => {
  const initialPromise = useMemo(() =>
    loadConfigFromDB()
      .then(async (stored) => {
        if (!stored) {
          const problemsWithKeys = exampleStatements["English Example"].problems.map((problem) => ({
            ...problem,
            key: problem.key || crypto.randomUUID(),
          }));
          return {
            ...exampleStatements["English Example"],
            problems: problemsWithKeys,
            images: []
          } as ContestWithImages;
        }

        // Create blob URLs for loaded images
        const imageList: ImageData[] = [];
        for (const imgMeta of stored.data.images || []) {
          const blob = stored.images.get(imgMeta.uuid);
          if (blob) {
            const url = URL.createObjectURL(blob);
            imageList.push({ uuid: imgMeta.uuid, name: imgMeta.name, url });
          }
        }

        const problemsWithKeys = stored.data.problems.map((problem) => ({
          ...problem,
          key: problem.key || crypto.randomUUID(),
        }));

        const contestWithImages = {
          meta: stored.data.meta,
          problems: problemsWithKeys,
          images: imageList,
        } as ContestWithImages;

        // Register images with compiler first to avoid race condition
        await registerImages(imageList);

        return contestWithImages;
      })
      .catch(() => {
        const problemsWithKeys = exampleStatements["English Example"].problems.map((problem) => ({
          ...problem,
          key: problem.key || crypto.randomUUID(),
        }));
        return {
          ...exampleStatements["English Example"],
          problems: problemsWithKeys,
          images: []
        } as ContestWithImages;
      }),
    []
  );

  return (
    <Suspense fallback={<div className="contest-editor loading"><LoadingFallback /></div>}>
      <ContestEditorWithPromise promise={initialPromise} />
    </Suspense>
  );
};

const LoadingFallback = () => {
  const { t } = useTranslation();
  return <>{t('common:loading')}</>;
};

export default ContestEditor;
