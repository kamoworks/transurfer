/* App boot, navigation, and the Today screen. */
'use strict';

import { db, today, dayKey, ensurePersistence, migrateTo4amBoundary } from './db.js';
import { startMorning, startEvening, esc } from './sessions.js';
import { openComposer } from './composer.js';
import { openDrop, openBranch, openSign, openFrame, openReplay } from './instruments.js';
import { openSettings, daysSinceExport } from './settings.js';

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

  const dayMap = Object.fromEntries(days.map(d => [d.date, d]));
  const dots = Array.from({ length: 14 }, (_, i) => {
    const key = dayKey(13 - i);
    const rec = dayMap[key];
    return `<i class="${rec && (rec.morning || rec.evening) ? 'y' : ''}${key === today() ? ' now' : ''}"></i>`;
  }).join('');
  const exportAge = await daysSinceExport();
  const nagBackup = practiced > 0 && exportAge > 30;

  el.innerHTML = `
    <div class="hrow">
      <h1>${greeting}, Kamo</h1>
      <button class="gear" id="t-settings" aria-label="Settings">&#9881;</button>
    </div>
    <p class="sub">${practiced ? 'Days practiced: ' + practiced : 'Day one.'}</p>
    <div class="dots14">${dots}</div>
    ${nagBackup ? '<p class="meta" style="margin:0 2px 12px">The record has never left this phone. Export it in Settings.</p>' : ''}
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
      <h2>Instruments</h2>
      <div class="tools-grid">
        <button class="tool-tile" id="i-drop"><b>Drop</b><span>release the grip</span></button>
        <button class="tool-tile" id="i-branch"><b>Branch</b><span>select the favorable line</span></button>
        <button class="tool-tile" id="i-sign"><b>Sign</b><span>log what appeared</span></button>
        <button class="tool-tile" id="i-frame"><b>Frame</b><span>compose what's next</span></button>
        <button class="tool-tile wide" id="i-replay"><b>Replay</b><span>thirty seconds inside the slide</span></button>
      </div>`}`;

  if ($('t-compose')) $('t-compose').onclick = () => openComposer(null, renderToday);
  $('t-settings').onclick = () => openSettings(renderToday);
  if ($('i-drop')) {
    $('i-drop').onclick = () => openDrop(renderToday);
    $('i-branch').onclick = () => openBranch(renderToday);
    $('i-sign').onclick = () => openSign(renderToday);
    $('i-frame').onclick = () => openFrame(renderToday);
    $('i-replay').onclick = () => openReplay(renderToday);
  }
  if ($('t-morning')) $('t-morning').onclick = () => {
    if (!(day && day.morning)) startMorning(renderToday);
  };
  if ($('t-evening')) $('t-evening').onclick = () => {
    if (!(day && day.evening)) startEvening(renderToday);
  };

  // Re-request durable storage on every launch; status is visible in Settings.
  await ensurePersistence();
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
  const logs = (await db.logAll()).slice(-40).reverse();
  const body = l => {
    switch (l.type) {
      case 'evening': return l.mirror || 'The day was closed.';
      case 'morning': return 'Presence and the slide.';
      case 'replay': return 'Thirty seconds inside the slide.';
      case 'drop': return (l.charge || 'A grip, released.')
        + (l.pendulum ? ' · pendulum: ' + l.pendulum + (l.move === 'quench' ? ' (quenched)' : ' (let fail)') : '');
      case 'branch': return l.event + ' → ' + l.reading;
      case 'sign': return (l.kind === 'discomfort' ? 'Soul discomfort · ' : '') + l.text;
      case 'frame': return l.text + (l.marker === 'landed' ? ' · landed' : l.marker === 'later' ? ' · not yet' : '');
      default: return '';
    }
  };
  el.innerHTML = `
    <h1>Mirror</h1>
    <p class="sub">What the record holds. Frequency, never scores.</p>
    ${logs.length === 0 ? '<div class="panel"><p class="pbody">Empty for now. The record begins with your first morning.</p></div>' : ''}
    ${logs.map(l => `
      <div class="panel">
        <p class="plabel">${l.date} · ${esc(l.type)}</p>
        <p class="pbody">${esc(body(l))}</p>
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
