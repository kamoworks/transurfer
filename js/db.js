/* IndexedDB wrapper — stdlib only, fails loudly.
   Stores: kv (profile/settings-adjacent state), slides, days (one per date), logs.
   localStorage is reserved for connection settings + token (see coach step). */
'use strict';

const DB_NAME = 'transurfer';
const DB_VERSION = 1;
let _db = null;

function open() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      db.createObjectStore('kv');
      db.createObjectStore('slides', { keyPath: 'id', autoIncrement: true });
      db.createObjectStore('days', { keyPath: 'date' });
      db.createObjectStore('logs', { keyPath: 'id', autoIncrement: true })
        .createIndex('byDate', 'date');
    };
    req.onsuccess = () => { _db = req.result; resolve(_db); };
    req.onerror = () => reject(new Error('IndexedDB open failed: ' + req.error));
  });
}

function tx(store, mode, fn) {
  return open().then(db => new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const result = fn(t.objectStore(store));
    t.oncomplete = () => resolve(result.__value !== undefined ? result.__value : undefined);
    t.onerror = () => reject(new Error(store + ' tx failed: ' + t.error));
  }));
}

function reqValue(request) {
  // Wraps an IDBRequest so tx() can hand its result back after commit.
  const holder = {};
  request.onsuccess = () => { holder.__value = request.result; };
  return holder;
}

export const db = {
  kvGet: key => tx('kv', 'readonly', s => reqValue(s.get(key))),
  kvSet: (key, value) => tx('kv', 'readwrite', s => reqValue(s.put(value, key))),

  slideAdd: slide => tx('slides', 'readwrite', s => reqValue(s.add(slide))),
  slidePut: slide => tx('slides', 'readwrite', s => reqValue(s.put(slide))),
  slideAll: () => tx('slides', 'readonly', s => reqValue(s.getAll())),

  dayGet: date => tx('days', 'readonly', s => reqValue(s.get(date))),
  dayPut: day => tx('days', 'readwrite', s => reqValue(s.put(day))),
  dayAll: () => tx('days', 'readonly', s => reqValue(s.getAll())),

  logAdd: log => tx('logs', 'readwrite', s => reqValue(s.add(log))),
  logAll: () => tx('logs', 'readonly', s => reqValue(s.getAll())),
};

/* Local date key, e.g. "2026-07-31" — day boundaries follow the phone's clock. */
export function today() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
    + '-' + String(d.getDate()).padStart(2, '0');
}

/* Ask for durable storage on every launch (Safari grants heuristically;
   status is surfaced in the UI, never assumed). */
export async function ensurePersistence() {
  if (!navigator.storage || !navigator.storage.persist) return 'unsupported';
  await navigator.storage.persist();
  return navigator.storage.persisted();
}
