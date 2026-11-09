// Video-only strategy: make the playing <video> position:fixed and full-viewport and
// hide everything else. Used by YouTube (and TikTok when toggled manually).
// NOT suitable for Instagram: moving its video breaks the feed (see sites/instagram.js).
// Page-side source, see lib/page-core.js for the contract. No backticks or ${}.
module.exports = `
  // Ancestors of the current video are tagged data-sv-anc and neutralised by a
  // stylesheet rule: YouTube rewrites inline transforms on every Short change, which
  // would undo inline overrides and trap the fixed video inside a moved container.
  const css = 'html.__sv,html.__sv body{background:#000!important}' +
    'html.__sv *{visibility:hidden!important}' +
    'html.__sv .__sv_video{visibility:visible!important;position:fixed!important;top:0!important;left:0!important;width:100vw!important;height:100vh!important;max-width:none!important;max-height:none!important;margin:0!important;padding:0!important;transform:none!important;object-fit:contain!important;background:#000!important;z-index:2147483647!important}' +
    'html.__sv [data-sv-anc]{transform:none!important;translate:none!important;scale:none!important;rotate:none!important;filter:none!important;perspective:none!important;contain:none!important;will-change:auto!important;backdrop-filter:none!important;clip-path:none!important;content-visibility:visible!important}';

  function apply(v) {
    release();
    const pos = getComputedStyle(v).position;
    const r = v.getBoundingClientRect();
    if (pos === 'static' || pos === 'relative') {
      // keep the video's slot in the page flow so feeds don't collapse
      const ph = document.createElement('div');
      ph.style.cssText = 'display:block;flex:none;width:' + r.width + 'px;height:' + r.height + 'px';
      v.parentNode.insertBefore(ph, v);
      state.ph = ph;
    }
    mark(v); // transforms/filters on ancestors would trap position:fixed
    state.slot = state.ph || v.parentElement;
    state.userPaused = false;
    v.classList.add('__sv_video');
    state.cur = v;
  }

  function pick() {
    if (state.cur && !state.cur.isConnected) release();
    if (state.cur) mark(state.cur); // the site may move the <video> into a new container
    const c = state.cur;
    if (c && !c.paused) return;
    let best = null, top = 0;
    for (const v of document.querySelectorAll('video')) {
      if (v === c) continue;
      const r = v.getBoundingClientRect();
      const a = r.width * r.height;
      const s = ((!v.paused && v.readyState > 0) ? 1e9 : 0) + a;
      if (a > 0 && s > top) { top = s; best = v; }
    }
    if (best && (!c || !best.paused)) apply(best);
  }

  return { css, pick };
`;
