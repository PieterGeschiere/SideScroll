// TikTok. Not finished: the feed does not scroll yet (see CLAUDE.md "Open / not done").
// Everything TikTok-specific goes in this file (and a preload/tiktok.js when needed).
const fixedVideo = require('./_fixed-video');

module.exports = {
  name: 'tiktok',
  hostSuffix: 'tiktok.com',
  home: 'https://www.tiktok.com/',
  login: 'https://www.tiktok.com/login',

  lockAspect: true,
  videoStrategy: fixedVideo, // only used when video-only mode is toggled by hand

  // No automatic video-only mode yet.
  classify() {
    return null;
  },
};
