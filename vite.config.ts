import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { copyFileSync } from 'fs';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          router: ['react-router-dom'],
          supabase: ['@supabase/supabase-js'],
          ui: ['lucide-react']
        }
      },
      plugins: [
        {
          name: 'copy-redirects',
          writeBundle() {
            try {
              copyFileSync('_redirects', 'dist/_redirects');
              console.log('✅ _redirects file copied to dist/');
            } catch (error) {
              console.warn('⚠️ Could not copy _redirects file:', error.message);
            }
          }
        }
      ]
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false
      }
    }
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
