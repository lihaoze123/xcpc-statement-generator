import type { Contest, ImageMeta, Version, Branch, ExportedVersions, ExportedImageData } from "@/types/contest";

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
      const db = (event.target as IDBOpenDBRequest).result;
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

// 获取单个分支
export const getBranch = async (id: string): Promise<Branch | undefined> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([BRANCHES_STORE], "readonly");
    const store = tx.objectStore(BRANCHES_STORE);
    const request = store.get(id);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
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

  // Export metadata only (images not included in this simplified version)
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

  // Validation
  if (data.type !== "xcpc-versions") {
    throw new Error("Invalid version package format");
  }
  if (!data.version || data.version !== "1.0") {
    throw new Error("Unsupported version package version");
  }
  if (!Array.isArray(data.branches) || !Array.isArray(data.versions)) {
    throw new Error("Invalid version package structure");
  }

  // Generate ID mapping for branches to avoid conflicts
  const branchIdMap = new Map<string, string>();
  const importedBranches = data.branches.map(b => {
    const newId = crypto.randomUUID();
    branchIdMap.set(b.id, newId);
    return {
      ...b,
      id: newId,
      name: b.name + " (imported)",
    };
  });

  // Update version branchIds and generate new IDs
  const importedVersions = data.versions.map(v => ({
    ...v,
    id: crypto.randomUUID(),
    branchId: branchIdMap.get(v.branchId) || v.branchId,
    name: v.name + " (imported)",
  }));

  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction([VERSIONS_STORE, BRANCHES_STORE], "readwrite");
    const versionsStore = tx.objectStore(VERSIONS_STORE);
    const branchesStore = tx.objectStore(BRANCHES_STORE);

    importedBranches.forEach(b => branchesStore.put(b));
    importedVersions.forEach(v => versionsStore.put(v));

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
