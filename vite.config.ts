/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build`        -> dist/ (normal static site: index.html + hashed assets)
// `npm run build:share`  -> dist-share/ (normal static site WITHOUT the fixture library, for hosting)
// `npm run build:single` -> dist-single/index.html (everything inlined, one portable file)
export default defineConfig(({ mode }) => ({
  plugins: [tailwindcss(), ...(mode === 'single' ? [viteSingleFile()] : [])],
  resolve: mode === 'share' ? { alias: [{ find: /^\.\/sources$/, replacement: '/src/library/sources.empty.ts' }] } : {},
  build: { outDir: mode === 'single' ? 'dist-single' : mode === 'share' ? 'dist-share' : 'dist' },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
  },
}));
