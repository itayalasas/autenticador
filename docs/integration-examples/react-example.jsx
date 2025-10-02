// Ejemplo completo de integración con React
import React, { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Configuración
const AUTH_CONFIG = {
  APP_ID: 'app_mk2k3j4h5k6l',
  API_KEY: 'ak_development_cd9bac61b17b0a09f307afe54e93d40f',
  AUTH_BASE_URL: 'http://localhost:5173',
  API_BASE_URL: 'http://localhost:3001/api',
  CALLBACK_URL: window.location.origin + '/auth/callback'
};

// Context de autenticación
const AuthContext = createContext();

// Hook para usar autenticación
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }
  return context;
};

// Provider de autenticación
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(null);

  useEffect(() => {
    checkAuthentication();
  }, []);

  const checkAuthentication = () => {
    const authData = getStoredAuthData();
    if (authData && isTokenValid(authData)) {
      setUser(authData.user);
      setToken(authData.access_token);
    }
    setLoading(false);
  };

  const getStoredAuthData = () => {
    try {
      const authData = localStorage.getItem('authData');
      return authData ? JSON.parse(authData) : null;
    } catch (error) {
      return null;
    }
  };

  const isTokenValid = (authData) => {
    if (!authData.expires_at) return false;
    return new Date(authData.expires_at) > new Date();
  };

  const login = () => {
    const loginUrl = `${AUTH_CONFIG.AUTH_BASE_URL}/login?app_id=${AUTH_CONFIG.APP_ID}&callback_url=${encodeURIComponent(AUTH_CONFIG.CALLBACK_URL)}`;
    window.location.href = loginUrl;
  };

  const register = () => {
    const registerUrl = `${AUTH_CONFIG.AUTH_BASE_URL}/register?app_id=${AUTH_CONFIG.APP_ID}&callback_url=${encodeURIComponent(AUTH_CONFIG.CALLBACK_URL)}`;
    window.location.href = registerUrl;
  };

  const logout = () => {
    localStorage.removeItem('authData');
    setUser(null);
    setToken(null);
  };

  const hasPermission = (permission) => {
    return user && user.permissions.includes(permission);
  };

  const hasRole = (role) => {
    return user && user.roles.includes(role);
  };

  const value = {
    user,
    token,
    loading,
    login,
    register,
    logout,
    hasPermission,
    hasRole,
    isAuthenticated: !!user
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Componente de callback
const AuthCallback = () => {
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('Procesando autenticación...');

  useEffect(() => {
    handleCallback();
  }, []);

  const handleCallback = async () => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const token = urlParams.get('token');
      const refreshToken = urlParams.get('refresh_token');
      const userId = urlParams.get('user_id');
      const userEmail = urlParams.get('user_email');
      const userName = urlParams.get('user_name');
      const state = urlParams.get('state');
      const expiresIn = parseInt(urlParams.get('expires_in') || '86400');

      if (state !== 'success' || !token) {
        throw new Error('Autenticación fallida');
      }

      // Validar token con AuthSystem
      const isValid = await validateToken(token);
      if (!isValid) {
        throw new Error('Token inválido');
      }

      // Decodificar JWT
      const userData = parseJWT(token);

      // Guardar datos de autenticación
      const authData = {
        access_token: token,
        refresh_token: refreshToken,
        user: {
          id: userId,
          email: userEmail,
          name: decodeURIComponent(userName || ''),
          roles: userData.roles || [],
          permissions: userData.permissions || [],
          metadata: userData.metadata || {}
        },
        expires_at: new Date(Date.now() + expiresIn * 1000).toISOString()
      };

      localStorage.setItem('authData', JSON.stringify(authData));

      setStatus('success');
      setMessage('¡Autenticación exitosa! Redirigiendo...');

      // Redirigir a la página principal
      setTimeout(() => {
        window.location.href = '/';
      }, 2000);

    } catch (error) {
      console.error('Error en callback:', error);
      setStatus('error');
      setMessage(error.message);
    }
  };

  const validateToken = async (token) => {
    try {
      const response = await fetch(`${AUTH_CONFIG.API_BASE_URL}/auth/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': AUTH_CONFIG.API_KEY
        },
        body: JSON.stringify({
          token: token,
          application_id: AUTH_CONFIG.APP_ID
        })
      });

      const result = await response.json();
      return result.success && result.data?.valid;
    } catch (error) {
      return false;
    }
  };

  const parseJWT = (token) => {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      return JSON.parse(jsonPayload);
    } catch (error) {
      return {};
    }
  };

  return (
    <div style={{ textAlign: 'center', padding: '50px' }}>
      {status === 'loading' && (
        <>
          <div style={{ fontSize: '50px', marginBottom: '20px' }}>⏳</div>
          <h2>Procesando autenticación...</h2>
        </>
      )}
      
      {status === 'success' && (
        <>
          <div style={{ fontSize: '50px', marginBottom: '20px' }}>✅</div>
          <h2>¡Autenticación exitosa!</h2>
          <p>{message}</p>
        </>
      )}
      
      {status === 'error' && (
        <>
          <div style={{ fontSize: '50px', marginBottom: '20px' }}>❌</div>
          <h2>Error de autenticación</h2>
          <p>{message}</p>
          <button onClick={() => window.location.href = '/'}>
            Volver al inicio
          </button>
        </>
      )}
    </div>
  );
};

// Componente de login
const LoginPage = () => {
  const { login, register } = useAuth();

  return (
    <div style={{ textAlign: 'center', padding: '50px' }}>
      <h1>🔐 Mi Aplicación</h1>
      <p>Necesitas autenticarte para continuar</p>
      
      <div style={{ margin: '30px 0' }}>
        <button onClick={login} style={{ margin: '10px' }}>
          🔑 Iniciar Sesión
        </button>
        <button onClick={register} style={{ margin: '10px' }}>
          📝 Registrarse
        </button>
      </div>

      <div className="auth-info">
        <h4>💡 Información de Integración:</h4>
        <p><strong>App ID:</strong> <code>{AUTH_CONFIG.APP_ID}</code></p>
        <p><strong>Callback URL:</strong> <code>{AUTH_CONFIG.CALLBACK_URL}</code></p>
        <p><strong>AuthSystem URL:</strong> <code>{AUTH_CONFIG.AUTH_BASE_URL}</code></p>
      </div>
    </div>
  );
};

// Componente principal protegido
const Dashboard = () => {
  const { user, logout, hasRole, hasPermission } = useAuth();

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <h1>🏠 Dashboard</h1>
        <button onClick={logout}>🚪 Cerrar Sesión</button>
      </div>

      <div className="user-info">
        <h2>👤 Información del Usuario</h2>
        <p><strong>ID:</strong> <code>{user.id}</code></p>
        <p><strong>Nombre:</strong> {user.name}</p>
        <p><strong>Email:</strong> {user.email}</p>
        <p><strong>Roles:</strong> {user.roles.join(', ')}</p>
        <p><strong>Permisos:</strong> {user.permissions.join(', ')}</p>
      </div>

      {/* Contenido basado en roles */}
      {hasRole('admin') && (
        <div className="auth-info">
          <h3>🔧 Panel de Administración</h3>
          <p>Solo visible para administradores</p>
          <button>Gestionar Usuarios</button>
          <button>Configuración</button>
        </div>
      )}

      {hasPermission('write') && (
        <div className="auth-info">
          <h3>✏️ Acciones de Escritura</h3>
          <p>Tienes permisos para modificar datos</p>
          <button>Crear Contenido</button>
          <button>Editar Datos</button>
        </div>
      )}

      <div className="auth-info">
        <h3>🔍 Datos de Sesión</h3>
        <p><strong>Token:</strong> <code>{JSON.parse(localStorage.getItem('authData') || '{}').access_token?.substring(0, 20)}...</code></p>
        <p><strong>Expira:</strong> {new Date(JSON.parse(localStorage.getItem('authData') || '{}').expires_at || '').toLocaleString()}</p>
      </div>
    </div>
  );
};

// Componente de ruta protegida
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <div>Cargando...</div>;
  }

  return isAuthenticated ? children : <Navigate to="/login" />;
};

// Aplicación principal
const App = () => {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />
        </Routes>
      </Router>
    </AuthProvider>
  );
};

export default App;