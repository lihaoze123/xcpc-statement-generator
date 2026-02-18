# 版本管理功能实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为 XCPC Statement Generator 添加版本管理功能，支持手动保存版本、版本对比、分支管理和导出导入。

**Architecture:** 使用 IndexedDB 存储版本和分支数据，使用 `diff` 库进行文本差异对比，在设置面板中添加版本管理入口。

**Tech Stack:** React + TypeScript + IndexedDB + diff 库

---

## 任务总览

| 任务 | 描述 |
|------|------|
| 1 | 添加 diff 依赖并定义类型 |
| 2 | 创建版本管理工具函数 |
| 3 | 创建版本管理 UI 组件 |
| 4 | 集成到主编辑器 |

---

### 任务 1: 添加 diff 依赖并定义类型

**Files:**
- Modify: `package.json`
- Modify: `src/types/contest.ts`

**Step 1: 添加 diff 依赖**

```bash
npm install diff @types/diff
```

**Step 2: 在 types/contest.ts 中添加版本相关类型**

在文件末尾添加：

```typescript
// 版本/快照
export interface Version {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  branchId: string;
  parentVersionId?: string;
  contest: Contest;
  images: ImageMeta[];
}

// 分支
export interface Branch {
  id: string;
  name: string;
  createdAt: number;
  currentVersionId: string;
}

// 导出的版本包
export interface ExportedVersions {
  type: "xcpc-versions";
  version: "1.0";
  exportedAt: number;
  branches: Branch[];
  versions: (Omit<Version, "contest" | "images"> & {
    contest: Contest;
    images: ExportedImageData[];
  })[];
}
```

**Step 3: 提交**

```bash
git add package.json src/types/contest.ts
git commit -m "feat: add diff dependency and version types"
```

---

### 任务 2: 创建版本管理工具函数

**Files:**
- Create: `src/utils/versionControl.ts`

**Step 1: 创建 versionControl.ts**

