import dotenv from 'dotenv';
dotenv.config();

// Validate required environment variables
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
  console.error('❌ SUPABASE_URL or VITE_SUPABASE_URL is required in .env file');
  process.exit(1);
}

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY is required in .env file');
  process.exit(1);
}

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const app = express();
const PORT = process.env.PORT || 3001;

console.log(`🔧 Starting server with PORT: ${PORT}`);
console.log(`🔧 Environment variables:`, {
  PORT: process.env.PORT,
  NODE_ENV: process.env.NODE_ENV,
  SUPABASE_URL: !!SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: !!SUPABASE_SERVICE_ROLE_KEY
});

// Store active tunnels
let activeTunnels = new Map();

// Supabase client
const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);


// Middleware
app.use(helmet());
app.use(cors({
  origin: [
    'https://zp1v56uxy8rdx5ypatb0ockcb9tr6a-oci3-6prh5986--5173--96435430.local-credentialless.webcontainer-api.io',
    'https://zp1v56uxy8rdx5ypatb0ockcb9tr6a-oci3-6prh5986--3001--96435430.local-credentialless.webcontainer-api.io',
    'http://localhost:5173',
    'http://localhost:3001',
    'https://zp1v56uxy8rdx5ypatb0ockcb9tr6a-oci3-6prh5986--5173--96435430.local-credentialless.webcontainer-api.io',
    'https://zp1v56uxy8rdx5ypatb0ockcb9tr6a-oci3-6prh5986--3001--96435430.local-credentialless.webcontainer-api.io',
    '*' // Allow all origins for development
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 requests per windowMs
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Demasiados intentos. Intenta de nuevo en 15 minutos.'
    }
  }
});

// JWT Secret (en producción usar variable de entorno)
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

// API Key validation middleware
const validateApiKey = async (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
    
    if (!apiKey) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'MISSING_API_KEY',
          message: 'API key requerida en header X-API-Key'
        }
      });
    }

    // Validate API key format
    const apiKeyPattern = /^ak_(development|dev|testing|test|production|live)_[a-f0-9]{32}$/;
    if (!apiKeyPattern.test(apiKey)) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_API_KEY_FORMAT',
          message: 'Formato de API key inválido'
        }
      });
    }

    // Extract environment from API key
    const environment = apiKey.split('_')[1];

    // Validate API key against database
    const { data: apiKeyRecord, error: keyError } = await supabase
      .from('api_keys')
      .select(`
        *,
        applications!inner(*)
      `)
      .or(`key_hash.eq.${apiKey},key_preview.eq.${apiKey}`)
      .eq('is_active', true)
      .maybeSingle();

    console.log('🔍 API Key lookup:', {
      searchKey: apiKey,
      found: !!apiKeyRecord,
      error: keyError?.message,
      applicationId: apiKeyRecord?.applications?.application_id,
      keyPreview: apiKeyRecord?.key_preview,
      keyHash: apiKeyRecord?.key_hash ? `${apiKeyRecord.key_hash.substring(0, 10)}...` : null
    });

    if (keyError) {
      console.error('❌ Database error looking up API key:', keyError);
      
      // If it's an auth error, it means Supabase credentials are wrong
      if (keyError.message?.includes('Invalid API key')) {
        return res.status(500).json({
          success: false,
          error: {
            code: 'SUPABASE_AUTH_ERROR',
            message: 'Error de configuración de Supabase. Verifica las credenciales en .env'
          }
        });
      }
      
      return res.status(500).json({
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'Error consultando la base de datos'
        }
      });
    }
    
    if (!apiKeyRecord) {
      console.log('❌ API key not found in database. Please create this API key in the dashboard:', apiKey);
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_API_KEY',
          message: 'API key no encontrada en la base de datos'
        }
      });
    }

    // Check if API key has expired (skip for mock data)
    if (apiKeyRecord.expires_at && new Date(apiKeyRecord.expires_at) < new Date()) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'API_KEY_EXPIRED',
          message: 'API key expirada'
        }
      });
    }

    // Update last used timestamp (skip for mock data)
    try {
      await supabase
        .from('api_keys')
        .update({ last_used: new Date().toISOString() })
        .eq('id', apiKeyRecord.id);
    } catch (updateError) {
      console.log('⚠️ Could not update last_used timestamp:', updateError.message);
    }

    // Add API key info to request
    req.apiKey = apiKeyRecord;
    req.environment = environment;
    req.application = apiKeyRecord.applications;
    
    next();
  } catch (error) {
    console.error('API key validation error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error interno del servidor'
      }
    });
  }
};

// Environment-specific rate limiting
const createEnvironmentLimiter = (environment) => {
  const limits = {
    development: { windowMs: 15 * 60 * 1000, max: 50 },
    dev: { windowMs: 15 * 60 * 1000, max: 50 },
    testing: { windowMs: 15 * 60 * 1000, max: 30 },
    test: { windowMs: 15 * 60 * 1000, max: 30 },
    production: { windowMs: 15 * 60 * 1000, max: 10 },
    live: { windowMs: 15 * 60 * 1000, max: 10 }
  };
  
  const config = limits[environment] || limits.production;
  
  return rateLimit({
    ...config,
    message: {
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: `Límite de ${config.max} requests por 15 minutos excedido para ambiente ${environment}`
      }
    },
    keyGenerator: (req) => {
      const ip = ipKeyGenerator(req);
      return `${ip}-${req.environment}-${req.application?.id || 'unknown'}`;
    }
  });
};

// Pre-create rate limiters for each environment
const rateLimiters = {
  development: createEnvironmentLimiter('development'),
  testing: createEnvironmentLimiter('testing'),
  production: createEnvironmentLimiter('production')
};

