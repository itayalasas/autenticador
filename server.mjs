import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app = express();
const port = Number(process.env.PORT || 80);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.join(__dirname, 'dist');
const indexFile = path.join(distDir, 'index.html');
const supabaseUrl = String(process.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
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
    'Authorization': `Bearer ${supabaseAnonKey}`,
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

function sendIndex(res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  return res.sendFile(indexFile);
}

function shouldServeSpaRoute(req) {
  if (req.method !== 'GET') {
    return false;
  }

  if (req.path.startsWith('/api/') || req.path === '/get-env' || req.path === '/health') {
    return false;
  }

  if (path.extname(req.path)) {
    return false;
  }

  const accept = String(req.headers.accept || '');
  return accept.includes('text/html') || accept.includes('*/*');
}

app.get(['/health', '/api/health'], (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    ok: true,
    service: 'authsystem-public-forms',
    has_supabase_proxy: Boolean(supabaseUrl && supabaseAnonKey),
  });
});

app.get('/get-env', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    variables: {
      VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL || '',
      VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY || '',
      VITE_ENV_CONFIG_URL: '/get-env',
    },
  });
});

app.all('/api/application/plans', async (req, res) => {
  if (!ensureSupabaseConfig(res)) return;

  try {
    const requestBody = req.method === 'GET'
      ? req.query
      : (req.body || {});

    const response = await fetch(`${supabaseUrl}/functions/v1/application-plans`, {
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
    const response = await fetch(`${supabaseUrl}/functions/v1/subscription-start-checkout`, {
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

    const response = await fetch(`${supabaseUrl}/functions/v1/subscription-checkout-status`, {
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
    const response = await fetch(`${supabaseUrl}/functions/v1/subscription-cancel`, {
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
    const targetUrl = new URL(`${supabaseUrl}/functions/v1/mercadopago-return`);
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
    const targetUrl = new URL(`${supabaseUrl}/functions/v1/mercadopago-webhook`);
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
  fallthrough: true,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      return;
    }

    if (filePath.includes(`${path.sep}assets${path.sep}`)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      return;
    }

    res.setHeader('Cache-Control', 'public, max-age=3600');
  },
}));

app.use((req, res, next) => {
  if (shouldServeSpaRoute(req)) {
    return sendIndex(res);
  }
  return next();
});

app.use((req, res) => {
  if (path.extname(req.path)) {
    return res.status(404).type('text/plain').send('Asset not found');
  }

  if (req.accepts('html')) {
    return sendIndex(res);
  }

  return res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Ruta no encontrada',
    },
  });
});

app.listen(port, () => {
  console.log('AuthSystem public forms listening on port', port);
});
