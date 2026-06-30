/**
 * IndexedDB wrapper for Coherence node storage.
 * All data stays local in the browser — no network calls.
 */

const DB_NAME = 'Coherence';
const DB_VERSION = 1;
const STORE_NAME = 'nodes';
const VECTOR_STORE = 'vectors';

export function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('sourceUrl', 'sourceUrl', { unique: false });
        store.createIndex('tags', 'tags', { multipleValues: true, unique: false });
      }

      if (!db.objectStoreNames.contains(VECTOR_STORE)) {
        db.createObjectStore(VECTOR_STORE, { keyPath: 'nodeId' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveNode(node) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put({ ...node, timestamp: Date.now() });
    tx.oncomplete = () => resolve(node);
    tx.onerror = () => reject(tx.error);
  });
}

export async function saveVector(nodeId, vector) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(VECTOR_STORE, 'readwrite');
    const store = tx.objectStore(VECTOR_STORE);
    store.put({ nodeId, vector });
    tx.oncomplete = () => resolve(nodeId);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAllNodes() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result.sort((a, b) => a.timestamp - b.timestamp));
    request.onerror = () => reject(tx.error);
  });
}

export async function getNode(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(tx.error);
  });
}

export async function getAllVectors() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(VECTOR_STORE, 'readonly');
    const store = tx.objectStore(VECTOR_STORE);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(tx.error);
  });
}

export async function deleteNode(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_NAME, VECTOR_STORE], 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.objectStore(VECTOR_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearAll() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx1 = db.transaction(STORE_NAME, 'readwrite');
    tx1.objectStore(STORE_NAME).clear();
    const tx2 = db.transaction(VECTOR_STORE, 'readwrite');
    tx2.objectStore(VECTOR_STORE).clear();
    tx1.oncomplete = () => tx2.oncomplete = () => resolve();
    tx1.onerror = tx2.onerror = () => reject(tx1.error);
  });
}

export async function getStorageUsage() {
  const nodes = await getAllNodes();
  const vectors = await getAllVectors();
  // Rough estimate in bytes
  const data = JSON.stringify([...nodes, ...vectors]);
  return new Blob([data]).size;
}