```typescript
import type { Contest, ContestWithImages, ImageMeta, Version, Branch, ExportedVersions, ExportedImageData } from "@/types/contest";

const DB_NAME = "xcpc-statement-gen-db";
const VERSIONS_STORE = "versions";
const BRANCHES_STORE = "branches";
const DB_VERSION = 26;

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBDatabase).result;
      if (!db.objectStoreNames.contains(VERSIONS_STORE)) {
        db.createObjectStore(VERSIONS_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(BRANCHES_STORE)) {
        db.createObjectStore(BRANCHES_STORE, { keyPath: "id" });
      }
    };
  });
};

// 保存版本
export const saveVersion = async (version: Version): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([VERSIONS_STORE], "readwrite");
    const store = tx.objectStore(VERSIONS_STORE);
    const request = store.put(version);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};

// 获取某分支的所有版本
export const getVersionsByBranch = async (branchId: string): Promise<Version[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([VERSIONS_STORE], "readonly");
    const store = tx.objectStore(VERSIONS_STORE);
    const request = store.getAll();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const versions = (request.result as Version[]).filter(v => v.branchId === branchId);
      resolve(versions.sort((a, b) => b.createdAt - a.createdAt));
    };
  });
};

// 获取所有版本
export const getAllVersions = async (): Promise<Version[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([VERSIONS_STORE], "readonly");
    const store = tx.objectStore(VERSIONS_STORE);
    const request = store.getAll();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve((request.result as Version[]).sort((a, b) => b.createdAt - a.createdAt));
  });
};

// 获取单个版本
export const getVersion = async (id: string): Promise<Version | undefined> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([VERSIONS_STORE], "readonly");
    const store = tx.objectStore(VERSIONS_STORE);
    const request = store.get(id);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
};

// 删除版本
export const deleteVersion = async (id: string): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([VERSIONS_STORE], "readwrite");
    const store = tx.objectStore(VERSIONS_STORE);
    const request = store.delete(id);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};

// 保存分支
export const saveBranch = async (branch: Branch): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([BRANCHES_STORE], "readwrite");
    const store = tx.objectStore(BRANCHES_STORE);
    const request = store.put(branch);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};

// 获取所有分支
export const getAllBranches = async (): Promise<Branch[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([BRANCHES_STORE], "readonly");
    const store = tx.objectStore(BRANCHES_STORE);
    const request = store.getAll();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve((request.result as Branch[]).sort((a, b) => a.createdAt - b.createdAt));
  });
};

// 删除分支（同时删除该分支的所有版本）
export const deleteBranch = async (id: string): Promise<void> => {
  const db = await openDB();
  const versions = await getVersionsByBranch(id);

  return new Promise((resolve, reject) => {
    const tx = db.transaction([VERSIONS_STORE, BRANCHES_STORE], "readwrite");
    const versionsStore = tx.objectStore(VERSIONS_STORE);
    const branchesStore = tx.objectStore(BRANCHES_STORE);

    versions.forEach(v => versionsStore.delete(v.id));
    branchesStore.delete(id);

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

// 创建新版本
export const createVersion = async (
  name: string,
  description: string,
  branchId: string,
  contest: Contest,
  images: ImageMeta[]
): Promise<Version> => {
  const version: Version = {
    id: crypto.randomUUID(),
    name,
    description,
    createdAt: Date.now(),
    branchId,
    contest,
    images,
  };
  await saveVersion(version);
  return version;
};

// 创建新分支
export const createBranch = async (
  name: string,
  fromVersionId?: string
): Promise<Branch> => {
  const branches = await getAllBranches();

  let currentVersionId = "";
  if (fromVersionId) {
    const version = await getVersion(fromVersionId);
    if (version) {
      currentVersionId = fromVersionId;
    }
  }

  const branch: Branch = {
    id: crypto.randomUUID(),
    name,
    createdAt: Date.now(),
    currentVersionId,
  };

  await saveBranch(branch);
  return branch;
};

// 导出版本包
export const exportVersions = async (): Promise<string> => {
  const branches = await getAllBranches();
  const versions = await getAllVersions();

  // Helper: blob to base64
  const blobToBase64 = async (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        resolve(base64.split(",")[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  // Need to get actual blobs from images - simplified: just export metadata
  const exportData: ExportedVersions = {
    type: "xcpc-versions",
    version: "1.0",
    exportedAt: Date.now(),
    branches,
    versions: versions.map(v => ({
      ...v,
      images: v.images as ExportedImageData[],
    })),
  };

  return JSON.stringify(exportData, null, 2);
};

// 导入版本包
export const importVersions = async (json: string): Promise<void> => {
  const data = JSON.parse(json) as ExportedVersions;

  if (data.type !== "xcpc-versions") {
    throw new Error("Invalid version package format");
  }

  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction([VERSIONS_STORE, BRANCHES_STORE], "readwrite");
    const versionsStore = tx.objectStore(VERSIONS_STORE);
    const branchesStore = tx.objectStore(BRANCHES_STORE);

    data.branches.forEach(b => branchesStore.put(b));
    data.versions.forEach(v => versionsStore.put(v));

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

// 创建默认分支（如果不存在）
export const ensureDefaultBranch = async (): Promise<Branch> => {
  const branches = await getAllBranches();
  if (branches.length === 0) {
    return createBranch("main");
  }
  return branches[0];
};
```

**Step 2: 提交**

```bash
git add src/utils/versionControl.ts
git commit -m "feat: add version control utilities"
```

---

### 任务 3: 创建版本管理 UI 组件

**Files:**
- Create: `src/components/VersionManager.tsx`

**Step 1: 创建 VersionManager.tsx**

