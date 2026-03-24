import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    // Raise chunk size warning limit — ExcelJS + Plotly are large but
    // unavoidable for this app's feature set.
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Plotly — ~3MB, matched by module path (react-plotly.js bundles it internally)
          if (id.includes('node_modules/plotly.js') || id.includes('node_modules/react-plotly.js')) {
            return 'vendor-plotly';
          }
          // ExcelJS — ~2.5MB, lazy-loaded only on import/export
          if (id.includes('node_modules/exceljs')) {
            return 'vendor-excel';
          }
          // Core React runtime
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react-router-dom')) {
            return 'vendor-react';
          }
          if (id.includes('node_modules/react/')) {
            return 'vendor-react';
          }
          // Supabase client
          if (id.includes('node_modules/@supabase')) {
            return 'vendor-supabase';
          }
          // Small UI utilities
          if (
            id.includes('node_modules/react-hot-toast') ||
            id.includes('node_modules/clsx') ||
            id.includes('node_modules/tailwind-merge')
          ) {
            return 'vendor-ui';
          }
        },
      },
    },
  },
})

