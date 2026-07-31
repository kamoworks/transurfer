/* Morning session + evening close — the sacred loop. Fully offline.
   Morning v1 (curriculum days 1-13 form): Presence -> Slide (metronome) -> close line.
   Evening close: mirror line -> coordination line -> reflection. ~90 seconds. */
'use strict';

import { db, today } from './db.js';

const $ = id => document.getElementById(id);

const SENSES = ['sound', 'sight', 'touch', 'smell', 'feeling'];

function senseOfDay() {
  // Deterministic per date so the day's focus is stable across opens.
  const seed = today().split('-').reduce((a, b) => a + Number(b), 0);
  return SENSES[seed % SENSES.length];
}

async function markDay(part) {
  const date = today();
  const day = (await db.dayGet(date)) || { date };
  day[part] = new Date().toISOString();
  await db.dayPut(day);
}

/* ---------- morning ---------- */

export async function startMorning(onDone) {
  const slides = await db.slideAll();
  const active = slides.find(s => s.active) || slides[0];
  if (!active) return; // Today screen routes to the composer first.

  const ov = $('session-overlay');
  ov.classList.add('open');
  let step = 0;

  const steps = [
    () => render({
      label: 'Morning · 1 of 2', title: 'Presence',
      body: 'I see myself. I see reality.\nYou are on the screen and in the audience, both at once. Arrive.',
      seconds: 30, cta: 'I am here',
    }),
    () => render({
      label: 'Morning · 2 of 2', title: active.name,
      body: null, cinema: true,
      sense: 'Today, ' + senseOfDay(),
      seconds: 180, cta: 'The slide is run',
    }),
  ];

  function render(cfg) {
    ov.classList.toggle('cinema', !!cfg.cinema);
    ov.innerHTML = `
      <div class="top">
        <span class="meta">${cfg.label}</span>
        <button class="close" id="s-close">Close</button>
      </div>
      <div class="center">
        ${cfg.cinema ? `
          <p class="slide-cue">${esc(active.name)}</p>
          <p class="sense">${esc(cfg.sense)}</p>
          <div class="pulse"></div>
          <p class="body">Eyes closed or soft gaze. Run it from the inside. The pulse keeps your breath; the screen holds nothing else.</p>
        ` : `
          <p class="big">${esc(cfg.title)}</p>
          <p class="body">${esc(cfg.body).replace(/\n/g, '<br>')}</p>
        `}
        <p class="timer" id="s-timer"></p>
      </div>
      <button class="btn" id="s-next" disabled>${esc(cfg.cta)}</button>`;
    $('s-close').onclick = close;
    countdown(cfg.seconds, cfg.cinema ? 60 : 10);
  }

  let timerId = null;
  function countdown(total, minBeforeSkip) {
    let left = total;
    const btn = $('s-next');
    const t = $('s-timer');
    const tick = () => {
      t.textContent = Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0');
      if (total - left >= minBeforeSkip) btn.disabled = false;
      if (left-- <= 0) { clearInterval(timerId); btn.disabled = false; t.textContent = ''; }
    };
    clearInterval(timerId);
    timerId = setInterval(tick, 1000);
    tick();
    btn.onclick = advance;
  }

  function advance() {
    clearInterval(timerId);
    step += 1;
    if (step < steps.length) return steps[step]();
    // Closing beat: the amalgam line, then done.
    ov.classList.remove('cinema');
    ov.innerHTML = `
      <div class="top"><span class="meta">Morning</span><span></span></div>
      <div class="center">
        <p class="big">My world takes care of me.</p>
        <p class="body">The morning is set. When something goes sideways today, that is Branch.</p>
      </div>
      <button class="btn" id="s-done">Begin the day</button>`;
    $('s-done').onclick = async () => {
      await markDay('morning');
      await db.logAdd({ date: today(), t: new Date().toISOString(), type: 'morning', slide: active.id });
      close();
      onDone();
    };
  }

  function close() {
    clearInterval(timerId);
    ov.classList.remove('open', 'cinema');
    ov.innerHTML = '';
  }

  steps[0]();
}

/* ---------- evening close ---------- */

export async function startEvening(onDone) {
  const ov = $('session-overlay');
  const frames = (await db.logsByDate(today())).filter(l => l.type === 'frame');
  ov.classList.add('open');
  ov.innerHTML = `
    <div class="top">
      <span class="meta">Evening close</span>
      <button class="close" id="e-close">Close</button>
    </div>
    <div class="center" style="text-align:left">
      ${frames.length ? `
      <p class="big">Today's frames</p>
      ${frames.map(f => `
        <div class="panel" data-frame="${f.id}" style="margin-bottom:10px">
          <p class="pbody" style="color:var(--ink)">${esc(f.text)}</p>
          <div style="display:flex;gap:10px;margin-top:10px">
            <button class="btn quiet" data-mark="landed" style="margin:0;flex:1">Landed</button>
            <button class="btn quiet" data-mark="later" style="margin:0;flex:1">Not yet</button>
          </div>
        </div>`).join('')}
      ` : ''}
      <p class="big">The mirror</p>
      <label for="e-mirror">What did the world reflect today? One line is enough. Blank is allowed.</label>
      <textarea id="e-mirror" style="min-height:110px"></textarea>
      <p class="big" style="margin-top:18px">Coordination</p>
      <p class="body" style="max-width:none;text-align:left">Say it, in your own voice or silently, and mean it:</p>
      <p style="font-size:19px;font-weight:600;margin:4px 0">Everything is unfolding according to my plan.</p>
    </div>
    <button class="btn" id="e-done">Spoken. Close the day.</button>`;
  $('e-close').onclick = () => { ov.classList.remove('open'); ov.innerHTML = ''; };
  ov.querySelectorAll('[data-frame]').forEach(panel => {
    panel.querySelectorAll('[data-mark]').forEach(btn => {
      btn.onclick = async () => {
        const frame = frames.find(f => f.id === Number(panel.dataset.frame));
        frame.marker = btn.dataset.mark;
        await db.logPut(frame);
        // Celebrated singly, never aggregated: the panel simply settles.
        panel.style.opacity = '0.55';
        panel.querySelector('div').innerHTML = `<p class="meta">${btn.dataset.mark === 'landed' ? 'Landed. Noted with a quiet nod.' : 'Not yet. The frame stays composed.'}</p>`;
      };
    });
  });
  $('e-done').onclick = async () => {
    await markDay('evening');
    await db.logAdd({
      date: today(), t: new Date().toISOString(), type: 'evening',
      mirror: $('e-mirror').value.trim(),
    });
    ov.classList.remove('open');
    ov.innerHTML = '';
    onDone();
  };
}

export function esc(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
