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
        manualChunks: {
          // Core React runtime
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // Supabase client
          'vendor-supabase': ['@supabase/supabase-js'],
          // Small UI utilities
          'vendor-ui': ['react-hot-toast', 'clsx', 'tailwind-merge'],
          // ExcelJS — ~2.5MB minified, lazy-loaded only on import/export
          'vendor-excel': ['exceljs'],
          // Plotly — ~3MB minified, used only by StructureSunburstView
          'vendor-plotly': ['plotly.js-dist-min'],
        },
      },
    },
  },
})

