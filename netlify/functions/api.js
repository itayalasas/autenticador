const { createClient } = require('@supabase/supabase-js');

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
};

// Initialize Supabase client
let supabase;
try {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  console.log('🔧 Netlify Function - Environment check:', {
    hasUrl: !!supabaseUrl,
    hasServiceKey: !!supabaseServiceKey,
    nodeEnv: process.env.NODE_ENV,
    netlifyContext: process.env.CONTEXT
  });

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase environment variables');
    console.log('Available env vars:', Object.keys(process.env).filter(key => key.includes('SUPABASE')));
  } else {
    supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    console.log('✅ Supabase client initialized for Netlify');
  }
} catch (error) {
  console.error('❌ Failed to initialize Supabase:', error.message);
}

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-for-development';

// Helper function to generate JWT tokens (simplified for Netlify)
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
    exp: now + (24 * 60 * 60), // 24 hours
    iss: 'AuthSystem',
    aud: application.domain
  };

  const refreshTokenPayload = {
    sub: user.id,
    app_id: applicationId,
    type: 'refresh',
    iat: now,
    exp: now + (30 * 24 * 60 * 60), // 30 days
    iss: 'AuthSystem'
  };

  // Simplified JWT generation for Netlify
  const accessToken = `eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify(accessTokenPayload)).toString('base64')}.signature`;
  const refreshToken = `eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify(refreshTokenPayload)).toString('base64')}.signature`;

  return { accessToken, refreshToken };
};

// Helper function to log auth events
const logAuthEvent = async (applicationId, appUserId, eventType, req, success, errorMessage = null, metadata = {}) => {
  try {
    if (!supabase) return;
    
    await supabase.from('auth_logs').insert({
      application_id: applicationId,
      app_user_id: appUserId,
      event_type: eventType,
      ip_address: req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown',
      user_agent: req.headers['user-agent'] || 'unknown',
      success,
      error_message: errorMessage,
      metadata
    });
  } catch (error) {
    console.error('Error logging auth event:', error);
  }
};

