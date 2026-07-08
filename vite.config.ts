import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { copyFileSync } from 'fs';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
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
     port: 5172,
    host: true,
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
  define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY),
    'import.meta.env.VITE_DLOCAL_API_URL': JSON.stringify(env.VITE_DLOCAL_API_URL),
    'import.meta.env.VITE_DLOCAL_API_KEY': JSON.stringify(env.VITE_DLOCAL_API_KEY),
    'import.meta.env.VITE_DLOCAL_SECRET_KEY': JSON.stringify(env.VITE_DLOCAL_SECRET_KEY),
    'import.meta.env.VITE_DLOCAL_PLANS_ENDPOINT': JSON.stringify(env.VITE_DLOCAL_PLANS_ENDPOINT),
  }
};
});