// Dynamic rate limiter middleware
const dynamicRateLimit = (req, res, next) => {
  // Check if rate limiting is enabled for this application
  if (!req.application?.metadata?.enable_rate_limiting) {
    return next();
  }
  
  // Get custom limits from application metadata
  const appLimits = {
    windowMs: (req.application.metadata?.lockout_duration ?? 15) * 60 * 1000,
    max: req.application.metadata?.max_login_attempts ?? 10
  };
  
  // Create custom rate limiter for this application
  const customLimiter = rateLimit({
    ...appLimits,
    message: {
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: `Límite de ${appLimits.max} intentos por ${Math.floor(appLimits.windowMs / 60000)} minutos excedido`
      }
    },
    keyGenerator: (req) => {
      const ip = ipKeyGenerator(req);
      return `${ip}-${req.environment}-${req.application?.id || 'unknown'}`;
    }
  });
  
  const limiter = customLimiter || rateLimiters[req.environment] || rateLimiters.production;
  limiter(req, res, next);
};
// Helper function to generate JWT tokens
const generateTokens = (user, applicationId, application) => {
  const now = Math.floor(Date.now() / 1000);
  
  const accessTokenPayload = {
    sub: user.id,
    email: user.email,
    name: user.name,
    app_id: applicationId,
    roles: user.user_roles?.map(r => r.role_name) || [],
    permissions: user.user_roles?.flatMap(r => r.permissions) || [],
    iat: now,
    exp: now + (24 * 60 * 60), // 24 horas
    iss: 'AuthSystem',
    aud: application.domain
  };

  const refreshTokenPayload = {
    sub: user.id,
    app_id: applicationId,
    type: 'refresh',
    iat: now,
    exp: now + (30 * 24 * 60 * 60), // 30 días
    iss: 'AuthSystem'
  };

  const accessToken = jwt.sign(accessTokenPayload, JWT_SECRET);
  const refreshToken = jwt.sign(refreshTokenPayload, JWT_SECRET);

  return { accessToken, refreshToken };
};

// Helper function to log auth events
const logAuthEvent = async (applicationId, appUserId, eventType, req, success, errorMessage = null, metadata = {}) => {
  try {
    await supabase.from('auth_logs').insert({
      application_id: applicationId,
      app_user_id: appUserId,
      event_type: eventType,
      ip_address: req.ip || req.connection.remoteAddress || 'unknown',
      user_agent: req.get('User-Agent'),
      success,
      error_message: errorMessage,
      metadata
    });
  } catch (error) {
    console.error('Error logging auth event:', error);
  }
};

const proxyEdgeFunctionRoute = async (req, res, functionName, {
  allowGet = false,
  routeName = functionName,
} = {}) => {
  if (req.method !== 'POST' && !(allowGet && req.method === 'GET')) {
    return res.status(405).json({
      success: false,
      error: {
        code: 'METHOD_NOT_ALLOWED',
        message: `${routeName} solo acepta ${allowGet ? 'GET y POST' : 'POST'}`
      }
    });
  }

  const requestBody = req.method === 'GET' ? (req.query || {}) : (req.body || {});

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/${functionName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.VITE_SUPABASE_ANON_KEY || ''}`,
      },
      body: JSON.stringify(requestBody)
    });

    const result = await response.json();
    return res.status(response.status).json(result);
  } catch (error) {
    console.error(`Proxy error for ${functionName}:`, error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'PROXY_ERROR',
        message: `No se pudo conectar con ${routeName}: ${error.message}`
      }
    });
  }
};

// API Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'AuthSystem API is running',
    timestamp: new Date().toISOString()
  });
});

// Public application plans endpoint
app.all('/api/application/plans', async (req, res) => {
  try {
    const requestBody = req.method === 'GET'
      ? req.query
      : (req.body || {});

    const response = await fetch(`${SUPABASE_URL}/functions/v1/application-plans`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.VITE_SUPABASE_ANON_KEY || ''}`
      },
      body: JSON.stringify(requestBody)
    });

    const result = await response.json();
    return res.status(response.status).json(result);
  } catch (error) {
    console.error('Application plans proxy error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'PROXY_ERROR',
        message: 'No se pudo consultar el listado de planes'
      }
    });
  }
});

[
  {
    paths: ['/list-roles', '/api/list-roles'],
    functionName: 'list-roles',
    allowGet: true,
    routeName: 'list-roles'
  },
  {
    paths: ['/invitations-list', '/api/invitations-list'],
    functionName: 'invitations-list',
    allowGet: true,
    routeName: 'invitaciones'
  },
  {
    paths: ['/invitations-create', '/api/invitations-create'],
    functionName: 'invitations-create',
    allowGet: false,
    routeName: 'crear invitación'
  },
  {
    paths: ['/invitations-revoke', '/api/invitations-revoke'],
    functionName: 'invitations-revoke',
    allowGet: false,
    routeName: 'revocar invitación'
  },
  {
    paths: ['/invitations-validate', '/api/invitations-validate'],
    functionName: 'invitations-validate',
    allowGet: true,
    routeName: 'validar invitación'
  },
  {
    paths: ['/invitations-accept', '/api/invitations-accept'],
    functionName: 'invitations-accept',
    allowGet: false,
    routeName: 'aceptar invitación'
  }
].forEach(({ paths, functionName, allowGet, routeName }) => {
  app.all(paths, async (req, res) => proxyEdgeFunctionRoute(req, res, functionName, {
    allowGet,
    routeName
  }));
});

app.post('/api/application/subscription/start-checkout', async (req, res) => {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/subscription-start-checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.VITE_SUPABASE_ANON_KEY || ''}`,
      },
      body: JSON.stringify(req.body || {})
    });

    const result = await response.json();
    return res.status(response.status).json(result);
  } catch (error) {
    console.error('Subscription checkout start proxy error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'PROXY_ERROR',
        message: 'No se pudo iniciar el checkout de la suscripcion'
      }
    });
  }
});

app.all('/api/application/subscription/session', async (req, res) => {
  try {
    const requestBody = req.method === 'GET'
      ? req.query
      : (req.body || {});

    const response = await fetch(`${SUPABASE_URL}/functions/v1/subscription-checkout-status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.VITE_SUPABASE_ANON_KEY || ''}`,
      },
      body: JSON.stringify(requestBody)
    });

    const result = await response.json();
    return res.status(response.status).json(result);
  } catch (error) {
    console.error('Subscription checkout session proxy error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'PROXY_ERROR',
        message: 'No se pudo consultar el estado del checkout'
      }
    });
  }
});

app.post('/api/application/subscription/cancel', async (req, res) => {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/subscription-cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.VITE_SUPABASE_ANON_KEY || ''}`,
      },
      body: JSON.stringify(req.body || {})
    });

    const result = await response.json();
    return res.status(response.status).json(result);
  } catch (error) {
    console.error('Subscription cancel proxy error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'PROXY_ERROR',
        message: 'No se pudo cancelar la suscripcion'
      }
    });
  }
});

