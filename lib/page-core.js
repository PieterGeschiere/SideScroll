// Page-side core of video-only mode: the generic parts shared by every site.
// A site supplies a "strategy" (sites/*.js -> videoStrategy): JS source that returns
// { css, pick }. The strategy decides HOW to show only the video; this core owns the
// state object, tagging helpers, the injected <style>, the timer and cleanup.
//
// The strategy source runs inside the page as the body of
//   function (state, mark, release, overlap) { ... return { css, pick }; }
//   state    { cur, ph, slot, marked[], userPaused }  - cur = the current <video>
//   mark(v)  tag all ancestors of v with data-sv-anc (removed again by release)
//   release()  undo everything the strategy did to cur/ancestors
//   overlap(rect)  visible area of a rect inside the viewport
// pick() runs every 200ms and must set state.cur (or leave it null if no video).
// Strategies must not contain backticks or ${} (they are embedded in a template).

function buildEnterScript(strategySrc) {
  return `(() => {
  if (window.__sv) return { ok: true, ar: 0 };
  const state = { cur: null, ph: null, slot: null, marked: [], timer: 0, userPaused: false };
  window.__sv = state;
  function mark(v) {
    for (let el = v.parentElement; el && el !== document.documentElement; el = el.parentElement) {
      if (!el.hasAttribute('data-sv-anc')) {
        el.setAttribute('data-sv-anc', '');
        state.marked.push(el);
      }
    }
  }
  function release() {
    if (state.cur) state.cur.classList.remove('__sv_video');
    if (state.ph) state.ph.remove();
    for (const el of state.marked) { el.removeAttribute('data-sv-anc'); el.removeAttribute('data-sv-scroller'); }
    state.cur = null; state.ph = null; state.slot = null; state.marked = [];
  }
  function overlap(r) {
    const h = Math.max(0, Math.min(innerHeight, r.bottom) - Math.max(0, r.top));
    const w = Math.max(0, Math.min(innerWidth, r.right) - Math.max(0, r.left));
    return h * w;
  }
  const strategy = (function (state, mark, release, overlap) {
${strategySrc}
  })(state, mark, release, overlap);
  const style = document.createElement('style');
  style.textContent = strategy.css;
  document.documentElement.appendChild(style);
  document.documentElement.classList.add('__sv');
  window.__svExit = () => {
    clearInterval(state.timer);
    release();
    style.remove();
    document.documentElement.classList.remove('__sv');
    delete window.__sv;
    delete window.__svExit;
  };
  strategy.pick();
  if (!state.cur) { window.__svExit(); return { ok: false }; }
  state.timer = setInterval(strategy.pick, 200);
  const v = state.cur;
  return { ok: true, ar: v.videoWidth && v.videoHeight ? v.videoWidth / v.videoHeight : 0 };
})()`;
}

const EXIT_JS = `(() => { if (window.__svExit) window.__svExit(); })()`;
const AR_JS = `(() => { const s = window.__sv; const v = s && s.cur; return v && v.videoWidth ? v.videoWidth / v.videoHeight : 0; })()`;
// Play/pause the current video (any mode). Remembers a manual pause so strategies
// that auto-start playback do not undo it.
const TOGGLE_JS = `(() => { const s = window.__sv; let v = s && s.cur; if (!v) v = [...document.querySelectorAll('video')].find((x) => !x.paused) || document.querySelector('video'); if (v) { if (v.paused) { v.play(); if (s) s.userPaused = false; } else { v.pause(); if (s) s.userPaused = true; } } })()`;
const PAUSE_ALL_JS = `document.querySelectorAll('video,audio').forEach((m) => m.pause())`;

module.exports = { buildEnterScript, EXIT_JS, AR_JS, TOGGLE_JS, PAUSE_ALL_JS };
