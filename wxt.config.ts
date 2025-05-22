import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: [
    '@wxt-dev/module-react',
  ],
  manifest: {
    name: 'NoMoScroll',
    description: 'Control scrolling on distracting websites to prevent doomscrolling',
    version: '2.1.0',
    permissions: ['storage', 'tabs'],
    host_permissions: ['<all_urls>'], // Allow extension to run on any website
    action: {
      default_popup: 'popup/index.html',
      default_title: 'NoMoScroll Settings'
    },
    // Explicitly defining your custom icons
    icons: {
      "16": "icon/16.jpg",
      "32": "icon/32.jpg",
      "48": "icon/48.jpg",
      "96": "icon/96.jpg",
      "128": "icon/128.jpg"
    },
    commands: {
      "toggle-pomodoro": {
        suggested_key: {
          default: "Alt+Shift+P",
          windows: "Alt+Shift+P",
          mac: "Alt+Shift+P",
          linux: "Alt+Shift+P"
        },
        description: "Start or stop the Pomodoro timer"
      }
    },
    // The content_scripts array previously here has been removed.
    // WXT will auto-discover content scripts from the entrypoints/ directory.
    // Ensure matching patterns (including for file://*/*) are defined
    // by exporting a 'manifest' const from your 'entrypoints/content.ts' file.
  },
});