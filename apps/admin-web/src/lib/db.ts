/**
 * KidzVenture Persistent Database — IndexedDB wrapper.
 * Falls back to localStorage for browsers without IndexedDB.
 *
 * Usage (in store.ts):
 *   import { kvdb } from "./db";
 *   await kvdb.set("kv_centres", [...]);
 *   const data = await kvdb.get("kv_centres");
 */

const DB_NAME = "kidzventure_erp";
const DB_VER  = 1;
const STORE   = "kv_store";

// Internal connection — named _conn to avoid clash with the export
let _conn: IDBDatabase | null = null;

function openConnection(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (_conn) { resolve(_conn); return; }
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = (e) => {
      const idb = (e.target as IDBOpenDBRequest).result;
      if (!idb.objectStoreNames.contains(STORE)) idb.createObjectStore(STORE);
    };
    req.onsuccess = (e) => { _conn = (e.target as IDBOpenDBRequest).result; resolve(_conn); };
    req.onerror   = () => reject(req.error);
  });
}

async function runTx<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const idb = await openConnection();
  return new Promise((resolve, reject) => {
    const tx    = idb.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    const req   = fn(store);
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

async function kvGet<T>(key: string): Promise<T | null> {
  try {
    const val = await runTx<T | undefined>("readonly", (s) => s.get(key));
    return val ?? null;
  } catch {
    // Fallback: read from localStorage
    try { return JSON.parse(localStorage.getItem(key) ?? "null"); } catch { return null; }
  }
}

async function kvSet(key: string, value: unknown): Promise<void> {
  // Always mirror to localStorage first (instant synchronous reads in store.ts)
  localStorage.setItem(key, JSON.stringify(value));
  try {
    await runTx("readwrite", (s) => s.put(value, key));
  } catch {
    // IndexedDB failed — localStorage mirror is already set above, that's fine
  }
  window.dispatchEvent(new CustomEvent("kv-store-update", { detail: key }));
}

async function kvDel(key: string): Promise<void> {
  localStorage.removeItem(key);
  try { await runTx("readwrite", (s) => s.delete(key)); } catch {}
  window.dispatchEvent(new CustomEvent("kv-store-update", { detail: key }));
}

/** One-time migration: copy any existing localStorage data into IndexedDB */
async function migrateFromLocalStorage() {
  const STATIC_KEYS = [
    "kv_centers", "kv_local_employees", "kv_orders", "kv_local_invoices",
    "kv_ledger_entries", "kv_leave_requests", "kv_product_catalogue",
    "kv_payslips", "kv_attendance_log",
  ];

  for (const key of STATIC_KEYS) {
    const raw = localStorage.getItem(key);
    if (!raw) continue;
    try {
      const existing = await kvGet(key);
      if (existing === null) await kvSet(key, JSON.parse(raw));
    } catch { /* skip */ }
  }

  // Migrate dynamic per-day attendance keys
  const dynamicKeys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && (k.startsWith("kv_emp_attendance_") || k.startsWith("kv_my_attendance_"))) {
      dynamicKeys.push(k);
    }
  }
  for (const key of dynamicKeys) {
    const raw = localStorage.getItem(key);
    if (!raw) continue;
    try {
      const existing = await kvGet(key);
      if (existing === null) await kvSet(key, JSON.parse(raw));
    } catch { /* skip */ }
  }
}

// Run migration once at module load (non-blocking)
migrateFromLocalStorage().catch(() => {});

/** The exported database interface used by store.ts */
export const kvdb = {
  get: kvGet,
  set: kvSet,
  del: kvDel,
};
