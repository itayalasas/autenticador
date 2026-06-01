import { requireSupabaseAnonKey, requireSupabaseUrl } from '../lib/supabaseRuntime';
import type { AzureContainerAppsConfig } from '../types';

interface AzureContainerAppsDeploymentOptions {
  environmentName: string;
  branch: string;
  applicationDisplayName: string;
  containerAppName: string;
  environmentId: string;
  resourceGroup: string;
  location: string;
  containerAppsEnvironment?: string | null;
  createIfMissing?: boolean;
  azureAuthMode?: 'service_principal' | 'oidc';
  azureOidcAudience?: string | null;
}

function escapeYamlValue(value: string): string {
  return value.replace(/'/g, "''");
}

function sanitizeEnvironmentName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
}

function normalizeEnvironmentSecretSegment(name: string): string {
  return name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'ENVIRONMENT';
}

function hashString(value: string): string {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash).toString(36);
}

function normalizeAzureName(value: string, fallback: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);

  return normalized || fallback;
}

function normalizeAcrName(value: string, fallback: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 50);

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

export function buildAzureOidcSecretPayload(config: AzureContainerAppsConfig): Record<string, string> {
  return {
    AZURE_CLIENT_ID: config.client_id,
    AZURE_TENANT_ID: config.tenant_id,
    AZURE_SUBSCRIPTION_ID: config.subscription_id,
  };
}

export function buildDefaultContainerAppName(applicationName: string, environmentName: string): string {
  const appSlug = applicationName
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalizeAzureName(`${appSlug || 'auth-forms'}-${sanitizeEnvironmentName(environmentName)}`, `auth-${sanitizeEnvironmentName(environmentName)}`);
}

export function buildDeployCallbackSecretName(environmentName: string): string {
  return `AUTHSYSTEM_DEPLOY_CALLBACK_TOKEN_${normalizeEnvironmentSecretSegment(environmentName)}`;
}

