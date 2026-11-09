// Main-process side of video-only mode: enter/exit, auto-enter, window aspect lock.
// Knows nothing about specific sites: it asks the active site module for its
// `videoStrategy` and `lockAspect`.
const cfg = require('./config');
const { buildEnterScript, EXIT_JS, AR_JS, TOGGLE_JS } = require('./page-core');

// ctx: { getWin, getView, getSite, railSend, layout }
function createVideoMode(ctx) {
  let active = false;
  let suppressed = false; // user left the mode by hand: don't auto re-enter until they leave the video pages
  let savedBounds = null;
  let ar = 0; // aspect ratio the window is locked to (0 = no lock)
  let lastSize = null;
  let arTimer = null;
  let autoBusy = false;
  let entering = false; // enter() is awaiting the page: ignore overlapping calls
  let resized = false; // did this mode change the window size? (only then restore it on exit)

  // Keep the window the same shape as the video so nothing is cropped or letterboxed,
  // and re-shape it when the format changes (16:9 <-> 9:16), preserving its area.
  function fit(preserveArea) {
    if (!active || !ar) return;
    const win = ctx.getWin();
    const [w, h] = win.getContentSize();
    let nw, nh;
    if (preserveArea) {
      nw = Math.round(Math.sqrt(w * h * ar));
      nh = Math.round(nw / ar);
    } else if (lastSize && w !== lastSize[0]) {
      nw = w; // width was dragged: height follows
      nh = Math.round(w / ar);
    } else {
      nh = h; // height was dragged: width follows
      nw = Math.round(h * ar);
    }
    if (nw !== w || nh !== h) {
      win.setContentSize(nw, nh);
      resized = true;
    }
    lastSize = win.getContentSize();
  }

  async function enter() {
    const view = ctx.getView();
    const site = ctx.getSite();
    if (!view || !site || active || entering) return;
    entering = true;
    let res;
    try {
      res = await view.webContents.executeJavaScript(buildEnterScript(site.videoStrategy));
    } catch {
      res = null;
    } finally {
      entering = false;
    }
    if (active) return; // another enter() finished while we waited
    if (!res || !res.ok) {
      ctx.railSend('video-mode-failed');
      return;
    }
    const win = ctx.getWin();
    savedBounds = win.getBounds();
    active = true;
    win.setMinimumSize(cfg.VIDEO_MODE_MIN.width, cfg.VIDEO_MODE_MIN.height);
    ar = site.lockAspect ? res.ar || 0 : 0;
    resized = false;
    if (ar) {
      const [w] = win.getContentSize();
      win.setContentSize(w, Math.round(w / ar));
      resized = true;
    }
    lastSize = win.getContentSize();
    ctx.layout();
    if (site.lockAspect) {
      arTimer = setInterval(async () => {
        const v = ctx.getView();
        if (!active || !v) return;
        const r = await v.webContents.executeJavaScript(AR_JS).catch(() => 0);
        if (r > 0 && (!ar || Math.abs(r / ar - 1) > cfg.VIDEO_MODE.ASPECT_CHANGE)) {
          ar = r;
          fit(true);
          ctx.layout();
        }
      }, cfg.VIDEO_MODE.ASPECT_POLL);
    }
    ctx.railSend('video-mode', true);
  }

  function exit() {
    if (!active) return;
    active = false;
    clearInterval(arTimer);
    ar = 0;
    lastSize = null;
    const view = ctx.getView();
    if (view) view.webContents.executeJavaScript(EXIT_JS).catch(() => {});
    const win = ctx.getWin();
    win.setMinimumSize(cfg.WINDOW.minWidth, cfg.WINDOW.minHeight);
    // Only undo size changes this mode made; never override a resize the user did.
    if (resized && savedBounds) win.setBounds(savedBounds);
    resized = false;
    ctx.layout();
    ctx.railSend('video-mode', false);
  }

  // Manual toggle (rail button / Ctrl+Shift+V). Leaving by hand suppresses auto re-entry.
  function toggle() {
    if (active) {
      suppressed = true;
      exit();
    } else {
      suppressed = false;
      enter();
    }
  }

  // Called when a video page opens: retry until the <video> exists.
  function autoEnter(view) {
    if (autoBusy) return;
    autoBusy = true;
    let tries = 0;
    const t = setInterval(async () => {
      if (active || ++tries > cfg.VIDEO_MODE.AUTO_ENTER_TRIES || ctx.getView() !== view) {
        autoBusy = false;
        return clearInterval(t);
      }
      await enter(); // fails quietly until the <video> exists
      if (active) {
        autoBusy = false;
        clearInterval(t);
      }
    }, cfg.VIDEO_MODE.AUTO_ENTER_INTERVAL);
  }

  function togglePlay() {
    const view = ctx.getView();
    if (view) view.webContents.executeJavaScript(TOGGLE_JS).catch(() => {});
  }

  return {
    enter, exit, toggle, autoEnter, fit, togglePlay,
    isActive: () => active,
    isSuppressed: () => suppressed,
    setSuppressed: (v) => { suppressed = !!v; },
  };
}

module.exports = { createVideoMode };
