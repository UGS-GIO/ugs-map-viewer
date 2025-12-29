import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { tanstackRouter } from '@tanstack/router-plugin/vite'

// https://vitejs.dev/config/
// Fix for MapLibre GL JS 5.12.0 __publicField issue
// See: https://github.com/maplibre/maplibre-gl-js/issues/6680
export default defineConfig({
  plugins: [
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
    }),
    react(),
  ],
  esbuild: {
    supported: {
      'class-static-field': true,
    },
  },
  build: {
    target: 'es2022',
    rollupOptions: {
      output: {
        manualChunks: {
          'maplibre': ['maplibre-gl'],
          'turf': ['@turf/helpers', '@turf/bbox', '@turf/boolean-point-in-polygon', '@turf/center'],
          'terra-draw': ['terra-draw', 'terra-draw-maplibre-gl-adapter'],
          'react-vendor': ['react', 'react-dom'],
          'tanstack': ['@tanstack/react-query', '@tanstack/react-router'],
        },
      },
    },
  },
  optimizeDeps: {
    esbuildOptions: {
      target: 'es2022',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
