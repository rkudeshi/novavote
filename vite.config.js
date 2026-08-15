import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Served as a project page at rkudeshi.github.io/novavote, so production
// assets need the /novavote/ base path. Dev server stays at root. If/when
// this moves to a custom domain (novavote.net), switch base back to '/'.
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? '/novavote/' : '/',
}));
