/* Settings sheet: backup (export/import), storage status.
   The record is irreplaceable; the export is the real safety net. */
'use strict';

import { db, today } from './db.js';

const $ = id => document.getElementById(id);

export async function daysSinceExport() {
  const last = await db.kvGet('last-export');
  if (!last) return Infinity;
  return Math.floor((Date.now() - new Date(last).getTime()) / 86400000);
}

export function openSettings(onChange) {
  const ov = $('session-overlay');
  ov.classList.add('open');
  ov.innerHTML = `
    <div class="top"><span class="meta">Settings</span><button class="close" id="st-close">Close</button></div>
    <div style="max-width:560px;margin:0 auto;width:100%">
      <h2>Backup</h2>
      <div class="panel">
        <p class="pbody">Everything lives on this phone. Deleting the app deletes the record; the export is the safety net. Monthly is the floor.</p>
        <p class="meta" id="st-last" style="margin-top:8px"></p>
        <button class="btn" id="st-export">Export the record</button>
        <button class="btn quiet" id="st-import">Restore from a backup file</button>
        <input type="file" id="st-file" accept="application/json" style="display:none">
      </div>
      <h2>Storage</h2>
      <div class="panel"><p class="pbody" id="st-storage">checking…</p></div>
    </div>`;

  $('st-close').onclick = close;
  function close() { ov.classList.remove('open'); ov.innerHTML = ''; }

  (async () => {
    const last = await db.kvGet('last-export');
    $('st-last').textContent = last ? 'last export: ' + last.slice(0, 10) : 'never exported';
    const persisted = navigator.storage && navigator.storage.persisted
      ? await navigator.storage.persisted() : 'unsupported';
    const est = navigator.storage && navigator.storage.estimate ? await navigator.storage.estimate() : null;
    $('st-storage').textContent = 'persistent: ' + persisted
      + (est ? ' · ' + (est.usage / 1024).toFixed(0) + ' KB of ' + (est.quota / 1048576).toFixed(0) + ' MB' : '');
  })();

  $('st-export').onclick = async () => {
    const kvKeys = await db.kvKeys();
    const kv = {};
    for (const k of kvKeys) kv[k] = await db.kvGet(k);
    const payload = {
      app: 'transurfer', version: 1, exported: new Date().toISOString(),
      slides: await db.slideAll(), days: await db.dayAll(), logs: await db.logAll(), kv,
    };
    const blob = new Blob([JSON.stringify(payload, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'transurfer-backup-' + today() + '.json';
    a.click();
    URL.revokeObjectURL(a.href);
    await db.kvSet('last-export', new Date().toISOString());
    $('st-last').textContent = 'last export: ' + today();
    if (onChange) onChange();
  };

  $('st-import').onclick = () => $('st-file').click();
  $('st-file').onchange = async e => {
    const file = e.target.files[0];
    if (!file) return;
    let data;
    try {
      data = JSON.parse(await file.text());
      if (data.app !== 'transurfer' || !Array.isArray(data.slides)) throw new Error('not a Transurfer backup');
    } catch (err) {
      alert('This file is not a valid Transurfer backup: ' + err.message);
      return;
    }
    if (!confirm('Restore from ' + (data.exported || 'unknown date') + '? This replaces everything currently in the app.')) return;
    for (const store of ['slides', 'days', 'logs', 'kv']) await db.clearStore(store);
    for (const s of data.slides) await db.slidePut(s);
    for (const d of data.days || []) await db.dayPut(d);
    for (const l of data.logs || []) await db.logPut(l);
    for (const [k, v] of Object.entries(data.kv || {})) await db.kvSet(k, v);
    alert('Restored.');
    close();
    if (onChange) onChange();
  };
}
