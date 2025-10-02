// Netlify Function que maneja toda la API
const express = require('express');
const serverless = require('serverless-http');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();

// Log environment variables for debugging
console.log('🔧 Netlify Function Environment Check:', {
  VITE_SUPABASE_URL: !!process.env.VITE_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  JWT_SECRET: !!process.env.JWT_SECRET,
  NODE_ENV: process.env.NODE_ENV
});

// Validate required environment variables
if (!process.env.VITE_SUPABASE_URL) {
  console.error('❌ VITE_SUPABASE_URL is missing');
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY is missing');
}

// Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Middleware
app.use(helmet({
  contentSecurityPolicy: false
}));

app.use(cors({
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
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
    
    console.log('🔑 API Key validation:', {
      hasApiKey: !!apiKey,
      apiKeyPrefix: apiKey ? apiKey.substring(0, 15) + '...' : 'none',
      method: req.method,
      path: req.path
    });
    
    if (!apiKey) {
      console.log('❌ Missing API key');
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
      console.log('❌ Invalid API key format:', apiKey);
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
    console.log('🌍 Environment from API key:', environment);

    // For development, allow the mock API key without database validation
    if (apiKey === 'ak_development_cd9bac61b17b0a09f307afe54e93d40f') {
      console.log('🔧 Using development mock API key');
      req.apiKey = {
        id: 'mock-key',
        name: 'Development Mock Key',
        permissions: ['read', 'write']
      };
      req.environment = 'development';
      req.application = {
        id: 'mock-app-id',
        application_id: 'app_9c0ffde2-fc7',
        name: 'Demo Application',
        domain: 'demo.com'
      };
      return next();
    }

    // Validate API key against database
    console.log('🔍 Checking API key in database...');
    const { data: apiKeyRecord, error: keyError } = await supabase
      .from('api_keys')
      .select(`
        *,
        applications!inner(*)
      `)
      .or(`key_hash.eq.${apiKey},key_preview.eq.${apiKey}`)
      .eq('is_active', true)
      .maybeSingle();

    console.log('📊 Database lookup result:', {
      found: !!apiKeyRecord,
      error: keyError?.message,
      applicationId: apiKeyRecord?.applications?.application_id
    });

    if (keyError || !apiKeyRecord) {
      console.log('❌ API key not found or error:', keyError?.message);
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_API_KEY',
          message: `API key no encontrada en la base de datos. Error: ${keyError?.message || 'Not found'}`
        }
      });
    }

    // Add API key info to request
    req.apiKey = apiKeyRecord;
    req.environment = environment;
    req.application = apiKeyRecord.applications;
    
    console.log('✅ API key validated successfully');
    next();
  } catch (error) {
    console.error('❌ API key validation error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: `Error interno del servidor: ${error.message}`
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
    exp: now + (24 * 60 * 60),
    iss: 'AuthSystem',
    aud: application.domain
  };

  const refreshTokenPayload = {
    sub: user.id,
    app_id: applicationId,
    type: 'refresh',
    iat: now,
    exp: now + (30 * 24 * 60 * 60),
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
      ip_address: req.headers['x-forwarded-for'] || req.ip || 'unknown',
      user_agent: req.get('User-Agent'),
      success,
      error_message: errorMessage,
      metadata
    });
  } catch (error) {
    console.error('Error logging auth event:', error);
  }
};

// Health check
app.get('/api/health', (req, res) => {
  console.log('🏥 Health check called');
  res.json({
    success: true,
    message: 'AuthSystem API is running on Netlify',
    timestamp: new Date().toISOString(),
    environment: 'netlify',
    supabase_configured: !!process.env.VITE_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY
  });
});

