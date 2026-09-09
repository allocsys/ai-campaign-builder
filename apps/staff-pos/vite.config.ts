import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

// PWA config: this is the only persona app that needs an installable manifest +
// service worker (plan.md "Deployment architecture" — Staff POS is a PWA, needs
// its own manifest/service-worker scope, which is exactly why it's a separate
// deployment rather than sharing an origin with a non-PWA app). generateSW
// strategy (Workbox-authored SW) is enough for v1 — no custom offline-queue
// caching logic needed at the service-worker level, since the offline queue
// itself is handled in-app via localStorage (see src/lib/mock-data.ts), not
// via service-worker background sync, for this stub/pre-backend phase.
//
// Step 9 polish (2026-09-09): vendor libs (react/react-dom/react-router-dom/framer-motion)
// and the shared ui-kit are split into their own chunks, separate from app code — these
// rarely change between deploys of this app, so browsers can cache them across releases
// instead of re-downloading them every time app code changes.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'صندوق فروشگاه — کمپین‌ساز هوشمند',
        short_name: 'صندوق POS',
        description: 'اپلیکیشن صندوقدار برای ثبت خرید و تحویل پاداش مشتریان',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        start_url: '.',
        scope: '.',
        dir: 'rtl',
        lang: 'fa',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          motion: ['framer-motion'],
          'ui-kit': ['@ai-campaign-builder/ui-kit'],
        },
      },
    },
  },
})