export function buildDefaultAzureContainerRegistryName(
  applicationName: string,
  environmentName: string,
  resourceGroup: string
): string {
  const base = normalizeAcrName(applicationName, 'authforms').slice(0, 20);
  const hash = hashString(`${applicationName}:${environmentName}:${resourceGroup}`).slice(0, 10);
  return normalizeAcrName(`${base}${hash}acr`, 'authformsaca01');
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
  const containerRegistryName = buildDefaultAzureContainerRegistryName(
    options.applicationDisplayName,
    options.environmentName,
    options.resourceGroup
  );
  const deploymentCallbackUrl = `${supabaseUrl.replace(/\/+$/, '')}/functions/v1/sync-environment-deployment-url`;
  const deployCallbackSecretName = buildDeployCallbackSecretName(options.environmentName);
  const createIfMissing = options.createIfMissing !== false;
  const workflowFileName = `.github/workflows/deploy-auth-forms-${envName}.yml`;
  const useOidc = options.azureAuthMode === 'oidc';
  const oidcAudience = escapeYamlValue(options.azureOidcAudience?.trim() || 'api://AzureADTokenExchange');
  const workflowPermissions = useOidc
    ? `    permissions:\n      contents: read\n      id-token: write`
    : `    permissions:\n      contents: read`;
  const azureLoginStep = useOidc
    ? `      - name: Login to Azure
        uses: azure/login@v2
        with:
          client-id: \${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: \${{ secrets.AZURE_TENANT_ID }}
          subscription-id: \${{ secrets.AZURE_SUBSCRIPTION_ID }}
          audience: '${oidcAudience}'`
    : `      - name: Login to Azure
        uses: azure/login@v2
        with:
          creds: \${{ secrets.AZURE_CREDENTIALS }}`;

  files['server.mjs'] = `import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app = express();
const port = Number(process.env.PORT || 8080);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.join(__dirname, 'dist');
const supabaseUrl = String(process.env.VITE_SUPABASE_URL || '').replace(/\\/+$/, '');
const supabaseAnonKey = String(process.env.VITE_SUPABASE_ANON_KEY || '');

app.use(express.json({ limit: '2mb' }));

function firstHeaderValue(value) {
  if (Array.isArray(value)) {
    return value[0] || '';
  }
  return value || '';
}

function ensureSupabaseConfig(res) {
  if (supabaseUrl && supabaseAnonKey) {
    return true;
  }

  res.status(500).json({
    success: false,
    error: {
      code: 'SUPABASE_NOT_CONFIGURED',
      message: 'Supabase no esta configurado en este deployment',
    },
  });
  return false;
}

function edgeHeaders(extra = {}) {
  return {
    'Content-Type': 'application/json',
    'Authorization': \`Bearer \${supabaseAnonKey}\`,
    ...extra,
  };
}

async function parseJsonResponse(response) {
  const raw = await response.text();
  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch (_error) {
    return {
      success: false,
      error: {
        code: 'INVALID_EDGE_RESPONSE',
        message: raw,
      },
    };
  }
}

app.get(['/health', '/api/health'], (_req, res) => {
  res.json({
    ok: true,
    service: 'authsystem-public-forms',
    has_supabase_proxy: Boolean(supabaseUrl && supabaseAnonKey),
  });
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

app.all('/api/application/plans', async (req, res) => {
  if (!ensureSupabaseConfig(res)) return;

  try {
    const requestBody = req.method === 'GET'
      ? req.query
      : (req.body || {});

    const response = await fetch(\`\${supabaseUrl}/functions/v1/application-plans\`, {
      method: 'POST',
      headers: edgeHeaders(),
      body: JSON.stringify(requestBody),
    });

    const result = await parseJsonResponse(response);
    return res.status(response.status).json(result);
  } catch (error) {
    console.error('Application plans proxy error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'PROXY_ERROR',
        message: 'No se pudo consultar el listado de planes',
      },
    });
  }
});

app.post('/api/application/subscription/start-checkout', async (req, res) => {
  if (!ensureSupabaseConfig(res)) return;

  try {
    const response = await fetch(\`\${supabaseUrl}/functions/v1/subscription-start-checkout\`, {
      method: 'POST',
      headers: edgeHeaders(),
      body: JSON.stringify(req.body || {}),
    });

    const result = await parseJsonResponse(response);
    return res.status(response.status).json(result);
  } catch (error) {
    console.error('Subscription checkout start proxy error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'PROXY_ERROR',
        message: 'No se pudo iniciar el checkout de la suscripcion',
      },
    });
  }
});

app.all('/api/application/subscription/session', async (req, res) => {
  if (!ensureSupabaseConfig(res)) return;

  try {
    const requestBody = req.method === 'GET'
      ? req.query
      : (req.body || {});

    const response = await fetch(\`\${supabaseUrl}/functions/v1/subscription-checkout-status\`, {
      method: 'POST',
      headers: edgeHeaders(),
      body: JSON.stringify(requestBody),
    });

    const result = await parseJsonResponse(response);
    return res.status(response.status).json(result);
  } catch (error) {
    console.error('Subscription checkout session proxy error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'PROXY_ERROR',
        message: 'No se pudo consultar el estado del checkout',
      },
    });
  }
});

app.post('/api/application/subscription/cancel', async (req, res) => {
  if (!ensureSupabaseConfig(res)) return;

  try {
    const response = await fetch(\`\${supabaseUrl}/functions/v1/subscription-cancel\`, {
      method: 'POST',
      headers: edgeHeaders(),
      body: JSON.stringify(req.body || {}),
    });

    const result = await parseJsonResponse(response);
    return res.status(response.status).json(result);
  } catch (error) {
    console.error('Subscription cancel proxy error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'PROXY_ERROR',
        message: 'No se pudo cancelar la suscripcion',
      },
    });
  }
});

app.all('/api/application/subscription/return', async (req, res) => {
  if (!ensureSupabaseConfig(res)) return;

  try {
    const targetUrl = new URL(\`\${supabaseUrl}/functions/v1/mercadopago-return\`);
    Object.entries(req.query || {}).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      targetUrl.searchParams.set(key, String(value));
    });

    const response = await fetch(targetUrl.toString(), {
      method: req.method,
      headers: edgeHeaders(),
      body: req.method === 'GET' ? undefined : JSON.stringify(req.body || {}),
      redirect: 'manual',
    });

    const location = response.headers.get('location');
    if (location) {
      return res.redirect(response.status, location);
    }

    const contentType = response.headers.get('content-type') || 'text/html; charset=utf-8';
    const payload = await response.text();
    return res.status(response.status).type(contentType).send(payload);
  } catch (error) {
    console.error('Mercado Pago return proxy error:', error);
    return res.status(500).send('No se pudo procesar el retorno de Mercado Pago');
  }
});

app.post('/api/webhooks/mercadopago', async (req, res) => {
  if (!ensureSupabaseConfig(res)) return;

  try {
    const targetUrl = new URL(\`\${supabaseUrl}/functions/v1/mercadopago-webhook\`);
    Object.entries(req.query || {}).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      targetUrl.searchParams.set(key, String(value));
    });

    const response = await fetch(targetUrl.toString(), {
      method: 'POST',
      headers: edgeHeaders({
        'x-signature': firstHeaderValue(req.headers['x-signature']),
        'x-request-id': firstHeaderValue(req.headers['x-request-id']),
      }),
      body: JSON.stringify(req.body || {}),
    });

    const result = await parseJsonResponse(response);
    return res.status(response.status).json(result);
  } catch (error) {
    console.error('Mercado Pago webhook proxy error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'PROXY_ERROR',
        message: 'No se pudo procesar el webhook de Mercado Pago',
      },
    });
  }
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
${workflowPermissions}

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

${azureLoginStep}

      - name: Install Container Apps extension
        uses: azure/cli@v2
        with:
          inlineScript: |
            az extension add --name containerapp --upgrade
            echo "Azure Container Apps extension instalada."
            echo "Nota: Microsoft.App y Microsoft.OperationalInsights deben estar registrados previamente en la suscripcion por un administrador."

      - name: Ensure Azure resources
        uses: azure/cli@v2
        with:
          inlineScript: |
            set -e
            RG_NAME='${escapeYamlValue(options.resourceGroup)}'
            RG_LOCATION='${escapeYamlValue(options.location)}'

            if az group show --name "$RG_NAME" >/dev/null 2>&1; then
              echo "Resource Group $RG_NAME encontrado"
            elif ${createIfMissing ? 'true' : 'false'}; then
              az group create --name "$RG_NAME" --location "$RG_LOCATION"
            else
              echo "::error::El Resource Group $RG_NAME no existe y la creacion automatica esta desactivada."
              exit 1
            fi

            ACA_ENV_NAME='${escapeYamlValue(containerAppsEnvironment)}'
            if az containerapp env show --name "$ACA_ENV_NAME" --resource-group "$RG_NAME" >/dev/null 2>&1; then
              echo "ACA Environment $ACA_ENV_NAME encontrado"
            elif ${createIfMissing ? 'true' : 'false'}; then
              if ! ACA_ENV_CREATE_OUTPUT=$(az containerapp env create --name "$ACA_ENV_NAME" --resource-group "$RG_NAME" --location "$RG_LOCATION" --logs-destination none 2>&1); then
                echo "$ACA_ENV_CREATE_OUTPUT"
                if echo "$ACA_ENV_CREATE_OUTPUT" | grep -q "Microsoft.App/register/action"; then
                  echo "::error::La suscripcion todavia no tiene registrado Microsoft.App. Un administrador de la suscripcion debe ejecutar una sola vez: az provider register --namespace Microsoft.App --wait y az provider register --namespace Microsoft.OperationalInsights --wait"
                fi
                if echo "$ACA_ENV_CREATE_OUTPUT" | grep -q "Microsoft.OperationalInsights/register/action"; then
                  echo "::error::La suscripcion todavia no tiene registrado Microsoft.OperationalInsights. Un administrador de la suscripcion debe ejecutar una sola vez: az provider register --namespace Microsoft.OperationalInsights --wait"
                fi
                if echo "$ACA_ENV_CREATE_OUTPUT" | grep -q "Microsoft.OperationalInsights/workspaces/write"; then
                  echo "::error::Azure intento crear un Log Analytics Workspace, pero este flujo ahora espera crear el ACA Environment sin logs centralizados. Vuelve a generar el workflow desde AuthSystem o elimina la creacion automatica de workspace en el YAML actual."
                fi
                exit 1
              fi
              echo "$ACA_ENV_CREATE_OUTPUT"
            else
              echo "::error::El ACA Environment $ACA_ENV_NAME no existe y la creacion automatica esta desactivada."
              exit 1
            fi

            echo "ACA_ENV_NAME=$ACA_ENV_NAME" >> "$GITHUB_ENV"

      - name: Ensure Azure Container Registry
        uses: azure/cli@v2
        with:
          inlineScript: |
            set -e
            RG_NAME='${escapeYamlValue(options.resourceGroup)}'
            RG_LOCATION='${escapeYamlValue(options.location)}'
            ACR_NAME='${escapeYamlValue(containerRegistryName)}'

            if az acr show --name "$ACR_NAME" --resource-group "$RG_NAME" >/dev/null 2>&1; then
              echo "Azure Container Registry $ACR_NAME encontrado"
            else
              az acr create --name "$ACR_NAME" --resource-group "$RG_NAME" --sku Basic --admin-enabled true --location "$RG_LOCATION"
            fi

            az acr update --name "$ACR_NAME" --resource-group "$RG_NAME" --admin-enabled true >/dev/null

            ACR_SERVER=$(az acr show --name "$ACR_NAME" --resource-group "$RG_NAME" --query loginServer -o tsv)
            ACR_USERNAME=$(az acr credential show --name "$ACR_NAME" --resource-group "$RG_NAME" --query username -o tsv)
            ACR_PASSWORD=$(az acr credential show --name "$ACR_NAME" --resource-group "$RG_NAME" --query "passwords[0].value" -o tsv)
            IMAGE_REPOSITORY='auth-forms-${escapeYamlValue(envName)}'
            IMAGE_TAG='${'${{ github.sha }}'}'

            echo "ACR_NAME=$ACR_NAME" >> "$GITHUB_ENV"
            echo "ACR_SERVER=$ACR_SERVER" >> "$GITHUB_ENV"
            echo "ACR_USERNAME=$ACR_USERNAME" >> "$GITHUB_ENV"
            echo "ACR_PASSWORD=$ACR_PASSWORD" >> "$GITHUB_ENV"
            echo "IMAGE_REPOSITORY=$IMAGE_REPOSITORY" >> "$GITHUB_ENV"
            echo "IMAGE_TAG=$IMAGE_TAG" >> "$GITHUB_ENV"

      - name: Build and push image to ACR
        uses: azure/cli@v2
        with:
          inlineScript: |
            set -e
            az acr build \
              --registry "$ACR_NAME" \
              --resource-group '${escapeYamlValue(options.resourceGroup)}' \
              --file Dockerfile \
              --image "$IMAGE_REPOSITORY:$IMAGE_TAG" \
              .

      - name: Deploy to Azure Container Apps
        uses: azure/cli@v2
        with:
          inlineScript: |
            set -e
            IMAGE_REF="$ACR_SERVER/$IMAGE_REPOSITORY:$IMAGE_TAG"

            if az containerapp show --name '${escapeYamlValue(containerAppName)}' --resource-group '${escapeYamlValue(options.resourceGroup)}' >/dev/null 2>&1; then
              az containerapp registry set \
                --name '${escapeYamlValue(containerAppName)}' \
                --resource-group '${escapeYamlValue(options.resourceGroup)}' \
                --server "$ACR_SERVER" \
                --username "$ACR_USERNAME" \
                --password "$ACR_PASSWORD"

              az containerapp update \
                --name '${escapeYamlValue(containerAppName)}' \
                --resource-group '${escapeYamlValue(options.resourceGroup)}' \
                --image "$IMAGE_REF" \
                --set-env-vars PORT=8080 NODE_ENV=production VITE_SUPABASE_URL='${escapeYamlValue(supabaseUrl)}' VITE_SUPABASE_ANON_KEY='${escapeYamlValue(supabaseAnonKey)}'
            else
              az containerapp create \
                --name '${escapeYamlValue(containerAppName)}' \
                --resource-group '${escapeYamlValue(options.resourceGroup)}' \
                --environment "$ACA_ENV_NAME" \
                --image "$IMAGE_REF" \
                --target-port 8080 \
                --ingress external \
                --registry-server "$ACR_SERVER" \
                --registry-username "$ACR_USERNAME" \
                --registry-password "$ACR_PASSWORD" \
                --env-vars PORT=8080 NODE_ENV=production VITE_SUPABASE_URL='${escapeYamlValue(supabaseUrl)}' VITE_SUPABASE_ANON_KEY='${escapeYamlValue(supabaseAnonKey)}'
            fi

            FQDN=$(az containerapp show --name '${escapeYamlValue(containerAppName)}' --resource-group '${escapeYamlValue(options.resourceGroup)}' --query properties.configuration.ingress.fqdn -o tsv)
            echo "Container App desplegada en https://$FQDN"

      - name: Sync deployed URLs with AuthSystem
        uses: azure/cli@v2
        with:
          inlineScript: |
            set -e
            DEPLOY_CALLBACK_TOKEN="${'${{ secrets.'}${deployCallbackSecretName}${' }}'}"
            if [ -z "$DEPLOY_CALLBACK_TOKEN" ]; then
              echo "::error::No se encontro el secreto ${deployCallbackSecretName} en GitHub Actions"
              exit 1
            fi
            FQDN=$(az containerapp show --name '${escapeYamlValue(containerAppName)}' --resource-group '${escapeYamlValue(options.resourceGroup)}' --query properties.configuration.ingress.fqdn -o tsv)
            DEPLOY_BASE_URL="https://$FQDN"
            if [ -z "$FQDN" ]; then
              echo "::error::No se pudo resolver el FQDN final de la Container App"
              exit 1
            fi

            cat > sync-deployment-url.json <<EOF
            {
              "environment_id": "${escapeYamlValue(options.environmentId)}",
              "deployed_base_url": "$DEPLOY_BASE_URL",
              "deployment_provider": "azure_container_apps",
              "azure_container_app_name": "${escapeYamlValue(containerAppName)}",
              "azure_containerapps_environment": "${escapeYamlValue(containerAppsEnvironment)}"
            }
            EOF

            echo "Sincronizando URLs del ambiente ${escapeYamlValue(options.environmentId)} con base $DEPLOY_BASE_URL"

            CALLBACK_RESPONSE=$(curl -sS -w "\\n%{http_code}" -X POST '${escapeYamlValue(deploymentCallbackUrl)}' \
              -H "Content-Type: application/json" \
              -H "x-deploy-token: $DEPLOY_CALLBACK_TOKEN" \
              --data-binary @sync-deployment-url.json)

            CALLBACK_HTTP_CODE=$(echo "$CALLBACK_RESPONSE" | tail -n 1)
            CALLBACK_BODY=$(echo "$CALLBACK_RESPONSE" | sed '$d')
            echo "$CALLBACK_BODY"

            if [ "$CALLBACK_HTTP_CODE" -lt 200 ] || [ "$CALLBACK_HTTP_CODE" -ge 300 ]; then
              echo "::error::No se pudo sincronizar la URL desplegada con AuthSystem"
              exit 1
            fi
`;

  return files;
}