```tsx
import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faTrash, faCodeBranch, faHistory, faDownload, faUpload, faCompress, faExpand } from "@fortawesome/free-solid-svg-icons";
import * as Diff from "diff";
import type { Version, Branch, ContestWithImages, ImageData, Contest, ImageMeta } from "@/types/contest";
import {
  getAllBranches, saveBranch, deleteBranch,
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

  // Load branches
  useEffect(() => {
    getAllBranches().then(branches => {
      setBranches(branches);
      if (branches.length > 0 && !selectedBranchId) {
        setSelectedBranchId(branches[0].id);
      }
    });
  }, []);

  // Load versions when branch changes
  useEffect(() => {
    if (selectedBranchId) {
      getVersionsByBranch(selectedBranchId).then(setVersions);
    }
  }, [selectedBranchId]);

  // Handle save version
  const handleSaveVersion = async () => {
    if (!versionName.trim() || !selectedBranchId) return;

    const contest: Contest = {
      meta: currentContest.meta,
      problems: currentContest.problems,
      images: currentContest.images.map(img => ({ uuid: img.uuid, name: img.name })),
    };

    await saveVersion({
      id: crypto.randomUUID(),
      name: versionName,
      description: versionDesc,
      createdAt: Date.now(),
      branchId: selectedBranchId,
      contest,
      images: contest.images,
    });

    setShowSaveModal(false);
    setVersionName("");
    setVersionDesc("");

    // Refresh versions
    const newVersions = await getVersionsByBranch(selectedBranchId);
    setVersions(newVersions);
    showToast(t("versionControl:versionSaved"));
  };

  // Handle create branch
  const handleCreateBranch = async () => {
    if (!newBranchName.trim()) return;

    await saveBranch({
      id: crypto.randomUUID(),
      name: newBranchName,
      createdAt: Date.now(),
      currentVersionId: "",
    });

    setShowNewBranchModal(false);
    setNewBranchName("");

    // Refresh branches
    const newBranches = await getAllBranches();
    setBranches(newBranches);
    setSelectedBranchId(newBranches[newBranches.length - 1].id);
    showToast(t("versionControl:branchCreated"));
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
    showToast(t("versionControl:versionRestored"));
  };

  // Handle delete version
  const handleDeleteVersion = async (versionId: string) => {
    await deleteVersion(versionId);
    const newVersions = await getVersionsByBranch(selectedBranchId);
    setVersions(newVersions);
    showToast(t("versionControl:versionDeleted"));
  };

  // Handle delete branch
  const handleDeleteBranch = async (branchId: string) => {
    if (branches.length <= 1) {
      showToast(t("versionControl:cannotDeleteLastBranch"), "error");
      return;
    }
    await deleteBranch(branchId);
    const newBranches = await getAllBranches();
    setBranches(newBranches);
    setSelectedBranchId(newBranches[0].id);
    showToast(t("versionControl:branchDeleted"));
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

    // Compare problems
    const result: { problemName: string; diff: Diff.Change[] }[] = [];

    const problems1 = v1.contest.problems;
    const problems2 = v2.contest.problems;

    // Simple comparison: for each problem in v2, compare with v1
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
      showToast(t("versionControl:exportSuccess"));
    } catch (e) {
      showToast(t("versionControl:exportFailed"), "error");
    }
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
        showToast(t("versionControl:importSuccess"));
      } catch (e) {
        showToast(t("versionControl:importFailed"), "error");
      }
    };
    input.click();
  };

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-xl">{t("versionControl:title")}</h3>
          <button className="btn btn-sm btn-ghost" onClick={onClose}>
            <FontAwesomeIcon icon={faX} />
          </button>
        </div>

        <div className="flex flex-1 gap-4 min-h-0">
          {/* Left: Branches */}
          <div className="w-48 flex flex-col">
            <h4 className="font-semibold mb-2">{t("versionControl:branches")}</h4>
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
              {t("versionControl:newBranch")}
            </button>
          </div>

          {/* Right: Versions */}
          <div className="flex-1 flex flex-col min-w-0">
            <div className="flex justify-between items-center mb-2">
              <h4 className="font-semibold">{t("versionControl:versions")}</h4>
              <div className="flex gap-2">
                <button
                  className="btn btn-sm"
                  onClick={handleShowDiff}
                  disabled={selectedVersions.length !== 2}
                >
                  <FontAwesomeIcon icon={faCompress} className="mr-1" />
                  {t("versionControl:compare")}
                </button>
                <button className="btn btn-sm btn-primary" onClick={() => setShowSaveModal(true)}>
                  <FontAwesomeIcon icon={faPlus} className="mr-1" />
                  {t("versionControl:saveVersion")}
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {versions.length === 0 ? (
                <div className="text-center text-base-content/50 py-8">
                  <FontAwesomeIcon icon={faHistory} className="text-4xl mb-2" />
                  <p>{t("versionControl:noVersions")}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {versions.map(version => (
                    <div
                      key={version.id}
                      className={`p-3 rounded border-2 cursor-pointer ${selectedVersions.includes(version.id) ? "border-primary" : "border-base-300 hover:border-primary/50"}`}
                      onClick={() => handleVersionSelect(version.id)}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-semibold">{version.name}</div>
                          <div className="text-sm text-base-content/60">{formatDate(version.createdAt)}</div>
                          {version.description && (
                            <div className="text-sm mt-1">{version.description}</div>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <button
                            className="btn btn-xs btn-outline"
                            onClick={(e) => { e.stopPropagation(); handleRestore(version.id); }}
                          >
                            {t("versionControl:restore")}
                          </button>
                          <button
                            className="btn btn-xs btn-ghost"
                            onClick={(e) => { e.stopPropagation(); handleDeleteVersion(version.id); }}
                          >
                            <FontAwesomeIcon icon={faTrash} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Export/Import */}
            <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
              <button className="btn btn-sm btn-outline" onClick={handleImport}>
                <FontAwesomeIcon icon={faUpload} className="mr-1" />
                {t("versionControl:import")}
              </button>
              <button className="btn btn-sm btn-outline" onClick={handleExport}>
                <FontAwesomeIcon icon={faDownload} className="mr-1" />
                {t("versionControl:export")}
              </button>
            </div>
          </div>
        </div>

        {/* Save Version Modal */}
        {showSaveModal && (
          <div className="modal modal-open">
            <div className="modal-box">
              <h3 className="font-bold text-lg">{t("versionControl:saveVersion")}</h3>
              <div className="form-control mt-4">
                <label className="label"><span className="label-text">{t("versionControl:versionName")}</span></label>
                <input
                  type="text"
                  className="input input-bordered"
                  value={versionName}
                  onChange={e => setVersionName(e.target.value)}
                  placeholder="v1.0"
                />
              </div>
              <div className="form-control mt-4">
                <label className="label"><span className="label-text">{t("versionControl:versionDesc")}</span></label>
                <textarea
                  className="textarea textarea-bordered"
                  value={versionDesc}
                  onChange={e => setVersionDesc(e.target.value)}
                  placeholder={t("versionControl:versionDescPlaceholder")}
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
              <h3 className="font-bold text-lg">{t("versionControl:newBranch")}</h3>
              <div className="form-control mt-4">
                <label className="label"><span className="label-text">{t("versionControl:branchName")}</span></label>
                <input
                  type="text"
                  className="input input-bordered"
                  value={newBranchName}
                  onChange={e => setNewBranchName(e.target.value)}
                  placeholder="draft-A"
                />
              </div>
              <div className="modal-action">
                <button className="btn btn-ghost" onClick={() => setShowNewBranchModal(false)}>{t("common:cancel")}</button>
                <button className="btn btn-primary" onClick={handleCreateBranch}>{t("common:create")}</button>
              </div>
            </div>
            <div className="modal-backdrop" onClick={() => setShowNewBranchModal(false)}></div>
          </div>
        )}

        {/* Diff Modal */}
        {showDiffModal && (
          <div className="modal modal-open">
            <div className="modal-box max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-lg">{t("versionControl:diffResult")}</h3>
                <button className="btn btn-sm btn-ghost" onClick={() => setShowDiffModal(false)}>
                  <FontAwesomeIcon icon={faX} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                {diffResult.length === 0 ? (
                  <p className="text-center text-base-content/50">{t("versionControl:noDiff")}</p>
                ) : (
                  <div className="space-y-4">
                    {diffResult.map((item, idx) => (
                      <div key={idx} className="border rounded p-3">
                        <h4 className="font-semibold mb-2">{item.problemName}</h4>
                        <div className="font-mono text-sm whitespace-pre-wrap">
                          {item.diff.length === 0 ? (
                            <span className="text-base-content/50">{t("versionControl:newProblem")}</span>
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
      </div>
      <div className="modal-backdrop" onClick={onClose}></div>
    </div>
  );
};

export default VersionManager;
```

