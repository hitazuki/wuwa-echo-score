import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vite'

export default defineConfig({
  base: '/wuwa-echo-score/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: '鸣潮声骸评分',
        short_name: '声骸评分',
        description: '本地 OCR 识别和角色声骸逐条评分',
        theme_color: '#0a171b',
        background_color: '#0a171b',
        display: 'standalone',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,txt,json,tar,wasm,mjs,png}'],
        globIgnores: ['**/assets/ort-wasm-simd-threaded.jsep-*.wasm', '**/models/**', '**/ort/**'],
        maximumFileSizeToCacheInBytes: 50 * 1024 * 1024,
        navigateFallback: '/wuwa-echo-score/index.html',
        skipWaiting: true,
        clientsClaim: true,
        runtimeCaching: [{
          urlPattern: /\/wuwa-echo-score\/(?:models\/.*\.tar|ort\/.*\.(?:wasm|mjs))$/,
          handler: 'CacheFirst',
          options: { cacheName: 'wuwa-ocr-assets-v1' },
        }],
      },
    }),
  ],
})
