/**
 * Full React Project Helper
 *
 * This helper collects ALL the React source files from the current project
 * and prepares them for deployment to GitHub.
 *
 * Instead of generating static HTML, we deploy the complete React application
 * with all its components, services, and logic.
 */

/**
 * Get all the source files needed for a complete React deployment
 * This includes all components, services, utilities, etc.
 */
export async function getFullReactProjectFiles(
  applicationId: string,
  apiKey: string,
  supabaseUrl: string,
  supabaseAnonKey: string,
  branding?: any
): Promise<Record<string, string>> {
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
    emptyOutDir: true
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

  // .env.production
  files['.env.production'] = `VITE_SUPABASE_URL=${supabaseUrl}
VITE_SUPABASE_ANON_KEY=${supabaseAnonKey}
VITE_DEFAULT_APP_ID=${applicationId}
VITE_DEFAULT_API_KEY=${apiKey}
`;

  // netlify.toml
  files['netlify.toml'] = `[build]
  command = "npm install && npm run build"
  publish = "dist"

[build.environment]
  NODE_VERSION = "18"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
`;

  // _redirects
  files['_redirects'] = `/*    /index.html   200`;

  // index.html
  files['index.html'] = `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>AuthSystem - Autenticación</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;

  // ============================================
  // NOTE: The actual component files need to be read from the file system
  // Since we're in a browser environment, we'll need to use a different approach
  //
  // For now, we'll return a manifest that tells the system which files to include
  // The actual file reading will be done by the backend/edge function
  // ============================================

  // Add a manifest file that lists all files that need to be copied
  files['_deployment_manifest.json'] = JSON.stringify({
    "type": "full-react-project",
    "applicationId": applicationId,
    "instructions": "This deployment requires ALL source files from the project",
    "requiredFiles": [
      "package.json",
      "vite.config.ts",
      "tsconfig.json",
      "tsconfig.node.json",
      "tailwind.config.js",
      "postcss.config.js",
      "index.html",
      ".env.production",
      "netlify.toml",
      "_redirects",
      "src/main.tsx",
      "src/App.tsx",
      "src/index.css",
      "src/vite-env.d.ts",
      "src/lib/supabase.ts",
      "src/components/auth/PublicAuthForms.tsx",
      "src/components/auth/BrandedPublicAuth.tsx",
      "src/components/auth/PublicAuthRouter.tsx",
      "src/components/auth/RegisterTenantForm.tsx",
      "src/components/ui/BrandedComponents.tsx",
      "src/services/rolesService.ts",
      "src/services/applicationService.ts",
      "src/services/ipService.ts",
      "src/hooks/useAuth.ts",
      "src/utils/themePresets.ts",
      "src/types/index.ts"
    ],
    "sourceProject": "Current AuthSystem Project",
    "deploymentType": "Complete React Application"
  }, null, 2);

  return files;
}

/**
 * Alternative approach: Create a deployment instruction file
 * that tells the system to copy the entire src/ directory
 */
export function getDeploymentInstructions(
  applicationId: string,
  apiKey: string,
  supabaseUrl: string,
  supabaseAnonKey: string
): {
  type: 'full-source-copy';
  config: Record<string, string>;
  instructions: string[];
} {
  return {
    type: 'full-source-copy',
    config: {
      '.env.production': `VITE_SUPABASE_URL=${supabaseUrl}
VITE_SUPABASE_ANON_KEY=${supabaseAnonKey}
VITE_DEFAULT_APP_ID=${applicationId}
VITE_DEFAULT_API_KEY=${apiKey}`,
      'netlify.toml': `[build]
  command = "npm install && npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200`
    },
    instructions: [
      'Copy entire project source to GitHub repository',
      'Update .env.production with application-specific config',
      'Update netlify.toml with build settings',
      'Netlify will build the complete React application',
      'All components, services, and logic will be included'
    ]
  };
}
