/* The five day instruments. Each is 10-30 seconds, one field per ritual
   moment, and the practitioner performs the move himself. All offline. */
'use strict';

import { db, today } from './db.js';
import { esc } from './sessions.js';

const $ = id => document.getElementById(id);
const ov = () => $('session-overlay');

function openSheet(html) {
  const o = ov();
  o.classList.add('open');
  o.innerHTML = html;
  $('i-close').onclick = closeSheet;
}
function closeSheet() {
  const o = ov();
  o.classList.remove('open', 'cinema');
  o.innerHTML = '';
}
function top(label) {
  return `<div class="top"><span class="meta">${label}</span><button class="close" id="i-close">Close</button></div>`;
}

/* ---------- Drop: importance release, with optional pendulum naming ---------- */
export function openDrop(onDone) {
  openSheet(`${top('Drop')}
    <div class="center" style="text-align:left">
      <p class="big">What's gripping?</p>
      <input type="text" id="d-charge" placeholder="One line. Naming it loosens it.">
      <div class="check" style="margin-top:16px"><input type="checkbox" id="d-pend"><span><b>This is a pendulum.</b> Something that feeds on my reaction.</span></div>
      <div id="d-pendbox" style="display:none">
        <label for="d-pname">Name it</label>
        <input type="text" id="d-pname" placeholder="The client drama. The feed. The money fear.">
        <label>The move</label>
        <div class="check"><input type="radio" name="d-move" value="fail" checked><span><b>Let it fail.</b> The provocation falls through emptiness. No reaction at all.</span></div>
        <div class="check"><input type="radio" name="d-move" value="quench"><span><b>Quench it.</b> An unexpected, non-standard response it cannot feed on.</span></div>
      </div>
    </div>
    <button class="btn" id="d-go">Drop it</button>`);
  $('d-pend').onchange = e => { $('d-pendbox').style.display = e.target.checked ? 'block' : 'none'; };
  $('d-go').onclick = () => {
    const charge = $('d-charge').value.trim();
    const isPend = $('d-pend').checked;
    const pendulum = isPend ? $('d-pname').value.trim() : '';
    const move = isPend ? document.querySelector('input[name="d-move"]:checked').value : '';
    const o = ov();
    o.classList.add('cinema');
    o.innerHTML = `
      <div class="center">
        <div class="pulse"></div>
        <p class="big">I can lose this and still be whole.</p>
        <p class="body">One slow breath. Let the weight go with it.</p>
      </div>
      <button class="btn" id="d-act" disabled>Now I act</button>`;
    const btn = $('d-act');
    setTimeout(() => { btn.disabled = false; }, 6000);
    btn.onclick = async () => {
      await db.logAdd({ date: today(), t: new Date().toISOString(), type: 'drop', charge, pendulum, move });
      closeSheet();
      onDone();
    };
  };
}

/* ---------- Branch: coordination of intention. He writes the reading. ---------- */
export function openBranch(onDone) {
  openSheet(`${top('Branch')}
    <div class="center" style="text-align:left">
      <p class="big">What went sideways?</p>
      <input type="text" id="b-event" placeholder="One line. Just the event.">
      <p class="big" style="margin-top:18px">Write the favorable reading</p>
      <label for="b-reading">Why is this, in fact, according to plan? Your words select the branch.</label>
      <textarea id="b-reading" style="min-height:90px"></textarea>
    </div>
    <button class="btn" id="b-fork" disabled>Show the fork</button>`);
  const gate = () => { $('b-fork').disabled = !($('b-event').value.trim() && $('b-reading').value.trim()); };
  $('b-event').oninput = gate;
  $('b-reading').oninput = gate;
  $('b-fork').onclick = async () => {
    const event = $('b-event').value.trim();
    const reading = $('b-reading').value.trim();
    const uses = (await db.kvGet('branch-uses')) || 0;
    const o = ov();
    o.innerHTML = `${top('Branch')}
      <div class="center" style="text-align:left">
        <p class="body" style="max-width:none">${esc(event)}</p>
        <p class="big">Two branches run from here.</p>
        <div class="panel" style="opacity:0.45">
          <p class="plabel">The branch where this is against you</p>
          <p class="pbody">Heavy, familiar, and not selected.</p>
        </div>
        <div class="panel tappable" id="b-pick" style="border-color:rgba(122,131,255,0.55);box-shadow:0 0 30px -8px rgba(122,131,255,0.45)">
          <p class="plabel" style="color:#AEB4FF">The branch you select</p>
          <p class="pbody" style="color:var(--ink)">${esc(reading)}</p>
        </div>
        <p class="body" style="max-width:none">Tap the branch to take it.</p>
      </div>`;
    $('i-close').onclick = closeSheet;
    $('b-pick').onclick = async () => {
      await db.logAdd({ date: today(), t: new Date().toISOString(), type: 'branch', event, reading });
      await db.kvSet('branch-uses', uses + 1);
      const o2 = ov();
      o2.innerHTML = `
        <div class="center">
          <p class="big">Selected.</p>
          <p class="body">If it works out, great. If it doesn't, even better.</p>
        </div>
        <button class="btn" id="b-done">Back to the day</button>`;
      const finish = () => { closeSheet(); onDone(); };
      $('b-done').onclick = finish;
      if (uses >= 10) setTimeout(finish, 900); // fast-path: the ritual is internalized
    };
  };
}

