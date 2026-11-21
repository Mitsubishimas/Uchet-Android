/** IndexedDB storage for offline orders */
const DB_NAME = "uchet-mastermitsu";
const DB_VERSION = 1;
const STORE = "orders";

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const os = db.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
        os.createIndex("created_at", "created_at", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore(mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    let result;
    try {
      result = fn(store);
    } catch (e) {
      reject(e);
      return;
    }
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
  });
}

async function listOrders() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => {
      const rows = (req.result || []).slice();
      rows.sort((a, b) => {
        if (a.created_at !== b.created_at) return a.created_at < b.created_at ? 1 : -1;
        return b.id - a.id;
      });
      resolve(rows);
    };
    req.onerror = () => reject(req.error);
  });
}

async function getOrder(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, "readonly").objectStore(STORE).get(Number(id));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function createOrder(draft) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const req = tx.objectStore(STORE).add(draft);
    req.onsuccess = () => resolve({ id: req.result, ...draft });
    req.onerror = () => reject(req.error);
  });
}

async function updateOrder(id, draft) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const getReq = store.get(Number(id));
    getReq.onsuccess = () => {
      if (!getReq.result) {
        resolve(false);
        return;
      }
      store.put({ ...draft, id: Number(id) });
    };
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

async function deleteOrder(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(Number(id));
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

// Non-module fallback for file:// and simple serve
window.UchetDB = { listOrders, getOrder, createOrder, updateOrder, deleteOrder };
