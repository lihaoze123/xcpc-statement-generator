import type { Contest, ContestWithImages } from "@/types/contest";

const DB_NAME = "xcpc-statement-gen-db";
const CONFIG_STORE = "contest-config";
const IMAGES_STORE = "images";
const DB_VERSION = 26; // Must match versionControl.ts

// Image blob storage type
interface StoredImageData {
  uuid: string;
  blob: Blob;
}

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(CONFIG_STORE)) {
        db.createObjectStore(CONFIG_STORE);
      }
      // Delete and recreate images store to ensure correct schema
      if (db.objectStoreNames.contains(IMAGES_STORE)) {
        db.deleteObjectStore(IMAGES_STORE);
      }
      db.createObjectStore(IMAGES_STORE, { keyPath: "uuid" });
    };
  });
};

export const saveConfigToDB = async (data: ContestWithImages): Promise<void> => {
  const db = await openDB();
  // Convert ContestWithImages to Contest (strip urls)
  const storedData: Contest = {
    meta: data.meta,
    problems: data.problems,
    images: data.images.map((img) => ({ uuid: img.uuid, name: img.name })),
    template: data.template,
  };
  return new Promise((resolve, reject) => {
    const tx = db.transaction([CONFIG_STORE], "readwrite");
    const store = tx.objectStore(CONFIG_STORE);
    const request = store.put(storedData, "config");
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};

export const saveImageToDB = async (uuid: string, blob: Blob): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([IMAGES_STORE], "readwrite");
    const store = tx.objectStore(IMAGES_STORE);
    const request = store.put({ uuid, blob } as StoredImageData);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};

export const deleteImageFromDB = async (uuid: string): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([IMAGES_STORE], "readwrite");
    const store = tx.objectStore(IMAGES_STORE);
    const request = store.delete(uuid);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};

export const loadConfigFromDB = async (): Promise<{
  data: Contest;
  images: Map<string, Blob>;
} | null> => {
  const db = await openDB();

  // Load config
  const storedData: Contest | null = await new Promise((resolve, reject) => {
    const tx = db.transaction([CONFIG_STORE], "readonly");
    const store = tx.objectStore(CONFIG_STORE);
    const request = store.get("config");
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || null);
  });

  if (!storedData) return null;

  // Load images
  const imageMap = new Map<string, Blob>();
  const imageUuids = (storedData.images || []).map((img) => img.uuid);

  if (imageUuids.length > 0) {
    const images: (StoredImageData | undefined)[] = await new Promise((resolve, reject) => {
      const tx = db.transaction([IMAGES_STORE], "readonly");
      const store = tx.objectStore(IMAGES_STORE);
      const results: (StoredImageData | undefined)[] = [];
      let pending = imageUuids.length;

      imageUuids.forEach((uuid, i) => {
        const request = store.get(uuid);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          results[i] = request.result;
          pending--;
          if (pending === 0) resolve(results);
        };
      });
    });

    images.forEach((imageData) => {
      if (imageData) {
        imageMap.set(imageData.uuid, imageData.blob);
      }
    });
  }

  return { data: storedData, images: imageMap };
};

export const clearDB = async (): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([CONFIG_STORE, IMAGES_STORE], "readwrite");
    const configStore = tx.objectStore(CONFIG_STORE);
    const imagesStore = tx.objectStore(IMAGES_STORE);

    const clearConfig = configStore.clear();
    const clearImages = imagesStore.clear();

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);

    // Ignore individual request errors, let transaction handle it
    clearConfig.onerror = clearImages.onerror = null;
  });
};

// Helper functions for base64 conversion
const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      resolve(base64.split(",")[1]); // Remove data URL prefix
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

const base64ToBlob = (base64: string, mimeType: string): Blob => {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
};

// Export interface for JSON serialization
interface ExportedImageData {
  uuid: string;
  name: string;
  base64: string;
  mimeType: string;
}

interface ExportedConfig {
  meta: Contest["meta"];
  problems: Contest["problems"];
  images: ExportedImageData[];
  template?: string;
}

export const exportConfig = async (data: ContestWithImages): Promise<string> => {
  const imageData: ExportedImageData[] = [];

  for (const img of data.images) {
    // Fetch blob from blob URL
    const response = await fetch(img.url);
    const blob = await response.blob();

    const base64 = await blobToBase64(blob);
    imageData.push({
      uuid: img.uuid,
      name: img.name,
      base64,
      mimeType: blob.type,
    });
  }

  const exportData: ExportedConfig = {
    meta: data.meta,
    problems: data.problems,
    images: imageData,
    template: data.template,
  };

  return JSON.stringify(exportData, null, 2);
};

export const importConfig = (json: string): {
  data: Contest;
  images: Map<string, Blob>;
} => {
  const importData = JSON.parse(json);

  // Extract images
  const images = new Map<string, Blob>();
  const imageData = importData.images || [];

  for (const img of imageData) {
    if (img.base64 && img.mimeType) {
      const blob = base64ToBlob(img.base64, img.mimeType);
      images.set(img.uuid, blob);
    }
  }

  // Return data structure without url field
  const data: Contest = {
    meta: importData.meta,
    problems: importData.problems,
    images: imageData.map((img: { uuid: string; name: string }) => ({
      uuid: img.uuid,
      name: img.name,
    })),
    template: importData.template,
  };

  return { data, images };
};
