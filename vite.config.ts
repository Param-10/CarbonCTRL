import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { visualizer } from 'rollup-plugin-visualizer';
import { splitVendorChunkPlugin } from 'vite';

// Configuration for CarbonCTRL application
export default defineConfig({
  plugins: [
    react(),
    splitVendorChunkPlugin(), // Automatically split vendor chunks
    visualizer({
      open: false,
      gzipSize: true,
      brotliSize: true,
      filename: 'stats.html'
    }) // Bundle size analyzer with more details
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    },
  },
  define: {
    'process.env': process.env
  },
  base: '/',
  build: {
    rollupOptions: {
      output: {}
    },
    sourcemap: process.env.NODE_ENV !== 'production',
    minify: false,
    reportCompressedSize: true,
    assetsInlineLimit: 4096,
    target: 'esnext',
    outDir: 'dist',
    emptyOutDir: true
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'three',
      '@react-three/fiber',
      '@react-three/drei'
    ],
    esbuildOptions: {
      target: 'esnext'
    }
  },
  server: {
    host: true,
    open: true,
    cors: true,
    hmr: {
      overlay: true
    }
  },
  preview: {
    port: 4173,
    open: true
  }
});
