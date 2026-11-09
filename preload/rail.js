const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('sidescroll', {
  switchTo: (name) => ipcRenderer.send('switch-view', name),
  toggleVideoMode: () => ipcRenderer.send('toggle-video-mode'),
  setRailExpanded: (on) => ipcRenderer.send('rail-expand', on),
  dragStart: () => ipcRenderer.send('drag-start'),
  dragEnd: () => ipcRenderer.send('drag-end'),
  onRailSide: (cb) => ipcRenderer.on('rail-side', (_e, side) => cb(side)),
  openLogin: () => ipcRenderer.send('open-login'),
  goBack: () => ipcRenderer.send('go-back'),
  togglePlay: () => ipcRenderer.send('toggle-play'),
  setVolume: (v) => ipcRenderer.send('set-volume', v),
  onVolume: (cb) => ipcRenderer.on('volume-changed', (_e, v) => cb(v)),
  close: () => ipcRenderer.send('close-window'),
  onActiveChanged: (cb) =>
    ipcRenderer.on('active-changed', (_e, name) => cb(name)),
  onVideoMode: (cb) => ipcRenderer.on('video-mode', (_e, on) => cb(on)),
  onVideoFailed: (cb) => ipcRenderer.on('video-mode-failed', () => cb()),
});
