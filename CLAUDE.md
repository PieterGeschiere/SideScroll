# SideScroll - project notes for Claude

Electron desktop app: a tiny always-on-top, frameless mini-browser for YouTube,
TikTok and Instagram. The owner uses it to scroll short-form video in a very small
window (default 190x340, as small as ~90x70). Everything is judged by how well it
works at tiny sizes and with video only, no surrounding page chrome.

Run: `npm start` (Electron ^45). Windows 11, PowerShell/Git Bash.
If `npm start` crashes with `Cannot read properties of undefined (reading 'commandLine')`
the shell has `ELECTRON_RUN_AS_NODE=1` set (the VS Code extension does this):
unset it first (`$env:ELECTRON_RUN_AS_NODE=$null` / `unset ELECTRON_RUN_AS_NODE`).

## Owner preferences (follow these)
- NEVER run `git commit` (or `git push`, or otherwise commit anything) yourself. The owner
  commits and pushes to GitHub manually. Only stage/commit if explicitly told to in that message.
- NO emojis anywhere (UI, code, messages). Use drawn SVG icons or plain text.
  Unicode symbols like the play/pause symbol render as coloured emoji on Windows.
- Small and minimal. Controls must never take video space; video is the point.
- Test things for real before claiming they work (see Testing). Earlier "it works"
  claims were wrong several times because the test did not match real input.
- Be concise in replies; say plainly what is untested.
- SITE CODE STAYS SEPARATE: a change for one site must not be able to break another.
  Put site-specific code only in that site's files (see below). If a fix needs an
  `if (instagram)` inside shared code, that is the wrong place: add a hook to the
  site module instead.

## Layout (who owns what)
```
main.js              entry + wiring only: app switches, window, views, IPC, switchTo
lib/config.js        constants (UA, partition, sizes, whitelist, scrollbar css)
lib/navigation-guard.js  URL whitelist hooks for a site view (navigate/redirect/popup)
lib/shortcuts.js     keyboard shortcuts (back, volume, video-only, zoom)
lib/rail.js          control panel window (separate hovering window, drag, expand)
lib/video-mode.js    video-only mode, main side (enter/exit/auto/aspect lock). Site-agnostic.
lib/page-core.js     video-only mode, page side core + shared page snippets. Site-agnostic.
sites/index.js       registry of sites
sites/youtube.js     YouTube: urls, classify(), videoStrategy, 'swipe' IPC
sites/instagram.js   Instagram: urls, classify() (video-only only on /reel*), its own videoStrategy
sites/tiktok.js      TikTok: urls only so far (unfinished)
sites/_fixed-video.js shared "position:fixed fullscreen video" strategy (YouTube, TikTok). NOT for Instagram.
preload/common.js    all pages: visibility/blur spoof, un-mute + app volume
preload/youtube.js   YouTube only: wheel -> 'swipe' (guarded by hostname)
preload/instagram.js Instagram only: reels scrolling, feed restarts, guest wall + cookie dialog (guarded)
preload/rail.js      contextBridge API for the rail UI (window.sidescroll.*)
index.html, renderer.js   the rail UI (SVG icons, vertical volume slider, sign-in button)
```
- Page-side preloads are registered for the whole session with
  `session.setPreloads(PRELOADS)` in `main.js` (sandboxed preloads cannot `require`
  local files). Each preload file guards on its own hostname. Add new ones to `PRELOADS`.
- A site module exports: `name`, `hostSuffix`, `home`, `login`, `lockAspect`,
  `videoStrategy` (page-side source, contract in `lib/page-core.js`),
  `classify(url) -> {video} | null` (null = no automatic video-only mode),
  optional `setupMain({ipcMain, viewFromSender})`.
- To add a site: create `sites/<name>.js`, add to `sites/index.js`, add the domain to
  `ALLOWED_DOMAINS`, optionally `preload/<name>.js` + `PRELOADS`, and a button in the rail.
- Window: `win` is frameless, alwaysOnTop, hosts only the site `WebContentsView`s
  (one per site, lazy, shared session `persist:sidescroll`, iPhone UA, sandbox,
  `backgroundThrottling:false`), filling the window (`layout()`).
- Rail = a SEPARATE small transparent window (`parent: win`, `focusable:false`)
  hovering beside the video window, not over it. Collapsed = 14px grip tab; expands on
  hover to 48px (max 300px tall); follows move/resize; flips left near the screen edge.
  Window drag is manual (grip sends `drag-start`/`drag-end`, main polls the cursor).

