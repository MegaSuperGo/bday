import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv, type Plugin } from 'vite';

/** Adds a strict Content-Security-Policy to production HTML (dev needs inline HMR scripts). */
function csp(apiUrl: string): Plugin {
  let apiOrigin = '';
  try {
    apiOrigin = apiUrl ? new URL(apiUrl).origin : '';
  } catch {
    apiOrigin = '';
  }
  const policy = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    "img-src 'self' data: blob: https://wmts.geo.admin.ch",
    `connect-src 'self' ${apiOrigin}`.trim(),
    "base-uri 'self'",
    "form-action 'none'",
  ].join('; ');
  return {
    name: 'nexus-csp',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />`);
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    // For GitHub project pages set VITE_BASE=/<repository-name>/
    base: env.VITE_BASE || '/',
    plugins: [react(), csp(env.VITE_API_URL ?? '')],
    server: { port: 5173, fs: { allow: ['..'] } },
    build: {
      target: 'es2020',
      // three.js is lazy-loaded in its own chunk; it is large by nature
      chunkSizeWarningLimit: 700,
      rollupOptions: {
        input: {
          main: fileURLToPath(new URL('./index.html', import.meta.url)),
          admin: fileURLToPath(new URL('./admin/index.html', import.meta.url)),
        },
      },
    },
    test: { include: ['src/**/*.test.ts'] },
  };
});
