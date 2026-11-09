// Keyboard shortcuts for a site view (handled in the main process, before the page sees them).
//   Alt+Left              back
//   Ctrl+Up / Ctrl+Down   volume
//   Ctrl+Shift+V          toggle video-only mode
//   Ctrl + / - / 0        zoom
// actions: { goBack, changeVolume(delta), toggleVideoMode, zoomIn, zoomOut, zoomReset }
function attachShortcuts(wc, actions) {
  wc.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return;
    let handled = true;
    if (input.alt && input.key === 'ArrowLeft') {
      actions.goBack();
    } else if (!input.control) {
      handled = false;
    } else if (input.key === 'ArrowUp' || input.key === 'ArrowDown') {
      actions.changeVolume(input.key === 'ArrowUp' ? 1 : -1);
    } else if (input.shift && input.key.toLowerCase() === 'v') {
      actions.toggleVideoMode();
    } else if (input.key === '=' || input.key === '+') {
      actions.zoomIn();
    } else if (input.key === '-') {
      actions.zoomOut();
    } else if (input.key === '0') {
      actions.zoomReset();
    } else {
      handled = false;
    }
    if (handled) e.preventDefault();
  });
}

module.exports = { attachShortcuts };