## Behaviour that exists and must keep working
- URL whitelist (`lib/config.js`): `will-navigate`, `will-redirect`,
  `setWindowOpenHandler`; blocked URLs are console-logged.
- Media keys: `HardwareMediaKeyHandling,MediaSessionService`; autoplay without gesture.
- Only the visible site makes sound: `switchTo()` mutes + pauses the others, and leaves
  video-only mode first. Clicking the already-active site button loads its home page.
- Back: rail button, Alt+Left, mouse back button. Sign-in: rail person button loads
  the site's `login` URL (the logged-out Instagram home has no obvious login entry).
- Zoom: pages load at 0.7 (`DEFAULT_ZOOM`); Ctrl +/-/0. Volume: rail slider and
  Ctrl+Up/Down; 0 = muted; the site's own mute button is overridden on purpose.
- Video-only mode: Ctrl+Shift+V or the rail's show-full-page button toggles. Sites whose
  `classify` says `video` auto-enter it (YouTube /watch + /shorts, Instagram Reels).
  Leaving to a non-video page exits it (otherwise a blank hidden page). Leaving by hand
  sets "suppressed" so scrolling does not re-enter; re-armed after a non-video page.
  With `lockAspect` (YouTube) the window follows the video shape, re-fitting on a >10%
  format change preserving area. Instagram does NOT lock (reels differ slightly).
- Keeps playing when the window loses focus (`preload/common.js` overrides
  `document.hidden`/`visibilityState`/`hasFocus`, swallows visibilitychange + window blur;
  plus Chromium backgrounding/occlusion switches in `main.js`).

## Hard-won gotchas (do not relearn these)
- DO NOT enable touch emulation (`Emulation.setEmitTouchEventsForMouse` /
  `setTouchEmulationEnabled`) on the site views. It swallowed the real mouse wheel and
  shifted click coordinates. Synthetic test events still passed, which hid it.
- YouTube Shorts (mobile site) advance with ArrowDown/ArrowUp. Wheel in a Short ->
  `preload/youtube.js` sends `swipe` -> `sites/youtube.js` presses Down/Up via
  `sendInputEvent`. CDP touch swipes were unreliable.
- YouTube re-mutes the SAME `<video>` element for each new Short: un-mute must be
  continuous (media-event capture listeners + 250ms interval), not once per element.
- YouTube video-only: YouTube rewrites inline transforms on the video's ancestors on every
  Short change, which trapped the position:fixed video in a moved container (black
  screen). Ancestors are tagged `data-sv-anc` and neutralised by a STYLESHEET rule
  (beats non-important inline styles) and re-tagged every tick. Do not go back to inline.
- Instagram video-only must NOT move the video (position:fixed shifted the feed and broke
  autoplay and current-reel detection). It only hides non-video elements; the feed is
  ~45px shorter than the window (hidden bottom bar) so the scroller is centred with a
  CSS transform. Its feed ignores wheel/arrow keys: scroll the container with `scrollBy`.
- Instagram opens NORMALLY (home `/`, its own bottom bar, login works). Video-only mode
  starts only when the user taps the Reels tab (SPA navigation to /reels/...) and ends when
  they leave Reels. There is no bounce/redirect (an earlier "Reels only" bounce broke login).
- The saved session is usually LOGGED OUT. A logged-out Reels page is covered by a guest
  wall ("view this reel in the app" + Log in / Sign up) when a reel URL is loaded DIRECTLY,
  and Instagram then tries `instagram://reels_share/...` (blocked by the whitelist; harmless).
  Never reload/load a direct `/reels/<id>/` URL: `reloadFeed()` goes to `/` and taps the
  Reels tab instead (`resume()`); `hideWall()` hides the guest wall if it shows anyway.
- Login: the cookie consent dialog covers the form after pressing Log in and its buttons
  are out of reach in a tiny window. `dismissCookieDialog()` clicks its FIRST button
  ("Allow all cookies"); the owner asked for auto-accept (the last button would decline optional).
  Verified end to end with a fake account: Instagram answers "account not found".
