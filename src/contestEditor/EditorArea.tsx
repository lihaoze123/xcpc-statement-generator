import { type FC, useState } from "react";
import type { ContestWithImages, Problem, ProblemFormat, ImageData, AutoLanguageOption } from "@/types/contest";
import { useTranslation } from "react-i18next";
import Editor from "@monaco-editor/react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faTrash, faInbox, faCopy, faChevronDown } from "@fortawesome/free-solid-svg-icons";
import { saveImageToDB, deleteImageFromDB } from "@/utils/indexedDBUtils";
import { useToast } from "@/components/ToastProvider";

interface EditorAreaProps {
  contestData: ContestWithImages;
  updateContestData: (update: (draft: ContestWithImages) => void) => void;
  activeId: string;
}

interface ConfigFormProps {
  contestData: ContestWithImages;
  updateContestData: (update: (draft: ContestWithImages) => void) => void;
}

const GlobalConfigForm: FC<ConfigFormProps> = ({ contestData, updateContestData }) => {
  const { t } = useTranslation();
  return (
    <div className="p-6 max-w-2xl mx-auto space-y-4">
      <h2 className="text-xl font-semibold mb-6 text-gray-800">{t('editor:contestConfig')}</h2>

      <div className="form-control">
        <label className="label py-1"><span className="form-label">{t('editor:contestTitle')}</span></label>
        <input
          type="text"
          className="input input-bordered w-full"
          value={contestData.meta.title}
          onChange={(e) => updateContestData((d) => { d.meta.title = e.target.value; })}
        />
      </div>

      <div className="form-control">
        <label className="label py-1"><span className="form-label">{t('editor:contestSubtitle')}</span></label>
        <input
          type="text"
          className="input input-bordered w-full"
          value={contestData.meta.subtitle}
          onChange={(e) => updateContestData((d) => { d.meta.subtitle = e.target.value; })}
        />
      </div>

      <div className="form-control">
        <label className="label py-1"><span className="form-label">{t('editor:author')}</span></label>
        <input
          type="text"
          className="input input-bordered w-full"
          value={contestData.meta.author}
          onChange={(e) => updateContestData((d) => { d.meta.author = e.target.value; })}
        />
      </div>

      <div className="form-control">
        <label className="label py-1"><span className="form-label">{t('editor:contestDate')}</span></label>
        <input
          type="text"
          className="input input-bordered w-full"
          value={contestData.meta.date}
          onChange={(e) => updateContestData((d) => { d.meta.date = e.target.value; })}
        />
      </div>

      <div className="grid grid-cols-2 gap-4 mt-6">
        <div className="form-control flex flex-row items-center justify-between p-3 bg-gray-50 rounded-lg">
          <span className="form-label">{t('editor:enableTitlepage')}</span>
          <input
            type="checkbox"
            className="toggle toggle-primary toggle-sm"
            checked={contestData.meta.enable_titlepage}
            onChange={(e) => updateContestData((d) => { d.meta.enable_titlepage = e.target.checked; })}
          />
        </div>
        <div className="form-control flex flex-row items-center justify-between p-3 bg-gray-50 rounded-lg">
          <span className="form-label">{t('editor:enableHeaderFooter')}</span>
          <input
            type="checkbox"
            className="toggle toggle-primary toggle-sm"
            checked={contestData.meta.enable_header_footer}
            onChange={(e) => updateContestData((d) => { d.meta.enable_header_footer = e.target.checked; })}
          />
        </div>
        <div className="form-control flex flex-row items-center justify-between p-3 bg-gray-50 rounded-lg">
          <span className="form-label">{t('editor:enableProblemList')}</span>
          <input
            type="checkbox"
            className="toggle toggle-primary toggle-sm"
            checked={contestData.meta.enable_problem_list}
            onChange={(e) => updateContestData((d) => { d.meta.enable_problem_list = e.target.checked; })}
          />
        </div>
        <div className="form-control flex flex-row items-center justify-between p-3 bg-gray-50 rounded-lg">
          <span className="form-label">{t('editor:englishMode')}</span>
          <input
            type="checkbox"
            className="toggle toggle-primary toggle-sm"
            checked={contestData.meta.language === "en"}
            onChange={(e) => updateContestData((d) => { d.meta.language = e.target.checked ? "en" : "zh"; })}
          />
        </div>
      </div>

      {/* Language detailed configuration */}
      <div className="grid grid-cols-2 gap-4 mt-4">
        <div className="form-control">
          <label className="label py-1"><span className="form-label">{t('editor:titlepageLanguage')}</span></label>
          <select
            className="select select-bordered select-sm w-full"
            value={contestData.meta.titlepage_language || "auto"}
            onChange={(e) => updateContestData((d) => { d.meta.titlepage_language = e.target.value as AutoLanguageOption; })}
          >
            <option value="auto">{t('editor:languageAuto')}</option>
            <option value="zh">{t('editor:languageChinese')}</option>
            <option value="en">{t('editor:languageEnglish')}</option>
          </select>
        </div>

        <div className="form-control">
          <label className="label py-1"><span className="form-label">{t('editor:problemLanguage')}</span></label>
          <select
            className="select select-bordered select-sm w-full"
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
  );
};

