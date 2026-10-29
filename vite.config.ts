import { readFileSync } from 'node:fs';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

/**
 * Strict Content Security Policy for the built app: no third-party calls, no form posts.
 * Added at build time only: the dev server needs an inline script for hot reload.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

function contentSecurityPolicy(): Plugin {
  return {
    name: 'content-security-policy',
    apply: 'build',
    transformIndexHtml: () => [
      { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP }, injectTo: 'head-prepend' },
    ],
  };
}

export default defineConfig({
  // GitHub Pages serves the app from /<repo name>/.
  base: '/rigpoint-load-sheet/',
  plugins: [
    react(),
    contentSecurityPolicy(),
    VitePWA({
      // Our own service worker (src/sw.ts): it also receives Android shares.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      // Never update mid-edit: the app shows "Update available – reload" instead.
      registerType: 'prompt',
      // Registered from the app (virtual:pwa-register/react), so no inline script is needed.
      injectRegister: false,
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
      },
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        id: './',
        name: 'RigPoint Load Sheet',
        short_name: 'Load Sheet',
        description: 'Static load-path calculation and Load Sheet for a single flown loudspeaker hang.',
        lang: 'en-GB',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#0b2545',
        theme_color: '#0b2545',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        // Double-click a show file to open it in the installed app (Chrome and Edge desktop).
        file_handlers: [{ action: './', accept: { 'application/json': ['.json'] } }],
        launch_handler: { client_mode: 'focus-existing' },
        // Share a show file into the app from another Android app.
        share_target: {
          action: './share-target',
          method: 'POST',
          enctype: 'multipart/form-data',
          params: { files: [{ name: 'show', accept: ['application/json', '.json'] }] },
        },
      },
      devOptions: { enabled: false },
    }),
  ],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
