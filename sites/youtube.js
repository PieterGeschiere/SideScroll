// YouTube (mobile site). Everything YouTube-specific is in this file and
// preload/youtube.js. Do not add Instagram/TikTok logic here.
const fixedVideo = require('./_fixed-video');

module.exports = {
  name: 'youtube',
  hostSuffix: 'youtube.com',
  home: 'https://m.youtube.com/',
  login: 'https://accounts.google.com/ServiceLogin?service=youtube&continue=https%3A%2F%2Fm.youtube.com%2F',

  // Window follows the video's shape (16:9 videos vs 9:16 Shorts).
  lockAspect: true,
  videoStrategy: fixedVideo,

  // Watch pages and Shorts open straight into video-only mode.
  classify(u) {
    const p = u.pathname;
    return { video: p === '/watch' || p.startsWith('/shorts') };
  },

  // preload/youtube.js turns the wheel into a 'swipe' request; Shorts advance with
  // the Up/Down arrow keys (touch swipes via CDP were unreliable).
  setupMain({ ipcMain, viewFromSender }) {
    ipcMain.on('swipe', (e, dir) => {
      const view = viewFromSender(e.sender);
      if (!view) return;
      const wc = view.webContents;
      const keyCode = dir === 'next' ? 'Down' : 'Up';
      wc.sendInputEvent({ type: 'keyDown', keyCode });
      wc.sendInputEvent({ type: 'keyUp', keyCode });
    });
  },
};