// Login endpoint
app.post('/api/auth/login', validateApiKey, authLimiter, async (req, res) => {
  try {
    console.log('🔐 Login attempt started');
    console.log('📝 Request body:', {
      email: req.body.email,
      application_id: req.body.application_id,
      hasPassword: !!req.body.password,
      hasCallbackUrl: !!req.body.callback_url
    });
    
    const { email, password, application_id, callback_url } = req.body;

    // Validate required fields
    if (!email || !password || !application_id) {
      console.log('❌ Missing required fields');
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
      console.log('❌ Application mismatch:', {
        apiKeyApp: req.application.application_id,
        requestedApp: application_id
      });
      return res.status(403).json({
        success: false,
        error: {
          code: 'APPLICATION_MISMATCH',
          message: 'API key no pertenece a la aplicación solicitada'
        }
      });
    }

    console.log('✅ Application validation passed');

    // For mock application, use mock user data
    if (application_id === 'app_9c0ffde2-fc7') {
      console.log('🔧 Using mock application data');
      
      // Mock user validation
      const mockUsers = [
        {
          id: 'user_123',
          email: 'mariavortiz600@gmail.com',
          name: 'Maria Ortiz',
          password_hash: btoa('123456'), // Mock password: 123456
          status: 'active',
          user_roles: [
            { role_name: 'admin', permissions: ['read', 'write', 'admin'] }
          ],
          metadata: {},
          created_at: new Date().toISOString()
        },
        {
          id: 'user_456',
          email: 'test@example.com',
          name: 'Test User',
          password_hash: btoa('password123'),
          status: 'active',
          user_roles: [
            { role_name: 'user', permissions: ['read'] }
          ],
          metadata: {},
          created_at: new Date().toISOString()
        }
      ];

      const mockUser = mockUsers.find(u => u.email === email);
      
      if (!mockUser) {
        console.log('❌ Mock user not found for email:', email);
        return res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Email o contraseña incorrectos'
          }
        });
      }

      // Verify password (mock)
      const isValidPassword = btoa(password) === mockUser.password_hash;
      
      if (!isValidPassword) {
        console.log('❌ Invalid mock password');
        return res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Email o contraseña incorrectos'
          }
        });
      }

      console.log('✅ Mock user authenticated successfully');

      // Generate tokens
      const { accessToken, refreshToken } = generateTokens(mockUser, application_id, req.application);

      const response = {
        success: true,
        data: {
          access_token: accessToken,
          refresh_token: refreshToken,
          token_type: 'Bearer',
          expires_in: 86400,
          user: {
            id: mockUser.id,
            email: mockUser.email,
            name: mockUser.name,
            roles: mockUser.user_roles?.map(r => r.role_name) || [],
            permissions: mockUser.user_roles?.flatMap(r => r.permissions) || [],
            metadata: mockUser.metadata || {},
            last_login: new Date().toISOString()
          },
          application: {
            id: application_id,
            name: req.application.name,
            domain: req.application.domain
          }
        }
      };

      if (callback_url) {
        const callbackParams = new URLSearchParams({
          state: 'success',
          token: accessToken,
          refresh_token: refreshToken,
          user_id: mockUser.id,
          user_email: mockUser.email,
          user_name: encodeURIComponent(mockUser.name),
          expires_in: '86400'
        });
        
        response.data.callback_url = `${callback_url}?${callbackParams.toString()}`;
      }

      console.log('✅ Mock login successful');
      return res.json(response);
    }

    // Real database logic for production
    console.log('🔍 Looking up application in database:', application_id);
    const { data: application, error: appError } = await supabase
      .from('applications')
      .select('*')
      .eq('application_id', application_id)
      .single();

    if (!application || appError) {
      console.log('❌ Application not found:', appError?.message);
      return res.status(404).json({
        success: false,
        error: {
          code: 'APPLICATION_NOT_FOUND',
          message: `Aplicación no encontrada: ${appError?.message || 'Unknown error'}`
        }
      });
    }

    console.log('✅ Application found:', application.name);
    
    // Get user
    console.log('👤 Looking up user:', email);
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
      console.log('❌ User not found:', userError?.message);
      await logAuthEvent(application.id, null, 'failed_login', req, false, 'Usuario no encontrado', { email });
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Email o contraseña incorrectos'
        }
      });
    }

    console.log('✅ User found:', {
      id: appUser.id,
      status: appUser.status,
      hasPasswordHash: !!appUser.password_hash
    });
    
    // Verify password
    let isValidPassword = false;
    try {
      console.log('🔐 Verifying password...');
      isValidPassword = await bcrypt.compare(password, appUser.password_hash);
      console.log('🔐 bcrypt result:', isValidPassword);
      
      if (!isValidPassword) {
        const base64Password = btoa(password);
        isValidPassword = base64Password === appUser.password_hash;
        console.log('🔐 base64 fallback result:', isValidPassword);
      }
    } catch (bcryptError) {
      console.log('🔐 bcrypt error, trying base64:', bcryptError.message);
      const base64Password = btoa(password);
      isValidPassword = base64Password === appUser.password_hash;
      console.log('🔐 base64 result:', isValidPassword);
    }

    if (!isValidPassword) {
      console.log('❌ Invalid password');
      await logAuthEvent(application.id, appUser.id, 'failed_login', req, false, 'Contraseña incorrecta', { email });
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Email o contraseña incorrectos'
        }
      });
    }

    // Check user status
    if (appUser.status !== 'active') {
      console.log('❌ User not active:', appUser.status);
      await logAuthEvent(application.id, appUser.id, 'failed_login', req, false, 'Usuario inactivo', { email, status: appUser.status });
      return res.status(403).json({
        success: false,
        error: {
          code: 'USER_INACTIVE',
          message: 'Tu cuenta está inactiva. Contacta al administrador.'
        }
      });
    }

    console.log('✅ Password verified, generating tokens...');
    
    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(appUser, application_id, application);

    // Update last login
    await supabase
      .from('app_users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', appUser.id);

    // Log successful login
    await logAuthEvent(application.id, appUser.id, 'login', req, true, null, { email, login_method: 'email_password' });

    console.log('✅ Login successful for user:', appUser.email);
    
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
    console.error('❌ Login error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: `Error interno del servidor: ${error.message}`
      }
    });
  }
});

