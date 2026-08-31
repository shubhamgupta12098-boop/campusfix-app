import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// Allow React JSX syntax inside .js source files.
export default defineConfig({
  base: '/student/',
  plugins: [react()],
  esbuild: {
    loader: 'jsx',
    include: /src\/.*\.js$/,
    exclude: [],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
    esbuildOptions: {
      loader: {
        '.js': 'jsx',
      },
    },
  },
});