app.all('/api/application/subscription/return', async (req, res) => {
  try {
    const targetUrl = new URL(`${SUPABASE_URL}/functions/v1/mercadopago-return`);
    Object.entries(req.query || {}).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      targetUrl.searchParams.set(key, String(value));
    });

    const response = await fetch(targetUrl.toString(), {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.VITE_SUPABASE_ANON_KEY || ''}`,
      },
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
  try {
    const targetUrl = new URL(`${SUPABASE_URL}/functions/v1/mercadopago-webhook`);
    Object.entries(req.query || {}).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      targetUrl.searchParams.set(key, String(value));
    });

    const response = await fetch(targetUrl.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.VITE_SUPABASE_ANON_KEY || ''}`,
        'x-signature': req.headers['x-signature'] || '',
        'x-request-id': req.headers['x-request-id'] || '',
      },
      body: JSON.stringify(req.body || {})
    });

    const result = await response.json();
    return res.status(response.status).json(result);
  } catch (error) {
    console.error('Mercado Pago webhook proxy error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'PROXY_ERROR',
        message: 'No se pudo procesar el webhook de Mercado Pago'
      }
    });
  }
});

// Login endpoint
app.post('/api/auth/login', validateApiKey, dynamicRateLimit, async (req, res) => {
  try {
    const { email, password, application_id, callback_url } = req.body;

    // Validate required fields
    if (!email || !password || !application_id) {
      // Log missing fields error
      await logAuthEvent(null, null, 'failed_login', req, false, 'Campos requeridos faltantes', { 
        email: email || 'missing', 
        application_id: application_id || 'missing',
        error_type: 'validation_error'
      });
      
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_FIELDS',
          message: 'Email, password, and application_id are required'
        }
      });
    }

    // Validate that API key belongs to the requested application
    if (req.application.application_id !== application_id) {
      // Log application mismatch error
      await logAuthEvent(null, null, 'failed_login', req, false, 'API key no pertenece a la aplicación', { 
        email, 
        application_id,
        api_key_app: req.application.application_id,
        error_type: 'authorization_error'
      });
      
      return res.status(403).json({
        success: false,
        error: {
          code: 'APPLICATION_MISMATCH',
          message: 'API key no pertenece a la aplicación solicitada'
        }
      });
    }

    // 1. Get application with environment URLs
    const { data: application, error: appError } = await supabase
      .from('applications')
      .select('*')
      .eq('application_id', application_id)
      .single();

    if (!application) {
      await logAuthEvent(null, null, 'failed_login', req, false, 'Aplicación no encontrada', { 
        application_id,
        email,
        error_type: 'application_not_found'
      });
      return res.status(404).json({
        success: false,
        error: {
          code: 'APPLICATION_NOT_FOUND',
          message: 'Aplicación no encontrada'
        }
      });
    }

    if (appError) {
      console.error('Application lookup error:', appError);
      await logAuthEvent(null, null, 'failed_login', req, false, 'Error de base de datos al buscar aplicación', { 
        application_id,
        email,
        error_type: 'database_error',
        db_error: appError.message
      });
      return res.status(500).json({
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'Error consultando la aplicación'
        }
      });
    }

    // Determine environment from API key
    const environment = req.environment; // 'development', 'testing', 'production'
    console.log('🌍 Environment detected from API key:', environment);

    // Get callback URL from application configuration based on environment
    const environmentUrls = application.metadata?.environment_urls || {};
    const envConfig = environmentUrls[environment];
    const defaultCallbackUrl = envConfig?.callback_url || `https://${application.domain}/auth/callback`;
    
    // Use provided callback_url or fall back to environment-specific URL
    const finalCallbackUrl = callback_url || defaultCallbackUrl;
    
    console.log('🔄 Callback URL configuration:', {
      environment,
      providedCallbackUrl: callback_url,
      envConfigCallbackUrl: envConfig?.callback_url,
      defaultCallbackUrl,
      finalCallbackUrl
    });
    // 2. Buscar el usuario en la aplicación
    const { data: appUser, error: userError } = await supabase
      .from('app_users')
      .select(`
        *,
        user_roles(
          role_name,
          permissions
        )
      `)
      .eq('application_id', application.id)
      .eq('email', email)
      .single();

    if (userError || !appUser) {
      await logAuthEvent(application.id, null, 'failed_login', req, false, 'Usuario no encontrado', { 
        email,
        error_type: 'user_not_found',
        application_name: application.name
      });
      
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Email o contraseña incorrectos'
        }
      });
    }

    // 3. Verificar si el usuario requiere verificación de email
    if (appUser.status === 'pending') {
      await logAuthEvent(application.id, appUser.id, 'failed_login', req, false, 'Email no verificado', { 
        email, 
        user_name: appUser.name,
        error_type: 'email_not_verified',
        application_name: application.name
      });

      const response = {
        success: false,
        error: {
          code: 'EMAIL_NOT_VERIFIED',
          message: 'Debes verificar tu email antes de iniciar sesión',
          user_id: appUser.id,
          email: appUser.email,
          next_step: 'verify_email'
        }
      };

      if (finalCallbackUrl) {
        const verifyParams = new URLSearchParams({
          user_id: appUser.id,
          email: appUser.email,
          state: 'email_verification_required',
          message: 'Debes verificar tu email antes de continuar'
        });
        
        response.error.callback_url = `${finalCallbackUrl.replace('/callback', '/verify-email')}?${verifyParams.toString()}`;
      }

      return res.status(403).json(response);
    }

    // 4. Verificar contraseña
    console.log('🔐 Password validation:', {
      providedPassword: password,
      storedHash: appUser.password_hash,
      hashLength: appUser.password_hash?.length,
      hashPrefix: appUser.password_hash?.substring(0, 10) + '...'
    });

    let isValidPassword = false;
    
    try {
      // Try bcrypt first (preferred method)
      isValidPassword = await bcrypt.compare(password, appUser.password_hash);
      console.log('🔐 bcrypt validation result:', isValidPassword);
      
      // If bcrypt fails, try base64 (for legacy compatibility)
      if (!isValidPassword) {
        const base64Password = btoa(password);
        isValidPassword = base64Password === appUser.password_hash;
        console.log('🔐 base64 validation:', {
          provided: base64Password,
          stored: appUser.password_hash,
          match: isValidPassword
        });
      }
    } catch (bcryptError) {
      console.log('🔐 bcrypt error, trying base64:', bcryptError.message);
      // If bcrypt throws error, try base64
      const base64Password = btoa(password);
      isValidPassword = base64Password === appUser.password_hash;
      console.log('🔐 fallback base64 validation:', {
        provided: base64Password,
        stored: appUser.password_hash,
        match: isValidPassword
      });
    }

    console.log('🔐 Final password validation result:', isValidPassword);

    if (!isValidPassword) {
      await logAuthEvent(application.id, appUser.id, 'failed_login', req, false, 'Contraseña incorrecta', { 
        email,
        user_name: appUser.name,
        error_type: 'invalid_password',
        application_name: application.name,
        password_method: 'bcrypt_or_base64'
      });
      
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Email o contraseña incorrectos'
        }
      });
    }

    // 5. Verificar que el usuario esté activo
    if (appUser.status !== 'active') {
      await logAuthEvent(application.id, appUser.id, 'failed_login', req, false, 'Usuario inactivo', { 
        email,
        user_name: appUser.name,
        status: appUser.status,
        error_type: 'user_inactive',
        application_name: application.name
      });
      
      return res.status(403).json({
        success: false,
        error: {
          code: 'USER_INACTIVE',
          message: 'Tu cuenta está inactiva. Contacta al administrador.'
        }
      });
    }

    // 6. Generar tokens JWT
    const { accessToken, refreshToken } = generateTokens(appUser, application_id, application);

    // 7. Actualizar último login
    await supabase
      .from('app_users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', appUser.id);

    // 8. Log login exitoso
    await logAuthEvent(application.id, appUser.id, 'login', req, true, null, { 
      email,
      user_name: appUser.name,
      login_method: 'email_password',
      application_name: application.name,
      environment: req.environment
    });

    // 9. Preparar respuesta con formato exacto requerido
    const lastLoginTime = new Date().toISOString();
    
    const response = {
      success: true,
      data: {
        access_token: accessToken,
        refresh_token: refreshToken,
        token_type: 'Bearer',
        expires_in: 86400,
        user: {
          id: appUser.id,
          email: appUser.email,
          name: appUser.name,
          roles: appUser.user_roles?.map(r => r.role_name) || [],
          permissions: appUser.user_roles?.flatMap(r => r.permissions) || [],
          metadata: appUser.metadata || {},
          last_login: lastLoginTime
        },
        application: {
          id: application_id,
          name: application.name,
          domain: application.domain
        },
        callback_url: null // Will be set below if callback is needed
      }
    };

    // 10. Generar callback URL con tokens para redirección automática
    if (finalCallbackUrl) {
      const callbackParams = new URLSearchParams({
        state: 'success',
        token: accessToken,
        refresh_token: refreshToken,
        user_id: appUser.id,
        user_email: appUser.email,
        user_name: encodeURIComponent(appUser.name),
        expires_in: '86400'
      });
      
      response.data.callback_url = `${finalCallbackUrl}?${callbackParams.toString()}`;
      
      console.log('🔄 Generated callback URL:', response.data.callback_url);
    }

    console.log('✅ Login successful for user:', {
      userId: appUser.id,
      email: appUser.email,
      environment,
      hasCallback: !!response.data.callback_url
    });
    res.json(response);

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error interno del servidor'
      }
    });
  }
});

