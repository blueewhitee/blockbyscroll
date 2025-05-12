import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: [
    '@wxt-dev/module-react',
  ],
  manifest: {
    name: 'ScrollStop',
    description: 'Control scrolling on distracting websites to prevent doomscrolling',
    version: '1.0.0',
    permissions: ['storage', 'tabs'],
    host_permissions: ['<all_urls>'], // Allow extension to run on any website
    action: {
      default_popup: 'popup/index.html',
      default_title: 'ScrollStop Settings'
    }
    // WXT will auto-discover icons in the public directory
  }
});
