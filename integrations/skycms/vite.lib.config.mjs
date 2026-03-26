import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/index.ts'),
      name: 'SkyCMSMonacoEditor',
      formats: ['es', 'umd'],
      fileName: (format) => `skycms-monaco-editor.${format === 'es' ? 'mjs' : 'js'}`,
    },
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      external: ['monaco-editor'],
      output: [
        {
          format: 'es',
          entryFileNames: '[name].mjs',
        },
        {
          format: 'umd',
          name: 'SkyCMSMonacoEditor',
          entryFileNames: '[name].js',
          globals: {
            'monaco-editor': 'monaco',
          },
        },
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