// Register endpoint
app.post('/api/auth/register', validateApiKey, authLimiter, async (req, res) => {
  try {
    console.log('📝 Register attempt started');
    console.log('📝 Request body:', {
      email: req.body.email,
      name: req.body.name,
      application_id: req.body.application_id,
      hasPassword: !!req.body.password
    });
    
    const { email, password, name, application_id, callback_url, metadata, role } = req.body;

    if (!email || !password || !name || !application_id) {
      console.log('❌ Missing required fields for registration');
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_FIELDS',
          message: 'Email, password, name, and application_id are required'
        }
      });
    }

    if (req.application.application_id !== application_id) {
      console.log('❌ Application mismatch for registration');
      return res.status(403).json({
        success: false,
        error: {
          code: 'APPLICATION_MISMATCH',
          message: 'API key no pertenece a la aplicación solicitada'
        }
      });
    }

    console.log('✅ Registration validation passed');

    // For mock application, simulate registration
    if (application_id === 'app_9c0ffde2-fc7') {
      console.log('🔧 Using mock registration');
      
      const newUserId = `user_${Date.now()}`;
      const mockUser = {
        id: newUserId,
        email: email,
        name: name,
        status: 'active',
        user_roles: [
          { role_name: 'user', permissions: ['read'] }
        ],
        metadata: metadata || {},
        created_at: new Date().toISOString()
      };

      // Generate tokens for auto-login
      const { accessToken, refreshToken } = generateTokens(mockUser, application_id, req.application);

      const response = {
        success: true,
        data: {
          access_token: accessToken,
          refresh_token: refreshToken,
          token_type: 'Bearer',
          expires_in: 86400,
          user: {
            id: mockUser.id,
            email: mockUser.email,
            name: mockUser.name,
            roles: ['user'],
            permissions: ['read'],
            metadata: mockUser.metadata || {},
            created_at: mockUser.created_at
          },
          application: {
            id: application_id,
            name: req.application.name,
            domain: req.application.domain
          }
        }
      };

      if (callback_url) {
        const callbackParams = new URLSearchParams({
          token: accessToken,
          refresh_token: refreshToken,
          user_id: mockUser.id,
          state: 'registered_and_logged_in'
        });
        
        response.data.callback_url = `${callback_url}?${callbackParams.toString()}`;
      }

      console.log('✅ Mock registration successful');
      return res.status(201).json(response);
    }

    // Real database logic continues here...
    const { data: application, error: appError } = await supabase
      .from('applications')
      .select('*')
      .eq('application_id', application_id)
      .single();

    if (appError || !application) {
      console.log('❌ Application not found for registration:', appError?.message);
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
      console.log('❌ User already exists:', email);
      return res.status(409).json({
        success: false,
        error: {
          code: 'EMAIL_ALREADY_EXISTS',
          message: 'Ya existe un usuario con este email'
        }
      });
    }

    // Hash password
    console.log('🔐 Hashing password...');
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    
    const requireEmailVerification = application.metadata?.enable_email_verification ?? true;
    const userStatus = requireEmailVerification ? 'pending' : 'active';
    
    console.log('👤 Creating user with status:', userStatus);
    
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
      console.log('❌ Error creating user:', createError.message);
      return res.status(500).json({
        success: false,
        error: {
          code: 'CREATE_USER_FAILED',
          message: `Error al crear el usuario: ${createError.message}`
        }
      });
    }

    console.log('✅ User created successfully:', newUser.id);
    
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
    
    console.log('🎭 Assigning role:', assignedRoleName);
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
      console.log('📧 Email verification required');
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
    console.log('🎫 Generating tokens for auto-login...');
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

    console.log('✅ Registration successful');
    res.status(201).json(response);

  } catch (error) {
    console.error('❌ Register error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: `Error interno del servidor: ${error.message}`
      }
    });
  }
});

