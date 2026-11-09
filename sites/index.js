// Site registry. To add a site: create sites/<name>.js, list it here, and (if it needs
// page-side behaviour) create preload/<name>.js and list it in main.js PRELOADS.
const all = [require('./youtube'), require('./tiktok'), require('./instagram')];
const byName = Object.fromEntries(all.map((s) => [s.name, s]));

module.exports = { all, byName };
