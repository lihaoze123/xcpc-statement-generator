import { type FC, useEffect, useState, useMemo, Suspense, use, useRef, useCallback } from "react";
import { useImmer } from "use-immer";
import { debounce } from "lodash";
import { useTranslation } from "react-i18next";
import { Allotment } from "allotment";
import "allotment/dist/style.css";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { arrayMove } from "@dnd-kit/sortable";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFileCode, faLanguage, faUpload, faFileZipper, faX, faImages, faChevronDown } from "@fortawesome/free-solid-svg-icons";

import type { ContestWithImages, ImageData } from "@/types/contest";
import { exampleStatements } from "./exampleStatements";
import { compileToPdf, typstInitPromise, registerImages } from "@/compiler";
import { saveConfigToDB, loadConfigFromDB, exportConfig, importConfig, clearDB, saveImageToDB } from "@/utils/indexedDBUtils";
import { loadPolygonPackage } from "@/utils/polygonConverter";
import { useToast } from "@/components/ToastProvider";
import { type PreviewHandle } from "./Preview";

import Sidebar from "./Sidebar";
import EditorArea from "./EditorArea";
import PreviewArea from "./PreviewArea";

import "./index.css";

const ContestEditorImpl: FC<{ initialData: ContestWithImages }> = ({ initialData }) => {
  const [contestData, updateContestData] = useImmer<ContestWithImages>(initialData);
  const [activeId, setActiveId] = useState<string>('config');
  const [exportDisabled, setExportDisabled] = useState(true);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [confirmModalContent, setConfirmModalContent] = useState({ title: '', content: '' });
  const [previewFullscreen, setPreviewFullscreen] = useState(false);
  const previewRef = useRef<PreviewHandle>(null);
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();

  // DND sensors - prevent accidental drags
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

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

  // Toggle language
  const toggleLanguage = useCallback(() => {
    const newLang = i18n.language === "zh" ? "en" : "zh";
    i18n.changeLanguage(newLang);
    localStorage.setItem("language", newLang);
  }, [i18n]);

  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = contestData.problems.findIndex((p) => p.key === active.id);
    const newIndex = contestData.problems.findIndex((p) => p.key === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      updateContestData((draft) => {
        draft.problems = arrayMove(draft.problems, oldIndex, newIndex);
      });
    }
  };

  // Handle add problem
  const handleAddProblem = useCallback(() => {
    const newKey = crypto.randomUUID();
    updateContestData((draft) => {
      draft.problems.push({
        key: newKey,
        problem: { display_name: "New Problem", samples: [{ input: "", output: "" }] },
        statement: { description: "", input: "", output: "", notes: "" },
      });
    });
    setActiveId(newKey);
  }, []);

  // Handle delete problem
  const handleDeleteProblem = useCallback((key: string) => {
    setConfirmModalContent({
      title: t('messages:deleteProblemConfirm.title'),
      content: t('messages:deleteProblemConfirm.content'),
    });

    setPendingAction(() => {
      updateContestData((draft) => {
        const idx = draft.problems.findIndex((p) => p.key === key);
        if (idx !== -1) draft.problems.splice(idx, 1);
      });
      if (activeId === key) setActiveId('config');
    });
    setShowConfirmModal(true);
  }, [activeId, t]);

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
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd} modifiers={[restrictToVerticalAxis]}>
      <div className="flex h-full w-full bg-white overflow-hidden">
        {/* Left Sidebar */}
        <div className="w-12 flex-shrink-0 border-r border-gray-200 bg-white z-10">
          <Sidebar
            contestData={contestData}
            activeId={activeId}
            setActiveId={setActiveId}
            onAddProblem={handleAddProblem}
            onDeleteProblem={handleDeleteProblem}
            onExportPdf={handleExportPdf}
            exportDisabled={exportDisabled}
            onOpenSettings={() => setShowSettings(true)}
            onOpenImages={() => setActiveId('images')}
          />
        </div>

        {/* Main Content: Editor + Preview */}
        <div className="flex-1 h-full min-w-0">
          <Allotment>
            {/* Editor Area */}
            <Allotment.Pane minSize={350} preferredSize="40%">
              <EditorArea
                contestData={contestData}
                updateContestData={updateContestData}
                activeId={activeId}
                onDeleteProblem={handleDeleteProblem}
              />
            </Allotment.Pane>

            {/* Preview Area */}
            <Allotment.Pane minSize={400}>
              <PreviewArea
                data={contestData}
                previewRef={previewRef}
                isFullscreen={previewFullscreen}
                setFullscreen={setPreviewFullscreen}
              />
            </Allotment.Pane>
          </Allotment>
        </div>

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

        {/* Settings Modal */}
        {showSettings && (
          <div className="modal modal-open">
            <div className="modal-box max-w-md">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-xl">{t('common:settings')}</h3>
                <button className="btn btn-sm btn-ghost" onClick={() => setShowSettings(false)}>
                  <FontAwesomeIcon icon={faX} />
                </button>
              </div>
              <div className="flex flex-col gap-4">
                {/* Language Toggle */}
                <button className="btn btn-outline btn-lg justify-start gap-4 h-14" onClick={() => { setShowSettings(false); toggleLanguage(); }}>
                  <FontAwesomeIcon icon={faLanguage} className="text-xl w-6" />
                  <span className="text-base">{i18n.language === "zh" ? "切换到英文" : "Switch to 中文"}</span>
                </button>

                {/* Image Management */}
                <button className="btn btn-outline btn-lg justify-start gap-4 h-14" onClick={() => { setShowSettings(false); setActiveId('images'); }}>
                  <FontAwesomeIcon icon={faImages} className="text-xl w-6" />
                  <span className="text-base">{t('editor:imageManagement')}</span>
                </button>

                {/* Load Example - Dropdown */}
                <div className="dropdown dropdown-bottom w-full">
                  <label tabIndex={0} className="btn btn-outline btn-lg justify-start gap-4 h-14 w-full">
                    <FontAwesomeIcon icon={faChevronDown} className="text-xl w-6" />
                    <span className="text-base">{t('common:loadExample')}</span>
                  </label>
                  <ul tabIndex={0} className="dropdown-content menu p-2 shadow-xl bg-base-100 rounded-box w-full border border-base-300 mt-2">
                    {Object.keys(exampleStatements).map((key) => (
                      <li key={key}>
                        <a onClick={() => { setShowSettings(false); handleLoadExample(key); }} className="text-base">
                          {key}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="divider my-1">导入 / 导出</div>

                {/* Import Polygon */}
                <button className="btn btn-outline btn-lg justify-start gap-4 h-14" onClick={() => { setShowSettings(false); handleImportPolygonPackage(); }}>
                  <FontAwesomeIcon icon={faFileZipper} className="text-xl w-6" />
                  <span className="text-base">{t('common:importPolygonPackage')}</span>
                </button>

                {/* Import Config */}
                <button className="btn btn-outline btn-lg justify-start gap-4 h-14" onClick={() => { setShowSettings(false); handleImport(); }}>
                  <FontAwesomeIcon icon={faUpload} className="text-xl w-6" />
                  <span className="text-base">{t('common:importConfig')}</span>
                </button>

                {/* Export Config */}
                <button className="btn btn-outline btn-lg justify-start gap-4 h-14" onClick={() => { setShowSettings(false); handleExport(); }}>
                  <FontAwesomeIcon icon={faFileCode} className="text-xl w-6" />
                  <span className="text-base">{t('common:exportConfig')}</span>
                </button>
              </div>
            </div>
            <div className="modal-backdrop" onClick={() => setShowSettings(false)}></div>
          </div>
        )}
      </div>
    </DndContext>
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
