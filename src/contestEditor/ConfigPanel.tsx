import { type FC, useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faTrash, faInbox, faCopy, faChevronDown, faChevronUp, faBars } from "@fortawesome/free-solid-svg-icons";
import Editor from "@monaco-editor/react";
import { useTranslation } from "react-i18next";
import type { ContestWithImages, ProblemFormat, ImageData, AutoLanguageOption, Problem } from "@/types/contest";
import { saveImageToDB, deleteImageFromDB } from "@/utils/indexedDBUtils";
import { useToast } from "@/components/ToastProvider";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";

interface ConfigPanelProps {
  contestData: ContestWithImages;
  updateContestData: (update: (draft: ContestWithImages) => void) => void;
}

interface ProblemItemProps {
  problem: Problem;
  index: number;
  isExpanded: boolean;
  onToggleExpand: (key: string) => void;
  onDelete: () => void;
  onUpdate: (updater: (problem: Problem) => void) => void;
  t: any;
}

const ProblemItem: FC<ProblemItemProps> = ({
  problem,
  index,
  isExpanded,
  onToggleExpand,
  onDelete,
  onUpdate,
  t,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: problem.key!,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1000 : undefined,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className={`bg-white border border-gray-200 rounded-lg overflow-hidden ${isDragging ? 'opacity-50' : ''} problem-item ${isExpanded ? 'problem-item-expanded' : ''}`}>
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 problem-item-header">
        <div className="flex items-center gap-2">
          <button {...attributes} {...listeners} className="btn btn-ghost btn-xs cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600" title={t('editor:dragToReorder')}>
            <FontAwesomeIcon icon={faBars} />
          </button>
          <span className="text-sm font-medium text-gray-700">
            {String.fromCharCode(65 + index)}. {problem.problem.display_name || t('editor:problemPlaceholder', { number: index + 1 })}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button className="btn btn-ghost btn-xs text-gray-400 hover:text-red-500 transition-colors" onClick={onDelete} title={t('editor:deleteProblem')}>
            <FontAwesomeIcon icon={faTrash} />
          </button>
          <button className="btn btn-ghost btn-xs text-gray-400 hover:text-gray-600 transition-colors" onClick={() => onToggleExpand(problem.key!)} title={isExpanded ? t('editor:collapse') : t('editor:expand')}>
            <FontAwesomeIcon icon={isExpanded ? faChevronUp : faChevronDown} />
          </button>
        </div>
      </div>
      {isExpanded && (
        <div className="bg-gray-50 p-4 space-y-5 problem-item-content">
          <div className="form-control">
            <label className="label py-1">
              <span className="form-label">{t('editor:format')}</span>
            </label>
            <select
              className="form-select select-sm w-full"
              value={problem.problem.format || "latex"}
              onChange={(e) => onUpdate((p) => { p.problem.format = e.target.value as ProblemFormat; })}
            >
              <option value="latex">LaTeX</option>
              <option value="markdown">Markdown</option>
              <option value="typst">Typst</option>
            </select>
          </div>
          <div className="form-control">
            <label className="label py-1">
              <span className="form-label">{t('editor:problemName')}</span>
            </label>
            <input
              type="text"
              className="form-input w-full"
              placeholder={t('editor:problemName')}
              value={problem.problem.display_name}
              onChange={(e) => onUpdate((p) => { p.problem.display_name = e.target.value; })}
            />
          </div>
          <div className="form-control">
            <label className="label py-1">
              <span className="form-label">{t('editor:problemDescription')}</span>
            </label>
            <div className="editor-container">
              <Editor
                height="150px"
                language={problem.problem.format === "markdown" ? "markdown" : problem.problem.format === "typst" ? "plaintext" : "latex"}
                value={problem.statement.description}
                onChange={(value) => onUpdate((p) => { p.statement.description = value || ""; })}
                options={{
                  minimap: { enabled: false },
                  fontSize: 13,
                  lineNumbers: "off",
                  scrollBeyondLastLine: false,
                  wordWrap: "on",
                  wrappingIndent: "same",
                }}
                theme="vs-light"
              />
            </div>
          </div>
          <div className="form-control">
            <label className="label py-1">
              <span className="form-label">{t('editor:inputFormat')}</span>
            </label>
            <div className="editor-container">
              <Editor
                height="100px"
                language={problem.problem.format === "markdown" ? "markdown" : problem.problem.format === "typst" ? "plaintext" : "latex"}
                value={problem.statement.input || ""}
                onChange={(value) => onUpdate((p) => { p.statement.input = value || ""; })}
                options={{
                  minimap: { enabled: false },
                  fontSize: 13,
                  lineNumbers: "off",
                  scrollBeyondLastLine: false,
                  wordWrap: "on",
                  wrappingIndent: "same",
                }}
                theme="vs-light"
              />
            </div>
          </div>
          <div className="form-control">
            <label className="label py-1">
              <span className="form-label">{t('editor:outputFormat')}</span>
            </label>
            <div className="editor-container">
              <Editor
                height="100px"
                language={problem.problem.format === "markdown" ? "markdown" : problem.problem.format === "typst" ? "plaintext" : "latex"}
                value={problem.statement.output || ""}
                onChange={(value) => onUpdate((p) => { p.statement.output = value || ""; })}
                options={{
                  minimap: { enabled: false },
                  fontSize: 13,
                  lineNumbers: "off",
                  scrollBeyondLastLine: false,
                  wordWrap: "on",
                  wrappingIndent: "same",
                }}
                theme="vs-light"
              />
            </div>
          </div>
          <div className="form-control">
            <label className="label py-1">
              <span className="form-label">{t('editor:hints')}</span>
            </label>
            <div className="editor-container">
              <Editor
                height="100px"
                language={problem.problem.format === "markdown" ? "markdown" : problem.problem.format === "typst" ? "plaintext" : "latex"}
                value={problem.statement.notes || ""}
                onChange={(value) => onUpdate((p) => { p.statement.notes = value || ""; })}
                options={{
                  minimap: { enabled: false },
                  fontSize: 13,
                  lineNumbers: "off",
                  scrollBeyondLastLine: false,
                  wordWrap: "on",
                  wrappingIndent: "same",
                }}
                theme="vs-light"
              />
            </div>
          </div>

          <div className="form-label">{t('editor:sampleInputOutput')}</div>
          {problem.problem.samples.map((sample, sIdx) => (
            <div key={sIdx} className="sample-item">
              <div className="sample-header">
                <span className="sample-number">{t('editor:sampleNumber', { number: sIdx + 1 })}</span>
                {problem.problem.samples.length > 1 && (
                  <button
                    className="btn btn-ghost btn-xs text-gray-400 hover:text-red-500 transition-colors sample-delete-btn"
                    onClick={() => onUpdate((p) => { p.problem.samples.splice(sIdx, 1); })}
                  >
                    <FontAwesomeIcon icon={faTrash} />
                  </button>
                )}
              </div>
              <div className="sample-grid">
                <div className="sample-field">
                  <label className="sample-field-label">{t('editor:input')}</label>
                  <div className="editor-container editor-container-mono">
                    <Editor
                      height="80px"
                      language="plaintext"
                      value={sample.input}
                      onChange={(value) => onUpdate((p) => { p.problem.samples[sIdx].input = value || ""; })}
                      options={{
                        minimap: { enabled: false },
                        fontSize: 12,
                        lineNumbers: "off",
                        scrollBeyondLastLine: false,
                        wordWrap: "off",
                        wrappingIndent: "same",
                        fontFamily: "Consolas, Monaco, 'Andale Mono', monospace",
                      }}
                      theme="vs-light"
                    />
                  </div>
                </div>
                <div className="sample-field">
                  <label className="sample-field-label">{t('editor:output')}</label>
                  <div className="editor-container editor-container-mono">
                    <Editor
                      height="80px"
                      language="plaintext"
                      value={sample.output}
                      onChange={(value) => onUpdate((p) => { p.problem.samples[sIdx].output = value || ""; })}
                      options={{
                        minimap: { enabled: false },
                        fontSize: 12,
                        lineNumbers: "off",
                        scrollBeyondLastLine: false,
                        wordWrap: "off",
                        wrappingIndent: "same",
                        fontFamily: "Consolas, Monaco, 'Andale Mono', monospace",
                      }}
                      theme="vs-light"
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
          <button
            className="btn-secondary w-full"
            onClick={() => onUpdate((p) => { p.problem.samples.push({ input: "", output: "" }); })}
          >
            <FontAwesomeIcon icon={faPlus} className="mr-1" />
            {t('editor:addSample')}
          </button>
        </div>
      )}
    </div>
  );
};

const ConfigPanel: FC<ConfigPanelProps> = ({ contestData, updateContestData }) => {
  const { t } = useTranslation();
  const { showToast } = useToast();

  // 确保所有题目都有唯一的 key
  useEffect(() => {
    updateContestData((draft) => {
      draft.problems.forEach((problem) => {
        if (!problem.key) {
          problem.key = crypto.randomUUID();
        }
      });
    });
  }, []);

  // 配置拖拽传感器
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 移动 8px 后才开始拖拽，避免误触
      },
    })
  );

  // State to track which problems are expanded (default: all collapsed)
  const [expandedProblems, setExpandedProblems] = useState<Set<string>>(
    new Set()
  );

  // State to track drag-over for file upload
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // Handle drag events for file upload
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      for (const file of Array.from(files)) {
        if (!["image/png", "image/jpeg", "image/gif", "image/svg+xml"].includes(file.type)) {
          showToast(t('messages:unsupportedImageType'), 'error');
          continue;
        }
        try {
          await handleAddImage(file);
        } catch (err) {
          console.error("Failed to add image:", err);
          showToast(t('messages:imageUploadFailed'), 'error');
        }
      }
    }
  };

  // Toggle problem expansion
  const toggleProblemExpansion = (key: string) => {
    setExpandedProblems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  // 处理拖拽结束事件
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

  // Add image handler
  const handleAddImage = async (file: File) => {
    const uuid = crypto.randomUUID();
    const blob = new Blob([file], { type: file.type });
    const url = URL.createObjectURL(blob);

    // Save to IndexedDB
    await saveImageToDB(uuid, blob);

    // Add to state
    updateContestData((draft) => {
      draft.images.push({
        uuid,
        name: file.name,
        url,
      });
    });

    showToast(t('messages:imageUploadSuccess', { name: file.name }));
  };

  // Delete image handler
  const handleDeleteImage = async (index: number) => {
    const img = contestData.images[index];
    if (!img) return;

    // Revoke blob URL
    URL.revokeObjectURL(img.url);

    // Delete from IndexedDB
    await deleteImageFromDB(img.uuid);

    // Remove from state
    updateContestData((draft) => {
      draft.images.splice(index, 1);
    });

    showToast(t('messages:imageDeleted'));
  };

  // Copy image reference to clipboard
  const handleCopyImageRef = (img: ImageData, format: "typst" | "latex" | "markdown") => {
    let ref: string;
    switch (format) {
      case "typst":
        ref = `#image("/asset/${img.uuid}")`;
        break;
      case "latex":
        ref = `\\includegraphics{/asset/${img.uuid}}`;
        break;
      case "markdown":
        ref = `![${img.name}](/asset/${img.uuid})`;
        break;
    }
    navigator.clipboard.writeText(ref);
    showToast(t('messages:imageCopied'));
  };

  return (
    <div className="config-panel">
      {/* Contest Config Card */}
      <div className="mb-6">
        <div className="card-body p-4">
          <h2 className="section-title">{t('editor:contestConfig')}</h2>
          <div className="space-y-3">
            {/* Contest Title */}
            <div className="form-control">
              <label className="label py-1">
                <span className="form-label">{t('editor:contestTitle')}</span>
              </label>
              <input
                type="text"
                className="form-input w-full text-sm h-10"
                value={contestData.meta.title}
                onChange={(e) => updateContestData((d) => { d.meta.title = e.target.value; })}
                placeholder={t('editor:inputPlaceholder', { field: t('editor:contestTitle') })}
              />
            </div>

            {/* Contest Subtitle */}
            <div className="form-control">
              <label className="label py-1">
                <span className="form-label">{t('editor:contestSubtitle')}</span>
              </label>
              <input
                type="text"
                className="form-input w-full text-sm h-10"
                value={contestData.meta.subtitle}
                onChange={(e) => updateContestData((d) => { d.meta.subtitle = e.target.value; })}
                placeholder={t('editor:inputPlaceholder', { field: t('editor:contestSubtitle') })}
              />
            </div>

            {/* Author */}
            <div className="form-control">
              <label className="label py-1">
                <span className="form-label">{t('editor:author')}</span>
              </label>
              <input
                type="text"
                className="form-input w-full text-sm h-10"
                value={contestData.meta.author}
                onChange={(e) => updateContestData((d) => { d.meta.author = e.target.value; })}
                placeholder={t('editor:inputPlaceholder', { field: t('editor:author') })}
              />
            </div>

            {/* Contest Date */}
            <div className="form-control">
              <label className="label py-1">
                <span className="form-label">{t('editor:contestDate')}</span>
              </label>
              <input
                type="text"
                className="form-input w-full text-sm h-10"
                value={contestData.meta.date}
                onChange={(e) => updateContestData((d) => { d.meta.date = e.target.value; })}
                placeholder={t('editor:inputPlaceholder', { field: t('editor:contestDate') })}
              />
            </div>

            {/* Enable Titlepage */}
            <div className="form-group-switch">
              <span className="form-label">{t('editor:enableTitlepage')}</span>
              <input
                type="checkbox"
                className="toggle toggle-primary toggle-sm"
                checked={contestData.meta.enable_titlepage}
                onChange={(e) => updateContestData((d) => { d.meta.enable_titlepage = e.target.checked; })}
              />
            </div>

            {/* Enable Header/Footer */}
            <div className="form-group-switch">
              <span className="form-label">{t('editor:enableHeaderFooter')}</span>
              <input
                type="checkbox"
                className="toggle toggle-primary toggle-sm"
                checked={contestData.meta.enable_header_footer}
                onChange={(e) => updateContestData((d) => { d.meta.enable_header_footer = e.target.checked; })}
              />
            </div>

            {/* Enable Problem List */}
            <div className="form-group-switch">
              <span className="form-label">{t('editor:enableProblemList')}</span>
              <input
                type="checkbox"
                className="toggle toggle-primary toggle-sm"
                checked={contestData.meta.enable_problem_list}
                onChange={(e) => updateContestData((d) => { d.meta.enable_problem_list = e.target.checked; })}
              />
            </div>

            {/* English Mode */}
            <div className="form-group-switch">
              <span className="form-label">{t('editor:englishMode')}</span>
              <input
                type="checkbox"
                className="toggle toggle-primary toggle-sm"
                checked={contestData.meta.language === "en"}
                onChange={(e) => updateContestData((d) => { d.meta.language = e.target.checked ? "en" : "zh"; })}
              />
            </div>

            {/* Titlepage Language */}
            <div className="form-control">
              <label className="label py-1">
                <span className="form-label">{t('editor:titlepageLanguage')}</span>
              </label>
              <select
                className="form-select select-sm w-full"
                value={contestData.meta.titlepage_language || "auto"}
                onChange={(e) => updateContestData((d) => { d.meta.titlepage_language = e.target.value as AutoLanguageOption; })}
              >
                <option value="auto">{t('editor:languageAuto')}</option>
                <option value="zh">{t('editor:languageChinese')}</option>
                <option value="en">{t('editor:languageEnglish')}</option>
              </select>
            </div>

            {/* Problem Language */}
            <div className="form-control">
              <label className="label py-1">
                <span className="form-label">{t('editor:problemLanguage')}</span>
              </label>
              <select
                className="form-select select-sm w-full"
                value={contestData.meta.problem_language || "auto"}
                onChange={(e) => updateContestData((d) => { d.meta.problem_language = e.target.value as AutoLanguageOption; })}
              >
                <option value="auto">{t('editor:languageAuto')}</option>
                <option value="zh">{t('editor:languageChinese')}</option>
                <option value="en">{t('editor:languageEnglish')}</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Image Management Card */}
      <div className="mb-6">
        <div className="card-body p-4">
          <h2 className="section-title">{t('editor:imageManagement')}</h2>
          <div className="image-upload-section">
            <label
              className={`upload-zone flex flex-col items-center justify-center w-full h-32 ${isDraggingOver ? 'border-2 border-dashed border-primary bg-primary/5' : ''}`}
              onDragOver={handleDragOver}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <input
                type="file"
                className="hidden"
                accept=".png,.jpg,.jpeg,.gif,.svg,image/png,image/jpeg,image/gif,image/svg+xml"
                multiple
                onChange={(e) => {
                  const files = e.target.files;
                  if (files) {
                    Array.from(files).forEach(async (file) => {
                      if (!["image/png", "image/jpeg", "image/gif", "image/svg+xml"].includes(file.type)) {
                        showToast(t('messages:unsupportedImageType'), 'error');
                        return;
                      }
                      try {
                        await handleAddImage(file);
                      } catch (err) {
                        console.error("Failed to add image:", err);
                        showToast(t('messages:imageUploadFailed'), 'error');
                      }
                    });
                  }
                }}
              />
              <FontAwesomeIcon icon={faInbox} className="w-8 h-8 text-[#1D71B7] mb-2" />
              <span className="text-sm text-gray-600">{t('editor:clickOrDragUpload')}</span>
              <span className="text-xs text-gray-400 mt-1">{t('editor:supportedFormats')}</span>
            </label>

            {contestData.images.length > 0 && (
              <div className="space-y-2 mt-3">
                {contestData.images.map((img, index) => (
                  <div key={img.uuid} className="flex items-center gap-3 p-2 bg-base-200 rounded-xl">
                    <div className="w-12 h-12 flex-shrink-0">
                      <img src={img.url} alt={img.name} className="w-full h-full object-cover rounded" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{img.name}</p>
                    </div>
                    <div className="dropdown dropdown-end">
                      <button tabIndex={0} className="btn btn-ghost btn-xs">
                        <FontAwesomeIcon icon={faCopy} />
                        <FontAwesomeIcon icon={faChevronDown} className="ml-1 text-[10px]" />
                      </button>
                      <ul tabIndex={0} className="dropdown-content menu p-2 shadow bg-base-100 rounded-box w-32 border border-base-border">
                        <li><a onClick={() => handleCopyImageRef(img, 'typst')}>Typst</a></li>
                        <li><a onClick={() => handleCopyImageRef(img, 'latex')}>LaTeX</a></li>
                        <li><a onClick={() => handleCopyImageRef(img, 'markdown')}>Markdown</a></li>
                      </ul>
                    </div>
                    <button className="btn btn-ghost btn-xs text-gray-400 hover:text-red-500" onClick={() => handleDeleteImage(index)}>
                      <FontAwesomeIcon icon={faTrash} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {contestData.images.length > 0 && (
              <div className="mt-2 text-xs text-secondary-content">
                {t('editor:copyReferenceHint')}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Problem List Card */}
      <div>
        <div className="card-body p-4">
          <h2 className="section-title">{t('editor:problemList')}</h2>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
            modifiers={[restrictToVerticalAxis]}
          >
            <SortableContext
              items={contestData.problems.map((p) => p.key!)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {contestData.problems.map((problem, index) => (
                  <ProblemItem
                    key={problem.key}
                    problem={problem}
                    index={index}
                    isExpanded={expandedProblems.has(problem.key!)}
                    onToggleExpand={toggleProblemExpansion}
                    onDelete={() => updateContestData((d) => { d.problems.splice(index, 1); })}
                    onUpdate={(updater) => updateContestData((d) => { updater(d.problems[index]); })}
                    t={t}
                  />
                ))}

                <button className="btn-add-problem w-full" onClick={() => {
                  const newKey = crypto.randomUUID();
                  updateContestData((d) => {
                    d.problems.push({
                      key: newKey,
                      problem: { display_name: t('editor:problemPlaceholder', { number: d.problems.length + 1 }), samples: [{ input: "", output: "" }] },
                      statement: { description: "", input: "", output: "", notes: "" },
                    });
                  });
                  // Auto-expand new problem and collapse others
                  setExpandedProblems(new Set([newKey]));
                }}>
                  <FontAwesomeIcon icon={faPlus} className="mr-1" />
                  {t('editor:addProblem')}
                </button>
              </div>
            </SortableContext>
          </DndContext>
        </div>
      </div>
    </div>
  );
};

export default ConfigPanel;
