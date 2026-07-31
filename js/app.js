/* App boot, navigation, and the Today screen. */
'use strict';

import { db, today, ensurePersistence, migrateTo4amBoundary } from './db.js';
import { startMorning, startEvening, esc } from './sessions.js';
import { openComposer } from './composer.js';

const $ = id => document.getElementById(id);

/* ---------- navigation ---------- */
const SCREENS = ['today', 'slides', 'mirror', 'reel'];
function show(name) {
  SCREENS.forEach(s => {
    document.querySelector(`[data-screen="${s}"]`).classList.toggle('active', s === name);
    document.querySelector(`[data-tab="${s}"]`).classList.toggle('active', s === name);
  });
  if (name === 'today') renderToday();
  if (name === 'slides') renderSlides();
  if (name === 'mirror') renderMirror();
}
SCREENS.forEach(s => { document.querySelector(`[data-tab="${s}"]`).onclick = () => show(s); });

/* ---------- Today ---------- */
async function renderToday() {
  const el = document.querySelector('[data-screen="today"]');
  const slides = await db.slideAll();
  const active = slides.find(s => s.active) || slides[0];
  const day = await db.dayGet(today());
  const days = await db.dayAll();
  const practiced = days.filter(d => d.morning || d.evening).length;
  const hour = new Date().getHours();
  const greeting = hour < 4 ? 'Evening' : hour < 12 ? 'Morning' : hour < 18 ? 'Afternoon' : 'Evening';

  el.innerHTML = `
    <h1>${greeting}, Kamo</h1>
    <p class="sub">${practiced ? 'Days practiced: ' + practiced : 'Day one.'}</p>
    ${!active ? `
      <div class="panel tappable" id="t-compose">
        <p class="ptitle">Compose your slide</p>
        <p class="pbody">Everything begins with the scene where the goal is already yours. Five minutes, three rules, your words.</p>
        <button class="btn">Open the composer</button>
      </div>` : `
      <div class="panel tappable ${day && day.morning ? 'done' : ''}" id="t-morning">
        <p class="plabel"><span class="state-dot"></span>Morning</p>
        <p class="ptitle">${day && day.morning ? 'Set.' : 'Presence, then the slide'}</p>
        <p class="pbody">${day && day.morning
          ? 'The morning is behind you. The day is composing.'
          : 'Two movements, about four minutes. Fully offline.'}</p>
      </div>
      <div class="panel tappable ${day && day.evening ? 'done' : ''}" id="t-evening">
        <p class="plabel"><span class="state-dot"></span>Evening close</p>
        <p class="ptitle">${day && day.evening ? 'Closed.' : 'Ninety seconds, when the day is done'}</p>
        <p class="pbody">${day && day.evening
          ? 'The day is declared and on the record.'
          : 'The mirror, the coordination line, one line for the record.'}</p>
      </div>
      <div class="panel">
        <p class="plabel">Active slide</p>
        <p class="ptitle">${esc(active.name)}</p>
        <p class="pbody">Refine it in Slides whenever it goes stale. The instruments and the Reel arrive with the next update.</p>
      </div>`}
    <p class="meta" id="t-persist"></p>`;

  if ($('t-compose')) $('t-compose').onclick = () => openComposer(null, renderToday);
  if ($('t-morning')) $('t-morning').onclick = () => {
    if (!(day && day.morning)) startMorning(renderToday);
  };
  if ($('t-evening')) $('t-evening').onclick = () => {
    if (!(day && day.evening)) startEvening(renderToday);
  };

  const persisted = await ensurePersistence();
  $('t-persist').textContent = 'storage: ' + (persisted === true ? 'persistent' : String(persisted));
}

/* ---------- Slides ---------- */
async function renderSlides() {
  const el = document.querySelector('[data-screen="slides"]');
  const slides = await db.slideAll();
  el.innerHTML = `
    <h1>Slides</h1>
    <p class="sub">The studio. Scenes written from the inside.</p>
    ${slides.map(s => `
      <div class="panel tappable" data-slide="${s.id}">
        <p class="plabel">${s.active ? 'Active' : 'Resting'}</p>
        <p class="ptitle">${esc(s.name)}</p>
        <p class="pbody">${esc(s.text.slice(0, 120))}${s.text.length > 120 ? '…' : ''}</p>
      </div>`).join('')}
    <button class="btn quiet" id="sl-new">New slide</button>`;
  el.querySelectorAll('[data-slide]').forEach(p => {
    p.onclick = () => {
      const s = slides.find(x => x.id === Number(p.dataset.slide));
      openComposer(s, renderSlides);
    };
  });
  $('sl-new').onclick = () => openComposer(null, renderSlides);
}

/* ---------- Mirror (v1: the honest record) ---------- */
async function renderMirror() {
  const el = document.querySelector('[data-screen="mirror"]');
  const logs = (await db.logAll()).slice(-30).reverse();
  el.innerHTML = `
    <h1>Mirror</h1>
    <p class="sub">What the record holds. Frequency, never scores.</p>
    ${logs.length === 0 ? '<div class="panel"><p class="pbody">Empty for now. The record begins with your first morning.</p></div>' : ''}
    ${logs.map(l => `
      <div class="panel">
        <p class="plabel">${l.date} · ${esc(l.type)}</p>
        ${l.mirror ? `<p class="pbody">${esc(l.mirror)}</p>` : ''}
        ${l.note ? `<p class="pbody">${esc(l.note)}</p>` : ''}
      </div>`).join('')}`;
}

/* ---------- boot ---------- */
document.querySelector('[data-screen="reel"]').innerHTML =
  '<h1>Reel</h1><p class="sub">The 78-card path.</p><div class="panel"><p class="pbody">Part I arrives with the next update. The practice above is already complete without it.</p></div>';

migrateTo4amBoundary().then(() => show('today'));

/* Service worker: only on the real origin, never localhost (workspace rule). */
if ('serviceWorker' in navigator && location.hostname.endsWith('github.io')) {
  navigator.serviceWorker.register('sw.js');
}
