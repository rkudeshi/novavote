import { copyFileSync } from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * GitHub Pages has no rewrite rules, so a deep link like /versions
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

// Served at the root of its own subdomain (novavote.raviudeshi.com), so the
// base is '/'.
//
// It was '/novavote/' while the site lived at raviudeshi.com/novavote/: a
// project repo is served under its repo name only on <user>.github.io or on
// a *user-site* apex domain. Give the repo its own custom domain and Pages
// serves it from that domain's root instead, at which point a '/novavote/'
// base makes every asset URL a 404 and the page renders blank.
//
// So: base tracks where the site is *served*, not what the repo is called.
// The version archives override it per build (see deploy.yml) because each
// one is served from its own subdirectory.
export default defineConfig(() => ({
  plugins: [react(), spaFallback()],
  base: '/',
}));