/* ---------- Sign: the mirror's hints, with the soul's discomfort elevated ---------- */
export function openSign(onDone) {
  openSheet(`${top('Sign')}
    <div class="center" style="text-align:left">
      <p class="big">What appeared?</p>
      <div class="check"><input type="radio" name="s-kind" value="sign" checked><span><b>A sign.</b> A synchronicity, a hint of a turn in the flow.</span></div>
      <div class="check"><input type="radio" name="s-kind" value="discomfort"><span><b>Soul discomfort.</b> At a decision. This is the reliable kind.</span></div>
      <label for="s-text">One line</label>
      <input type="text" id="s-text">
    </div>
    <button class="btn" id="s-go" disabled>Log it</button>`);
  $('s-text').oninput = () => { $('s-go').disabled = !$('s-text').value.trim(); };
  $('s-go').onclick = async () => {
    const kind = document.querySelector('input[name="s-kind"]:checked').value;
    const text = $('s-text').value.trim();
    await db.logAdd({ date: today(), t: new Date().toISOString(), type: 'sign', kind, text });
    const o = ov();
    if (kind === 'sign') {
      // The amplify beat: waves of fortune are caught by letting small ones spread.
      o.classList.add('cinema');
      o.innerHTML = `
        <div class="center">
          <div class="pulse"></div>
          <p class="big">Hold it. Let it spread.</p>
          <p class="body">My world takes care of me.</p>
        </div>`;
      setTimeout(() => { closeSheet(); onDone(); }, 5000);
    } else {
      o.innerHTML = `
        <div class="center">
          <p class="big">Noted, with weight.</p>
          <p class="body">If you have to persuade yourself, the soul is saying no. Let the decision feel this before the mind argues.</p>
        </div>
        <button class="btn" id="s-done">Back to the day</button>`;
      $('s-done').onclick = () => { closeSheet(); onDone(); };
    }
  };
}

/* ---------- Frame: Tufti's advance order, 15 seconds ---------- */
export function openFrame(onDone) {
  const o = ov();
  o.classList.add('open', 'cinema');
  o.innerHTML = `${top('Frame')}
    <div class="center">
      <div class="pulse"></div>
      <p class="big">The plait</p>
      <p class="body">Attention between the shoulder blades. Feel it like a phantom limb. Hold it lightly.</p>
    </div>
    <button class="btn" id="f-next" disabled>It's lit</button>`;
  $('i-close').onclick = closeSheet;
  const btn = $('f-next');
  setTimeout(() => { btn.disabled = false; }, 5000);
  btn.onclick = () => {
    o.classList.remove('cinema');
    o.innerHTML = `${top('Frame')}
      <div class="center" style="text-align:left">
        <p class="big">Compose the frame</p>
        <label for="f-text">The next concrete scene, already gone your way. Words and image together.</label>
        <input type="text" id="f-text" placeholder="The call lands warm. They lean in.">
      </div>
      <button class="btn" id="f-go" disabled>Release</button>`;
    $('i-close').onclick = closeSheet;
    $('f-text').oninput = () => { $('f-go').disabled = !$('f-text').value.trim(); };
    $('f-go').onclick = async () => {
      await db.logAdd({ date: today(), t: new Date().toISOString(), type: 'frame', text: $('f-text').value.trim(), marker: null });
      closeSheet();
      onDone();
    };
  };
}

/* ---------- Replay: 30 seconds of spare attention inside the slide ---------- */
export async function openReplay(onDone) {
  const slides = await db.slideAll();
  const active = slides.find(s => s.active) || slides[0];
  if (!active) return;
  const o = ov();
  o.classList.add('open', 'cinema');
  o.innerHTML = `${top('Replay')}
    <div class="center">
      <p class="slide-cue">${esc(active.name)}</p>
      <div class="pulse"></div>
      <p class="body">Thirty seconds inside it, from spare attention. Ordinary, already yours.</p>
      <p class="timer" id="r-timer"></p>
    </div>
    <button class="btn" id="r-done" disabled>Done</button>`;
  $('i-close').onclick = closeSheet;
  let left = 30;
  const t = setInterval(() => {
    $('r-timer').textContent = '0:' + String(left).padStart(2, '0');
    if (left <= 15) $('r-done').disabled = false;
    if (left-- <= 0) { clearInterval(t); $('r-timer').textContent = ''; }
  }, 1000);
  $('r-done').onclick = async () => {
    clearInterval(t);
    await db.logAdd({ date: today(), t: new Date().toISOString(), type: 'replay', slide: active.id });
    closeSheet();
    onDone();
  };
}
