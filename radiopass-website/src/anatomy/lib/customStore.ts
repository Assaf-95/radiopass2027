// Minimal IndexedDB wrapper for storing learner-uploaded case images as
// Blobs. Chosen over localStorage because photo-sized images quickly blow
// past localStorage's ~5-10MB quota, while IndexedDB comfortably holds a
// growing personal collection.

const DB_NAME = 'frcr-anatomy-custom';
const STORE_NAME = 'images';
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveImageBlob(id: string, blob: Blob): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(blob, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getImageBlob(id: string): Promise<Blob | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(id);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteImageBlob(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export const CUSTOM_IMAGE_SCHEME = 'idb://';

export function isCustomImageRef(imagePath: string): boolean {
  return imagePath.startsWith(CUSTOM_IMAGE_SCHEME);
}

export function customImageId(imagePath: string): string {
  return imagePath.slice(CUSTOM_IMAGE_SCHEME.length);
}

// Object URLs are only valid for the lifetime of the document, so every
// resolution creates (and the caller is responsible for revoking) a fresh
// one — see useResolvedImageSrc in QuestionPlayer.
export async function resolveCustomImageSrc(imagePath: string): Promise<string | null> {
  const id = customImageId(imagePath);
  const blob = await getImageBlob(id);
  if (!blob) return null;
  return URL.createObjectURL(blob);
}
