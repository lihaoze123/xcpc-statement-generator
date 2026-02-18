import { useState, useEffect } from "react";
import type { FC } from "react";
import { useTranslation } from "react-i18next";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faTrash, faCodeBranch, faHistory, faDownload, faUpload, faCompress, faX, faChevronRight, faChevronDown } from "@fortawesome/free-solid-svg-icons";
import * as Diff from "diff";
import type { Version, Branch, ContestWithImages, ImageData, Contest, ImageMeta } from "@/types/contest";
import {
  getAllBranches, saveBranch, deleteBranch, getBranch,
  getVersionsByBranch, getVersion, saveVersion, deleteVersion,
  exportVersions, importVersions
} from "@/utils/versionControl";
import { useToast } from "@/components/ToastProvider";

interface VersionManagerProps {
  currentContest: ContestWithImages;
  onRestore: (contest: ContestWithImages, images: ImageData[]) => void;
  onClose: () => void;
}

// Helper: convert Contest to ContestWithImages
const toContestWithImages = (contest: Contest, images: ImageMeta[]): ContestWithImages => ({
  ...contest,
  images: images.map(img => ({ ...img, url: "" })),
});

// Helper: format date
const formatDate = (timestamp: number) => {
  return new Date(timestamp).toLocaleString();
};

// Helper: diff two strings
const diffTexts = (oldText: string, newText: string): Diff.Change[] => {
  return Diff.diffWords(oldText, newText);
};

