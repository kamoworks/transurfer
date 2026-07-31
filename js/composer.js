/* Slide composer — the studio's core. Enforces the book's composition rules
   as explicit confirmations, not fragile text analysis: the practitioner
   verifies each rule himself, which is itself part of the training. */
'use strict';

import { db } from './db.js';
import { esc } from './sessions.js';

const $ = id => document.getElementById(id);

export function openComposer(existing, onSaved) {
  const ov = $('session-overlay');
  ov.classList.add('open');
  ov.innerHTML = `
    <div class="top">
      <span class="meta">${existing ? 'Refine the slide' : 'Compose your slide'}</span>
      <button class="close" id="c-close">Close</button>
    </div>
    <div style="max-width:560px;margin:0 auto;width:100%">
      <p class="sub" style="margin-top:4px">A slide is a scene from the life where the goal is already yours. You are inside it, it is happening now, and how it came to be is not part of the picture.</p>
      <label for="c-name">Scene name</label>
      <input type="text" id="c-name" value="${existing ? esc(existing.name) : ''}" placeholder="Morning on the farm">
      <label for="c-text">The scene, written from the inside</label>
      <textarea id="c-text" placeholder="What do you see, hear, feel, smell? Where are you standing? What is ordinary about it, now that it is normal?">${existing ? esc(existing.text) : ''}</textarea>
      <h2>The three rules</h2>
      <div class="check"><input type="checkbox" id="c-r1"><span><b>I am inside the scene.</b> Not watching a picture of it. If I read this back, I am looking out of my own eyes.</span></div>
      <div class="check"><input type="checkbox" id="c-r2"><span><b>Present tense.</b> It is happening now, and it feels ordinary, not longed for.</span></div>
      <div class="check"><input type="checkbox" id="c-r3"><span><b>No how.</b> No mechanism, no path, no steps. The goal is already achieved; the door is not in the frame.</span></div>
      <button class="btn" id="c-save" disabled>${existing ? 'Save the slide' : 'Set as my slide'}</button>
    </div>`;

  const gate = () => {
    $('c-save').disabled = !($('c-r1').checked && $('c-r2').checked && $('c-r3').checked
      && $('c-name').value.trim() && $('c-text').value.trim());
  };
  ['c-r1', 'c-r2', 'c-r3'].forEach(id => $(id).onchange = gate);
  ['c-name', 'c-text'].forEach(id => $(id).oninput = gate);

  $('c-close').onclick = () => { ov.classList.remove('open'); ov.innerHTML = ''; };
  $('c-save').onclick = async () => {
    const slide = {
      ...(existing || {}),
      name: $('c-name').value.trim(),
      text: $('c-text').value.trim(),
      active: true,
      updated: new Date().toISOString(),
    };
    // One active slide in v1: deactivate the rest.
    const all = await db.slideAll();
    for (const s of all) {
      if (s.active && (!existing || s.id !== existing.id)) {
        s.active = false;
        await db.slidePut(s);
      }
    }
    if (existing) await db.slidePut(slide); else await db.slideAdd(slide);
    ov.classList.remove('open');
    ov.innerHTML = '';
    onSaved();
  };
}