// Register endpoint
app.post('/api/auth/register', validateApiKey, dynamicRateLimit, async (req, res) => {
  try {
    const { email, password, name, application_id, callback_url, metadata, role } = req.body;

    // Validate required fields
    if (!email || !password || !name || !application_id) {
      // Log missing fields error
      await logAuthEvent(null, null, 'failed_login', req, false, 'Campos requeridos faltantes en registro', { 
        email: email || 'missing',
        name: name || 'missing',
        application_id: application_id || 'missing',
        error_type: 'validation_error'
      });
      
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_FIELDS',
          message: 'Email, password, name, and application_id are required'
        }
      });
    }

    // Validate that API key belongs to the requested application
    if (req.application.application_id !== application_id) {
      // Log application mismatch error
      await logAuthEvent(null, null, 'failed_login', req, false, 'API key no pertenece a la aplicación en registro', { 
        email,
        name,
        application_id,
        api_key_app: req.application.application_id,
        error_type: 'authorization_error'
      });
      
      return res.status(403).json({
        success: false,
        error: {
          code: 'APPLICATION_MISMATCH',
          message: 'API key no pertenece a la aplicación solicitada'
        }
      });
    }

    // 1. Verificar que la aplicación existe
    const { data: application, error: appError } = await supabase
      .from('applications')
      .select('*')
      .eq('application_id', application_id)
      .single();

    if (appError || !application) {
      await logAuthEvent(null, null, 'failed_login', req, false, 'Aplicación no encontrada en registro', { 
        application_id,
        email,
        name,
        error_type: 'application_not_found'
      });
      
      return res.status(404).json({
        success: false,
        error: {
          code: 'APPLICATION_NOT_FOUND',
          message: 'Aplicación no encontrada'
        }
      });
    }

    // 2. Verificar si el usuario ya existe
    const { data: existingUser } = await supabase
      .from('app_users')
      .select('id')
      .eq('application_id', application.id)
      .eq('email', email)
      .single();

    if (existingUser) {
      await logAuthEvent(application.id, null, 'failed_login', req, false, 'Email ya existe', { 
        email,
        name,
        error_type: 'email_already_exists',
        application_name: application.name
      });
      
      return res.status(409).json({
        success: false,
        error: {
          code: 'EMAIL_ALREADY_EXISTS',
          message: 'Ya existe un usuario con este email'
        }
      });
    }

    // 3. Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    
    // 4. Verificar configuración de la aplicación
    const requireEmailVerification = application.metadata?.enable_email_verification ?? true;
    const passwordPolicy = {
      min_length: application.metadata?.password_min_length ?? 8,
      require_uppercase: application.metadata?.password_require_uppercase ?? true,
      require_lowercase: application.metadata?.password_require_lowercase ?? true,
      require_numbers: application.metadata?.password_require_numbers ?? true,
      require_symbols: application.metadata?.password_require_symbols ?? false
    };
    
    // Validate password against policy
    const passwordValidation = validatePassword(password, passwordPolicy);
    if (!passwordValidation.valid) {
      await logAuthEvent(application.id, null, 'failed_login', req, false, 'Política de contraseña no cumplida', { 
        email,
        name,
        error_type: 'password_policy_violation',
        policy_message: passwordValidation.message,
        application_name: application.name
      });
      
      return res.status(400).json({
        success: false,
        error: {
          code: 'PASSWORD_POLICY_VIOLATION',
          message: passwordValidation.message
        }
      });
    }
    
    const userStatus = requireEmailVerification ? 'pending' : 'active';
    
    // 5. Crear usuario
    const { data: newUser, error: createError } = await supabase
      .from('app_users')
      .insert({
        application_id: application.id,
        email,
        name,
        password_hash: passwordHash,
        status: userStatus,
        metadata: metadata || {}
      })
      .select()
      .single();

    if (createError) {
      console.error('Create user error:', createError);
      await logAuthEvent(application.id, null, 'failed_login', req, false, 'Error al crear usuario', { 
        email,
        name,
        error_type: 'database_error',
        db_error: createError.message,
        application_name: application.name
      });
      
      return res.status(500).json({
        success: false,
        error: {
          code: 'CREATE_USER_FAILED',
          message: 'Error al crear el usuario'
        }
      });
    }

    // 6. Asignar rol (proporcionado o por defecto)
    let assignedRoleName = 'user';
    let assignedPermissions = ['read'];
    
    if (role) {
      // Buscar el rol específico en la aplicación
      const { data: applicationRole } = await supabase
        .from('application_roles')
        .select('*')
        .eq('application_id', application.id)
        .eq('name', role)
        .single();
      
      if (applicationRole) {
        assignedRoleName = applicationRole.name;
        assignedPermissions = applicationRole.permissions;
      }
    } else {
      // Buscar rol por defecto de la aplicación
      const { data: defaultRole } = await supabase
        .from('application_roles')
        .select('*')
        .eq('application_id', application.id)
        .eq('is_default', true)
        .single();
      
      if (defaultRole) {
        assignedRoleName = defaultRole.name;
        assignedPermissions = defaultRole.permissions;
      }
    }
    
    await supabase
      .from('user_roles')
      .insert({
        app_user_id: newUser.id,
        role_name: assignedRoleName,
        permissions: assignedPermissions
      });

    // 7. Log registro exitoso
    await logAuthEvent(application.id, newUser.id, 'register', req, true, null, { 
      email,
      user_name: newUser.name,
      registration_method: 'email_password',
      application_name: application.name,
      environment: req.environment,
      assigned_role: assignedRoleName
    });

    // 8. Si requiere verificación de email, no generar tokens aún
    if (requireEmailVerification) {
      const response = {
        success: true,
        data: {
          message: 'Usuario registrado exitosamente. Por favor verifica tu email antes de continuar.',
          user_id: newUser.id,
          email_verification_required: true,
          next_step: 'verify_email'
        }
      };
      
      if (callback_url) {
        const verifyParams = new URLSearchParams({
          user_id: newUser.id,
          email: newUser.email,
          state: 'email_verification_required',
          message: 'Por favor verifica tu email para continuar'
        });
        
        response.data.callback_url = `${callback_url.replace('/callback', '/verify-email')}?${verifyParams.toString()}`;
      }
      
      return res.status(201).json(response);
    }

    // 9. Generar tokens para login automático
    const { accessToken, refreshToken } = generateTokens(newUser, application_id, application);

    const response = {
      success: true,
      data: {
        access_token: accessToken,
        refresh_token: refreshToken,
        token_type: 'Bearer',
        expires_in: 86400,
        user: {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name,
          roles: [assignedRoleName],
          permissions: assignedPermissions,
          metadata: newUser.metadata || {},
          created_at: newUser.created_at
        },
        application: {
          id: application_id,
          name: application.name,
          domain: application.domain
        }
      }
    };

    // 10. Si hay callback_url, generar URL de redirección
    if (callback_url) {
      const callbackParams = new URLSearchParams({
        token: accessToken,
        refresh_token: refreshToken,
        user_id: newUser.id,
        state: 'registered_and_logged_in'
      });
      
      response.data.callback_url = `${callback_url}?${callbackParams.toString()}`;
    }

    res.status(201).json(response);

  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error interno del servidor'
      }
    });
  }
});

