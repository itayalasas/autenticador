import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, useSearchParams, useParams } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import AuthPage from './components/auth/AuthPage';
import PublicAuthRouter from './components/auth/PublicAuthRouter';
import ResetPasswordForm from './components/auth/ResetPasswordForm';
import VerifyEmailForm from './components/auth/VerifyEmailForm';
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';
import DashboardOverview from './components/dashboard/DashboardOverview';
import ApplicationsList from './components/applications/ApplicationsList';
import ApiDocumentation from './components/documentation/ApiDocumentation';
import BrandingManager from './components/branding/BrandingManager';
import UsersManager from './components/users/UsersManager';
import EnvironmentsManager from './components/environments/EnvironmentsManager';
import ApiKeysManager from './components/apikeys/ApiKeysManager';
import RolesManager from './components/roles/RolesManager';
import AuthenticationSettings from './components/authentication/AuthenticationSettings';
import SettingsPage from './components/settings/SettingsPage';
import LogsViewer from './components/activity/LogsViewer';
import ConnectorsPage from './components/connectors/ConnectorsPage';
import GitHubCallback from './components/github/GitHubCallback';
import DeploymentManager from './components/deployments/DeploymentManager';
import FormStylesPrototype from './components/auth/FormStylesPrototype';
import RegisterTenantForm from './components/auth/RegisterTenantForm';

// Component for handling public auth routes
function PublicAuthRoute() {
  const { action } = useParams<{ action: string }>();
  const [searchParams] = useSearchParams();
  
  const appId = searchParams.get('app_id');
  
  if (!appId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Error</h1>
          <p className="text-gray-600">app_id parameter is required</p>
        </div>
      </div>
    );
  }
  
  // Map auth actions to form types
  const actionTypeMap: Record<string, string> = {
    'login': 'login',
    'register': 'register',
    'reset-password': 'reset-password',
    'reset-password-confirm': 'reset-password-confirm',
    'verify-email': 'verify-email'
  };
  
  const formType = actionTypeMap[action || 'login'] || 'login';
  
  return (
    <PublicAuthRouter
      appId={appId}
      formType={formType as 'login' | 'register' | 'reset-password' | 'reset-password-confirm'}
    />
  );
}

function MainApp() {
  const { user, loading } = useAuth();
  const [activeSection, setActiveSection] = useState('dashboard');
  const [currentEnvironment, setCurrentEnvironment] = useState('development');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // Check if we're in public auth mode
  const appId = searchParams.get('app_id');
  const formType = searchParams.get('form') || 'login';
  const isPublicAuth = !!appId;

  // Escuchar eventos de cambio de sección desde otros componentes
  useEffect(() => {
    const handleSectionChange = (event: CustomEvent) => {
      const { section, appId } = event.detail;
      setActiveSection(section);
      
      // Guardar el appId seleccionado para que los componentes lo usen
      if (appId) {
        sessionStorage.setItem('selectedAppId', appId);
      }
    };

    window.addEventListener('changeSectionWithApp', handleSectionChange as EventListener);
    
    return () => {
      window.removeEventListener('changeSectionWithApp', handleSectionChange as EventListener);
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Show public auth forms if app_id parameter is present
  if (isPublicAuth) {
    return (
      <PublicAuthRouter
        appId={appId}
        formType={formType as 'login' | 'register' | 'reset-password' | 'reset-password-confirm'}
      />
    );
  }

  // Show login page if not authenticated and not on public route
  if (!user) {
    return <AuthPage onAuthSuccess={() => {}} />;
  }

  const getSectionTitle = (section: string) => {
    switch (section) {
      case 'dashboard': return 'Dashboard';
      case 'applications': return 'Aplicaciones';
      case 'users': return 'Gestión de Usuarios';
      case 'roles': return 'Roles y Permisos';
      case 'authentication': return 'Autenticación';
      case 'branding': return 'Gestión de Branding';
      case 'environments': return 'Ambientes';
      case 'connectors': return 'Conectores';
      case 'deployments': return 'Deployments';
      case 'api-keys': return 'API Keys';
      case 'logs': return 'Logs de Actividad';
      case 'documentation': return 'Documentación';
      case 'settings': return 'Configuración';
      default: return 'Dashboard';
    }
  };

  const getSectionSubtitle = (section: string) => {
    switch (section) {
      case 'dashboard': return 'Vista general de tu sistema de autenticación';
      case 'applications': return 'Gestiona todas tus aplicaciones registradas';
      case 'users': return 'Administra usuarios y permisos por aplicación';
      case 'roles': return 'Configura roles y permisos personalizados';
      case 'authentication': return 'Configura métodos de autenticación';
      case 'branding': return 'Personaliza la apariencia de tus formularios';
      case 'environments': return 'Gestiona ambientes de desarrollo, testing y producción';
      case 'connectors': return 'Configura integraciones con GitHub, Netlify y más';
      case 'deployments': return 'Gestiona deployments y rollbacks de tus aplicaciones';
      case 'api-keys': return 'Administra claves de API para integración';
      case 'logs': return 'Monitorea actividad y eventos del sistema';
      case 'documentation': return 'Guías y referencias de API';
      case 'settings': return 'Configuración general del sistema';
      default: return '';
    }
  };

  const renderContent = () => {
    switch (activeSection) {
      case 'dashboard':
        return <DashboardOverview />;
      case 'applications':
        return <ApplicationsList />;
      case 'users':
        return <UsersManager />;
      case 'roles':
        return <RolesManager />;
      case 'authentication':
        return <AuthenticationSettings />;
      case 'branding':
        return <BrandingManager />;
      case 'environments':
        return <EnvironmentsManager />;
      case 'connectors':
        return <ConnectorsPage />;
      case 'deployments':
        // Get selected application from session storage or URL
        const selectedAppId = sessionStorage.getItem('selectedAppId');
        return <DeploymentManager applicationId={selectedAppId || undefined} />;
      case 'api-keys':
        return <ApiKeysManager />;
      case 'logs':
        return <LogsViewer />;
      case 'documentation':
        return <ApiDocumentation />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <DashboardOverview />;
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <Sidebar
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          title={getSectionTitle(activeSection)}
          subtitle={getSectionSubtitle(activeSection)}
          onMenuClick={() => setSidebarOpen(true)}
        />
        
        <main className="flex-1 overflow-y-auto p-6">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/prototype" element={<FormStylesPrototype />} />
        <Route path="/reset-password" element={<ResetPasswordForm />} />
        <Route path="/reset-password-confirm" element={<ResetPasswordForm />} />
        <Route path="/register-tenant" element={<RegisterTenantForm />} />
        <Route path="/verify-email" element={<VerifyEmailForm />} />
        <Route path="/github/callback" element={<GitHubCallback />} />
        <Route path="/:action" element={<PublicAuthRoute />} />
        <Route path="/*" element={<MainApp />} />
      </Routes>
    </Router>
  );
}

export default App;