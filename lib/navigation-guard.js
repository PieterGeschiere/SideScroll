// URL whitelist for one site view: blocks navigations, redirects and popups to
// domains that are not in config.ALLOWED_DOMAINS. Blocked URLs are console-logged.
const cfg = require('./config');

// `load(url)` opens an allowed popup target in the same view.
function guardNavigation(wc, name, load) {
  const guard = (event, url) => {
    if (!cfg.isAllowedUrl(url)) {
      console.log(`[${name}] BLOCKED navigation:`, url);
      event.preventDefault();
    }
  };
  wc.on('will-navigate', guard);
  wc.on('will-redirect', guard);
  // Links that want a new window: open allowed ones in-place, drop the rest.
  wc.setWindowOpenHandler(({ url }) => {
    if (cfg.isAllowedUrl(url)) load(url);
    else console.log(`[${name}] BLOCKED popup:`, url);
    return { action: 'deny' };
  });
}

module.exports = { guardNavigation };
