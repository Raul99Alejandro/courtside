import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const page = (name: string) => resolve(import.meta.dirname, name);

export default defineConfig({
  root: import.meta.dirname,
  build: {
    target: 'es2022',
    rollupOptions: { input: { index: page('index.html'), phone: page('phone.html'), tv: page('tv.html') } },
  },
});
