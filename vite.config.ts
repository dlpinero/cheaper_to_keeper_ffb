import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Base path must match the GitHub Pages repo name (https://<user>.github.io/<repo>/)
export default defineConfig({
  base: '/fantasy_football_keeper/',
  plugins: [react()],
});
