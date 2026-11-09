// SideScroll: entry point and wiring only. Site-specific code lives in sites/ and
// preload/<site>.js; shared machinery lives in lib/. See CLAUDE.md.
const { app, BrowserWindow, WebContentsView, ipcMain, session } = require('electron');
const path = require('path');
const cfg = require('./lib/config');
const { createRail } = require('./lib/rail');
const { createVideoMode } = require('./lib/video-mode');
const { guardNavigation } = require('./lib/navigation-guard');
const { attachShortcuts } = require('./lib/shortcuts');
const { PAUSE_ALL_JS } = require('./lib/page-core');
const sites = require('./sites');

// Hardware media keys (play/pause/next/prev) -> Chromium's media session handling.
app.commandLine.appendSwitch('enable-features', 'HardwareMediaKeyHandling,MediaSessionService');
// Let videos start without a prior click inside the page.
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
// Never throttle or pause rendering because the window is unfocused or covered.
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');

// Page-side scripts run in every site view; each one guards on its own hostname.
const PRELOADS = ['common', 'youtube', 'instagram'].map((n) => path.join(__dirname, 'preload', n + '.js'));

let win;
const views = {}; // site name -> WebContentsView (created lazily)
let activeName = null;
let zoom = cfg.DEFAULT_ZOOM;
let volume = 1;

const loadUrl = (wc, url) => wc.loadURL(url, { userAgent: cfg.IPHONE_UA });

const rail = createRail(() => win);
const vm = createVideoMode({
  getWin: () => win,
  getView: () => views[activeName],
  getSite: () => sites.byName[activeName],
  railSend: rail.send,
  layout,
});

function layout() {
  if (!win) return;
  const [width, height] = win.getContentSize();
  for (const v of Object.values(views)) v.setBounds({ x: 0, y: 0, width, height });
  rail.position();
}

function setVolume(v) {
  volume = Math.max(0, Math.min(1, v));
  for (const view of Object.values(views)) view.webContents.send('volume', volume);
  rail.send('volume-changed', volume);
}

function setZoom(z) {
  zoom = Math.max(cfg.ZOOM_MIN, Math.min(cfg.ZOOM_MAX, z));
  for (const v of Object.values(views)) v.webContents.setZoomFactor(zoom);
}

function goBack() {
  const view = views[activeName];
  if (!view) return;
  const h = view.webContents.navigationHistory;
  if (h.canGoBack()) h.goBack();
}

