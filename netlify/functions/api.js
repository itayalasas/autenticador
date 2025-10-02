// Netlify Function que maneja toda la API
import express from 'express';
import serverless from 'serverless-http';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const app = express();

// Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
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
  origin: true, // Permitir todos los orígenes en Netlify
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Demasiados intentos. Intenta de nuevo en 15 minutos.'
    }
  }
});

// JWT Secret
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

    if (keyError || !apiKeyRecord) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_API_KEY',
          message: 'API key no encontrada en la base de datos'
        }
      });
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

// API Routes

// Health check
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'AuthSystem API is running on Netlify',
    timestamp: new Date().toISOString(),
    environment: 'netlify'
  });
});

// Login endpoint
app.post('/auth/login', validateApiKey, authLimiter, async (req, res) => {
  try {
    const { email, password, application_id, callback_url } = req.body;

    // Validate required fields
    if (!email || !password || !application_id) {
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

    if (!application || appError) {
      await logAuthEvent(null, null, 'failed_login', req, false, 'Aplicación no encontrada', { application_id });
      return res.status(404).json({
        success: false,
        error: {
          code: 'APPLICATION_NOT_FOUND',
          message: 'Aplicación no encontrada'
        }
      });
    }

    // Get user
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
      await logAuthEvent(application.id, null, 'failed_login', req, false, 'Usuario no encontrado', { email });
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Email o contraseña incorrectos'
        }
      });
    }

    // Verify password
    let isValidPassword = false;
    try {
      isValidPassword = await bcrypt.compare(password, appUser.password_hash);
      if (!isValidPassword) {
        const base64Password = btoa(password);
        isValidPassword = base64Password === appUser.password_hash;
      }
    } catch (bcryptError) {
      const base64Password = btoa(password);
      isValidPassword = base64Password === appUser.password_hash;
    }

    if (!isValidPassword) {
      await logAuthEvent(application.id, appUser.id, 'failed_login', req, false, 'Contraseña incorrecta', { email });
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Email o contraseña incorrectos'
        }
      });
    }

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(appUser, application_id, application);

    // Update last login
    await supabase
      .from('app_users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', appUser.id);

    // Log successful login
    await logAuthEvent(application.id, appUser.id, 'login', req, true, null, { email, login_method: 'email_password' });

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
          last_login: new Date().toISOString()
        },
        application: {
          id: application_id,
          name: application.name,
          domain: application.domain
        }
      }
    };

    if (callback_url) {
      const callbackParams = new URLSearchParams({
        state: 'success',
        token: accessToken,
        refresh_token: refreshToken,
        user_id: appUser.id,
        user_email: appUser.email,
        user_name: encodeURIComponent(appUser.name),
        expires_in: '86400'
      });
      
      response.data.callback_url = `${callback_url}?${callbackParams.toString()}`;
    }

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
app.post('/auth/register', validateApiKey, authLimiter, async (req, res) => {
  try {
    const { email, password, name, application_id, callback_url, metadata, role } = req.body;

    if (!email || !password || !name || !application_id) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_FIELDS',
          message: 'Email, password, name, and application_id are required'
        }
      });
    }

    if (req.application.application_id !== application_id) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'APPLICATION_MISMATCH',
          message: 'API key no pertenece a la aplicación solicitada'
        }
      });
    }

    const { data: application, error: appError } = await supabase
      .from('applications')
      .select('*')
      .eq('application_id', application_id)
      .single();

    if (appError || !application) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'APPLICATION_NOT_FOUND',
          message: 'Aplicación no encontrada'
        }
      });
    }

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('app_users')
      .select('id')
      .eq('application_id', application.id)
      .eq('email', email)
      .single();

    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'EMAIL_ALREADY_EXISTS',
          message: 'Ya existe un usuario con este email'
        }
      });
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    
    const requireEmailVerification = application.metadata?.enable_email_verification ?? true;
    const userStatus = requireEmailVerification ? 'pending' : 'active';
    
    // Create user
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
      return res.status(500).json({
        success: false,
        error: {
          code: 'CREATE_USER_FAILED',
          message: 'Error al crear el usuario'
        }
      });
    }

    // Assign role
    let assignedRoleName = 'user';
    let assignedPermissions = ['read'];
    
    if (role) {
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

    // Log successful registration
    await logAuthEvent(application.id, newUser.id, 'register', req, true, null, { email, registration_method: 'email_password' });

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

    // Generate tokens for auto-login
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

// Verify token endpoint
app.post('/auth/verify', validateApiKey, async (req, res) => {
  try {
    const { token, application_id } = req.body;

    if (!token || !application_id) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_FIELDS',
          message: 'Token and application_id are required'
        }
      });
    }

    if (req.application.application_id !== application_id) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'APPLICATION_MISMATCH',
          message: 'API key no pertenece a la aplicación solicitada'
        }
      });
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      
      if (decoded.app_id !== application_id) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_TOKEN',
            message: 'Token no válido para esta aplicación'
          }
        });
      }

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
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error interno del servidor'
      }
    });
  }
});

// Get users endpoint
app.get('/users', validateApiKey, async (req, res) => {
  try {
    const { application_id, page = 1, limit = 50, search } = req.query;

    if (!application_id) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_APPLICATION_ID',
          message: 'application_id es requerido'
        }
      });
    }

    if (req.application.application_id !== application_id) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'APPLICATION_MISMATCH',
          message: 'API key no pertenece a la aplicación solicitada'
        }
      });
    }
    
    const { data: application, error: appError } = await supabase
      .from('applications')
      .select('*')
      .eq('application_id', application_id)
      .single();

    if (appError || !application) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'APPLICATION_NOT_FOUND',
          message: 'Aplicación no encontrada'
        }
      });
    }

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

    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    query = query.range(offset, offset + parseInt(limit) - 1);

    const { data: users, error: usersError, count } = await query;

    if (usersError) {
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
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error interno del servidor'
      }
    });
  }
});

// Error handling
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Error interno del servidor'
    }
  });
});

// Export the serverless function
export const handler = serverless(app);