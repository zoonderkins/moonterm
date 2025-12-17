import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },

  // Tauri expects the app at localhost:1420 in dev mode
  server: {
    port: 1420,
    strictPort: true,
    host: true
  },

  // Optimize for Tauri
  build: {
    target: 'esnext',
    minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_DEBUG,
    chunkSizeWarningLimit: 600, // Adjust warning threshold
    rollupOptions: {
      output: {
        manualChunks: {
          // Split vendor chunks for better caching
          'vendor-react': ['react', 'react-dom'],
          'vendor-xterm': ['@xterm/xterm', '@xterm/addon-fit', '@xterm/addon-webgl'],
          'vendor-tauri': ['@tauri-apps/api']
        }
      }
    }
  },

  clearScreen: false
})
