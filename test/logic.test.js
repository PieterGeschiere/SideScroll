const test = require('node:test');
const assert = require('node:assert');
const cfg = require('../lib/config');
const sites = require('../sites');
const { createVideoMode } = require('../lib/video-mode');
const { buildEnterScript } = require('../lib/page-core');

test('isAllowedUrl accepts site and sign-in domains and subdomains', () => {
  for (const u of ['https://m.youtube.com/', 'https://www.instagram.com/reels/', 'https://accounts.google.com/x', 'http://tiktok.com'])
    assert.ok(cfg.isAllowedUrl(u), u);
});

test('isAllowedUrl rejects lookalikes, other schemes and garbage', () => {
  for (const u of ['https://evilinstagram.com/', 'https://youtube.com.evil.io/', 'instagram://reels_share/1', 'javascript:alert(1)', 'not a url', 'https://example.com'])
    assert.ok(!cfg.isAllowedUrl(u), u);
});

test('hostMatches is exact or subdomain only', () => {
  assert.ok(cfg.hostMatches('instagram.com', 'instagram.com'));
  assert.ok(cfg.hostMatches('WWW.Instagram.com', 'instagram.com'));
  assert.ok(!cfg.hostMatches('evilinstagram.com', 'instagram.com'));
});

test('site classify', () => {
  const u = (s) => new URL(s);
  assert.deepStrictEqual(sites.byName.youtube.classify(u('https://m.youtube.com/watch?v=1')), { video: true });
  assert.deepStrictEqual(sites.byName.youtube.classify(u('https://m.youtube.com/shorts/abc')), { video: true });
  assert.deepStrictEqual(sites.byName.youtube.classify(u('https://m.youtube.com/')), { video: false });
  assert.deepStrictEqual(sites.byName.instagram.classify(u('https://www.instagram.com/reels/')), { video: true });
  assert.deepStrictEqual(sites.byName.instagram.classify(u('https://www.instagram.com/')), { video: false });
  assert.strictEqual(sites.byName.tiktok.classify(u('https://www.tiktok.com/')), null);
});

test('every site strategy compiles inside the enter script', () => {
  for (const s of sites.all) assert.doesNotThrow(() => new Function(buildEnterScript(s.videoStrategy)), s.name);
});

// Fake window/view to drive video-mode's aspect-lock maths and enter() guard.
function fakeCtx({ enterResult }) {
  let size = [190, 340];
  const calls = { enter: 0, setContentSize: [] };
  const win = {
    getContentSize: () => size,
    setContentSize: (w, h) => { size = [w, h]; calls.setContentSize.push([w, h]); },
    getBounds: () => ({ x: 0, y: 0, width: size[0], height: size[1] }),
    setBounds: () => {},
    setMinimumSize: () => {},
  };
  const view = {
    webContents: {
      executeJavaScript: async () => {
        calls.enter++;
        await new Promise((r) => setTimeout(r, 20));
        return enterResult;
      },
    },
  };
  const ctx = { getWin: () => win, getView: () => view, getSite: () => ({ videoStrategy: '', lockAspect: true }), railSend() {}, layout() {} };
  return { ctx, calls };
}

test('video-mode enter locks the window to the video aspect ratio', async () => {
  const { ctx, calls } = fakeCtx({ enterResult: { ok: true, ar: 2 } });
  const vm = createVideoMode(ctx);
  await vm.enter();
  assert.ok(vm.isActive());
  assert.deepStrictEqual(calls.setContentSize[0], [190, 95]);
  vm.exit();
  assert.ok(!vm.isActive());
});

test('video-mode ignores overlapping enter() calls', async () => {
  const { ctx, calls } = fakeCtx({ enterResult: { ok: true, ar: 0 } });
  const vm = createVideoMode(ctx);
  await Promise.all([vm.enter(), vm.enter()]);
  assert.strictEqual(calls.enter, 1);
  vm.exit();
});