- Instagram feed quirks (all handled in `preload/instagram.js`, keep them there):
  1. It does NOT re-lay-out on window resize: reels get the new height but keep the old
     spacing, so several overlap. After a resize/zoom settles (700ms) the page reloads.
  2. Reel spacing is fractional (e.g. 656.4px) but `clientHeight` is an integer, so
     stepping by `clientHeight` drifted ~1px per reel (a sliver of the previous reel
     showed after ~4 steps). Step to the next `<video>`'s real top instead.
  3. The feed stops after 8 reels and never loads more (also without video-only). When
     you step past the last one: `reloadFeed(true)` (home, then Reels tab = fresh batch),
     then auto-step forward. Reloads are rate-limited via sessionStorage (`mayReload`) so
     they can never loop.
  4. Measure "one reel on screen" inside the feed box, not the viewport: neighbours are
     clipped by the feed but still intersect the viewport (test artefact otherwise).
- `lib/video-mode.js` only restores the pre-mode window bounds on exit if the mode itself
  resized the window (`resized`); otherwise a reload (which exits the mode) would undo
  the user's resize and trigger another reload.
- Switching sites while in video-only mode used to resize the window to the old site's
  shape: `switchTo` now exits the mode first.
- Google/Facebook sometimes block sign-in in embedded browsers; it works because the
  sign-in domains are whitelisted and the UA looks like Safari.
- Zoom 0.7 changes the CSS-pixel viewport (190 DIP / 0.7 = 271 CSS px); wheel deltas and
  coordinates seen by the page are scaled by 1/zoom.
- The rail is a separate window, so it is not part of `win.getContentSize()`.

## Open / not done
- Cookie auto-accept exists for Instagram only. YouTube/TikTok were attempted and
  stopped at the owner's request (unverified, reverted). Notes for later: YouTube's consent
  page lists "Reject all" FIRST and "Accept all" second (form flag `set_eom=false` = accept);
  TikTok's banner is a `tiktok-cookie-banner` custom element with its buttons in a shadow root.
  Neither consent screen showed up in clean-session probes from the owner's region.
- RESOLVED: the YouTube view's `render-process-gone: crashed` was a test artefact. It only
  appears when `timeout` kills the app; with a graceful quit (`app.quit()` after 20s) there is no
  crash. In smoke runs ignore that line, or quit gracefully.
- TikTok scrolling and video-only. Probed: the mobile page has a single `<video>`; wheel,
  ArrowDown and touch swipes did nothing. Needs investigation of TikTok's next-video
  mechanism; then fill in `sites/tiktok.js` (+ `preload/tiktok.js`), `classify`.
- Unverified by me: real window dragging by the grip, long-session stability.

## Testing (what actually works)
- Lint + unit tests: `npm run check` (ESLint, `eslint.config.js`; CI in `.github/workflows/ci.yml`). Unit tests: `npm test` (node:test, `test/`): whitelist, site classify(), video-mode window fit, strategy compile.
- Syntax: `for f in main.js lib/*.js sites/*.js preload/*.js renderer.js; do node --check $f; done`.
- Smoke launch: `(unset ELECTRON_RUN_AS_NODE; timeout 12 npx electron .)`; cache errors in
  output are harmless if another instance is running.
- Logic harness: temporarily append a `// TEMP TEST` block to `main.js` guarded by
  `process.env.SS_TEST`, run `SS_TEST=1 npx electron .`, print `console.log('T PASS/FAIL ...')`,
  grep `^T `, then REMOVE the block (`grep -c "TEMP TEST" main.js` must be 0). It can use
  `views.<site>.webContents` (`executeJavaScript`, `sendInputEvent`, `capturePage`,
  `isCurrentlyAudible`), `vm`, `rail.window().webContents` (click rail buttons through the
  real UI, e.g. `document.querySelector('[data-view=instagram]').click()`), `switchTo`,
  `setVolume`, `cfg`. Write screenshots to the scratchpad and Read them.
  Test URLs: `https://m.youtube.com/shorts/`, Instagram home then click `a[href="/reels/"]`. Use `SS_PARTITION=x`
  for a fresh logged-out session. A full regression covers: YouTube Shorts (video-only,
  wheel next x3, audible, manual exit/enter), rail expand + volume slider, switch to
  Instagram (YouTube muted/paused, window unchanged 190x340, reel centred, wheel next/prev,
  survives `win.blur()`), sign-in button, TikTok loads.
- Real input: for bugs that synthetic events miss, launch via PowerShell `Start-Process` and
  drive it with user32 `SetCursorPos`/`mouse_event`/`keybd_event` (wheel flag 0x800, delta
  -120); log page-side events with a temporary `console.log('SSDBG ...')` in a preload and
  forward via `console-message`. This acts on the owner's real desktop: keep it short.
- Test runs use the owner's saved logins (same userData); do not log out or post anything.
