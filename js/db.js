// IndexedDBの薄い層。判断はここに書かない

const DB_NAME = 'kiroku-cho';
const DB_VERSION = 1;
let opening = null;

function open() {
  opening ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      db.createObjectStore('records', { keyPath: 'id' });
      db.createObjectStore('attachments', { keyPath: 'id' });
      db.createObjectStore('meta');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return opening;
}

// トランザクションが確定してから解決する。fn がリクエストを返した時は、その結果を返す
async function run(storeNames, mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeNames, mode);
    let result;
    tx.oncomplete = () => resolve(result instanceof IDBRequest ? result.result : result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('保存が中断されました'));
    result = fn(tx);
  });
}

export function getAllRecords() {
  return run(['records'], 'readonly', (tx) => tx.objectStore('records').getAll());
}

export function getAllAttachments() {
  return run(['attachments'], 'readonly', (tx) => tx.objectStore('attachments').getAll());
}

export async function getAttachmentsMeta() {
  return (await getAllAttachments()).map(({ blob, ...meta }) => meta);
}

export function getAttachment(id) {
  return run(['attachments'], 'readonly', (tx) => tx.objectStore('attachments').get(id));
}

// 記録と添付は必ず同じトランザクションで書く（片方だけ残るのを防ぐ）
export function putAll(records, attachments = []) {
  return run(['records', 'attachments'], 'readwrite', (tx) => {
    for (const attachment of attachments) tx.objectStore('attachments').put(attachment);
    for (const record of records) tx.objectStore('records').put(record);
  });
}

export function getMeta(key) {
  return run(['meta'], 'readonly', (tx) => tx.objectStore('meta').get(key));
}

export function setMeta(key, value) {
  return run(['meta'], 'readwrite', (tx) => {
    tx.objectStore('meta').put(value, key);
  });
}