const VersionManager: FC<VersionManagerProps> = ({ currentContest, onRestore, onClose }) => {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [versions, setVersions] = useState<Version[]>([]);
  const [selectedVersions, setSelectedVersions] = useState<string[]>([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showNewBranchModal, setShowNewBranchModal] = useState(false);
  const [showDiffModal, setShowDiffModal] = useState(false);
  const [versionName, setVersionName] = useState("");
  const [versionDesc, setVersionDesc] = useState("");
  const [newBranchName, setNewBranchName] = useState("");
  const [diffResult, setDiffResult] = useState<{ problemName: string; diff: Diff.Change[] }[]>([]);
  const [diffVersions, setDiffVersions] = useState<{ v1: string; v2: string } | null>(null);
  const [expandedVersionId, setExpandedVersionId] = useState<string | null>(null);
  const [previewProblemIndex, setPreviewProblemIndex] = useState<number | null>(null);
  const [branchBaseType, setBranchBaseType] = useState<"empty" | "version">("empty");
  const [selectedBaseVersionId, setSelectedBaseVersionId] = useState<string>("");

  // Load branches
  useEffect(() => {
    let cancelled = false;
    getAllBranches()
      .then(branches => {
        if (!cancelled) {
          setBranches(branches);
          if (branches.length > 0 && !selectedBranchId) {
            setSelectedBranchId(branches[0].id);
          }
        }
      })
      .catch(error => {
        console.error("Failed to load branches:", error);
        if (!cancelled) {
          showToast(t("messages:versionControl.loadFailed"), "error");
        }
      });
    return () => { cancelled = true; };
  }, []);

  // Load versions when branch changes
  useEffect(() => {
    if (!selectedBranchId) return;

    let cancelled = false;
    getVersionsByBranch(selectedBranchId)
      .then(versions => {
        if (!cancelled) {
          setVersions(versions);
        }
      })
      .catch(error => {
        console.error("Failed to load versions:", error);
        if (!cancelled) {
          showToast(t("messages:versionControl.loadFailed"), "error");
        }
      });
    return () => { cancelled = true; };
  }, [selectedBranchId]);

  // Handle save version
  const handleSaveVersion = async () => {
    if (!selectedBranchId) {
      showToast(t("messages:versionControl.needBranch"), "error");
      return;
    }
    if (!versionName.trim()) return;

    const contest: Contest = {
      meta: currentContest.meta,
      problems: currentContest.problems,
      images: currentContest.images.map(img => ({ uuid: img.uuid, name: img.name })),
    };

    const versionId = crypto.randomUUID();
    await saveVersion({
      id: versionId,
      name: versionName,
      description: versionDesc,
      createdAt: Date.now(),
      branchId: selectedBranchId,
      contest,
      images: contest.images ?? [],
    });

    // Update branch's currentVersionId
    const branch = await getBranch(selectedBranchId);
    if (branch) {
      await saveBranch({
        ...branch,
        currentVersionId: versionId,
      });
    }

    setShowSaveModal(false);
    setVersionName("");
    setVersionDesc("");

    // Refresh versions
    const newVersions = await getVersionsByBranch(selectedBranchId);
    setVersions(newVersions);
    showToast(t("messages:versionControl.versionSaved"));
  };

  // Handle create branch
  const handleCreateBranch = async () => {
    if (!newBranchName.trim()) return;

    const branchId = crypto.randomUUID();

    if (branchBaseType === "version" && selectedBaseVersionId) {
      // 从版本创建：复制版本的 contest 数据到新分支
      const baseVersion = await getVersion(selectedBaseVersionId);
      if (baseVersion) {
        // 创建新版本，基于选中的版本
        await saveVersion({
          id: crypto.randomUUID(),
          name: baseVersion.name,
          description: baseVersion.description,
          createdAt: Date.now(),
          branchId,
          contest: baseVersion.contest,
          images: baseVersion.images,
        });
      }
    }

    await saveBranch({
      id: branchId,
      name: newBranchName,
      createdAt: Date.now(),
      currentVersionId: selectedBaseVersionId || "",
    });

    setShowNewBranchModal(false);
    setNewBranchName("");
    setBranchBaseType("empty");
    setSelectedBaseVersionId("");

    // Refresh branches
    const newBranches = await getAllBranches();
    setBranches(newBranches);
    setSelectedBranchId(newBranches[newBranches.length - 1].id);
    showToast(t("messages:versionControl.branchCreated"));
  };

  // Handle restore version
  const handleRestore = async (versionId: string) => {
    const version = await getVersion(versionId);
    if (!version) return;

    const images: ImageData[] = version.images.map(img => ({
      ...img,
      url: "",
    }));

    onRestore(toContestWithImages(version.contest, version.images), images);
    showToast(t("messages:versionControl.versionRestored"));
  };

  // Handle delete version
  const handleDeleteVersion = async (versionId: string) => {
    await deleteVersion(versionId);
    const newVersions = await getVersionsByBranch(selectedBranchId);
    setVersions(newVersions);
    showToast(t("messages:versionControl.versionDeleted"));
  };

  // Handle delete branch
  const handleDeleteBranch = async (branchId: string) => {
    if (branches.length <= 1) {
      showToast(t("messages:versionControl.cannotDeleteLastBranch"), "error");
      return;
    }
    await deleteBranch(branchId);
    const newBranches = await getAllBranches();
    setBranches(newBranches);
    setSelectedBranchId(newBranches[0].id);
    showToast(t("messages:versionControl.branchDeleted"));
  };

  // Handle version selection for diff
  const handleVersionSelect = (versionId: string) => {
    setSelectedVersions(prev => {
      if (prev.includes(versionId)) {
        return prev.filter(id => id !== versionId);
      }
      if (prev.length >= 2) {
        return [prev[1], versionId];
      }
      return [...prev, versionId];
    });
  };

  // Handle diff
  const handleShowDiff = async () => {
    if (selectedVersions.length !== 2) return;

    const [v1, v2] = await Promise.all([
      getVersion(selectedVersions[0]),
      getVersion(selectedVersions[1]),
    ]);

    if (!v1 || !v2) return;

    // Store version names for display
    setDiffVersions({ v1: v1.name, v2: v2.name });

    // Compare problems
    const result: { problemName: string; diff: Diff.Change[] }[] = [];

    const problems1 = v1.contest.problems;
    const problems2 = v2.contest.problems;

    // Check for new and changed problems (in v2 but not in v1, or different in v2)
    for (const p2 of problems2) {
      const p1 = problems1.find(p => p.problem.display_name === p2.problem.display_name);
      if (!p1) {
        result.push({ problemName: p2.problem.display_name + " (新增)", diff: [] });
        continue;
      }

      // Compare description
      const descDiff = diffTexts(p1.statement.description || "", p2.statement.description || "");
      if (descDiff.some(d => d.added || d.removed)) {
        result.push({ problemName: p2.problem.display_name, diff: descDiff });
      }
    }

    // Check for deleted problems (in v1 but not in v2)
    for (const p1 of problems1) {
      if (!problems2.find(p => p.problem.display_name === p1.problem.display_name)) {
        result.push({ problemName: p1.problem.display_name + " (已删除)", diff: [] });
      }
    }

    setDiffResult(result);
    setShowDiffModal(true);
  };

  // Handle export
  const handleExport = async () => {
    try {
      const json = await exportVersions();
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `xcpc-versions-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast(t("messages:versionControl.exportSuccess"));
    } catch (e) {
      showToast(t("messages:versionControl.exportFailed"), "error");
    }
  };

  // Handle toggle expand
  const handleToggleExpand = (versionId: string) => {
    setExpandedVersionId(prev => prev === versionId ? null : versionId);
  };

  // Handle import
  const handleImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        await importVersions(text);
        // Refresh
        const newBranches = await getAllBranches();
        setBranches(newBranches);
        if (newBranches.length > 0) {
          setSelectedBranchId(newBranches[0].id);
        }
        showToast(t("messages:versionControl.importSuccess"));
      } catch (e) {
        showToast(t("messages:versionControl.importFailed"), "error");
      }
    };
    input.click();
  };

  return (
    <>
      <div className="modal modal-open">
      <div className="modal-box max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col relative">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-xl">{t("messages:versionControl.title")}</h3>
          <button className="btn btn-sm btn-ghost" onClick={onClose}>
            <FontAwesomeIcon icon={faX} />
          </button>
        </div>

        <div className="flex flex-1 gap-4 min-h-0">
          {/* Left: Branches */}
          <div className="w-48 flex flex-col">
            <h4 className="font-semibold mb-2">{t("messages:versionControl.branches")}</h4>
            <div className="flex-1 overflow-y-auto">
              {branches.map(branch => (
                <div
                  key={branch.id}
                  className={`flex items-center gap-2 p-2 rounded cursor-pointer ${selectedBranchId === branch.id ? "bg-primary text-primary-content" : "hover:bg-base-200"}`}
                  onClick={() => setSelectedBranchId(branch.id)}
                >
                  <FontAwesomeIcon icon={faCodeBranch} />
                  <span className="flex-1 truncate">{branch.name}</span>
                  {branches.length > 1 && (
                    <button
                      className="btn btn-xs btn-ghost"
                      onClick={(e) => { e.stopPropagation(); handleDeleteBranch(branch.id); }}
                    >
                      <FontAwesomeIcon icon={faTrash} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button className="btn btn-sm mt-2" onClick={() => setShowNewBranchModal(true)}>
              <FontAwesomeIcon icon={faPlus} className="mr-1" />
              {t("messages:versionControl.newBranch")}
            </button>
          </div>

          {/* Right: Versions */}
          <div className="flex-1 flex flex-col min-w-0">
            <div className="flex justify-between items-center mb-2">
              <h4 className="font-semibold">{t("messages:versionControl.versions")}</h4>
              <div className="flex gap-2 items-center">
                {selectedVersions.length > 0 && (
                  <span className="text-xs text-base-content/60">
                    {selectedVersions.length === 1
                      ? versions.find(v => v.id === selectedVersions[0])?.name
                      : `${versions.find(v => v.id === selectedVersions[0])?.name} ↔ ${versions.find(v => v.id === selectedVersions[1])?.name}`}
                  </span>
                )}
                <button
                  className="btn btn-sm"
                  onClick={handleShowDiff}
                  disabled={selectedVersions.length !== 2}
                >
                  <FontAwesomeIcon icon={faCompress} className="mr-1" />
                  {t("messages:versionControl.compare")}
                </button>
                <button className="btn btn-sm btn-primary" onClick={() => setShowSaveModal(true)}>
                  <FontAwesomeIcon icon={faPlus} className="mr-1" />
                  {t("messages:versionControl.saveVersion")}
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {versions.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center p-4">
                  <div className="text-center max-w-xs">
                    <FontAwesomeIcon icon={faHistory} className="text-5xl mb-4 text-base-content/30" />
                    <h4 className="font-semibold text-lg mb-2">{t("messages:versionControl.emptyStateTitle")}</h4>
                    <p className="text-base-content/60 mb-4">{t("messages:versionControl.emptyStateDesc")}</p>
                    <button
                      className="btn btn-primary"
                      onClick={() => setShowSaveModal(true)}
                    >
                      <FontAwesomeIcon icon={faPlus} className="mr-2" />
                      {t("messages:versionControl.saveFirstVersion")}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {versions.map(version => (
                    <div
                      key={version.id}
                      className={`border-2 rounded-lg overflow-hidden transition-all ${selectedVersions.includes(version.id) ? "border-primary" : "border-base-300"}`}
                    >
                      {/* 卡片头部 - 始终显示 */}
                      <div
                        className="p-3 cursor-pointer hover:bg-base-200/50"
                        onClick={() => handleToggleExpand(version.id)}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                className="checkbox checkbox-xs"
                                checked={selectedVersions.includes(version.id)}
                                onChange={() => handleVersionSelect(version.id)}
                                onClick={e => e.stopPropagation()}
                              />
                              <FontAwesomeIcon
                                icon={expandedVersionId === version.id ? faChevronDown : faChevronRight}
                                className="text-xs text-base-content/50"
                              />
                              <span className="font-semibold">{version.name}</span>
                            </div>
                            <div className="text-sm text-base-content/60 ml-5">{formatDate(version.createdAt)}</div>
                            {version.description && (
                              <div className="text-sm mt-1 ml-5">{version.description}</div>
                            )}
                            <div className="text-xs text-base-content/50 mt-1 ml-5">
                              {t("messages:versionControl.problemCount", { count: version.contest.problems.length })}
                            </div>
                          </div>
                          <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                            <button
                              className="btn btn-xs btn-outline"
                              onClick={() => handleRestore(version.id)}
                            >
                              {t("messages:versionControl.restore")}
                            </button>
                            <button
                              className="btn btn-xs btn-ghost"
                              onClick={() => handleDeleteVersion(version.id)}
                            >
                              <FontAwesomeIcon icon={faTrash} />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* 展开内容 - 条件渲染 */}
                      {expandedVersionId === version.id && (
                        <div className="border-t border-base-300 p-3 bg-base-200/30">
                          <h5 className="font-medium text-sm mb-2">{t("messages:versionControl.problemList")}</h5>
                          <ul className="space-y-1">
                            {version.contest.problems.map((problem, idx) => (
                              <li key={idx} className="text-sm">
                                <button
                                  className="flex items-center gap-2 hover:text-primary w-full text-left"
                                  onClick={() => setPreviewProblemIndex(previewProblemIndex === idx ? null : idx)}
                                >
                                  <FontAwesomeIcon
                                    icon={previewProblemIndex === idx ? faChevronDown : faChevronRight}
                                    className="text-xs"
                                  />
                                  <span className="font-medium">{problem.problem.display_name}.</span>
                                  <span>{problem.problem.display_name}</span>
                                </button>
                                {previewProblemIndex === idx && (
                                  <div className="mt-2 p-2 bg-base-100 rounded text-xs font-mono max-h-64 overflow-y-auto space-y-2">
                                    {problem.statement.description && (
                                      <div>
                                        <div className="font-semibold text-base-content/70 mb-1">Description</div>
                                        <pre className="whitespace-pre-wrap">{problem.statement.description.slice(0, 1000)}{problem.statement.description.length > 1000 ? "..." : ""}</pre>
                                      </div>
                                    )}
                                    {problem.statement.input && (
                                      <div>
                                        <div className="font-semibold text-base-content/70 mb-1">Input</div>
                                        <pre className="whitespace-pre-wrap">{problem.statement.input.slice(0, 500)}{problem.statement.input.length > 500 ? "..." : ""}</pre>
                                      </div>
                                    )}
                                    {problem.statement.output && (
                                      <div>
                                        <div className="font-semibold text-base-content/70 mb-1">Output</div>
                                        <pre className="whitespace-pre-wrap">{problem.statement.output.slice(0, 500)}{problem.statement.output.length > 500 ? "..." : ""}</pre>
                                      </div>
                                    )}
                                    {problem.statement.notes && (
                                      <div>
                                        <div className="font-semibold text-base-content/70 mb-1">Notes</div>
                                        <pre className="whitespace-pre-wrap">{problem.statement.notes.slice(0, 500)}{problem.statement.notes.length > 500 ? "..." : ""}</pre>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Export/Import */}
            <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
              <button className="btn btn-sm btn-outline" onClick={handleImport}>
                <FontAwesomeIcon icon={faUpload} className="mr-1" />
                {t("messages:versionControl.import")}
              </button>
              <button className="btn btn-sm btn-outline" onClick={handleExport}>
                <FontAwesomeIcon icon={faDownload} className="mr-1" />
                {t("messages:versionControl.export")}
              </button>
            </div>
          </div>
        </div>

        {/* Save Version Modal */}
        {showSaveModal && (
          <div className="modal modal-open">
            <div className="modal-box">
              <h3 className="font-bold text-lg">{t("messages:versionControl.saveVersion")}</h3>
              <div className="form-control mt-4">
                <label className="label"><span className="label-text">{t("messages:versionControl.versionName")}</span></label>
                <input
                  type="text"
                  className="input input-bordered"
                  value={versionName}
                  onChange={e => setVersionName(e.target.value)}
                  placeholder="v1.0"
                />
              </div>
              <div className="form-control mt-4">
                <label className="label"><span className="label-text">{t("messages:versionControl.versionDesc")}</span></label>
                <textarea
                  className="textarea textarea-bordered"
                  value={versionDesc}
                  onChange={e => setVersionDesc(e.target.value)}
                  placeholder={t("messages:versionControl.versionDescPlaceholder")}
                />
              </div>
              <div className="modal-action">
                <button className="btn btn-ghost" onClick={() => setShowSaveModal(false)}>{t("common:cancel")}</button>
                <button className="btn btn-primary" onClick={handleSaveVersion}>{t("common:save")}</button>
              </div>
            </div>
            <div className="modal-backdrop" onClick={() => setShowSaveModal(false)}></div>
          </div>
        )}

        {/* New Branch Modal */}
        {showNewBranchModal && (
          <div className="modal modal-open">
            <div className="modal-box">
              <h3 className="font-bold text-lg">{t("messages:versionControl.newBranch")}</h3>
              <div className="form-control mt-4">
                <label className="label"><span className="label-text">{t("messages:versionControl.branchName")}</span></label>
                <input
                  type="text"
                  className="input input-bordered"
                  value={newBranchName}
                  onChange={e => setNewBranchName(e.target.value)}
                  placeholder="draft-A"
                />
              </div>

              {/* 基于版本选择 */}
              <div className="form-control mt-4">
                <label className="label"><span className="label-text">{t("messages:versionControl.branchBase")}</span></label>
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="branchBase"
                      className="radio radio-primary"
                      checked={branchBaseType === "empty"}
                      onChange={() => { setBranchBaseType("empty"); setSelectedBaseVersionId(""); }}
                    />
                    <span>{t("messages:versionControl.branchBaseEmpty")}</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="branchBase"
                      className="radio radio-primary"
                      checked={branchBaseType === "version"}
                      onChange={() => setBranchBaseType("version")}
                    />
                    <span>{t("messages:versionControl.branchBaseVersion")}</span>
                  </label>
                  {branchBaseType === "version" && (
                    <select
                      className="select select-bordered mt-2"
                      value={selectedBaseVersionId}
                      onChange={e => setSelectedBaseVersionId(e.target.value)}
                    >
                      <option value="">{t("messages:versionControl.selectVersion")}</option>
                      {versions.map(v => (
                        <option key={v.id} value={v.id}>{v.name} - {formatDate(v.createdAt)}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              <div className="modal-action">
                <button className="btn btn-ghost" onClick={() => { setShowNewBranchModal(false); setBranchBaseType("empty"); setSelectedBaseVersionId(""); }}>{t("common:cancel")}</button>
                <button className="btn btn-primary" onClick={handleCreateBranch}>{t("common:create")}</button>
              </div>
            </div>
            <div className="modal-backdrop" onClick={() => { setShowNewBranchModal(false); setBranchBaseType("empty"); setSelectedBaseVersionId(""); }}></div>
          </div>
        )}
      </div>
      <div className="modal-backdrop" onClick={onClose}></div>
    </div>

    {/* Diff Modal - rendered at root level */}
    {showDiffModal && (
      <div className="modal modal-open">
        <div className="modal-box max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-lg">
              {diffVersions ? `${diffVersions.v1} ↔ ${diffVersions.v2}` : t("messages:versionControl.diffResult")}
            </h3>
            <button className="btn btn-sm btn-ghost" onClick={() => { setShowDiffModal(false); setDiffVersions(null); }}>
              <FontAwesomeIcon icon={faX} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {diffResult.length === 0 ? (
              <p className="text-center text-base-content/50">{t("messages:versionControl.noDiff")}</p>
            ) : (
              <div className="space-y-4">
                {diffResult.map((item, idx) => (
                  <div key={idx} className="border rounded p-3">
                    <h4 className="font-semibold mb-2">{item.problemName}</h4>
                    <div className="font-mono text-sm whitespace-pre-wrap">
                      {item.diff.length === 0 ? (
                        <span className="text-base-content/50">{t("messages:versionControl.newProblem")}</span>
                      ) : (
                        item.diff.map((part, i) => (
                          <span
                            key={i}
                            className={part.added ? "bg-success/30" : part.removed ? "bg-error/30" : ""}
                          >
                            {part.value}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="modal-backdrop" onClick={() => setShowDiffModal(false)}></div>
      </div>
    )}
    </>
  );
};

export default VersionManager;