function createView(name) {
  const site = sites.byName[name];
  const view = new WebContentsView({
    webPreferences: {
      partition: cfg.PARTITION, // shared session: keeps logins between runs
      backgroundThrottling: false, // keep audio/video alive when unfocused
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  const wc = view.webContents;
  wc.setUserAgent(cfg.IPHONE_UA);
  const load = (url) => loadUrl(wc, url);

  guardNavigation(wc, name, load);

  // ---- Logging -------------------------------------------------------------
  wc.on('did-fail-load', (_e, code, desc, url, isMainFrame) => {
    if (isMainFrame && code !== -3) console.log(`[${name}] LOAD FAILED`, code, desc, url);
  });
  wc.on('render-process-gone', (_e, d) => console.log(`[${name}] RENDERER GONE`, d.reason));
  wc.on('did-navigate', (_e, url) => console.log(`[${name}] navigated:`, url));
  if (process.env.SS_DEVTOOLS) wc.openDevTools({ mode: 'detach' });

  // ---- Zoom, scrollbar, volume --------------------------------------------
  wc.on('dom-ready', () => {
    wc.send('volume', volume);
    wc.setZoomFactor(zoom);
    wc.insertCSS(cfg.SCROLLBAR_CSS).catch(() => {});
  });

  attachShortcuts(wc, {
    goBack,
    changeVolume: (dir) => setVolume(volume + dir * cfg.VOLUME_STEP),
    toggleVideoMode: () => vm.toggle(),
    zoomIn: () => setZoom(zoom + cfg.ZOOM_STEP),
    zoomOut: () => setZoom(zoom - cfg.ZOOM_STEP),
    zoomReset: () => setZoom(cfg.DEFAULT_ZOOM),
  });

  // ---- Per-site page handling (the site module decides what a page means) ---
  const onPage = (url) => {
    if (views[activeName] !== view) return;
    let u;
    try { u = new URL(url); } catch { return; }
    if (!cfg.hostMatches(u.hostname, site.hostSuffix)) return; // e.g. a sign-in provider page
    const c = site.classify(u);
    if (!c) return; // this site has no automatic video-only mode
    if (c.video) {
      if (!vm.isActive() && !vm.isSuppressed()) vm.autoEnter(view);
    } else {
      vm.setSuppressed(false); // left the video pages: auto mode is armed again
      if (vm.isActive()) vm.exit(); // don't leave a blank hidden page
    }
  };
  wc.on('did-navigate-in-page', (_e, url, isMain) => isMain && onPage(url));
  wc.on('did-finish-load', () => onPage(wc.getURL()));
  // A full page load wipes the injected video-mode script, so leave the mode.
  wc.on('did-navigate', () => {
    if (vm.isActive() && views[activeName] === view) vm.exit();
  });

  win.contentView.addChildView(view);
  views[name] = view;
  layout();
  load(site.home);
  return view;
}

function switchTo(name) {
  const site = sites.byName[name];
  if (!site) return;
  // Clicking the already-active site = go to its home page (escape hatch).
  if (activeName === name && views[name]) {
    if (vm.isActive()) vm.exit();
    loadUrl(views[name].webContents, site.home);
    return;
  }
  // Video-only mode belongs to one site's page: leave it (in the old view) before switching.
  if (vm.isActive()) vm.exit();
  const view = views[name] || createView(name);
  // Only the visible site may make sound: pause + mute the others.
  for (const [n, v] of Object.entries(views)) {
    const active = n === name;
    v.setVisible(active);
    v.webContents.setAudioMuted(!active);
    if (!active) v.webContents.executeJavaScript(PAUSE_ALL_JS).catch(() => {});
  }
  win.contentView.addChildView(view); // bring the active view to the top
  activeName = name;
  rail.send('active-changed', name);
}

function createWindow() {
  session.fromPartition(cfg.PARTITION).setPreloads(PRELOADS);

  win = new BrowserWindow({
    ...cfg.WINDOW,
    frame: false,
    alwaysOnTop: true,
    backgroundColor: '#111111',
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  win.setAlwaysOnTop(true, 'floating');

  rail.create(() => switchTo(sites.all[0].name));

  win.on('app-command', (_e, cmd) => {
    if (cmd === 'browser-backward') goBack(); // mouse back button
  });
  win.on('resize', () => {
    vm.fit(false);
    layout();
  });
}

// ---- IPC from the rail -------------------------------------------------------
ipcMain.on('switch-view', (_e, name) => switchTo(name));
ipcMain.on('go-back', goBack);
ipcMain.on('set-volume', (_e, v) => setVolume(Number(v)));
ipcMain.on('toggle-video-mode', () => vm.toggle());
ipcMain.on('toggle-play', () => vm.togglePlay());
ipcMain.on('close-window', () => win && win.close());
ipcMain.on('rail-expand', (_e, on) => rail.setExpanded(on));
ipcMain.on('drag-start', () => rail.startDrag());
ipcMain.on('drag-end', () => rail.endDrag());
// Instagram shows Reels to guests, so there is no login prompt to reach on its own;
// the rail's sign-in button goes straight to the active site's login page.
ipcMain.on('open-login', () => {
  const view = views[activeName];
  const site = sites.byName[activeName];
  if (!view || !site) return;
  vm.setSuppressed(true);
  if (vm.isActive()) vm.exit();
  loadUrl(view.webContents, site.login);
});

// Site-specific main-process hooks (e.g. YouTube's 'swipe' request).
for (const site of sites.all) {
  if (site.setupMain) {
    site.setupMain({
      ipcMain,
      viewFromSender: (sender) => Object.values(views).find((v) => v.webContents === sender),
    });
  }
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
