// Shared constants. Nothing site-specific lives here (see sites/).
const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 ' +
  '(KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

// One shared session for all sites: logins persist between runs.
// SS_PARTITION lets tests use a fresh, logged-out session.
const PARTITION = process.env.SS_PARTITION || 'persist:sidescroll';

const DEFAULT_ZOOM = 0.7; // page zoom: smaller = more fits in the window
const ZOOM_MIN = 0.3;
const ZOOM_MAX = 1.5;
const ZOOM_STEP = 0.1;
const VOLUME_STEP = 0.1;

const WINDOW = { width: 190, height: 340, minWidth: 90, minHeight: 70 };
const VIDEO_MODE_MIN = { width: 80, height: 50 };

// Video-only mode timings (ms) and thresholds.
const VIDEO_MODE = {
  AUTO_ENTER_INTERVAL: 500, // retry entering until the <video> exists
  AUTO_ENTER_TRIES: 20,
  ASPECT_POLL: 500, // how often the video shape is re-read
  ASPECT_CHANGE: 0.1, // refit the window when the shape changes by more than 10%
};

// Navigation whitelist: the three sites plus the sign-in providers they use.
const ALLOWED_DOMAINS = [
  'youtube.com', 'tiktok.com', 'instagram.com',
  'google.com', 'facebook.com', 'apple.com', 'x.com', 'twitter.com',
  'tiktokv.com', 'tiktokw.us',
];

// True when `host` is `domain` or one of its subdomains (not merely a name ending in it).
function hostMatches(host, domain) {
  host = String(host).toLowerCase();
  return host === domain || host.endsWith('.' + domain);
}

function isAllowedUrl(url) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
  return ALLOWED_DOMAINS.some((d) => hostMatches(u.hostname, d));
}

// Slim, translucent scrollbar that suits a tiny window.
const SCROLLBAR_CSS = `
  ::-webkit-scrollbar { width: 4px !important; height: 4px !important; background: transparent !important; }
  ::-webkit-scrollbar-track { background: transparent !important; }
  ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.28) !important; border-radius: 4px !important; }
  ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.55) !important; }
  ::-webkit-scrollbar-corner { background: transparent !important; }
`;

module.exports = {
  IPHONE_UA, PARTITION, DEFAULT_ZOOM, ZOOM_MIN, ZOOM_MAX, ZOOM_STEP, VOLUME_STEP,
  WINDOW, VIDEO_MODE_MIN, VIDEO_MODE,
  ALLOWED_DOMAINS, hostMatches, isAllowedUrl, SCROLLBAR_CSS,
};
