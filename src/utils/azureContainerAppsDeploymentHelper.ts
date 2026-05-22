import { requireSupabaseAnonKey, requireSupabaseUrl } from '../lib/supabaseRuntime';
import type { AzureContainerAppsConfig } from '../types';

interface AzureContainerAppsDeploymentOptions {
  environmentName: string;
  branch: string;
  applicationDisplayName: string;
  containerAppName: string;
  resourceGroup: string;
  location: string;
  containerAppsEnvironment?: string | null;
  createIfMissing?: boolean;
}

function escapeYamlValue(value: string): string {
  return value.replace(/'/g, "''");
}

function sanitizeEnvironmentName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
}

function normalizeAzureName(value: string, fallback: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);

  return normalized || fallback;
}

export function buildAzureCredentialsSecretPayload(config: AzureContainerAppsConfig): string {
  return JSON.stringify({
    clientId: config.client_id,
    clientSecret: config.client_secret,
    subscriptionId: config.subscription_id,
    tenantId: config.tenant_id,
  });
}

export function buildDefaultContainerAppName(applicationName: string, environmentName: string): string {
  const appSlug = applicationName
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalizeAzureName(`${appSlug || 'auth-forms'}-${sanitizeEnvironmentName(environmentName)}`, `auth-${sanitizeEnvironmentName(environmentName)}`);
}

export function applyAzureContainerAppsDeploymentFiles(
  baseFiles: Record<string, string>,
  options: AzureContainerAppsDeploymentOptions
): Record<string, string> {
  const files = { ...baseFiles };
  const packageJson = JSON.parse(files['package.json']);
  packageJson.scripts = {
    ...(packageJson.scripts || {}),
    start: 'node server.mjs',
  };
  packageJson.dependencies = {
    ...(packageJson.dependencies || {}),
    express: '^4.21.2',
  };
  files['package.json'] = `${JSON.stringify(packageJson, null, 2)}\n`;

  const supabaseUrl = requireSupabaseUrl();
  const supabaseAnonKey = requireSupabaseAnonKey();
  const envName = sanitizeEnvironmentName(options.environmentName);
  const containerAppName = normalizeAzureName(
    options.containerAppName,
    buildDefaultContainerAppName(options.applicationDisplayName, options.environmentName)
  );
  const containerAppsEnvironment = normalizeAzureName(
    options.containerAppsEnvironment || `${containerAppName}-env`,
    `${containerAppName}-env`
  );
  const createIfMissing = options.createIfMissing !== false;
  const workflowFileName = `.github/workflows/deploy-auth-forms-${envName}.yml`;

  files['server.mjs'] = `import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app = express();
const port = Number(process.env.PORT || 8080);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.join(__dirname, 'dist');

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'authsystem-public-forms' });
});

app.get('/get-env', (_req, res) => {
  res.json({
    variables: {
      VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL || '',
      VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY || '',
      VITE_ENV_CONFIG_URL: '/get-env',
    }
  });
});

app.use(express.static(distDir, {
  index: false,
  maxAge: '1h',
}));

app.get('*', (_req, res) => {
  res.sendFile(path.join(distDir, 'index.html'));
});

app.listen(port, () => {
  console.log('AuthSystem public forms listening on port', port);
});
`;

  files['Dockerfile'] = `FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm install --omit=dev
COPY --from=build /app/dist ./dist
COPY server.mjs ./server.mjs
EXPOSE 8080
CMD ["npm", "run", "start"]
`;

  files['.dockerignore'] = `node_modules
dist
.git
.github
npm-debug.log
Dockerfile*
`;

  files[workflowFileName] = `name: Deploy auth forms (${options.environmentName})

on:
  push:
    branches:
      - ${options.branch}
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Login to Azure
        uses: azure/login@v2
        with:
          creds: \${{ secrets.AZURE_CREDENTIALS }}

      - name: Install Container Apps extension
        uses: azure/cli@v2
        with:
          inlineScript: |
            az extension add --name containerapp --upgrade
            az provider register --namespace Microsoft.App --wait
            az provider register --namespace Microsoft.OperationalInsights --wait

      - name: Ensure Azure resources
        uses: azure/cli@v2
        with:
          inlineScript: |
            set -e
            az group create --name '${escapeYamlValue(options.resourceGroup)}' --location '${escapeYamlValue(options.location)}'

            ACA_ENV_NAME='${escapeYamlValue(containerAppsEnvironment)}'
            if ${createIfMissing ? 'true' : 'false'}; then
              if ! az containerapp env show --name "$ACA_ENV_NAME" --resource-group '${escapeYamlValue(options.resourceGroup)}' >/dev/null 2>&1; then
                az containerapp env create --name "$ACA_ENV_NAME" --resource-group '${escapeYamlValue(options.resourceGroup)}' --location '${escapeYamlValue(options.location)}'
              fi
            else
              az containerapp env show --name "$ACA_ENV_NAME" --resource-group '${escapeYamlValue(options.resourceGroup)}' >/dev/null
            fi

            echo "ACA_ENV_NAME=$ACA_ENV_NAME" >> "$GITHUB_ENV"

      - name: Deploy to Azure Container Apps
        uses: azure/cli@v2
        with:
          inlineScript: |
            set -e
            az containerapp up \\
              --name '${escapeYamlValue(containerAppName)}' \\
              --resource-group '${escapeYamlValue(options.resourceGroup)}' \\
              --location '${escapeYamlValue(options.location)}' \\
              --environment "$ACA_ENV_NAME" \\
              --source . \\
              --target-port 8080 \\
              --ingress external \\
              --env-vars PORT=8080 NODE_ENV=production VITE_SUPABASE_URL='${escapeYamlValue(supabaseUrl)}' VITE_SUPABASE_ANON_KEY='${escapeYamlValue(supabaseAnonKey)}'

            FQDN=$(az containerapp show --name '${escapeYamlValue(containerAppName)}' --resource-group '${escapeYamlValue(options.resourceGroup)}' --query properties.configuration.ingress.fqdn -o tsv)
            echo "Container App desplegada en https://$FQDN"
`;

  return files;
}
