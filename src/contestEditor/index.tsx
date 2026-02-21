import { type FC, useEffect, useState, useMemo, Suspense, use, useRef, useCallback } from "react";
import { useImmer } from "use-immer";
import { debounce } from "lodash";
import { useTranslation } from "react-i18next";
import { Allotment } from "allotment";
import "allotment/dist/style.css";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFileCode, faLanguage, faUpload, faFileZipper, faX, faImages, faChevronDown, faArrowsDownToLine, faHistory, faCloud } from "@fortawesome/free-solid-svg-icons";

import type { ContestWithImages, ImageData } from "@/types/contest";
import { exampleStatements } from "./exampleStatements";
import { compileToPdf, compileProblemToPdf, typstInitPromise, registerImages } from "@/compiler";
import { saveConfigToDB, loadConfigFromDB, exportConfig, importConfig, clearDB, saveImageToDB } from "@/utils/indexedDBUtils";
import { loadPolygonPackage } from "@/utils/polygonConverter";
import { uploadToOnline, downloadFromOnline } from "@/utils/onlineSync";
import { getAllVersions, getAllBranches } from "@/utils/versionControl";
import { useToast } from "@/components/ToastProvider";
import VersionManager from "@/components/VersionManager";
import OnlineManager from "@/components/OnlineManager";
import ProblemMergeDialog from "@/components/ProblemMergeDialog";
import { type PreviewHandle } from "./Preview";

import Sidebar from "./Sidebar";
import EditorArea from "./EditorArea";
import PreviewArea from "./PreviewArea";
import MobileToolbar from "./MobileToolbar";
import MobileTabBar from "./MobileTabBar";
import TemplateEditor from "./TemplateEditor";
import { useMediaQuery } from "@/hooks/useMediaQuery";

import "./index.css";

const SortableReorderItem: FC<{ problem: ContestWithImages['problems'][0]; index: number }> = ({ problem, index }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: problem.key! });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-grab active:cursor-grabbing"
    >
      <span className="w-6 h-6 flex items-center justify-center bg-white rounded border text-sm font-medium">
        {String.fromCharCode(65 + index)}
      </span>
      <span className="flex-1 truncate">{problem.problem.display_name}</span>
    </div>
  );
};

