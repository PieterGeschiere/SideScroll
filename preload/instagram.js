// Instagram-only page behaviour (see also sites/instagram.js).
(function () {
  if (!location.hostname.endsWith('instagram.com')) return;
  const onReels = () => location.pathname.startsWith('/reel');

  // ---- Reloading the feed (workarounds for two Instagram quirks, below) -------------
  // NEVER reload a direct reel URL (/reels/<id>/): Instagram answers a direct load with
  // its "view this reel in the app" wall and tries to open instagram://..., and the feed
  // restarts at the same reel (looks like a loop). Go through the home page and tap the
  // Reels tab like a user would (see resume() below), which gives a fresh feed.
  // Reloads are also rate-limited per tab (sessionStorage) so nothing can ever loop.
  function mayReload(kind, gapMs) {
    try {
      const k = '__sv_rl_' + kind;
      const t = Number(sessionStorage.getItem(k) || 0);
      if (Date.now() - t < gapMs) return false;
      sessionStorage.setItem(k, String(Date.now()));
    } catch (e) {}
    return true;
  }
  function reloadFeed(advance) {
    try {
      sessionStorage.setItem('__sv_goreels', '1');
      if (advance) sessionStorage.setItem('__sv_adv', '1');
    } catch (e) {}
    location.href = location.origin + '/';
  }

  // ---- Scrolling the Reels feed ---------------------------------------------------
  // The feed is a scrollable container that ignores the wheel and arrow keys, so scroll
  // that container one reel at a time ourselves.
  //
  // Step to the NEXT VIDEO'S real position, not a fixed distance: the reels' spacing is
  // fractional (e.g. 656.4px) while clientHeight is a whole number, so fixed steps drift
  // about 1px per reel until a sliver of the previous reel shows.
  let last = 0;
  const visibleArea = (r) =>
    Math.max(0, Math.min(innerHeight, r.bottom) - Math.max(0, r.top)) *
    Math.max(0, Math.min(innerWidth, r.right) - Math.max(0, r.left));
  function step(dir) {
    const now = Date.now();
    if (now - last < 600) return;
    last = now;
    const vids = [...document.querySelectorAll('video')];
    if (!vids.length) return;
    let cur = vids[0], best = -1;
    for (const v of vids) {
      const a = visibleArea(v.getBoundingClientRect());
      if (a > best) { best = a; cur = v; }
    }
    let scroller = null;
    for (let e = cur.parentElement; e; e = e.parentElement) {
      const o = getComputedStyle(e).overflowY;
      if ((o === 'auto' || o === 'scroll') && e.scrollHeight > e.clientHeight + 5) { scroller = e; break; }
    }
    if (!scroller) return;
    const curTop = cur.getBoundingClientRect().top;
    let target = null, targetTop = 0;
    for (const v of vids) {
      const t = v.getBoundingClientRect().top;
      if (dir > 0 ? t > curTop + 4 && (!target || t < targetTop) : t < curTop - 4 && (!target || t > targetTop)) {
        target = v;
        targetTop = t;
      }
    }
    // End of the loaded reels: Instagram does not fetch more here, so you would get stuck.
    // Restart the feed (fresh reels) and step forward once it is back.
    if (dir > 0 && !target) {
      if (mayReload('end', 20000)) reloadFeed(true);
      return;
    }
    // Line the target up with the top of the feed (exact, so nothing accumulates).
    const delta = target ? targetTop - scroller.getBoundingClientRect().top : dir * scroller.clientHeight;
    scroller.scrollBy({ top: delta, behavior: 'smooth' });
  }

  // After reloadFeed(): we are on the home page. Tap the Reels tab, then (end-of-feed
  // case) continue to the next reel once the new feed is up.
  (function resume() {
    let goReels = false, adv = false;
    try {
      goReels = sessionStorage.getItem('__sv_goreels') === '1';
      adv = sessionStorage.getItem('__sv_adv') === '1';
      sessionStorage.removeItem('__sv_goreels');
      sessionStorage.removeItem('__sv_adv');
    } catch (e) {}
    if (!goReels) return;
    let tries = 0, clicked = false, stepped = false;
    const t = setInterval(() => {
      if (++tries > 80) return clearInterval(t);
      if (!clicked && !onReels()) {
        const a = document.querySelector('a[href="/reels/"]');
        if (a) { clicked = true; a.click(); }
        return;
      }
      if (onReels()) {
        if (!adv) return clearInterval(t);
        if (!stepped && document.querySelectorAll('video').length >= 2) {
          stepped = true;
          clearInterval(t);
          last = 0;
          setTimeout(() => step(1), 1500); // let autoplay / video-only mode settle first
        }
      }
    }, 300);
  })();

  // ---- Window resize -----------------------------------------------------------------
  // Instagram does not re-lay-out its reel feed when the window changes size: reels get
  // the new height but keep their old spacing, so several overlap on screen. Once the
  // resize settles, restart the feed so it lays out fresh. Also covers zoom changes.
  // Resizes in the first seconds are the app applying its page zoom while the page loads:
  // just remember the size, do not reload for them.
  let lastW = innerWidth, lastH = innerHeight, resizeTimer = 0;
  const armedAt = Date.now() + 4000;
  window.addEventListener('resize', () => {
    if (Date.now() < armedAt) {
      lastW = innerWidth;
      lastH = innerHeight;
      return;
    }
    if (!onReels()) return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (Math.abs(innerWidth - lastW) < 4 && Math.abs(innerHeight - lastH) < 4) return;
      if (mayReload('resize', 8000)) reloadFeed(false);
    }, 700);
  });

  // ---- Guest wall ----------------------------------------------------------------------
  // Logged out, reels come with a modal ("view this reel in the app" + Log in / Sign up)
  // that blocks the page. Hide it. (Log in with the side panel's sign-in button.)
  // Recognised by its login/sign-up links, so it works in any language, and legitimate
  // dialogs (comments, share sheet) are left alone.
  function hideWall() {
    if (!onReels()) return;
    for (const d of document.querySelectorAll('[role=dialog][aria-modal=true]')) {
      if (d.getAttribute('data-sv-wall')) continue;
      if (!d.querySelector('a[href*="/accounts/login"], a[href*="/accounts/emailsignup"], a[href*="signup"]')) continue;
      d.setAttribute('data-sv-wall', '1');
      let root = d;
      for (let e = d; e && e !== document.body; e = e.parentElement) {
        if (getComputedStyle(e).position === 'fixed') root = e;
      }
      root.style.setProperty('display', 'none', 'important');
    }
  }
  setInterval(hideWall, 400);

  // ---- Cookie consent --------------------------------------------------------------------
  // After you press Log in, Instagram covers the form with a cookie dialog ("Allow the use
  // of cookies from Instagram in this browser?") whose buttons are scrolled out of reach in a
  // tiny window, so login looks dead. Accept all cookies (the FIRST button; the second one
  // declines the optional ones). Recognised by the word "cookie" and two buttons, not by
  // language.
  function dismissCookieDialog() {
    for (const d of document.querySelectorAll('[role=dialog]')) {
      if (d.getAttribute('data-sv-cookie')) continue;
      if (!/cookie/i.test(d.innerText || '')) continue;
      const buttons = [...d.querySelectorAll('button, [role=button]')].filter((b) => b.getBoundingClientRect().width > 0);
      if (buttons.length < 2) continue;
      d.setAttribute('data-sv-cookie', '1');
      buttons[0].click(); // "Allow all cookies"
    }
  }
  setInterval(dismissCookieDialog, 500);

  // ---- Input -----------------------------------------------------------------------------
  window.addEventListener(
    'wheel',
    (e) => {
      if (!onReels() || e.ctrlKey) return;
      e.preventDefault();
      if (Math.abs(e.deltaY) >= 4) step(e.deltaY > 0 ? 1 : -1);
    },
    { passive: false, capture: true }
  );
  window.addEventListener(
    'keydown',
    (e) => {
      if (!onReels() || e.ctrlKey || e.altKey || (e.key !== 'ArrowDown' && e.key !== 'ArrowUp')) return;
      if (/^(INPUT|TEXTAREA)$/.test((e.target && e.target.tagName) || '')) return;
      e.preventDefault();
      step(e.key === 'ArrowDown' ? 1 : -1);
    },
    true
  );
})();
