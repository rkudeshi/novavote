import { copyFileSync } from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * GitHub Pages has no rewrite rules, so a deep link like /novavote/versions
 * would 404 — there's no file at that path. Copying the built index.html to
 * 404.html makes Pages serve the app for any unmatched path; it boots and
 * the router reads location.pathname. No redirect, no flash, no sessionStorage
 * hack, because the asset URLs in index.html are absolute.
 */
function spaFallback() {
  let outDir = 'dist';
  return {
    name: 'novavote-spa-fallback',
    apply: 'build',
    // Read the resolved outDir rather than assuming dist/: the version
    // archive builds each tagged release into its own directory.
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      copyFileSync(path.join(outDir, 'index.html'), path.join(outDir, '404.html'));
      console.log(`spa-fallback: ${path.relative(process.cwd(), outDir)}/404.html written`);
    },
  };
}

// Served as a project page under /novavote/, so production assets need that
// base path. Dev server stays at root. If this ever moves to a bare custom
// domain (novavote.net at the root), change base to '/'.
export default defineConfig(({ command }) => ({
  plugins: [react(), spaFallback()],
  base: command === 'build' ? '/novavote/' : '/',
}));
