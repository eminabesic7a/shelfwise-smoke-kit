import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // In development the API runs separately on :3001
    proxy: { '/api': 'http://localhost:3001' },
  },
});
