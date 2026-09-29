import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  // .env belongs to the API. Browser config comes from /api/config; keep the
  // local NODE_ENV=development from downgrading production React artifacts.
  envDir: false,
  build: { outDir: 'dist/web' },
  server: { port: 5173, strictPort: true, proxy: { '/api': 'http://127.0.0.1:3001' } },
});
