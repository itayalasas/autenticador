import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface CollectFilesRequest {
  applicationId: string;
  apiKey: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  branding?: any;
}

/**
 * This Edge Function collects ALL React source files from the project
 * and prepares them for deployment to GitHub.
 *
 * It reads the actual .tsx, .ts, .css files and returns them as a bundle.
 */
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { applicationId, apiKey, supabaseUrl, supabaseAnonKey, branding }: CollectFilesRequest = await req.json();

    console.log('📦 Collecting source files for deployment...');
    console.log('Application ID:', applicationId);

    const files: Record<string, string> = {};

    // ============================================
    // ROOT CONFIGURATION FILES
    // ============================================

    // package.json
    files['package.json'] = JSON.stringify({
      "name": "authsystem-public-forms",
      "version": "1.0.0",
      "private": true,
      "type": "module",
      "scripts": {
        "dev": "vite",
        "build": "vite build",
        "preview": "vite preview"
      },
      "dependencies": {
        "react": "^18.3.1",
        "react-dom": "^18.3.1",
        "react-router-dom": "^7.9.3",
        "@supabase/supabase-js": "^2.57.4",
        "lucide-react": "^0.344.0"
      },
      "devDependencies": {
        "@vitejs/plugin-react": "^4.3.1",
        "vite": "^5.4.2",
        "typescript": "^5.5.3",
        "@types/react": "^18.3.5",
        "@types/react-dom": "^18.3.0",
        "autoprefixer": "^10.4.18",
        "postcss": "^8.4.35",
        "tailwindcss": "^3.4.1"
      }
    }, null, 2);

    // vite.config.ts
    files['vite.config.ts'] = `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          router: ['react-router-dom'],
          supabase: ['@supabase/supabase-js'],
          ui: ['lucide-react']
        }
      }
    }
  },
  optimizeDeps: {
    exclude: ['lucide-react']
  }
});
`;

    // tsconfig.json
    files['tsconfig.json'] = JSON.stringify({
      "compilerOptions": {
        "target": "ES2020",
        "useDefineForClassFields": true,
        "lib": ["ES2020", "DOM", "DOM.Iterable"],
        "module": "ESNext",
        "skipLibCheck": true,
        "moduleResolution": "bundler",
        "allowImportingTsExtensions": true,
        "resolveJsonModule": true,
        "isolatedModules": true,
        "noEmit": true,
        "jsx": "react-jsx",
        "strict": true,
        "noUnusedLocals": true,
        "noUnusedParameters": true,
        "noFallthroughCasesInSwitch": true
      },
      "include": ["src"],
      "references": [{ "path": "./tsconfig.node.json" }]
    }, null, 2);

    // tsconfig.node.json
    files['tsconfig.node.json'] = JSON.stringify({
      "compilerOptions": {
        "composite": true,
        "skipLibCheck": true,
        "module": "ESNext",
        "moduleResolution": "bundler",
        "allowSyntheticDefaultImports": true
      },
      "include": ["vite.config.ts"]
    }, null, 2);

    // tailwind.config.js
    files['tailwind.config.js'] = `export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
`;

    // postcss.config.js
    files['postcss.config.js'] = `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
`;

    // .env.production - Application specific configuration
    files['.env.production'] = `# Auto-generated configuration for Application: ${applicationId}
# Generated: ${new Date().toISOString()}

# Supabase Configuration
VITE_SUPABASE_URL=${supabaseUrl}
VITE_SUPABASE_ANON_KEY=${supabaseAnonKey}

# Application Configuration
VITE_DEFAULT_APP_ID=${applicationId}
VITE_DEFAULT_API_KEY=${apiKey}

# Build Configuration
NODE_ENV=production
`;

    // netlify.toml
    files['netlify.toml'] = `# Netlify Build Configuration
# Application: ${applicationId}
# Generated: ${new Date().toISOString()}

[build]
  command = "npm install && npm run build"
  publish = "dist"

[build.environment]
  NODE_VERSION = "18"
  VITE_SUPABASE_URL = "${supabaseUrl}"
  VITE_SUPABASE_ANON_KEY = "${supabaseAnonKey}"
  VITE_DEFAULT_APP_ID = "${applicationId}"
  VITE_DEFAULT_API_KEY = "${apiKey}"

# SPA routing - redirect all requests to index.html
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

# Security headers
[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    X-XSS-Protection = "1; mode=block"
    Referrer-Policy = "strict-origin-when-cross-origin"
`;

    // _redirects
    files['_redirects'] = `/*    /index.html   200`;

    // index.html - NOTE: Use relative path for Vite
    files['index.html'] = `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>AuthSystem - Autenticación</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./src/main.tsx"></script>
  </body>
</html>
`;

    // ============================================
    // GENERATE SOURCE FILES (EMBEDDED)
    // ============================================

    console.log('📦 Generating source files...');

    // NOTE: Files are embedded directly to avoid dependency on temporary directories
    // that may contain stale code. This ensures fresh deployments every time.

    // IMPORTANT: When updating the source files in the main project,
    // you must also update this Edge Function to reflect the changes.
    // Better solution: Use MCP tool mcp__supabase__deploy_edge_function to update this function

    const EMBEDDED_FILES = {
      // Your source files will be embedded here
      // For now, return error to force update
    };

    throw new Error(
      'This Edge Function needs to be updated with embedded source files. ' +
      'The old version was reading from a temporary directory which contained stale code. ' +
      'Please contact support or use the deployment tool to regenerate this function with current code.'
    );

    // README with deployment info
    files['README.md'] = `# AuthSystem Public Forms

**Application ID**: ${applicationId}
**Deployed**: ${new Date().toISOString()}

## 🚀 Complete React Application

This is a full React application deployment with all components, services, and logic.

### ✨ Features Included

- ✅ Complete React components with validations
- ✅ Dynamic role loading from Supabase database
- ✅ Password confirmation and validation
- ✅ User type/role selection
- ✅ Custom branding support
- ✅ IP blocking functionality
- ✅ TypeScript for type safety
- ✅ Tailwind CSS for styling

### 📋 Available Routes

- \`/login\` - User login form
- \`/register\` - User registration form
- \`/reset-password\` - Password reset form

### 🔗 Example URLs

\`\`\`
https://your-site.netlify.app/login?app_id=${applicationId}&api_key=${apiKey.substring(0, 20)}...&redirect_uri=YOUR_CALLBACK
https://your-site.netlify.app/register?app_id=${applicationId}&api_key=${apiKey.substring(0, 20)}...&redirect_uri=YOUR_CALLBACK
\`\`\`

### 🏗️ Build Process

Netlify automatically:
1. Runs \`npm install\`
2. Runs \`npm run build\`
3. Deploys the \`dist/\` folder
4. Configures SPA routing

### 🔄 Updates

This site is configured for continuous deployment. Push changes to the repository and Netlify will automatically rebuild and redeploy.

---

*Auto-generated by AuthSystem*
`;

    console.log('✅ Source collection complete!');
    console.log(`📦 Total files collected: ${Object.keys(files).length}`);

    // Log summary
    const summary = {
      totalFiles: Object.keys(files).length,
      sourceFiles: sourceFilesToCollect.length,
      configFiles: Object.keys(files).length - sourceFilesToCollect.length,
      applicationId,
    };

    return new Response(
      JSON.stringify({
        success: true,
        files,
        summary,
        message: 'Source files collected successfully'
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );

  } catch (error) {
    console.error('❌ Error collecting source files:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Unknown error occurred'
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
