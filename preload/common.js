// Runs inside EVERY site page. Only site-independent behaviour goes here;
// per-site behaviour lives in preload/<site>.js.
const { ipcRenderer, webFrame } = require('electron');

// 1) Keep playing when the window loses focus. Sites pause on blur / visibilitychange,
//    so make the page believe it is always visible and focused. This must run in the
//    page's own world (a preload runs in an isolated world).
webFrame.executeJavaScript(`(() => {
  const def = (k, val) => { try { Object.defineProperty(Document.prototype, k, { configurable: true, get: () => val }); } catch (e) { /* property not configurable: ignore */ } };
  def('hidden', false);
  def('webkitHidden', false);
  def('visibilityState', 'visible');
  def('webkitVisibilityState', 'visible');
  Document.prototype.hasFocus = () => true;
  const kill = (e) => e.stopImmediatePropagation();
  for (const t of ['visibilitychange', 'webkitvisibilitychange', 'pagehide', 'freeze']) {
    window.addEventListener(t, kill, true);
    document.addEventListener(t, kill, true);
  }
  // window-level blur only (element blur events must still reach the page)
  window.addEventListener('blur', (e) => { if (e.target === window) kill(e); }, true);
})()`);

// 2) Sound: the sites mute videos until you tap, and YouTube re-mutes the same <video>
//    element for every new Short. So keep every video un-muted and at the app volume.
//    Volume 0 (panel slider) is the only way to silence it.
let vol = 1; // app-wide volume, set from the panel slider / Ctrl+Up/Down
function enforce(v) {
  if (Math.abs(v.volume - vol) > 0.01) v.volume = vol;
  if (vol > 0 && v.muted) v.muted = false;
  if (vol === 0 && !v.muted) v.muted = true;
}
ipcRenderer.on('volume', (_e, x) => {
  vol = x;
  document.querySelectorAll('video').forEach(enforce);
});
// Undo a re-mute the instant the site does it (media events don't bubble: capture).
for (const type of ['volumechange', 'play', 'playing', 'loadeddata']) {
  window.addEventListener(type, (e) => e.target instanceof HTMLVideoElement && enforce(e.target), true);
}
setInterval(() => document.querySelectorAll('video').forEach(enforce), 250);
