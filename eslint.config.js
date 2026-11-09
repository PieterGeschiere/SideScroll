const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  { ignores: ['node_modules/'] },
  js.configs.recommended,
  {
    // main process, lib, sites, tests: Node (CommonJS)
    files: ['main.js', 'lib/**/*.js', 'sites/**/*.js', 'test/**/*.js', 'eslint.config.js'],
    languageOptions: { sourceType: 'commonjs', globals: globals.node },
  },
  {
    // page-side scripts: browser plus the few Electron preload APIs
    files: ['preload/**/*.js', 'renderer.js'],
    languageOptions: { sourceType: 'commonjs', globals: { ...globals.browser, ...globals.node } },
  },
  {
    rules: {
      'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none' }],
    },
  },
];