// Reset password endpoint
app.post('/api/auth/reset-password', validateApiKey, authLimiter, async (req, res) => {
  try {
    console.log('🔄 Reset password attempt started');
    console.log('📝 Request body:', {
      email: req.body.email,
      application_id: req.body.application_id
    });
    
    const { email, application_id, callback_url } = req.body;

    if (!email || !application_id) {
      console.log('❌ Missing required fields for reset password');
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_FIELDS',
          message: 'Email and application_id are required'
        }
      });
    }

    if (req.application.application_id !== application_id) {
      console.log('❌ Application mismatch for reset password');
      return res.status(403).json({
        success: false,
        error: {
          code: 'APPLICATION_MISMATCH',
          message: 'API key no pertenece a la aplicación solicitada'
        }
      });
    }

    console.log('✅ Reset password validation passed');

    // For mock application, simulate reset
    if (application_id === 'app_9c0ffde2-fc7') {
      console.log('🔧 Using mock reset password');
      
      const resetToken = `reset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const resetUrl = callback_url 
        ? `${callback_url.replace('/callback', '/reset-password')}?token=${resetToken}&email=${encodeURIComponent(email)}`
        : `https://demo.com/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;

      const response = {
        success: true,
        data: {
          message: 'Email de recuperación enviado exitosamente.',
          email: email,
          debug_info: {
            reset_token: resetToken,
            reset_url: resetUrl,
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
          }
        }
      };

      if (callback_url) {
        response.data.callback_url = resetUrl;
      }

      console.log('✅ Mock reset password successful');
      return res.json(response);
    }

    // Real database logic continues here...
    const { data: application, error: appError } = await supabase
      .from('applications')
      .select('*')
      .eq('application_id', application_id)
      .single();

    if (appError || !application) {
      console.log('❌ Application not found for reset:', appError?.message);
      return res.status(404).json({
        success: false,
        error: {
          code: 'APPLICATION_NOT_FOUND',
          message: 'Aplicación no encontrada'
        }
      });
    }

    const { data: appUser, error: userError } = await supabase
      .from('app_users')
      .select('*')
      .eq('application_id', application.id)
      .eq('email', email)
      .single();

    if (userError || !appUser) {
      await logAuthEvent(application.id, null, 'password_reset', req, false, 'Usuario no encontrado', { email, reason: 'user_not_found' });

      return res.json({
        success: true,
        data: {
          message: 'Si el email existe en nuestro sistema, recibirás un enlace de recuperación.',
          email: email
        }
      });
    }

    const resetToken = `reset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

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
      console.log('❌ Error updating user with reset token:', updateError.message);
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: `Error interno del servidor: ${updateError.message}`
        }
      });
    }

    const resetUrl = callback_url 
      ? `${callback_url.replace('/callback', '/reset-password')}?token=${resetToken}&email=${encodeURIComponent(email)}`
      : `https://${application.domain}/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;

    await logAuthEvent(application.id, appUser.id, 'password_reset', req, true, null, { 
      email, 
      reset_token: resetToken,
      expires_at: expiresAt.toISOString(),
      reset_url: resetUrl
    });

    console.log('✅ Reset password successful');
    
    const response = {
      success: true,
      data: {
        message: 'Email de recuperación enviado exitosamente.',
        email: email,
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
    console.error('❌ Reset password error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: `Error interno del servidor: ${error.message}`
      }
    });
  }
});

// Verify token endpoint
app.post('/api/auth/verify', validateApiKey, async (req, res) => {
  try {
    console.log('🔍 Token verification attempt started');
    console.log('📝 Request body:', {
      hasToken: !!req.body.token,
      application_id: req.body.application_id
    });
    
    const { token, application_id } = req.body;

    if (!token || !application_id) {
      console.log('❌ Missing required fields for verification');
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_FIELDS',
          message: 'Token and application_id are required'
        }
      });
    }

    if (req.application.application_id !== application_id) {
      console.log('❌ Application mismatch for verification');
      return res.status(403).json({
        success: false,
        error: {
          code: 'APPLICATION_MISMATCH',
          message: 'API key no pertenece a la aplicación solicitada'
        }
      });
    }

    console.log('✅ Verification validation passed');

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      console.log('✅ JWT decoded successfully');
      
      if (decoded.app_id !== application_id) {
        console.log('❌ Token app_id mismatch');
        return res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_TOKEN',
            message: 'Token no válido para esta aplicación'
          }
        });
      }

      // For mock application, return mock user data
      if (application_id === 'app_9c0ffde2-fc7') {
        console.log('🔧 Using mock token verification');
        
        const mockUser = {
          id: decoded.sub,
          email: decoded.email,
          name: decoded.name,
          roles: decoded.roles || ['user'],
          permissions: decoded.permissions || ['read']
        };

        console.log('✅ Mock token verified successfully');
        
        return res.json({
          success: true,
          data: {
            valid: true,
            user: mockUser,
            expires_at: new Date(decoded.exp * 1000).toISOString()
          }
        });
      }

      // Real database lookup
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
        console.log('❌ User not found for token verification');
        return res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_TOKEN',
            message: 'Usuario no encontrado'
          }
        });
      }

      console.log('✅ Token verified successfully');
      
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
      console.log('❌ JWT verification failed:', jwtError.message);
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Token inválido o expirado'
        }
      });
    }

  } catch (error) {
    console.error('❌ Verify token error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: `Error interno del servidor: ${error.message}`
      }
    });
  }
});

