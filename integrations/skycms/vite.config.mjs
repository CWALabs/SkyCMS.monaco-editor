import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  root: 'playground',
  optimizeDeps: {
    exclude: ['monaco-editor'],
  },
  build: {
    outDir: '../playground-dist',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    open: true,
  },
});
