import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Step 9 polish (2026-09-09): vendor libs (react/react-dom/react-router-dom/framer-motion)
// and the shared ui-kit are split into their own chunks, separate from app code — these
// rarely change between deploys of this app, so browsers can cache them across releases
// instead of re-downloading them every time app code changes. Especially relevant here:
// this is the highest-traffic, most mobile-data-sensitive persona (plan.md "Deployment
// architecture" — Customer app note on Iranian mobile data costs).
export default defineConfig({
  plugins: [react()],
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
