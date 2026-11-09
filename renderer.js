const api = window.sidescroll;
const buttons = document.querySelectorAll('button[data-view]');
const vol = document.getElementById('vol');
const grip = document.getElementById('grip');

buttons.forEach((b) => b.addEventListener('click', () => api.switchTo(b.dataset.view)));
document.getElementById('back').addEventListener('click', () => api.goBack());
document.getElementById('login').addEventListener('click', () => api.openLogin());
document.getElementById('exit').addEventListener('click', () => api.toggleVideoMode());
document.getElementById('play').addEventListener('click', () => api.togglePlay());
document.getElementById('close').addEventListener('click', () => api.close());

api.onActiveChanged((name) => {
  buttons.forEach((b) => b.classList.toggle('active', b.dataset.view === name));
});
vol.addEventListener('input', () => api.setVolume(vol.value / 100));
api.onVolume((v) => (vol.value = Math.round(v * 100)));
api.onRailSide((side) => document.body.classList.toggle('left', side === 'left'));
api.onVideoMode((on) => document.body.classList.toggle('vm', on));

// ---- Expand on hover, collapse shortly after the pointer leaves -------------
let busy = false; // dragging the grip or the slider keeps the rail open
let collapseTimer = 0;
function setExpanded(on) {
  clearTimeout(collapseTimer);
  document.body.classList.toggle('expanded', on);
  api.setRailExpanded(on);
}
document.documentElement.addEventListener('mouseenter', () => setExpanded(true));
document.documentElement.addEventListener('mouseleave', () => {
  if (busy) return;
  collapseTimer = setTimeout(() => setExpanded(false), 350);
});

// ---- Window drag (frameless, so the grip moves the window itself) -----------
grip.addEventListener('pointerdown', (e) => {
  busy = true;
  grip.setPointerCapture(e.pointerId);
  api.dragStart();
});
const endDrag = () => {
  if (!busy) return;
  busy = false;
  api.dragEnd();
};
grip.addEventListener('pointerup', endDrag);
grip.addEventListener('pointercancel', endDrag);
window.addEventListener('blur', endDrag);

vol.addEventListener('pointerdown', () => (busy = true));
vol.addEventListener('pointerup', () => (busy = false));
