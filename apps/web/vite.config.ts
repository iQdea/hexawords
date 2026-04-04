import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico'],
      manifest: {
        name: 'Hexawords',
        short_name: 'Hexawords',
        description: 'Собирай слова из букв на гексагональном поле',
        theme_color: '#1976d2',
        background_color: '#fafafa',
        display: 'standalone',
        orientation: 'portrait',
        lang: 'ru',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https?:\/\/localhost:3000\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 300 },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // Point Vite to TypeScript sources instead of CJS dist
      '@hexawords/types': fileURLToPath(new URL('../../packages/types/src/index.ts', import.meta.url)),
      '@hexawords/hex-math': fileURLToPath(new URL('../../packages/hex-math/src/index.ts', import.meta.url)),
      '@hexawords/game-engine': fileURLToPath(new URL('../../packages/game-engine/src/index.ts', import.meta.url)),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        rewrite: path => path.replace(/^\/api/, ''),
      },
    },
  },
})
