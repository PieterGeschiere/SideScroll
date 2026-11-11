// The control panel: a small separate transparent window hovering beside the video
// window (not over it). Collapsed = a grip tab; expands on hover.
const { BrowserWindow, screen } = require('electron');
const path = require('path');

const COLLAPSED_W = 14;
const EXPANDED_W = 48;
const TAB_H = 46;
const MAX_H = 300;

function createRail(getWin) {
  let rail = null;
  let expanded = false;
  let side = 'right';
  let dragTimer = null;

  function send(...args) {
    if (rail && !rail.isDestroyed()) rail.webContents.send(...args);
  }

  // Keep attached to the main window; flip to the left if there is no room on the right.
  function position() {
    const win = getWin();
    if (!win || !rail || rail.isDestroyed()) return;
    const b = win.getBounds();
    const w = expanded ? EXPANDED_W : COLLAPSED_W;
    const h = Math.min(b.height, expanded ? MAX_H : TAB_H);
    const wa = screen.getDisplayMatching(b).workArea;
    const newSide = b.x + b.width + EXPANDED_W > wa.x + wa.width ? 'left' : 'right';
    const x = newSide === 'right' ? b.x + b.width : b.x - w;
    const rb = rail.getBounds();
    if (rb.width !== w || rb.height !== h) rail.setBounds({ x, y: b.y, width: w, height: h });
    else if (rb.x !== x || rb.y !== b.y) rail.setPosition(x, b.y);
    if (newSide !== side) {
      side = newSide;
      send('rail-side', side);
    }
  }

  function create(onLoaded) {
    const win = getWin();
    rail = new BrowserWindow({
      parent: win,
      width: COLLAPSED_W,
      height: TAB_H,
      frame: false,
      transparent: true,
      resizable: false,
      skipTaskbar: true,
      hasShadow: false,
      focusable: false, // clicking it never steals focus from the video
      alwaysOnTop: true,
      webPreferences: {
        preload: path.join(__dirname, '..', 'preload', 'rail.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    rail.setAlwaysOnTop(true, 'floating');
    rail.webContents.on('will-navigate', (e) => e.preventDefault());
    rail.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    position();
    rail.loadFile(path.join(__dirname, '..', 'index.html'));
    rail.webContents.once('did-finish-load', onLoaded);
    win.on('move', position);
    win.on('closed', () => rail && !rail.isDestroyed() && rail.destroy());
  }

  function setExpanded(on) {
    expanded = !!on;
    position();
  }

  // Manual window drag (the panel is its own window, so CSS drag regions don't apply).
  function startDrag() {
    clearInterval(dragTimer);
    const win = getWin();
    const c = screen.getCursorScreenPoint();
    const b = win.getBounds();
    let lx = b.x;
    let ly = b.y;
    dragTimer = setInterval(() => {
      const p = screen.getCursorScreenPoint();
      const x = b.x + p.x - c.x;
      const y = b.y + p.y - c.y;
      if (x === lx && y === ly) return;
      lx = x;
      ly = y;
      win.setPosition(x, y); // position only: setBounds re-sets the size and fires 'resize'
    }, 16);
  }
  function endDrag() {
    clearInterval(dragTimer);
  }

  return { create, position, send, setExpanded, startDrag, endDrag, window: () => rail };
}

module.exports = { createRail };
