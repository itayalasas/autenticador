import React, { createContext, useContext, useEffect, useState } from 'react';
import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';

const APP_ORIGIN = typeof window !== 'undefined' ? window.location.origin : 'https://miapp.com';

const AUTH_CONFIG = {
  APP_ID: 'app_mk2k3j4h5k6l',
  API_KEY: 'tu_api_key_publica',
  AUTH_BASE_URL: 'https://auth.tudominio.com',
  REDIRECT_URI: `${APP_ORIGIN}/auth/callback`
};

const AuthContext = createContext(null);

const isExpired = (expiresAt) => !expiresAt || new Date(expiresAt) <= new Date();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [authData, setAuthData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('authData');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.expires_at && !isExpired(parsed.expires_at)) {
          setAuthData(parsed);
        } else {
          localStorage.removeItem('authData');
        }
      }
    } catch (error) {
      localStorage.removeItem('authData');
    } finally {
      setLoading(false);
    }
  }, []);

  const persistAuthData = (data) => {
    localStorage.setItem('authData', JSON.stringify(data));
    setAuthData(data);
  };

  const login = () => {
    const url =
      `${AUTH_CONFIG.AUTH_BASE_URL}/login?app_id=${AUTH_CONFIG.APP_ID}` +
      `&redirect_uri=${encodeURIComponent(AUTH_CONFIG.REDIRECT_URI)}` +
      `&api_key=${AUTH_CONFIG.API_KEY}`;
    window.location.href = url;
  };

  const register = () => {
    const url =
      `${AUTH_CONFIG.AUTH_BASE_URL}/register?app_id=${AUTH_CONFIG.APP_ID}` +
      `&redirect_uri=${encodeURIComponent(AUTH_CONFIG.REDIRECT_URI)}` +
      `&api_key=${AUTH_CONFIG.API_KEY}`;
    window.location.href = url;
  };

  const logout = () => {
    localStorage.removeItem('authData');
    setAuthData(null);
  };

  const value = {
    authData,
    loading,
    isAuthenticated: !!authData && !isExpired(authData.expires_at),
    login,
    register,
    logout,
    persistAuthData,
    hasRole: (role) => authData?.user?.role === role,
    hasPermission: (menuSlug, action) =>
      Array.isArray(authData?.user?.permissions?.[menuSlug]) &&
      authData.user.permissions[menuSlug].includes(action)
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

const AuthCallback = () => {
  const { persistAuthData } = useAuth();
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('Procesando autenticacion...');

  useEffect(() => {
    void handleCallback();
  }, []);

  const handleCallback = async () => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const state = urlParams.get('state');

      if (state !== 'authenticated' || !code) {
        throw new Error('Callback invalido');
      }

      const response = await fetch(`${AUTH_CONFIG.AUTH_BASE_URL}/functions/v1/auth-exchange-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          code,
          application_id: AUTH_CONFIG.APP_ID
        })
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error?.message || 'No se pudo intercambiar el code');
      }

      const expiresIn = Number(result.data?.expires_in || 86400);
      const authData = {
        access_token: result.data.access_token,
        refresh_token: result.data.refresh_token,
        token_type: result.data.token_type || 'Bearer',
        expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
        user: result.data.user,
        application: result.data.application
      };

      persistAuthData(authData);
      setStatus('success');
      setMessage('Autenticacion exitosa. Redirigiendo...');

      setTimeout(() => {
        window.location.replace('/');
      }, 1200);
    } catch (error) {
      console.error('Error en callback:', error);
      setStatus('error');
      setMessage(error.message);
    }
  };

  return (
    <div style={{ textAlign: 'center', padding: '50px' }}>
      {status === 'loading' && (
        <>
          <div style={{ fontSize: '32px', marginBottom: '20px' }}>[loading]</div>
          <h2>Procesando autenticacion...</h2>
        </>
      )}

      {status === 'success' && (
        <>
          <div style={{ fontSize: '32px', marginBottom: '20px' }}>[ok]</div>
          <h2>Autenticacion exitosa</h2>
          <p>{message}</p>
        </>
      )}

      {status === 'error' && (
        <>
          <div style={{ fontSize: '32px', marginBottom: '20px' }}>[error]</div>
          <h2>Error de autenticacion</h2>
          <p>{message}</p>
          <button onClick={() => window.location.href = '/'}>Volver al inicio</button>
        </>
      )}
    </div>
  );
};

const LoginPage = () => {
  const { login, register } = useAuth();

  return (
    <div style={{ textAlign: 'center', padding: '50px' }}>
      <h1>Mi Aplicacion</h1>
      <p>Necesitas autenticarte para continuar.</p>

      <div style={{ margin: '30px 0' }}>
        <button onClick={login} style={{ margin: '10px' }}>
          Iniciar sesion
        </button>
        <button onClick={register} style={{ margin: '10px' }}>
          Registrarse
        </button>
      </div>

      <div className="auth-info">
        <h4>Informacion de integracion</h4>
        <p><strong>App ID:</strong> <code>{AUTH_CONFIG.APP_ID}</code></p>
        <p><strong>Redirect URI:</strong> <code>{AUTH_CONFIG.REDIRECT_URI}</code></p>
        <p><strong>AuthSystem URL:</strong> <code>{AUTH_CONFIG.AUTH_BASE_URL}</code></p>
      </div>
    </div>
  );
};

const Dashboard = () => {
  const { authData, logout, hasRole, hasPermission } = useAuth();

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <h1>Dashboard</h1>
        <button onClick={logout}>Cerrar sesion</button>
      </div>

      <div className="user-info">
        <h2>Informacion del usuario</h2>
        <p><strong>ID:</strong> <code>{authData?.user?.id}</code></p>
        <p><strong>Nombre:</strong> {authData?.user?.name}</p>
        <p><strong>Email:</strong> {authData?.user?.email}</p>
        <p><strong>Rol:</strong> {authData?.user?.role}</p>
        <p><strong>Aplicacion:</strong> <code>{authData?.application?.id}</code></p>
      </div>

      {hasRole('admin') && (
        <div className="auth-info">
          <h3>Panel de administracion</h3>
          <p>Solo visible para administradores.</p>
          <button>Gestionar usuarios</button>
          <button>Configuracion</button>
        </div>
      )}

      {hasPermission('dashboard', 'read') && (
        <div className="auth-info">
          <h3>Permiso de lectura</h3>
          <p>Tienes acceso al modulo dashboard.</p>
          <button>Ver dashboard</button>
        </div>
      )}

      <div className="auth-info">
        <h3>Datos de sesion</h3>
        <p><strong>Token:</strong> <code>{authData?.access_token?.substring(0, 20)}...</code></p>
        <p><strong>Expira:</strong> {authData?.expires_at ? new Date(authData.expires_at).toLocaleString() : 'N/A'}</p>
        <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(authData?.user?.permissions || {}, null, 2)}</pre>
      </div>
    </div>
  );
};

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <div>Cargando...</div>;
  }

  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

const App = () => {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
        </Routes>
      </Router>
    </AuthProvider>
  );
};

export default App;