// Reset password endpoint
app.post('/api/auth/reset-password', validateApiKey, dynamicRateLimit, async (req, res) => {
  try {
    const { email, application_id, callback_url } = req.body;

    // Validate required fields
    if (!email || !application_id) {
      // Log missing fields error
      await logAuthEvent(null, null, 'failed_login', req, false, 'Campos requeridos faltantes en reset password', { 
        email: email || 'missing',
        application_id: application_id || 'missing',
        error_type: 'validation_error'
      });
      
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_FIELDS',
          message: 'Email and application_id are required'
        }
      });
    }

    // Validate that API key belongs to the requested application
    if (req.application.application_id !== application_id) {
      // Log application mismatch error
      await logAuthEvent(null, null, 'failed_login', req, false, 'API key no pertenece a la aplicación en reset password', { 
        email,
        application_id,
        api_key_app: req.application.application_id,
        error_type: 'authorization_error'
      });
      
      return res.status(403).json({
        success: false,
        error: {
          code: 'APPLICATION_MISMATCH',
          message: 'API key no pertenece a la aplicación solicitada'
        }
      });
    }

    // 1. Verificar que la aplicación existe
    const { data: application, error: appError } = await supabase
      .from('applications')
      .select('*')
      .eq('application_id', application_id)
      .single();

    if (appError || !application) {
      await logAuthEvent(null, null, 'password_reset', req, false, 'Aplicación no encontrada en reset password', { 
        application_id,
        email,
        error_type: 'application_not_found'
      });
      
      return res.status(404).json({
        success: false,
        error: {
          code: 'APPLICATION_NOT_FOUND',
          message: 'Aplicación no encontrada'
        }
      });
    }

    // 2. Buscar el usuario en la aplicación
    const { data: appUser, error: userError } = await supabase
      .from('app_users')
      .select('*')
      .eq('application_id', application.id)
      .eq('email', email)
      .single();

    if (userError || !appUser) {
      await logAuthEvent(application.id, null, 'password_reset', req, false, 'Usuario no encontrado', { email, reason: 'user_not_found' });

      // Por seguridad, no revelamos si el usuario existe o no
      return res.json({
        success: true,
        data: {
          message: 'Si el email existe en nuestro sistema, recibirás un enlace de recuperación.',
          email: email
        }
      });
    }

    // 3. Generar token de recuperación
    const resetToken = `reset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas

    // 4. Guardar token de recuperación en metadata del usuario
    const { error: updateError } = await supabase
      .from('app_users')
      .update({
        metadata: {
          ...appUser.metadata,
          reset_token: resetToken,
          reset_token_expires: expiresAt.toISOString()
        }
      })
      .eq('id', appUser.id);

    if (updateError) {
      console.error('Error updating user with reset token:', updateError);
      await logAuthEvent(application.id, appUser.id, 'password_reset', req, false, 'Error al generar token de reset', { 
        email,
        user_name: appUser.name,
        error_type: 'database_error',
        db_error: updateError.message,
        application_name: application.name
      });
      
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Error interno del servidor'
        }
      });
    }

    // 5. Construir URL de recuperación
    const resetUrl = callback_url 
      ? `${callback_url.replace('/callback', '/reset-password')}?token=${resetToken}&email=${encodeURIComponent(email)}`
      : `https://${application.domain}/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;

    // 6. Log evento exitoso
    await logAuthEvent(application.id, appUser.id, 'password_reset', req, true, null, { 
      email,
      user_name: appUser.name,
      application_name: application.name,
      environment: req.environment,
      reset_token: resetToken,
      expires_at: expiresAt.toISOString(),
      reset_url: resetUrl
    });

    const response = {
      success: true,
      data: {
        message: 'Email de recuperación enviado exitosamente.',
        email: email,
        // En producción, NO incluir estos datos sensibles
        debug_info: {
          reset_token: resetToken,
          reset_url: resetUrl,
          expires_at: expiresAt.toISOString()
        }
      }
    };

    if (callback_url) {
      response.data.callback_url = resetUrl;
    }

    res.json(response);

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error interno del servidor'
      }
    });
  }
});

