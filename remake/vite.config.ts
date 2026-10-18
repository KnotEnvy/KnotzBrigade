import { defineConfig } from 'vite';

// Keep the exported dist/ portable, including static hosting under a subdirectory.
export default defineConfig({ base: './' });