// Get users endpoint
app.get('/api/users', validateApiKey, async (req, res) => {
  try {
    console.log('👥 Get users request started');
    console.log('📝 Query params:', req.query);
    
    const { application_id, page = 1, limit = 50, search } = req.query;

    if (!application_id) {
      console.log('❌ Missing application_id for users request');
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_APPLICATION_ID',
          message: 'application_id es requerido'
        }
      });
    }

    if (req.application.application_id !== application_id) {
      console.log('❌ Application mismatch for users request');
      return res.status(403).json({
        success: false,
        error: {
          code: 'APPLICATION_MISMATCH',
          message: 'API key no pertenece a la aplicación solicitada'
        }
      });
    }

    console.log('✅ Users request validation passed');

    // For mock application, return mock users
    if (application_id === 'app_9c0ffde2-fc7') {
      console.log('🔧 Using mock users data');
      
      const mockUsers = [
        {
          id: 'user_123',
          email: 'mariavortiz600@gmail.com',
          name: 'Maria Ortiz',
          status: 'active',
          last_login: new Date().toISOString(),
          created_at: '2024-01-15T10:30:00Z',
          user_roles: [{ role_name: 'admin' }]
        },
        {
          id: 'user_456',
          email: 'test@example.com',
          name: 'Test User',
          status: 'active',
          last_login: null,
          created_at: '2024-02-01T14:20:00Z',
          user_roles: [{ role_name: 'user' }]
        }
      ];

      let filteredUsers = mockUsers;
      if (search) {
        filteredUsers = mockUsers.filter(user => 
          user.name.toLowerCase().includes(search.toLowerCase()) ||
          user.email.toLowerCase().includes(search.toLowerCase())
        );
      }

      console.log('✅ Mock users retrieved:', filteredUsers.length);
      
      return res.json({
        success: true,
        data: {
          users: filteredUsers,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: filteredUsers.length,
            pages: 1
          }
        }
      });
    }
    
    // Real database logic
    const { data: application, error: appError } = await supabase
      .from('applications')
      .select('*')
      .eq('application_id', application_id)
      .single();

    if (appError || !application) {
      console.log('❌ Application not found for users request');
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

    console.log('✅ Users retrieved:', users?.length || 0);
    
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
    console.error('❌ Get users error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: `Error interno del servidor: ${error.message}`
      }
    });
  }
});

// Catch all handler for unmatched routes
app.use('*', (req, res) => {
  console.log('❌ Route not found:', req.method, req.originalUrl || req.url);
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Endpoint no encontrado: ${req.method} ${req.originalUrl || req.url}`
    }
  });
});

// Error handling
app.use((error, req, res, next) => {
  console.error('❌ Unhandled error:', error);
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: `Error interno del servidor: ${error.message}`
    }
  });
});

// Add startup logging
console.log('🚀 Netlify Function initialized');
console.log('📊 Environment check:', {
  hasSupabaseUrl: !!process.env.VITE_SUPABASE_URL,
  hasServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  hasJwtSecret: !!process.env.JWT_SECRET,
  nodeEnv: process.env.NODE_ENV
});

// Export the serverless function with proper configuration
const handler = serverless(app, {
  binary: false,
  request: (request, event, context) => {
    console.log('📥 Incoming request:', {
      method: event.httpMethod,
      path: event.path,
      headers: Object.keys(event.headers || {}),
      hasBody: !!event.body
    });
  },
  response: (response, event, context) => {
    console.log('📤 Outgoing response:', {
      statusCode: response.statusCode,
      hasBody: !!response.body
    });
  }
});

exports.handler = handler;