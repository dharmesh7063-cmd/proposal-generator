// Keeps the current proposal (including its images) in IndexedDB so a refresh or
// a closed tab doesn't lose work. Everything stays in this browser.
const DB_NAME = 'intara-proposal-generator';
const DRAFT_KEY = 'draft';

let dbPromise;
function db() {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore('meta');
      req.result.createObjectStore('blobs');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function run(store, mode, fn) {
  return db().then(
    (d) =>
      new Promise((resolve, reject) => {
        const tx = d.transaction(store, mode);
        const result = fn(tx.objectStore(store));
        tx.oncomplete = () => resolve(result?.result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      }),
  );
}

export function saveImageBlobs(id, blob, previewBlob) {
  return run('blobs', 'readwrite', (s) => {
    s.put(blob, `${id}:full`);
    s.put(previewBlob, `${id}:preview`);
  });
}

export function deleteImageBlobs(id) {
  return run('blobs', 'readwrite', (s) => {
    s.delete(`${id}:full`);
    s.delete(`${id}:preview`);
  });
}

export function saveDraft(draft) {
  return run('meta', 'readwrite', (s) => s.put(draft, DRAFT_KEY));
}

export async function loadDraft() {
  const draft = await run('meta', 'readonly', (s) => s.get(DRAFT_KEY));
  if (!draft) return null;
  const images = {};
  for (const meta of Object.values(draft.images || {})) {
    const [blob, previewBlob] = await Promise.all([
      run('blobs', 'readonly', (s) => s.get(`${meta.id}:full`)),
      run('blobs', 'readonly', (s) => s.get(`${meta.id}:preview`)),
    ]);
    if (blob && previewBlob) images[meta.id] = { ...meta, blob, previewBlob };
  }
  return { ...draft, images };
}

export function clearAll() {
  return Promise.all([run('meta', 'readwrite', (s) => s.clear()), run('blobs', 'readwrite', (s) => s.clear())]);
}