// Password validation function
const validatePassword = (password, policy) => {
  const errors = [];
  
  if (password.length < policy.min_length) {
    errors.push(`mínimo ${policy.min_length} caracteres`);
  }
  
  if (policy.require_uppercase && !/[A-Z]/.test(password)) {
    errors.push('al menos una mayúscula');
  }
  
  if (policy.require_lowercase && !/[a-z]/.test(password)) {
    errors.push('al menos una minúscula');
  }
  
  if (policy.require_numbers && !/\d/.test(password)) {
    errors.push('al menos un número');
  }
  
  if (policy.require_symbols && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('al menos un símbolo especial');
  }
  
  return {
    valid: errors.length === 0,
    message: errors.length > 0 ? `La contraseña debe tener: ${errors.join(', ')}` : 'Contraseña válida'
  };
};

// Verify token endpoint
app.post('/api/auth/verify', validateApiKey, async (req, res) => {
  try {
    const { token, application_id } = req.body;

    if (!token || !application_id) {
      // Log missing fields error
      await logAuthEvent(null, null, 'failed_login', req, false, 'Campos requeridos faltantes en verify token', { 
        application_id: application_id || 'missing',
        has_token: !!token,
        error_type: 'validation_error'
      });
      
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_FIELDS',
          message: 'Token and application_id are required'
        }
      });
    }

    // Validate that API key belongs to the requested application
    if (req.application.application_id !== application_id) {
      // Log application mismatch error
      await logAuthEvent(null, null, 'failed_login', req, false, 'API key no pertenece a la aplicación en verify token', { 
        application_id,
        api_key_app: req.application.application_id,
        error_type: 'authorization_error'
      });
      
      return res.status(403).json({
        success: false,
        error: {
          code: 'APPLICATION_MISMATCH',
          message: 'API key no pertenece a la aplicación solicitada'
        }
      });
    }

    // Verify JWT token
    try {
      const candidateSecrets = [
        req.application?.jwt_secret,
        JWT_SECRET,
      ].filter((value, index, array) => typeof value === 'string' && value.trim() && array.indexOf(value) === index);

      let decoded = null;
      let lastJwtError = null;

      for (const candidateSecret of candidateSecrets) {
        try {
          decoded = jwt.verify(token, candidateSecret);
          break;
        } catch (candidateError) {
          lastJwtError = candidateError;
        }
      }

      if (!decoded) {
        throw lastJwtError || new Error('Invalid token');
      }
      
      // Verify application matches
      if (decoded.app_id !== application_id) {
        await logAuthEvent(null, null, 'failed_login', req, false, 'Token no válido para esta aplicación', { 
          application_id,
          token_app_id: decoded.app_id,
          error_type: 'token_application_mismatch'
        });
        
        return res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_TOKEN',
            message: 'Token no válido para esta aplicación'
          }
        });
      }

      // Get user info
      const { data: appUser, error: userError } = await supabase
        .from('app_users')
        .select(`
          *,
          user_roles(
            role_name,
            permissions
          )
        `)
        .eq('id', decoded.sub)
        .single();

      if (userError || !appUser) {
        await logAuthEvent(null, null, 'failed_login', req, false, 'Usuario no encontrado para token', { 
          application_id,
          user_id: decoded.sub,
          error_type: 'user_not_found_for_token'
        });
        
        return res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_TOKEN',
            message: 'Usuario no encontrado'
          }
        });
      }

      res.json({
        success: true,
        data: {
          valid: true,
          user: {
            id: appUser.id,
            email: appUser.email,
            name: appUser.name,
            roles: appUser.user_roles?.map(r => r.role_name) || [],
            permissions: appUser.user_roles?.flatMap(r => r.permissions) || []
          },
          expires_at: new Date(decoded.exp * 1000).toISOString()
        }
      });

    } catch (jwtError) {
      await logAuthEvent(null, null, 'failed_login', req, false, 'Token JWT inválido o expirado', { 
        application_id,
        error_type: 'invalid_jwt_token',
        jwt_error: jwtError.message
      });
      
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Token inválido o expirado'
        }
      });
    }

  } catch (error) {
    console.error('Verify token error:', error);
    await logAuthEvent(null, null, 'failed_login', req, false, 'Error interno en verify token', { 
      error_type: 'internal_error',
      error_message: error.message
    });
    
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error interno del servidor'
      }
    });
  }
});