// Main Netlify function handler
exports.handler = async (event, context) => {
  console.log('📥 Netlify Function Called:', {
    httpMethod: event.httpMethod,
    path: event.path,
    hasBody: !!event.body,
    queryParams: event.queryStringParameters,
    headers: Object.keys(event.headers || {})
  });

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }

  try {
    // Check Supabase connection
    if (!supabase) {
      console.error('❌ Supabase not initialized - check environment variables');
      return {
        statusCode: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: {
            code: 'DATABASE_ERROR',
            message: 'Database connection not available. Check environment variables.'
          }
        })
      };
    }

    const path = event.path;
    const method = event.httpMethod;

    console.log(`🔍 Processing: ${method} ${path}`);

    // Health check endpoint
    if (path.endsWith('/health') && method === 'GET') {
      console.log('🏥 Health check endpoint');
      
      // Test Supabase connection
      try {
        const { data, error } = await supabase
          .from('applications')
          .select('id')
          .limit(1);
        
        return {
          statusCode: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: true,
            message: 'AuthSystem API is running on Netlify',
            timestamp: new Date().toISOString(),
            environment: 'netlify',
            database_status: error ? 'error' : 'connected',
            database_error: error?.message || null
          })
        };
      } catch (healthError) {
        return {
          statusCode: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: false,
            error: {
              code: 'HEALTH_CHECK_FAILED',
              message: 'Database health check failed: ' + healthError.message
            }
          })
        };
      }
    }

    // Login endpoint
    if (path.endsWith('/auth/login') && method === 'POST') {
      console.log('🔐 Login endpoint called');
      
      let requestBody;
      try {
        requestBody = event.body ? JSON.parse(event.body) : {};
      } catch (parseError) {
        console.error('❌ Invalid JSON in request body:', parseError);
        return {
          statusCode: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: false,
            error: {
              code: 'INVALID_JSON',
              message: 'Request body must be valid JSON'
            }
          })
        };
      }

      const { email, password, application_id, callback_url } = requestBody;

      console.log('📝 Login request data:', {
        email,
        application_id,
        callback_url,
        hasPassword: !!password
      });

      // Validate required fields
      if (!email || !password || !application_id) {
        console.log('❌ Missing required fields');
        return {
          statusCode: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: false,
            error: {
              code: 'MISSING_FIELDS',
              message: 'Email, password, and application_id are required'
            }
          })
        };
      }

      try {
        // 1. Get application from database
        console.log('🔍 Looking up application:', application_id);
        const { data: application, error: appError } = await supabase
          .from('applications')
          .select('*')
          .eq('application_id', application_id)
          .single();

        if (appError || !application) {
          console.log('❌ Application not found:', appError?.message);
          await logAuthEvent(null, null, 'failed_login', { headers: event.headers }, false, 'Application not found', { application_id });
          
          return {
            statusCode: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              success: false,
              error: {
                code: 'APPLICATION_NOT_FOUND',
                message: 'Aplicación no encontrada'
              }
            })
          };
        }

        console.log('✅ Application found:', {
          id: application.id,
          name: application.name,
          domain: application.domain
        });

        // 2. Get user from database
        console.log('🔍 Looking up user:', email);
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
          await logAuthEvent(application.id, null, 'failed_login', { headers: event.headers }, false, 'User not found', { email });
          
          return {
            statusCode: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              success: false,
              error: {
                code: 'INVALID_CREDENTIALS',
                message: 'Email o contraseña incorrectos'
              }
            })
          };
        }

        console.log('✅ User found:', {
          id: appUser.id,
          email: appUser.email,
          name: appUser.name,
          status: appUser.status,
          hasPasswordHash: !!appUser.password_hash
        });

        // 3. Check if user requires email verification
        if (appUser.status === 'pending') {
          console.log('❌ User email not verified');
          await logAuthEvent(application.id, appUser.id, 'failed_login', { headers: event.headers }, false, 'Email not verified', { email, reason: 'email_not_verified' });

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

          if (callback_url) {
            const verifyParams = new URLSearchParams({
              user_id: appUser.id,
              email: appUser.email,
              state: 'email_verification_required',
              message: 'Debes verificar tu email antes de continuar'
            });
            
            response.error.callback_url = `${callback_url.replace('/callback', '/verify-email')}?${verifyParams.toString()}`;
          }

          return {
            statusCode: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify(response)
          };
        }

        // 4. Verify password
        console.log('🔐 Verifying password');
        let isValidPassword = false;
        
        try {
          // Try base64 comparison first (for compatibility)
          const base64Password = Buffer.from(password).toString('base64');
          isValidPassword = base64Password === appUser.password_hash;
          
          console.log('🔐 Password verification result:', {
            providedPassword: password,
            base64Password: base64Password,
            storedHash: appUser.password_hash ? `${appUser.password_hash.substring(0, 10)}...` : 'null',
            match: isValidPassword
          });
          
          // If base64 doesn't work, try direct comparison (for plain text passwords)
          if (!isValidPassword) {
            isValidPassword = password === appUser.password_hash;
            console.log('🔐 Direct comparison result:', isValidPassword);
          }
          
        } catch (passwordError) {
          console.error('❌ Password verification error:', passwordError);
          isValidPassword = false;
        }

        if (!isValidPassword) {
          console.log('❌ Invalid password');
          await logAuthEvent(application.id, appUser.id, 'failed_login', { headers: event.headers }, false, 'Invalid password', { email });
          
          return {
            statusCode: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              success: false,
              error: {
                code: 'INVALID_CREDENTIALS',
                message: 'Email o contraseña incorrectos'
              }
            })
          };
        }

        // 5. Check if user is active
        if (appUser.status !== 'active') {
          console.log('❌ User not active:', appUser.status);
          await logAuthEvent(application.id, appUser.id, 'failed_login', { headers: event.headers }, false, 'User inactive', { email, status: appUser.status });
          
          return {
            statusCode: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              success: false,
              error: {
                code: 'USER_INACTIVE',
                message: 'Tu cuenta está inactiva. Contacta al administrador.'
              }
            })
          };
        }

        // 6. Generate tokens
        console.log('🎫 Generating tokens');
        const { accessToken, refreshToken } = generateTokens(appUser, application_id, application);

        // 7. Update last login
        try {
          await supabase
            .from('app_users')
            .update({ last_login: new Date().toISOString() })
            .eq('id', appUser.id);
          console.log('✅ Updated last login time');
        } catch (updateError) {
          console.warn('⚠️ Could not update last login:', updateError.message);
        }

        // 8. Log successful login
        await logAuthEvent(application.id, appUser.id, 'login', { headers: event.headers }, true, null, { email, login_method: 'email_password' });

        // 9. Prepare response
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
            callback_url: null
          }
        };

        // 10. Generate callback URL if provided
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
          console.log('🔄 Generated callback URL');
        }

        console.log('✅ Login successful for user:', appUser.email);
        
        return {
          statusCode: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify(response)
        };

      } catch (dbError) {
        console.error('❌ Database error during login:', dbError);
        return {
          statusCode: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: false,
            error: {
              code: 'DATABASE_ERROR',
              message: 'Error de base de datos: ' + dbError.message
            }
          })
        };
      }
    }

    // Register endpoint
    if (path.endsWith('/auth/register') && method === 'POST') {
      console.log('📝 Register endpoint called');
      
      let requestBody;
      try {
        requestBody = event.body ? JSON.parse(event.body) : {};
      } catch (parseError) {
        return {
          statusCode: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: false,
            error: {
              code: 'INVALID_JSON',
              message: 'Request body must be valid JSON'
            }
          })
        };
      }

      const { email, password, name, application_id, callback_url, metadata, role } = requestBody;

      if (!email || !password || !name || !application_id) {
        return {
          statusCode: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: false,
            error: {
              code: 'MISSING_FIELDS',
              message: 'Email, password, name, and application_id are required'
            }
          })
        };
      }

      try {
        // 1. Get application
        const { data: application, error: appError } = await supabase
          .from('applications')
          .select('*')
          .eq('application_id', application_id)
          .single();

        if (appError || !application) {
          return {
            statusCode: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              success: false,
              error: {
                code: 'APPLICATION_NOT_FOUND',
                message: 'Aplicación no encontrada'
              }
            })
          };
        }

        // 2. Check if user already exists
        const { data: existingUser } = await supabase
          .from('app_users')
          .select('id')
          .eq('application_id', application.id)
          .eq('email', email)
          .single();

        if (existingUser) {
          return {
            statusCode: 409,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              success: false,
              error: {
                code: 'EMAIL_ALREADY_EXISTS',
                message: 'Ya existe un usuario con este email'
              }
            })
          };
        }

        // 3. Hash password (simple base64 for now)
        const passwordHash = Buffer.from(password).toString('base64');
        
        // 4. Create user
        const { data: newUser, error: createError } = await supabase
          .from('app_users')
          .insert({
            application_id: application.id,
            email,
            name,
            password_hash: passwordHash,
            status: 'active',
            metadata: metadata || {}
          })
          .select()
          .single();

        if (createError) {
          console.error('❌ Error creating user:', createError);
          return {
            statusCode: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              success: false,
              error: {
                code: 'CREATE_USER_FAILED',
                message: 'Error al crear el usuario'
              }
            })
          };
        }

        // 5. Assign default role
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

        // 6. Log successful registration
        await logAuthEvent(application.id, newUser.id, 'register', { headers: event.headers }, true, null, { email, registration_method: 'email_password' });

        // 7. Generate tokens for auto-login
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
        return {
          statusCode: 201,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify(response)
        };

      } catch (dbError) {
        console.error('❌ Database error during registration:', dbError);
        return {
          statusCode: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: false,
            error: {
              code: 'DATABASE_ERROR',
              message: 'Error de base de datos: ' + dbError.message
            }
          })
        };
      }
    }

    // Reset password endpoint
    if (path.endsWith('/auth/reset-password') && method === 'POST') {
      console.log('🔄 Reset password endpoint called');
      
      let requestBody;
      try {
        requestBody = event.body ? JSON.parse(event.body) : {};
      } catch (parseError) {
        return {
          statusCode: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: false,
            error: {
              code: 'INVALID_JSON',
              message: 'Request body must be valid JSON'
            }
          })
        };
      }

      const { email, application_id, callback_url } = requestBody;

      if (!email || !application_id) {
        return {
          statusCode: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: false,
            error: {
              code: 'MISSING_FIELDS',
              message: 'Email and application_id are required'
            }
          })
        };
      }

      try {
        // Get application
        const { data: application, error: appError } = await supabase
          .from('applications')
          .select('*')
          .eq('application_id', application_id)
          .single();

        if (appError || !application) {
          return {
            statusCode: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              success: false,
              error: {
                code: 'APPLICATION_NOT_FOUND',
                message: 'Aplicación no encontrada'
              }
            })
          };
        }

        // Get user
        const { data: appUser, error: userError } = await supabase
          .from('app_users')
          .select('*')
          .eq('application_id', application.id)
          .eq('email', email)
          .single();

        if (userError || !appUser) {
          await logAuthEvent(application.id, null, 'password_reset', { headers: event.headers }, false, 'User not found', { email, reason: 'user_not_found' });

          return {
            statusCode: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              success: true,
              data: {
                message: 'Si el email existe en nuestro sistema, recibirás un enlace de recuperación.',
                email: email
              }
            })
          };
        }

        // Generate reset token
        const resetToken = `reset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

        // Save reset token
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
          console.error('❌ Error updating user with reset token:', updateError);
          return {
            statusCode: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              success: false,
              error: {
                code: 'INTERNAL_ERROR',
                message: 'Error interno del servidor'
              }
            })
          };
        }

        const resetUrl = callback_url 
          ? `${callback_url.replace('/callback', '/reset-password')}?token=${resetToken}&email=${encodeURIComponent(email)}`
          : `https://${application.domain}/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;

        await logAuthEvent(application.id, appUser.id, 'password_reset', { headers: event.headers }, true, null, { 
          email, 
          reset_token: resetToken,
          expires_at: expiresAt.toISOString(),
          reset_url: resetUrl
        });

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

        return {
          statusCode: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify(response)
        };

      } catch (dbError) {
        console.error('❌ Database error during reset password:', dbError);
        return {
          statusCode: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: false,
            error: {
              code: 'DATABASE_ERROR',
              message: 'Error de base de datos: ' + dbError.message
            }
          })
        };
      }
    }

    // Verify token endpoint
    if (path.endsWith('/auth/verify') && method === 'POST') {
      console.log('🔍 Verify token endpoint called');
      
      let requestBody;
      try {
        requestBody = event.body ? JSON.parse(event.body) : {};
      } catch (parseError) {
        return {
          statusCode: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: false,
            error: {
              code: 'INVALID_JSON',
              message: 'Request body must be valid JSON'
            }
          })
        };
      }

      const { token, application_id } = requestBody;

      if (!token || !application_id) {
        return {
          statusCode: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: false,
            error: {
              code: 'MISSING_FIELDS',
              message: 'Token and application_id are required'
            }
          })
        };
      }

      try {
        // Simple token verification
        const parts = token.split('.');
        if (parts.length !== 3) {
          return {
            statusCode: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              success: false,
              error: {
                code: 'INVALID_TOKEN',
                message: 'Token format invalid'
              }
            })
          };
        }

        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
        
        if (payload.app_id !== application_id) {
          return {
            statusCode: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              success: false,
              error: {
                code: 'INVALID_TOKEN',
                message: 'Token no válido para esta aplicación'
              }
            })
          };
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
          .eq('id', payload.sub)
          .single();

        if (userError || !appUser) {
          return {
            statusCode: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              success: false,
              error: {
                code: 'INVALID_TOKEN',
                message: 'Usuario no encontrado'
              }
            })
          };
        }

        return {
          statusCode: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({
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
              expires_at: new Date(payload.exp * 1000).toISOString()
            }
          })
        };

      } catch (tokenError) {
        console.error('❌ Token verification error:', tokenError);
        return {
          statusCode: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: false,
            error: {
              code: 'INVALID_TOKEN',
              message: 'Token inválido o expirado'
            }
          })
        };
      }
    }

    // Get users endpoint
    if (path.endsWith('/users') && method === 'GET') {
      console.log('👥 Get users endpoint called');
      
      const { application_id, page = 1, limit = 50, search } = event.queryStringParameters || {};

      if (!application_id) {
        return {
          statusCode: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: false,
            error: {
              code: 'MISSING_APPLICATION_ID',
              message: 'application_id es requerido'
            }
          })
        };
      }

      try {
        const { data: application, error: appError } = await supabase
          .from('applications')
          .select('*')
          .eq('application_id', application_id)
          .single();

        if (appError || !application) {
          return {
            statusCode: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              success: false,
              error: {
                code: 'APPLICATION_NOT_FOUND',
                message: 'Aplicación no encontrada'
              }
            })
          };
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

        return {
          statusCode: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({
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
          })
        };

      } catch (dbError) {
        console.error('❌ Database error during get users:', dbError);
        return {
          statusCode: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: false,
            error: {
              code: 'DATABASE_ERROR',
              message: 'Error de base de datos: ' + dbError.message
            }
          })
        };
      }
    }

    // 404 for unknown routes
    console.log('❌ Route not found:', method, path);
    return {
      statusCode: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Endpoint no encontrado: ${method} ${path}`
        }
      })
    };

  } catch (error) {
    console.error('❌ Netlify function error:', error);
    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Error interno del servidor: ' + error.message
        }
      })
    };
  }
};