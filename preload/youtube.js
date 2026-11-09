// YouTube-only page behaviour (see also sites/youtube.js).
const { ipcRenderer } = require('electron');

(function () {
  if (location.hostname !== 'youtube.com' && !location.hostname.endsWith('.youtube.com')) return;

  // The mobile Shorts player only reacts to swipes / arrow keys. Turn the mouse wheel
  // into a next/prev request; main.js (sites/youtube.js) presses Down/Up.
  let last = 0;
  window.addEventListener(
    'wheel',
    (e) => {
      if (!location.pathname.startsWith('/shorts') || e.ctrlKey) return;
      e.preventDefault();
      const now = Date.now();
      if (now - last < 700 || Math.abs(e.deltaY) < 4) return;
      last = now;
      ipcRenderer.send('swipe', e.deltaY > 0 ? 'next' : 'prev');
    },
    { passive: false, capture: true }
  );
})();