const ContestEditorImpl: FC<{ initialData: ContestWithImages }> = ({ initialData }) => {
  const [contestData, updateContestData] = useImmer<ContestWithImages>(initialData);
  const [activeId, setActiveId] = useState<string>('config');
  const [exportDisabled, setExportDisabled] = useState(true);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showVersionManager, setShowVersionManager] = useState(false);
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [showReorder, setShowReorder] = useState(false);
  const [showOnlineManager, setShowOnlineManager] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [confirmModalContent, setConfirmModalContent] = useState({ title: '', content: '' });
  const [previewFullscreen, setPreviewFullscreen] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(true);
  const [vimMode, setVimMode] = useState(() => {
    const saved = localStorage.getItem("vimMode");
    return saved ? saved === "true" : false;
  });
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'pending' | 'disabled'>(() => {
    try {
      const savedSettings = localStorage.getItem("onlineSyncSettings");
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        if (parsed.enabled && parsed.config) {
          return 'pending';
        }
      }
    } catch {
      // ignore
    }
    return 'disabled';
  });
  const [lastSyncTime, setLastSyncTime] = useState<number>();
  const lastSyncDataRef = useRef<string>('');
  const autoSyncInFlightRef = useRef(false);
  const previewRef = useRef<PreviewHandle>(null);
  const isInitialLoadRef = useRef(true);
  const [showProblemMergePrompt, setShowProblemMergePrompt] = useState(false);
  const [problemMergeConflicts, setProblemMergeConflicts] = useState<Array<{
    index: number;
    local?: ContestWithImages['problems'][0];
    cloud?: ContestWithImages['problems'][0];
  }>>([]);
  const [selectedProblemChoices, setSelectedProblemChoices] = useState<Record<number, "local" | "cloud">>({});
  const [rememberCurrentChoices, setRememberCurrentChoices] = useState<Record<number, boolean>>({});
  const [rememberedMergeChoices, setRememberedMergeChoices] = useState<Record<number, "local" | "cloud">>({});
  const problemMergeResolverRef = useRef<((result: { choices: Record<number, "local" | "cloud"> } | null) => void) | null>(null);

  const getProblemDetail = (problem?: ContestWithImages['problems'][0]) => {
    if (!problem) return null;
    return {
      title: problem.problem.display_name,
      format: problem.problem.format || "latex",
      samples: problem.problem.samples?.length ?? 0,
      description: problem.statement.description || "",
      input: problem.statement.input || "",
      output: problem.statement.output || "",
      notes: problem.statement.notes || "",
    };
  };

  const requestProblemMerge = (
    conflicts: Array<{
      index: number;
      local?: ContestWithImages['problems'][0];
      cloud?: ContestWithImages['problems'][0];
    }>,
    defaultChoices: Record<number, "local" | "cloud">
  ) =>
    new Promise<{ choices: Record<number, "local" | "cloud"> } | null>((resolve) => {
      setProblemMergeConflicts(conflicts);
      const initialChoices: Record<number, "local" | "cloud"> = {};
      for (const conflict of conflicts) {
        if (defaultChoices[conflict.index] !== undefined) {
          initialChoices[conflict.index] = defaultChoices[conflict.index];
        } else if (rememberedMergeChoices[conflict.index] !== undefined) {
          initialChoices[conflict.index] = rememberedMergeChoices[conflict.index];
        }
      }
      setSelectedProblemChoices(initialChoices);
      setRememberCurrentChoices({});
      problemMergeResolverRef.current = resolve;
      setShowProblemMergePrompt(true);
    });

  // Responsive layout
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [mobileTab, setMobileTab] = useState<'editor' | 'preview'>('editor');
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

  // Memoize serialized contest data for change detection
  const contestDataStr = useMemo(() => JSON.stringify({
    meta: contestData.meta,
    problems: contestData.problems,
  }), [contestData.meta, contestData.problems]);

  useEffect(() => { debouncedSave(contestData); }, [contestData, debouncedSave]);
  useEffect(() => {
    registerImages(contestData.images).catch((e) =>
      console.error("Failed to register images:", e)
    );
  }, [contestData.images]);

  const refreshSyncSettings = useCallback(() => {
    const savedSettings = localStorage.getItem("onlineSyncSettings");
    if (savedSettings) {
      const parsed = JSON.parse(savedSettings);
      if (parsed.enabled && parsed.config) {
        setLastSyncTime(parsed.lastSyncTime);
        if (isInitialLoadRef.current) {
          setSyncStatus('pending');
        } else if (parsed.lastSyncTime && lastSyncDataRef.current) {
          setSyncStatus('synced');
        } else {
          setSyncStatus('pending');
        }
        return;
      }
    }
    setSyncStatus('disabled');
  }, []);

  // Load sync settings on mount and when OnlineManager closes
  useEffect(() => {
    refreshSyncSettings();
  }, [refreshSyncSettings]);

  useEffect(() => {
    if (!showOnlineManager) {
      refreshSyncSettings();
    }
  }, [showOnlineManager, refreshSyncSettings]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "onlineSyncSettings") {
        refreshSyncSettings();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [refreshSyncSettings]);

  // Track changes to contest data and update sync status
  useEffect(() => {
    if (lastSyncDataRef.current && contestDataStr !== lastSyncDataRef.current) {
      if (syncStatus === 'synced') {
        setSyncStatus('pending');
      }
    }
  }, [contestDataStr, syncStatus]);

  const autoSync = useMemo(() =>
    debounce(async (data: ContestWithImages, dataStr?: string) => {
      if (!dataStr || dataStr === lastSyncDataRef.current) return;
      const savedSettings = localStorage.getItem("onlineSyncSettings");
      if (!savedSettings) return;
      const parsed = JSON.parse(savedSettings);
      if (!parsed.enabled || !parsed.config || !parsed.autoSync) return;
      if (autoSyncInFlightRef.current) return;

      autoSyncInFlightRef.current = true;
      setSyncStatus('syncing');
      try {
        const versions = await getAllVersions();
        const branches = await getAllBranches();

        const images = new Map<string, Blob>();
        for (const img of data.images) {
          const response = await fetch(img.url);
          const blob = await response.blob();
          images.set(img.uuid, blob);
        }

        await uploadToOnline(parsed.config, data.meta.title, {
          contest: {
            meta: data.meta,
            problems: data.problems,
            images: data.images.map((img) => ({ uuid: img.uuid, name: img.name })),
            template: data.template,
          },
          images,
          versions,
          branches,
        });

        const syncedAt = Date.now();
        const newSettings = {
          ...parsed,
          lastSyncTime: syncedAt,
        };
        localStorage.setItem("onlineSyncSettings", JSON.stringify(newSettings));
        setLastSyncTime(syncedAt);
        setSyncStatus('synced');
        lastSyncDataRef.current = dataStr;
      } catch (e) {
        console.error("Auto-sync failed:", e);
        setSyncStatus('pending');
      } finally {
        autoSyncInFlightRef.current = false;
      }
    }, 800),
    []
  );

  useEffect(() => {
    // 首次加载时不自动同步，只记录当前状态
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false;
      return;
    }
    
    // 后续变化才触发自动同步
    autoSync(contestData, contestDataStr);
  }, [contestData, contestDataStr, autoSync]);

  const handleManualSync = useCallback(async () => {
    const savedSettings = localStorage.getItem("onlineSyncSettings");
    if (!savedSettings) {
      showToast(t("online:error.no_config"), "error");
      setShowOnlineManager(true);
      return;
    }
    const parsed = JSON.parse(savedSettings);
    if (!parsed.enabled || !parsed.config) {
      showToast(t("online:error.no_config"), "error");
      setShowOnlineManager(true);
      return;
    }
    if (autoSyncInFlightRef.current) return;

    const stripProblemKey = (problem: ContestWithImages['problems'][0]) => {
      const { key, ...rest } = problem;
      return rest;
    };

    const areProblemsEqual = (
      localProblem?: ContestWithImages['problems'][0],
      cloudProblem?: ContestWithImages['problems'][0]
    ) => {
      if (!localProblem && !cloudProblem) return true;
      if (!localProblem || !cloudProblem) return false;
      return JSON.stringify(stripProblemKey(localProblem)) === JSON.stringify(cloudProblem);
    };

    try {
      const cloudData = await downloadFromOnline(parsed.config, contestData.meta.title);
      const localProblems = contestData.problems;
      const cloudProblems = cloudData?.contest?.problems || [];
      const maxCount = Math.max(localProblems.length, cloudProblems.length);

      let problemsForUpload = localProblems;
      if (cloudProblems.length > 0) {
        const conflicts: Array<{
          index: number;
          local?: ContestWithImages['problems'][0];
          cloud?: ContestWithImages['problems'][0];
        }> = [];
        const defaultChoices: Record<number, "local" | "cloud"> = {};

        for (let i = 0; i < maxCount; i += 1) {
          const localProblem = localProblems[i];
          const cloudProblem = cloudProblems[i];
          if (!areProblemsEqual(localProblem, cloudProblem)) {
            conflicts.push({ index: i, local: localProblem, cloud: cloudProblem });
          }
        }

        if (conflicts.length > 0) {
          // 显示所有冲突，已记住的会预填充选择
          for (const c of conflicts) {
            if (rememberedMergeChoices[c.index] !== undefined) {
              defaultChoices[c.index] = rememberedMergeChoices[c.index];
            }
          }

          let mergeChoices: Record<number, "local" | "cloud"> = { ...defaultChoices };

          const mergeResult = await requestProblemMerge(conflicts, defaultChoices);
          if (!mergeResult) {
            return;
          }
          mergeChoices = { ...mergeChoices, ...mergeResult.choices };

          const merged: ContestWithImages['problems'] = [];
          for (let i = 0; i < maxCount; i += 1) {
            const localProblem = localProblems[i];
            const cloudProblem = cloudProblems[i];
            const choice = mergeChoices[i];
            if (choice === "cloud") {
              if (cloudProblem) merged.push(cloudProblem as ContestWithImages['problems'][0]);
            } else {
              if (localProblem) merged.push(localProblem);
            }
          }
          problemsForUpload = merged;
          // 更新本地 contestData
          updateContestData((draft) => {
            draft.problems = problemsForUpload;
          });
        }
      }

      autoSyncInFlightRef.current = true;
      setSyncStatus('syncing');
      const versions = await getAllVersions();
      const branches = await getAllBranches();

      const images = new Map<string, Blob>();
      for (const img of contestData.images) {
        const response = await fetch(img.url);
        const blob = await response.blob();
        images.set(img.uuid, blob);
      }

      await uploadToOnline(parsed.config, contestData.meta.title, {
        contest: {
          meta: contestData.meta,
          problems: problemsForUpload.map(({ key, ...rest }) => rest),
          images: contestData.images.map((img) => ({ uuid: img.uuid, name: img.name })),
          template: contestData.template,
        },
        images,
        versions,
        branches,
      });

      const syncedAt = Date.now();
      const newSettings = {
        ...parsed,
        lastSyncTime: syncedAt,
      };
      localStorage.setItem("onlineSyncSettings", JSON.stringify(newSettings));
      setLastSyncTime(syncedAt);
      setSyncStatus('synced');
      lastSyncDataRef.current = contestDataStr;
      showToast(t("online:upload_success"), "success");
    } catch (e) {
      console.error("Manual sync failed:", e);
      setSyncStatus('pending');
      showToast(t("online:upload_failed"), "error");
    } finally {
      autoSyncInFlightRef.current = false;
    }
  }, [contestData, contestDataStr, rememberedMergeChoices, showToast, t]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isSave = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s";
      if (!isSave) return;
      e.preventDefault();
      handleManualSync();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleManualSync]);

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

    setPendingAction(() => () => {
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

  const previewData = useMemo<ContestWithImages>(() => {
    const problemIndex = contestData.problems.findIndex((p) => p.key === activeId);
    if (problemIndex === -1) return contestData;

    const selectedProblem = contestData.problems[problemIndex];
    return {
      ...contestData,
      meta: {
        ...contestData.meta,
        enable_titlepage: false,
        enable_problem_list: false,
        enable_header_footer: false,
      },
      problems: [{ ...selectedProblem }],
    };
  }, [contestData, activeId]);

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd} modifiers={[restrictToVerticalAxis]}>
      {isDesktop ? (
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
              onExportProblem={(key) => {
                const problem = contestData.problems.find(p => p.key === key);
                if (!problem) return;

                compileProblemToPdf(contestData, key)
                  .then(pdf => {
                    const blob = new Blob([new Uint8Array(pdf)], { type: "application/pdf" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    const index = contestData.problems.findIndex(p => p.key === key);
                    const letter = String.fromCharCode(65 + index);
                    a.download = `${contestData.meta.title || "contest"}-${letter}.pdf`;
                    a.click();
                    URL.revokeObjectURL(url);
                    showToast(t('editor:exportSuccess'), 'success');
                  })
                  .catch(err => {
                    showToast(t('editor:exportFailed') + ': ' + (err instanceof Error ? err.message : String(err)), 'error');
                  });
              }}
              exportDisabled={exportDisabled}
              onOpenSettings={() => setShowSettings(true)}
              onOpenImages={() => setActiveId('images')}
              onOpenVersionManager={() => setShowVersionManager(true)}
              onOpenTemplate={() => setShowTemplateEditor(true)}
              previewVisible={previewVisible}
              onTogglePreview={() => setPreviewVisible(!previewVisible)}
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
                  onExportCurrentProblem={() => {
                    if (!activeId || activeId === 'config' || activeId === 'images') return;

                    compileProblemToPdf(contestData, activeId)
                      .then(pdf => {
                        const blob = new Blob([new Uint8Array(pdf)], { type: "application/pdf" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        const index = contestData.problems.findIndex(p => p.key === activeId);
                        const letter = String.fromCharCode(65 + index);
                        a.download = `${contestData.meta.title || "contest"}-${letter}.pdf`;
                        a.click();
                        URL.revokeObjectURL(url);
                        showToast(t('editor:exportSuccess'), 'success');
                      })
                      .catch(err => {
                        showToast(t('editor:exportFailed') + ': ' + (err instanceof Error ? err.message : String(err)), 'error');
                      });
                  }}
                  vimMode={vimMode}
                  syncStatus={syncStatus}
                  lastSyncTime={lastSyncTime}
                  onSyncStatusClick={handleManualSync}
                />
              </Allotment.Pane>

              {/* Preview Area */}
              {previewVisible && (
                <Allotment.Pane minSize={400}>
                  <PreviewArea
                    data={previewData}
                    previewRef={previewRef}
                    isFullscreen={previewFullscreen}
                    setFullscreen={setPreviewFullscreen}
                  />
                </Allotment.Pane>
              )}
            </Allotment>
          </div>

          {/* Custom Modal */}
          {showConfirmModal && (
            <div className="modal modal-open">
              <div className="modal-box">
                <h3 className="font-bold text-lg">{confirmModalContent.title}</h3>
                <p className="py-4">{confirmModalContent.content}</p>
                <div className="modal-action">
                  <button className="btn btn-ghost" onClick={() => { setShowConfirmModal(false); setPendingAction(null); }}>
                    {t('common:cancel')}
                  </button>
                  <button className="btn btn-primary" onClick={() => { setShowConfirmModal(false); pendingAction?.(); setPendingAction(null); }}>
                    {t('common:continue')}
                  </button>
                </div>
              </div>
              <div className="modal-backdrop" onClick={() => setShowConfirmModal(false)}></div>
            </div>
          )}

          <ProblemMergeDialog
            isOpen={showProblemMergePrompt}
            conflicts={problemMergeConflicts}
            selectedChoices={selectedProblemChoices}
            rememberChoices={rememberCurrentChoices}
            onSelectedChoicesChange={setSelectedProblemChoices}
            onRememberChoicesChange={setRememberCurrentChoices}
            onConfirm={(choices) => {
              setShowProblemMergePrompt(false);
              problemMergeResolverRef.current?.({ choices });
              problemMergeResolverRef.current = null;
            }}
            onCancel={() => {
              setShowProblemMergePrompt(false);
              problemMergeResolverRef.current?.(null);
              problemMergeResolverRef.current = null;
            }}
            onRemembered={setRememberedMergeChoices}
            getProblemDetail={getProblemDetail}
          />

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

                  {/* Vim Mode Toggle */}
                  <button
                    className={`btn btn-outline btn-lg justify-start gap-4 h-14 ${vimMode ? 'border-[#1D71B7] text-[#1D71B7]' : ''}`}
                    onClick={() => {
                      const newValue = !vimMode;
                      setVimMode(newValue);
                      localStorage.setItem("vimMode", String(newValue));
                    }}
                  >
                    <span className="text-base">{vimMode ? 'Vim 模式 (已开启)' : 'Vim 模式'}</span>
                  </button>

                  {/* Image Management */}
                  <button className="btn btn-outline btn-lg justify-start gap-4 h-14" onClick={() => { setShowSettings(false); setActiveId('images'); }}>
                    <FontAwesomeIcon icon={faImages} className="text-xl w-6" />
                    <span className="text-base">{t('editor:imageManagement')}</span>
                  </button>

                  {/* Reorder Problems */}
                  <button className="btn btn-outline btn-lg justify-start gap-4 h-14" onClick={() => setShowReorder(true)}>
                    <FontAwesomeIcon icon={faArrowsDownToLine} className="text-xl w-6" />
                    <span className="text-base">重排题目</span>
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

                  {/* Version Management */}
                  <button className="btn btn-outline btn-lg justify-start gap-4 h-14" onClick={() => { setShowSettings(false); setShowVersionManager(true); }}>
                    <FontAwesomeIcon icon={faHistory} className="text-xl w-6" />
                    <span className="text-base">{t('messages:versionControl.title')}</span>
                  </button>
                  {/* <div className="divider my-1">云同步</div> */}

                  {/* Online Sync */}
                  <button className="btn btn-outline btn-lg justify-start gap-4 h-14" onClick={() => { setShowSettings(false); setShowOnlineManager(true); }}>
                    <FontAwesomeIcon icon={faCloud} className="text-xl w-6" />
                    <span className="text-base">{t('online:title')}</span>
                  </button>
                </div>
              </div>
              <div className="modal-backdrop" onClick={() => setShowSettings(false)}></div>
            </div>
          )}

          {/* Online Manager Modal */}
          {showOnlineManager && (
            <OnlineManager
              isOpen={showOnlineManager}
              onClose={() => setShowOnlineManager(false)}
              contestData={contestData}
              onDataImported={(data) => {
                updateContestData(() => data);
                setSyncStatus('synced');
                setLastSyncTime(Date.now());
                lastSyncDataRef.current = JSON.stringify({
                  meta: data.meta,
                  problems: data.problems,
                });
              }}
              onSyncComplete={(syncedAt) => {
                setSyncStatus('synced');
                setLastSyncTime(syncedAt);
                lastSyncDataRef.current = contestDataStr;
              }}
            />
          )}

          {/* Template Editor Modal */}
          {showTemplateEditor && (
            <div className="modal modal-open">
              <div className="modal-box max-w-4xl w-full h-[600px] p-4">
                <TemplateEditor
                  template={contestData.template}
                  onSave={(template) => {
                    updateContestData((draft) => { draft.template = template; });
                    setShowTemplateEditor(false);
                    showToast(t('editor:templateEditor') + ' ' + t('common:save'), 'success');
                  }}
                  onClose={() => setShowTemplateEditor(false)}
                />
              </div>
              <div className="modal-backdrop" onClick={() => setShowTemplateEditor(false)}></div>
            </div>
          )}

          {/* Version Manager Modal */}
          {showVersionManager && (
            <VersionManager
              currentContest={contestData}
              onRestore={(contest, _images) => {
                updateContestData(() => contest);
                setShowVersionManager(false);
                showToast(t('messages:versionControl.versionRestored'));
              }}
              onClose={() => setShowVersionManager(false)}
            />
          )}

          {/* Reorder Modal */}
          {showReorder && (
            <div className="modal modal-open">
              <div className="modal-box max-w-sm">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="font-bold text-xl">重排题目</h3>
                  <button className="btn btn-sm btn-ghost" onClick={() => setShowReorder(false)}>
                    <FontAwesomeIcon icon={faX} />
                  </button>
                </div>
                <SortableContext
                  items={contestData.problems.map((p) => p.key!)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto select-none">
                    {contestData.problems.map((problem, index) => (
                      <SortableReorderItem
                        key={problem.key}
                        problem={problem}
                        index={index}
                      />
                    ))}
                  </div>
                </SortableContext>
                <p className="text-sm text-gray-500 mt-4 text-center">拖拽题目以重新排序</p>
              </div>
              <div className="modal-backdrop" onClick={() => setShowReorder(false)}></div>
            </div>
          )}
        </div>
      ) : (
        /* Mobile Layout */
        <div className="flex flex-col h-full w-full bg-white overflow-hidden">
          <MobileToolbar
            contestData={contestData}
            activeId={activeId}
            onSelectProblem={setActiveId}
            onAddProblem={handleAddProblem}
            onOpenSettings={() => setShowSettings(true)}
            onExportPdf={handleExportPdf}
            onExportCurrentProblem={activeId !== 'config' && activeId !== 'images' ? () => {
              if (!activeId) return;
              compileProblemToPdf(contestData, activeId)
                .then(pdf => {
                  const blob = new Blob([new Uint8Array(pdf)], { type: "application/pdf" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  const index = contestData.problems.findIndex(p => p.key === activeId);
                  const letter = String.fromCharCode(65 + index);
                  a.download = `${contestData.meta.title || "contest"}-${letter}.pdf`;
                  a.click();
                  URL.revokeObjectURL(url);
                  showToast(t('editor:exportSuccess'), 'success');
                })
                .catch(err => {
                  showToast(t('editor:exportFailed') + ': ' + (err instanceof Error ? err.message : String(err)), 'error');
                });
            } : undefined}
            exportDisabled={exportDisabled}
          />

          <div className="flex-1 overflow-hidden">
            {mobileTab === 'editor' ? (
              <EditorArea
                contestData={contestData}
                updateContestData={updateContestData}
                activeId={activeId}
                onDeleteProblem={handleDeleteProblem}
                onExportCurrentProblem={undefined}
                vimMode={vimMode}
                syncStatus={syncStatus}
                lastSyncTime={lastSyncTime}
                onSyncStatusClick={handleManualSync}
              />
            ) : (
              <PreviewArea
                data={previewData}
                previewRef={previewRef}
                isFullscreen={previewFullscreen}
                setFullscreen={setPreviewFullscreen}
              />
            )}
          </div>

          <MobileTabBar activeTab={mobileTab} onTabChange={setMobileTab} />

          {/* Custom Modal */}
          {showConfirmModal && (
            <div className="modal modal-open">
              <div className="modal-box">
                <h3 className="font-bold text-lg">{confirmModalContent.title}</h3>
                <p className="py-4">{confirmModalContent.content}</p>
                <div className="modal-action">
                  <button className="btn btn-ghost" onClick={() => { setShowConfirmModal(false); setPendingAction(null); }}>
                    {t('common:cancel')}
                  </button>
                  <button className="btn btn-primary" onClick={() => { setShowConfirmModal(false); pendingAction?.(); setPendingAction(null); }}>
                    {t('common:continue')}
                  </button>
                </div>
              </div>
              <div className="modal-backdrop" onClick={() => setShowConfirmModal(false)}></div>
            </div>
          )}

            <ProblemMergeDialog
              isOpen={showProblemMergePrompt}
              conflicts={problemMergeConflicts}
              selectedChoices={selectedProblemChoices}
              rememberChoices={rememberCurrentChoices}
              onSelectedChoicesChange={setSelectedProblemChoices}
              onRememberChoicesChange={setRememberCurrentChoices}
              onConfirm={(choices) => {
                setShowProblemMergePrompt(false);
                problemMergeResolverRef.current?.({ choices });
                problemMergeResolverRef.current = null;
              }}
              onCancel={() => {
                setShowProblemMergePrompt(false);
                problemMergeResolverRef.current?.(null);
                problemMergeResolverRef.current = null;
              }}
              onRemembered={setRememberedMergeChoices}
              getProblemDetail={getProblemDetail}
            />

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

                  {/* Vim Mode Toggle */}
                  <button
                    className={`btn btn-outline btn-lg justify-start gap-4 h-14 ${vimMode ? 'border-[#1D71B7] text-[#1D71B7]' : ''}`}
                    onClick={() => {
                      const newValue = !vimMode;
                      setVimMode(newValue);
                      localStorage.setItem("vimMode", String(newValue));
                    }}
                  >
                    <span className="text-base">{vimMode ? 'Vim 模式 (已开启)' : 'Vim 模式'}</span>
                  </button>

                  {/* Image Management */}
                  <button className="btn btn-outline btn-lg justify-start gap-4 h-14" onClick={() => { setShowSettings(false); setActiveId('images'); }}>
                    <FontAwesomeIcon icon={faImages} className="text-xl w-6" />
                    <span className="text-base">{t('editor:imageManagement')}</span>
                  </button>

                  {/* Reorder Problems */}
                  <button className="btn btn-outline btn-lg justify-start gap-4 h-14" onClick={() => setShowReorder(true)}>
                    <FontAwesomeIcon icon={faArrowsDownToLine} className="text-xl w-6" />
                    <span className="text-base">重排题目</span>
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

                  {/* Version Management */}
                  <button className="btn btn-outline btn-lg justify-start gap-4 h-14" onClick={() => { setShowSettings(false); setShowVersionManager(true); }}>
                    <FontAwesomeIcon icon={faHistory} className="text-xl w-6" />
                    <span className="text-base">{t('messages:versionControl.title')}</span>
                  </button>
                  {/* <div className="divider my-1">云同步</div> */}

                  {/* Online Sync */}
                  <button className="btn btn-outline btn-lg justify-start gap-4 h-14" onClick={() => { setShowSettings(false); setShowOnlineManager(true); }}>
                    <FontAwesomeIcon icon={faCloud} className="text-xl w-6" />
                    <span className="text-base">{t('online:title')}</span>
                  </button>
                </div>
              </div>
              <div className="modal-backdrop" onClick={() => setShowSettings(false)}></div>
            </div>
          )}

          {/* Online Manager Modal */}
          {showOnlineManager && (
            <OnlineManager
              isOpen={showOnlineManager}
              onClose={() => setShowOnlineManager(false)}
              contestData={contestData}
              onDataImported={(data) => {
                updateContestData(() => data);
                setSyncStatus('synced');
                setLastSyncTime(Date.now());
                lastSyncDataRef.current = JSON.stringify({
                  meta: data.meta,
                  problems: data.problems,
                });
              }}
              onSyncComplete={(syncedAt) => {
                setSyncStatus('synced');
                setLastSyncTime(syncedAt);
                lastSyncDataRef.current = contestDataStr;
              }}
            />
          )}

          {/* Template Editor Modal */}
          {showTemplateEditor && (
            <div className="modal modal-open">
              <div className="modal-box max-w-4xl w-full h-[600px] p-4">
                <TemplateEditor
                  template={contestData.template}
                  onSave={(template) => {
                    updateContestData((draft) => { draft.template = template; });
                    setShowTemplateEditor(false);
                    showToast(t('editor:templateEditor') + ' ' + t('common:save'), 'success');
                  }}
                  onClose={() => setShowTemplateEditor(false)}
                />
              </div>
              <div className="modal-backdrop" onClick={() => setShowTemplateEditor(false)}></div>
            </div>
          )}

          {/* Version Manager Modal */}
          {showVersionManager && (
            <VersionManager
              currentContest={contestData}
              onRestore={(contest, _images) => {
                updateContestData(() => contest);
                setShowVersionManager(false);
                showToast(t('messages:versionControl.versionRestored'));
              }}
              onClose={() => setShowVersionManager(false)}
            />
          )}

          {/* Reorder Modal */}
          {showReorder && (
            <div className="modal modal-open">
              <div className="modal-box max-w-sm">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="font-bold text-xl">重排题目</h3>
                  <button className="btn btn-sm btn-ghost" onClick={() => setShowReorder(false)}>
                    <FontAwesomeIcon icon={faX} />
                  </button>
                </div>
                <SortableContext
                  items={contestData.problems.map((p) => p.key!)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto select-none">
                    {contestData.problems.map((problem, index) => (
                      <SortableReorderItem
                        key={problem.key}
                        problem={problem}
                        index={index}
                      />
                    ))}
                  </div>
                </SortableContext>
                <p className="text-sm text-gray-500 mt-4 text-center">拖拽题目以重新排序</p>
              </div>
              <div className="modal-backdrop" onClick={() => setShowReorder(false)}></div>
            </div>
          )}
        </div>
      )}
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
