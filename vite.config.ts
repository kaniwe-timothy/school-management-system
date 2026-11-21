import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import {viteSingleFile} from 'vite-plugin-singlefile';

// Builds the whole app (code, styles, images) into ONE self-contained
// dist/index.html that can be opened from a phone, sent as a file, or
// served from GitHub Pages.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), viteSingleFile()],
  build: {
    assetsInlineLimit: 100_000_000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
