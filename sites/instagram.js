// Instagram. Everything Instagram-specific is in this file and
// preload/instagram.js. Do not add YouTube/TikTok logic here.

// Page-side video-only strategy (see lib/page-core.js for the contract).
// Instagram: every reel already fills the viewport, so leave the layout alone and only
// hide everything that is not a video. (Moving the video, as the YouTube strategy does,
// breaks its feed and its autoplay.) No backticks or ${}.
const videoStrategy = `
  const css = 'html.__sv,html.__sv body{background:#000!important}' +
    'html.__sv *{visibility:hidden!important}' +
    'html.__sv video{visibility:visible!important;object-fit:contain!important}' +
    // the feed is shorter than the window (hidden bottom bar): centre it vertically
    'html.__sv [data-sv-scroller]{transform:translateY(var(--sv-shift,0px))!important}';

  function markScroller(v) {
    for (let e = v.parentElement; e; e = e.parentElement) {
      const o = getComputedStyle(e).overflowY;
      if ((o === 'auto' || o === 'scroll') && e.scrollHeight > e.clientHeight + 5) {
        if (!e.hasAttribute('data-sv-scroller')) { e.setAttribute('data-sv-scroller', ''); state.marked.push(e); }
        return;
      }
    }
  }

  // The reel that fills the viewport is current (for the play/pause button and the
  // window shape). Instagram does its own autoplay; only start playback if nothing
  // is playing at all.
  function pick() {
    const vids = [...document.querySelectorAll('video')];
    if (vids[0] && !document.querySelector('[data-sv-scroller]')) markScroller(vids[0]);
    const sc = document.querySelector('[data-sv-scroller]');
    if (sc) sc.style.setProperty('--sv-shift', Math.max(0, (innerHeight - sc.clientHeight) / 2) + 'px');
    let best = null, area = 0;
    for (const v of vids) {
      const a = overlap(v.getBoundingClientRect());
      if (a > area) { area = a; best = v; }
    }
    if (best && best !== state.cur) {
      if (state.cur) state.cur.classList.remove('__sv_video');
      best.classList.add('__sv_video');
      state.cur = best;
      state.userPaused = false;
    }
    if (state.cur && !state.userPaused && !vids.some((v) => !v.paused)) state.cur.play().catch(() => {});
  }

  return { css, pick };
`;

module.exports = {
  name: 'instagram',
  hostSuffix: 'instagram.com',
  home: 'https://www.instagram.com/', // normal Instagram, with its own bottom bar
  login: 'https://www.instagram.com/accounts/login/',

  // Reels differ slightly in shape: keep the window shape the user chose.
  lockAspect: false,
  videoStrategy,

  // Instagram opens normally (login, bottom bar, everything). Only the Reels pages go
  // into video-only mode, and only once the user taps Reels; leaving Reels (back, or
  // another tab) exits it again. Nothing is bounced or redirected.
  classify(u) {
    return { video: u.pathname.startsWith('/reel') };
  },
};