// Get users endpoint (for API access)
app.get('/api/users', validateApiKey, async (req, res) => {
  try {
    const { application_id, page = 1, limit = 50, search } = req.query;

    if (!application_id) {
      // Log missing application_id error
      await logAuthEvent(null, null, 'failed_login', req, false, 'application_id requerido en get users', { 
        error_type: 'validation_error',
        endpoint: 'get_users'
      });
      
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_APPLICATION_ID',
          message: 'application_id es requerido'
        }
      });
    }

    // Validate that API key belongs to the requested application
    if (req.application.application_id !== application_id) {
      // Log application mismatch error
      await logAuthEvent(null, null, 'failed_login', req, false, 'API key no pertenece a la aplicación en get users', { 
        application_id,
        api_key_app: req.application.application_id,
        error_type: 'authorization_error',
        endpoint: 'get_users'
      });
      
      return res.status(403).json({
        success: false,
        error: {
          code: 'APPLICATION_MISMATCH',
          message: 'API key no pertenece a la aplicación solicitada'
        }
      });
    }
    
    // Get application
    const { data: application, error: appError } = await supabase
      .from('applications')
      .select('*')
      .eq('application_id', application_id)
      .single();

    if (appError || !application) {
      await logAuthEvent(null, null, 'failed_login', req, false, 'Aplicación no encontrada en get users', { 
        application_id,
        error_type: 'application_not_found',
        endpoint: 'get_users'
      });
      
      return res.status(404).json({
        success: false,
        error: {
          code: 'APPLICATION_NOT_FOUND',
          message: 'Aplicación no encontrada'
        }
      });
    }

    // Build query
    let query = supabase
      .from('app_users')
      .select(`
        id,
        email,
        name,
        status,
        last_login,
        created_at,
        user_roles(role_name)
      `)
      .eq('application_id', application.id);

    // Add search filter
    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    // Add pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);
    query = query.range(offset, offset + parseInt(limit) - 1);

    const { data: users, error: usersError, count } = await query;

    if (usersError) {
      await logAuthEvent(application.id, null, 'failed_login', req, false, 'Error al consultar usuarios', { 
        application_id,
        error_type: 'database_error',
        db_error: usersError.message,
        application_name: application.name,
        endpoint: 'get_users'
      });
      
      throw usersError;
    }

    res.json({
      success: true,
      data: {
        users: users || [],
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count || 0,
          pages: Math.ceil((count || 0) / parseInt(limit))
        }
      }
    });

  } catch (error) {
    console.error('Get users error:', error);
    await logAuthEvent(null, null, 'failed_login', req, false, 'Error interno en get users', { 
      error_type: 'internal_error',
      error_message: error.message,
      endpoint: 'get_users'
    });
    
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error interno del servidor'
      }
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  
  // Log unhandled errors
  logAuthEvent(null, null, 'failed_login', req, false, 'Error no manejado', { 
    error_type: 'unhandled_error',
    error_message: error.message,
    error_stack: error.stack
  }).catch(logError => {
    console.error('Error logging unhandled error:', logError);
  });
  
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Error interno del servidor'
    }
  });
});

// 404 handler
app.use((req, res) => {
  // Log 404 errors
  logAuthEvent(null, null, 'failed_login', req, false, 'Endpoint no encontrado', { 
    error_type: 'not_found',
    requested_path: req.path,
    method: req.method
  }).catch(logError => {
    console.error('Error logging 404:', logError);
  });
  
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Endpoint no encontrado'
    }
  });
});

// Start server
app.listen(PORT, async () => {
  console.log(`🚀 AuthSystem API Server running on port ${PORT}`);
  console.log(`📚 Local API: http://localhost:${PORT}/api/health`);
  console.log(`🌐 WebContainer API: https://zp1v56uxy8rdx5ypatb0ockcb9tr6a-oci3-6prh5986--${PORT}--96435430.local-credentialless.webcontainer-api.io/api/health`);
  
  // Create default API key if it doesn't exist
  try {
    const defaultApiKey = 'ak_development_cd9bac61b17b0a09f307afe54e93d40f';
    const { data: existingKey } = await supabase
      .from('api_keys')
      .select('id')
      .eq('key_hash', defaultApiKey)
      .single();
    
    if (!existingKey) {
      // Get first application to associate with the API key
      const { data: applications } = await supabase
        .from('applications')
        .select('id')
        .limit(1);
      
      if (applications && applications.length > 0) {
        const { error: insertError } = await supabase
          .from('api_keys')
          .insert({
            application_id: applications[0].id,
            name: 'Development API Key',
            key_hash: defaultApiKey,
            key_preview: 'ak_development_...3d40f',
            permissions: ['read', 'write'],
            is_active: true
          });
        
        if (!insertError) {
          console.log('✅ Created default API key for development');
        } else {
          console.log('⚠️ Could not create default API key:', insertError.message);
        }
      } else {
        console.log('⚠️ No applications found to associate API key with');
      }
    } else {
      console.log('✅ Default API key already exists');
    }
  } catch (error) {
    console.log('⚠️ Error checking/creating default API key:', error.message);
  }
  
  console.log('💡 Para crear URLs públicas, usa el botón "Desplegar" en la sección Ambientes del dashboard');
  console.log('💡 Esto creará túneles ngrok específicos por ambiente usando la API REST');
  
  // Create tunnel endpoint
  app.post('/api/tunnels/create', async (req, res) => {
    try {
      const { environment = 'development', application_id, api_key } = req.body;
      
      console.log(`🚀 Creating tunnel for environment: ${environment}`);
      
      // Validate environment
      const validEnvironments = ['development', 'testing', 'production'];
      if (!validEnvironments.includes(environment)) {
        return res.status(400).json({
          success: false,
          error: `Invalid environment. Must be one of: ${validEnvironments.join(', ')}`
        });
      }
      
      // Generate WebContainer URL
      const webContainerUrl = `https://zp1v56uxy8rdx5ypatb0ockcb9tr6a-oci3-6prh5986--${PORT}--96435430.local-credentialless.webcontainer-api.io`;
      const apiUrl = `${webContainerUrl}/api`;
      
      console.log(`🌐 Generated URLs for ${environment}:`);
      console.log(`   Public URL: ${webContainerUrl}`);
      console.log(`   API URL: ${apiUrl}`);
      
      // Test the tunnel by making a health check
      console.log(`🧪 Testing tunnel connectivity...`);
      
      const testResults = await testAllEndpoints(webContainerUrl, application_id || 'test-app-123', api_key || 'ak_development_cd9bac61b17b0a09f307afe54e93d40f');
      
      // Store tunnel info
      const tunnelInfo = {
        environment,
        publicUrl: webContainerUrl,
        apiUrl: apiUrl,
        port: PORT,
        status: 'active',
        created_at: new Date().toISOString(),
        testResults: testResults
      };
      
      activeTunnels.set(environment, tunnelInfo);
      
      console.log(`✅ Tunnel created successfully for ${environment}`);
      console.log(`📊 Test results summary:`);
      Object.entries(testResults).forEach(([endpoint, result]) => {
        const status = result.success ? '✅' : '❌';
        console.log(`   ${status} ${endpoint}: ${result.status}`);
      });
      
      res.json({
        success: true,
        data: {
          environment,
          publicUrl: webContainerUrl,
          apiUrl: apiUrl,
          port: PORT,
          status: 'active',
          created_at: new Date().toISOString(),
          testResults: testResults
        }
      });
      
    } catch (error) {
      console.error(`❌ Error creating tunnel for ${environment}:`, error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to create tunnel'
      });
    }
  });
});