const ImageManagement: FC<ConfigFormProps> = ({ contestData, updateContestData }) => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const handleAddImage = async (file: File) => {
    const uuid = crypto.randomUUID();
    const blob = new Blob([file], { type: file.type });
    const url = URL.createObjectURL(blob);
    await saveImageToDB(uuid, blob);
    updateContestData((draft) => {
      draft.images.push({ uuid, name: file.name, url });
    });
    showToast(t('messages:imageUploadSuccess', { name: file.name }));
  };

  const handleDeleteImage = async (index: number) => {
    const img = contestData.images[index];
    if (!img) return;
    URL.revokeObjectURL(img.url);
    await deleteImageFromDB(img.uuid);
    updateContestData((draft) => { draft.images.splice(index, 1); });
    showToast(t('messages:imageDeleted'));
  };

  const handleCopyImageRef = (img: ImageData, format: "typst" | "latex" | "markdown") => {
    let ref: string;
    switch (format) {
      case "typst": ref = `#image("/asset/${img.uuid}")`; break;
      case "latex": ref = `\\includegraphics{/asset/${img.uuid}}`; break;
      case "markdown": ref = `![${img.name}](/asset/${img.uuid})`; break;
    }
    navigator.clipboard.writeText(ref);
    showToast(t('messages:imageCopied'));
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h2 className="text-xl font-semibold mb-6 text-gray-800">{t('editor:imageManagement')}</h2>

      {/* Upload Zone */}
      <label
        className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
          isDraggingOver ? 'border-[#1D71B7] bg-blue-50' : 'border-gray-300 hover:border-gray-400'
        }`}
        onDragOver={(e) => { e.preventDefault(); setIsDraggingOver(true); }}
        onDragLeave={() => setIsDraggingOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDraggingOver(false);
          const files = e.dataTransfer.files;
          if (files) {
            Array.from(files).forEach(async (file) => {
              if (!["image/png", "image/jpeg", "image/gif", "image/svg+xml"].includes(file.type)) {
                showToast(t('messages:unsupportedImageType'), 'error');
                return;
              }
              await handleAddImage(file);
            });
          }
        }}
      >
        <input
          type="file"
          className="hidden"
          accept=".png,.jpg,.jpeg,.gif,.svg"
          multiple
          onChange={(e) => {
            const files = e.target.files;
            if (files) {
              Array.from(files).forEach(async (file) => {
                if (!["image/png", "image/jpeg", "image/gif", "image/svg+xml"].includes(file.type)) {
                  showToast(t('messages:unsupportedImageType'), 'error');
                  return;
                }
                await handleAddImage(file);
              });
            }
          }}
        />
        <FontAwesomeIcon icon={faInbox} className="w-8 h-8 text-gray-400 mb-2" />
        <span className="text-sm text-gray-600">{t('editor:clickOrDragUpload')}</span>
      </label>

      {/* Image List */}
      {contestData.images.length > 0 && (
        <div className="space-y-2 mt-4">
          {contestData.images.map((img, index) => (
            <div key={img.uuid} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
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
                <ul tabIndex={0} className="dropdown-content menu p-2 shadow bg-white rounded-box w-28 border border-gray-200">
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
    </div>
  );
};

const SingleProblemEditor: FC<{
  problem: Problem;
  index: number;
  onUpdate: (updater: (p: Problem) => void) => void;
}> = ({ problem, index, onUpdate }) => {
  const { t } = useTranslation();
  const lang = problem.problem.format === "markdown" ? "markdown" : problem.problem.format === "typst" ? "plaintext" : "latex";

  return (
    <div className="p-6 h-full overflow-y-auto custom-scroll">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-800">
          {String.fromCharCode(65 + index)}. {problem.problem.display_name}
        </h2>
        <select
          className="select select-bordered select-sm w-32"
          value={problem.problem.format || "latex"}
          onChange={(e) => onUpdate((p) => { p.problem.format = e.target.value as ProblemFormat; })}
        >
          <option value="latex">LaTeX</option>
          <option value="markdown">Markdown</option>
          <option value="typst">Typst</option>
        </select>
      </div>

      <div className="space-y-5 max-w-3xl">
        <div className="form-control">
          <label className="label py-1"><span className="form-label">{t('editor:problemName')}</span></label>
          <input
            type="text"
            className="input input-bordered w-full"
            value={problem.problem.display_name}
            onChange={(e) => onUpdate((p) => { p.problem.display_name = e.target.value; })}
          />
        </div>

        <div className="form-control flex flex-col" style={{ minHeight: "250px" }}>
          <label className="label py-1"><span className="form-label">{t('editor:problemDescription')}</span></label>
          <div className="flex-1 border border-gray-300 rounded-lg overflow-hidden">
            <Editor
              language={lang}
              value={problem.statement.description}
              onChange={(val) => onUpdate((p) => { p.statement.description = val || ""; })}
              options={{ minimap: { enabled: false }, wordWrap: "on", fontSize: 14 }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="form-control flex flex-col h-56">
            <label className="label py-1"><span className="form-label">{t('editor:inputFormat')}</span></label>
            <div className="flex-1 border border-gray-300 rounded-lg overflow-hidden">
              <Editor
                language={lang}
                value={problem.statement.input || ""}
                onChange={(val) => onUpdate((p) => { p.statement.input = val || ""; })}
                options={{ minimap: { enabled: false }, wordWrap: "on", fontSize: 14 }}
              />
            </div>
          </div>
          <div className="form-control flex flex-col h-56">
            <label className="label py-1"><span className="form-label">{t('editor:outputFormat')}</span></label>
            <div className="flex-1 border border-gray-300 rounded-lg overflow-hidden">
              <Editor
                language={lang}
                value={problem.statement.output || ""}
                onChange={(val) => onUpdate((p) => { p.statement.output = val || ""; })}
                options={{ minimap: { enabled: false }, wordWrap: "on", fontSize: 14 }}
              />
            </div>
          </div>
        </div>

        <div className="form-control flex flex-col h-40">
          <label className="label py-1"><span className="form-label">{t('editor:hints')}</span></label>
          <div className="flex-1 border border-gray-300 rounded-lg overflow-hidden">
            <Editor
              language={lang}
              value={problem.statement.notes || ""}
              onChange={(val) => onUpdate((p) => { p.statement.notes = val || ""; })}
              options={{ minimap: { enabled: false }, wordWrap: "on", fontSize: 14 }}
            />
          </div>
        </div>

        {/* Samples */}
        <div>
          <h3 className="form-label mb-3">{t('editor:sampleInputOutput')}</h3>
          <div className="space-y-4">
            {problem.problem.samples.map((sample, sIdx) => (
              <div key={sIdx} className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium text-sm">{t('editor:sampleNumber', { number: sIdx + 1 })}</span>
                  <button
                    className="btn btn-ghost btn-xs text-gray-400 hover:text-red-500"
                    onClick={() => onUpdate((p) => { p.problem.samples.splice(sIdx, 1); })}
                  >
                    <FontAwesomeIcon icon={faTrash} />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="h-24 border border-gray-300 rounded overflow-hidden">
                    <Editor
                      language="plaintext"
                      value={sample.input}
                      onChange={(val) => onUpdate((p) => { p.problem.samples[sIdx].input = val || ""; })}
                      options={{ minimap: { enabled: false }, fontSize: 13, fontFamily: "monospace" }}
                    />
                  </div>
                  <div className="h-24 border border-gray-300 rounded overflow-hidden">
                    <Editor
                      language="plaintext"
                      value={sample.output}
                      onChange={(val) => onUpdate((p) => { p.problem.samples[sIdx].output = val || ""; })}
                      options={{ minimap: { enabled: false }, fontSize: 13, fontFamily: "monospace" }}
                    />
                  </div>
                </div>
              </div>
            ))}
            <button
              className="btn btn-outline btn-sm w-full"
              onClick={() => onUpdate((p) => { p.problem.samples.push({ input: "", output: "" }); })}
            >
              <FontAwesomeIcon icon={faPlus} className="mr-2" />
              {t('editor:addSample')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const EditorArea: FC<EditorAreaProps> = ({ contestData, updateContestData, activeId }) => {
  if (activeId === 'config') {
    return (
      <div className="h-full overflow-y-auto bg-white custom-scroll">
        <GlobalConfigForm contestData={contestData} updateContestData={updateContestData} />
      </div>
    );
  }

  if (activeId === 'images') {
    return (
      <div className="h-full overflow-y-auto bg-white custom-scroll">
        <ImageManagement contestData={contestData} updateContestData={updateContestData} />
      </div>
    );
  }

  const problemIndex = contestData.problems.findIndex(p => p.key === activeId);
  if (problemIndex !== -1) {
    const problem = contestData.problems[problemIndex];
    return (
      <div className="h-full overflow-hidden bg-white">
        <SingleProblemEditor
          problem={problem}
          index={problemIndex}
          onUpdate={(updater) => updateContestData((draft) => updater(draft.problems[problemIndex]))}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full items-center justify-center text-gray-400 bg-white">
      选择左侧项目开始编辑
    </div>
  );
};

export default EditorArea;