**Step 2: 添加缺失的 import**

需要在文件开头添加：
```tsx
import { FC } from "react";
import { faX } from "@fortawesome/free-solid-svg-icons";
```

**Step 3: 提交**

```bash
git add src/components/VersionManager.tsx
git commit -m "feat: add VersionManager UI component"
```

---

### 任务 4: 集成到主编辑器

**Files:**
- Modify: `src/contestEditor/index.tsx`
- Modify: `src/i18n/**/*.json`

**Step 1: 在 index.tsx 中导入 VersionManager**

在 import 部分添加：
```tsx
import VersionManager from "@/components/VersionManager";
import { ensureDefaultBranch } from "@/utils/versionControl";
```

**Step 2: 添加状态和逻辑**

在 ContestEditorImpl 组件中添加：
```tsx
const [showVersionManager, setShowVersionManager] = useState(false);
```

**Step 3: 在设置面板添加入口**

在设置面板的按钮列表中添加：
```tsx
{/* Version Management */}
<button className="btn btn-outline btn-lg justify-start gap-4 h-14" onClick={() => { setShowSettings(false); setShowVersionManager(true); }}>
  <FontAwesomeIcon icon={faHistory} className="text-xl w-6" />
  <span className="text-base">{t('versionControl:title')}</span>
</button>
```