// Helper function to test all API endpoints
async function testAllEndpoints(publicUrl, appId, apiKey) {
  const results = {};
  
  console.log(`🧪 Starting comprehensive API tests for: ${publicUrl}`);
  console.log(`🔑 Using API Key: ${apiKey.substring(0, 20)}...`);
  console.log(`📱 Testing with App ID: ${appId}`);
  
  // Test health endpoint
  results.health = await testHealthEndpoint(publicUrl);
  
  // Test auth endpoints
  results.login = await testLoginEndpoint(publicUrl, appId, apiKey);
  results.register = await testRegisterEndpoint(publicUrl, appId, apiKey);
  results.resetPassword = await testResetPasswordEndpoint(publicUrl, appId, apiKey);
  results.verify = await testVerifyEndpoint(publicUrl, appId, apiKey);
  results.users = await testUsersEndpoint(publicUrl, appId, apiKey);
  
  console.log(`📊 API tests completed. Results summary:`);
  Object.entries(results).forEach(([endpoint, result]) => {
    const status = result.success ? '✅' : '❌';
    const time = result.responseTime ? `(${result.responseTime}ms)` : '';
    console.log(`   ${status} ${endpoint}: ${result.status} ${time}`);
  });
  
  return results;
}

async function testHealthEndpoint(publicUrl) {
  try {
    const startTime = Date.now();
    const response = await fetch(`${publicUrl}/api/health`, {
      method: 'GET',
      headers: {
        'User-Agent': 'AuthSystem-HealthCheck/1.0'
      },
      signal: AbortSignal.timeout(10000)
    });
    const responseTime = Date.now() - startTime;
    
    const data = await response.json();
    
    return {
      success: response.ok,
      status: response.status,
      responseTime,
      data
    };
  } catch (error) {
    return {
      success: false,
      status: 'error',
      error: error.message
    };
  }
}

async function testLoginEndpoint(publicUrl, appId, apiKey) {
  try {
    const testData = {
      email: 'test@example.com',
      password: 'testpassword123',
      application_id: appId
    };
    
    const startTime = Date.now();
    const response = await fetch(`${publicUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
        'User-Agent': 'AuthSystem-Test/1.0'
      },
      body: JSON.stringify(testData),
      signal: AbortSignal.timeout(15000)
    });
    const responseTime = Date.now() - startTime;
    
    const data = await response.json();
    
    return {
      success: response.ok,
      status: response.status,
      responseTime,
      data
    };
  } catch (error) {
    return {
      success: false,
      status: 'error',
      error: error.message
    };
  }
}

async function testRegisterEndpoint(publicUrl, appId, apiKey) {
  try {
    const testData = {
      email: `test-${Date.now()}@example.com`,
      password: 'testpassword123',
      name: 'Test User',
      application_id: appId
    };
    
    const startTime = Date.now();
    const response = await fetch(`${publicUrl}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
        'User-Agent': 'AuthSystem-Test/1.0'
      },
      body: JSON.stringify(testData),
      signal: AbortSignal.timeout(15000)
    });
    const responseTime = Date.now() - startTime;
    
    const data = await response.json();
    
    return {
      success: response.ok,
      status: response.status,
      responseTime,
      data
    };
  } catch (error) {
    return {
      success: false,
      status: 'error',
      error: error.message
    };
  }
}

async function testResetPasswordEndpoint(publicUrl, appId, apiKey) {
  try {
    const testData = {
      email: 'test@example.com',
      application_id: appId
    };
    
    const startTime = Date.now();
    const response = await fetch(`${publicUrl}/api/auth/reset-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
        'User-Agent': 'AuthSystem-Test/1.0'
      },
      body: JSON.stringify(testData),
      signal: AbortSignal.timeout(15000)
    });
    const responseTime = Date.now() - startTime;
    
    const data = await response.json();
    
    return {
      success: response.ok,
      status: response.status,
      responseTime,
      data
    };
  } catch (error) {
    return {
      success: false,
      status: 'error',
      error: error.message
    };
  }
}

async function testVerifyEndpoint(publicUrl, appId, apiKey) {
  try {
    const testData = {
      token: 'test-jwt-token-123',
      application_id: appId
    };
    
    const startTime = Date.now();
    const response = await fetch(`${publicUrl}/api/auth/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
        'User-Agent': 'AuthSystem-Test/1.0'
      },
      body: JSON.stringify(testData),
      signal: AbortSignal.timeout(15000)
    });
    const responseTime = Date.now() - startTime;
    
    const data = await response.json();
    
    return {
      success: response.ok,
      status: response.status,
      responseTime,
      data
    };
  } catch (error) {
    return {
      success: false,
      status: 'error',
      error: error.message
    };
  }
}

async function testUsersEndpoint(publicUrl, appId, apiKey) {
  try {
    const startTime = Date.now();
    const response = await fetch(`${publicUrl}/api/users?application_id=${appId}&page=1&limit=10`, {
      method: 'GET',
      headers: {
        'X-API-Key': apiKey,
        'User-Agent': 'AuthSystem-Test/1.0'
      },
      signal: AbortSignal.timeout(15000)
    });
    const responseTime = Date.now() - startTime;
    
    const data = await response.json();
    
    return {
      success: response.ok,
      status: response.status,
      responseTime,
      data
    };
  } catch (error) {
    return {
      success: false,
      status: 'error',
      error: error.message
    };
  }
}

export default app;