添加 faHistory icon:
```tsx
import { faHistory } from "@fortawesome/free-solid-svg-icons";
```

**Step 4: 添加 VersionManager 组件**

在 Settings Modal 后面添加：
```tsx
{showVersionManager && (
  <VersionManager
    currentContest={contestData}
    onRestore={(contest, images) => {
      updateContestData(() => contest);
      setShowVersionManager(false);
      showToast(t('versionControl:versionRestored'));
    }}
    onClose={() => setShowVersionManager(false)}
  />
)}
```

**Step 5: 添加 i18n 文案**

在 `src/i18n/zh.json` 和 `src/i18n/en.json` 中添加：

```json
{
  "versionControl": {
    "title": "版本管理",
    "branches": "分支",
    "versions": "版本",
    "newBranch": "新建分支",
    "branchName": "分支名称",
    "saveVersion": "保存版本",
    "versionName": "版本名称",
    "versionDesc": "版本说明",
    "versionDescPlaceholder": "可选的版本描述...",
    "restore": "恢复",
    "compare": "对比",
    "noVersions": "暂无版本记录",
    "import": "导入",
    "export": "导出",
    "versionSaved": "版本已保存",
    "versionRestored": "版本已恢复",
    "versionDeleted": "版本已删除",
    "branchCreated": "分支已创建",
    "branchDeleted": "分支已删除",
    "cannotDeleteLastBranch": "无法删除最后一个分支",
    "exportSuccess": "导出成功",
    "exportFailed": "导出失败",
    "importSuccess": "导入成功",
    "importFailed": "导入失败",
    "diffResult": "差异对比",
    "noDiff": "无差异",
    "newProblem": "新题目"
  }
}
```

**Step 6: 提交**

```bash
git add src/contestEditor/index.tsx src/i18n/zh.json src/i18n/en.json
git commit -m "feat: integrate version management into editor"
```

---

## 实现顺序

1. 任务 1: 添加 diff 依赖并定义类型
2. 任务 2: 创建版本管理工具函数
3. 任务 3: 创建版本管理 UI 组件
4. 任务 4: 集成到主编辑器

---

**Plan complete and saved to `docs/plans/2026-02-18-version-control-design.md`. Two execution options:**

1. **Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

2. **Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

Which approach?
