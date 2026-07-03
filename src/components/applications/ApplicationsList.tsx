import { useState, useEffect } from 'react';
import { Plus, Search, MoreVertical, Users, Globe, Palette, Settings, Trash2, Calendar, Shield, CreditCard as Edit, Copy, ExternalLink, Rocket, Building2 } from 'lucide-react';
import type { Application, EnvironmentUrlsConfig } from '../../types';
import { applicationService } from '../../services/applicationService';
import { userService } from '../../services/userService';
import { useNotification } from '../../hooks/useNotification';
import NotificationModal from '../ui/NotificationModal';
import ConfirmationModal from '../ui/ConfirmationModal';
import CreateApplicationWizard from './CreateApplicationWizard';
import EditApplicationWizard from './EditApplicationWizard';
import TenantsModal from './TenantsModal';

export default function ApplicationsList() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditWizard, setShowEditWizard] = useState(false);
  const [editingApplication, setEditingApplication] = useState<Application | null>(null);
  const [showUsersModal, setShowUsersModal] = useState<string | null>(null);
  const [showTenantsModal, setShowTenantsModal] = useState<Application | null>(null);
  const [modalUsers, setModalUsers] = useState<any[]>([]);
  const [modalUsersLoading, setModalUsersLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState<string | null>(null);
  const [showUrlConfigModal, setShowUrlConfigModal] = useState<string | null>(null);
  const [createLoading, setCreateLoading] = useState(false);
  
  const [urlConfig, setUrlConfig] = useState<EnvironmentUrlsConfig>({
    development: {
      base_url: '',
      callback_url: '',
      mobile_redirect_uris: []
    },
    testing: {
      base_url: '',
      callback_url: '',
      mobile_redirect_uris: []
    },
    production: {
      base_url: '',
      callback_url: '',
      mobile_redirect_uris: []
    }
  });
  
  const {
    notification,
    confirmation,
    showSuccess,
    showError,
    showConfirmation,
    closeNotification,
    closeConfirmation,
    setConfirmationLoading
  } = useNotification();


  useEffect(() => {
    loadApplications();
  }, []);

  const loadApplications = async () => {
    try {
      const apps = await applicationService.getApplications();
      setApplications(apps);
    } catch (error) {
      console.error('Error loading applications:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadModalUsers = async (applicationId: string) => {
    try {
      setModalUsersLoading(true);
      console.log('Loading users for application:', applicationId);
      const users = await userService.getAppUsers(applicationId);
      console.log('Loaded users:', users);
      setModalUsers(users);
    } catch (error) {
      console.error('Error loading users:', error);
      setModalUsers([]);
    } finally {
      setModalUsersLoading(false);
    }
  };

  const handleCreateApp = async (appData: any) => {
    try {
      setCreateLoading(true);
      await applicationService.createApplication(appData);
      setShowCreateModal(false);
      await loadApplications();
      showSuccess(
        'Aplicación creada',
        `La aplicación "${appData.name}" ha sido creada exitosamente.`
      );
    } catch (error) {
      console.error('Error creating application:', error);
      showError(
        'Error al crear aplicación',
        'Ha ocurrido un error al crear la aplicación. Por favor, inténtalo de nuevo.'
      );
    } finally {
      setCreateLoading(false);
    }
  };

  const handleDeleteApp = async (appId: string) => {
    const app = applications.find(a => a.id === appId);
    if (!app) return;
    
    showConfirmation(
      'Eliminar aplicación',
      `¿Estás seguro de que deseas eliminar la aplicación "${app.name}"? Esta acción no se puede deshacer.`,
      async () => {
        try {
          setConfirmationLoading(true);
          await applicationService.deleteApplication(appId);
          await loadApplications();
          closeConfirmation();
          showSuccess(
            'Aplicación eliminada',
            `La aplicación "${app.name}" ha sido eliminada exitosamente.`
          );
        } catch (error) {
          console.error('Error deleting application:', error);
          closeConfirmation();
          showError(
            'Error al eliminar',
            'Ha ocurrido un error al eliminar la aplicación. Por favor, inténtalo de nuevo.'
          );
        }
      },
      { type: 'danger', confirmText: 'Eliminar' }
    );
  };

  const handleBrandingClick = (appId: string) => {
    // Cambiar a la sección de branding y seleccionar la app
    const event = new CustomEvent('changeSectionWithApp', { 
      detail: { section: 'branding', appId } 
    });
    window.dispatchEvent(event);
  };

  const handleSettingsClick = (appId: string) => {
    // Cambiar a la sección de autenticación y seleccionar la app
    const event = new CustomEvent('changeSectionWithApp', {
      detail: { section: 'authentication', appId }
    });
    window.dispatchEvent(event);
  };

  const handleDeploymentsClick = (appId: string) => {
    // Cambiar a la sección de deployments y seleccionar la app
    const event = new CustomEvent('changeSectionWithApp', {
      detail: { section: 'deployments', appId }
    });
    window.dispatchEvent(event);
  };

  const handleEditApp = (app: Application) => {
    setEditingApplication(app);
    setShowEditWizard(true);
  };

  const handleUpdateApp = async (appData: any) => {
    if (!editingApplication) {
      console.warn('⚠️ handleUpdateApp called without editingApplication');
      return;
    }

    console.log('💾 handleUpdateApp called with data:', appData);

    try {
      setCreateLoading(true);

      // Actualizar información básica
      await applicationService.updateApplication(editingApplication.id, {
        name: appData.name,
        description: appData.description,
        domain: appData.domain,
        auth_mode: appData.auth_mode || 'classic',
        metadata: {
          ...editingApplication.metadata,
          environment_urls: appData.environment_urls,
          supported_auth_channels: appData.supported_auth_channels || ['web'],
          auth_channel_config: appData.auth_channel_config || { web: { enabled: true }, mobile: { enabled: false, pkce_required: true, code_challenge_methods: ['S256'] } },
          cors_origins: appData.cors_origins,
          webhook_url: appData.webhook_url,
          enable_email_verification: appData.enable_email_verification,
          allow_public_registration: appData.allow_public_registration
        }
      });

      console.log('✅ Application updated successfully');

      // Solo cerrar si no hubo error
      setShowEditWizard(false);
      setEditingApplication(null);
      await loadApplications();
      showSuccess(
        'Aplicación actualizada',
        'La aplicación ha sido actualizada exitosamente con todas sus configuraciones.'
      );
    } catch (error) {
      console.error('❌ Error updating application:', error);
      showError(
        'Error al actualizar',
        'Ha ocurrido un error al actualizar la aplicación. Por favor, inténtalo de nuevo.'
      );
      // NO cerrar el modal si hay error
    } finally {
      setCreateLoading(false);
    }
  };

  const handleCopyAppId = (appId: string) => {
    navigator.clipboard.writeText(appId);
    showSuccess(
      'ID copiado',
      'El ID de la aplicación ha sido copiado al portapapeles.'
    );
  };

  const handleViewApp = (domain: string) => {
    window.open(`https://${domain}`, '_blank');
  };

  const handleSaveUrlConfig = async () => {
    if (!showUrlConfigModal) return;
    
    try {
      setCreateLoading(true);
      await applicationService.updateApplicationUrls(showUrlConfigModal, urlConfig);
      setShowUrlConfigModal(null);
      await loadApplications();
      showSuccess(
        'URLs actualizadas',
        'La configuración de URLs por ambiente ha sido guardada exitosamente.'
      );
    } catch (error) {
      console.error('Error updating URLs:', error);
      showError(
        'Error al actualizar URLs',
        'Ha ocurrido un error al actualizar la configuración de URLs. Por favor, inténtalo de nuevo.'
      );
    } finally {
      setCreateLoading(false);
    }
  };

  const filteredApps = applications.filter(app =>
    app.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    app.domain.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getEnvironmentColor = (env: string) => {
    switch (env) {
      case 'production': return 'bg-red-100 text-red-800';
      case 'testing': return 'bg-yellow-100 text-yellow-800';
      case 'development': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getEnvironmentIcon = (env: string) => {
    switch (env) {
      case 'production': return '🚀';
      case 'testing': return '🧪';
      case 'development': return '⚡';
      default: return '📦';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Aplicaciones</h2>
          <p className="text-gray-600">Gestiona todas tus aplicaciones registradas</p>
        </div>
        <button 
          onClick={() => setShowCreateModal(true)}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span>Nueva Aplicación</span>
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="relative">
          <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar aplicaciones..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full"
          />
        </div>
      </div>

      {/* Applications Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full flex items-center justify-center h-32">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : filteredApps.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <Globe className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No hay aplicaciones</h3>
            <p className="text-gray-600">Comienza creando tu primera aplicación</p>
          </div>
        ) : (
          filteredApps.map((app) => (
            <div key={app.id} className="bg-white rounded-lg border border-gray-200 hover:shadow-lg transition-shadow">
              <div className="p-6">
                {/* App Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    {app.logo ? (
                      <img src={app.logo} alt={app.name} className="w-12 h-12 rounded-lg" />
                    ) : (
                      <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center text-white font-bold text-xl">
                        {app.name.charAt(0)}
                      </div>
                    )}
                    <div>
                      <h3 className="font-semibold text-gray-900">{app.name}</h3>
                      <p className="text-sm text-gray-600">{app.domain}</p>
                      <div className="mt-1.5">
                        {(app as any).auth_mode === 'tenant' ? (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[11px] font-medium rounded-full border border-emerald-200">
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                            <span>Modo Tenant</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-[11px] font-medium rounded-full border border-blue-200">
                            <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                            <span>Autenticación Clásica</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="relative">
                    <button 
                      onClick={() => setShowDropdown(showDropdown === app.id ? null : app.id)}
                      className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                    >
                      <MoreVertical className="w-5 h-5" />
                    </button>
                    
                    {/* Dropdown Menu */}
                    {showDropdown === app.id && (
                      <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
                        <div className="py-1">
                          <button
                            onClick={() => {
                              handleEditApp(app);
                              setShowDropdown(null);
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                          >
                            <Edit className="w-4 h-4" />
                            <span>Editar aplicación completa</span>
                          </button>
                          <button
                            onClick={() => {
                              handleCopyAppId(app.application_id);
                              setShowDropdown(null);
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                          >
                            <Copy className="w-4 h-4" />
                            <span>Copiar ID</span>
                          </button>
                          <button
                            onClick={() => {
                              handleViewApp(app.domain);
                              setShowDropdown(null);
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                          >
                            <ExternalLink className="w-4 h-4" />
                            <span>Ver aplicación</span>
                          </button>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(`${window.location.origin}/login?app_id=${app.application_id}&env=development`);
                              showSuccess(
                                'URL copiada',
                                'La URL de login ha sido copiada al portapapeles.'
                              );
                              setShowDropdown(null);
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                          >
                            <Shield className="w-4 h-4" />
                            <span>Copiar URL de Login</span>
                          </button>
                          <button
                            onClick={() => {
                              const path = (app as any).auth_mode === 'tenant' ? '/register-tenant' : '/register';
                              navigator.clipboard.writeText(`${window.location.origin}${path}?app_id=${app.application_id}&env=development`);
                              showSuccess(
                                'URL copiada',
                                'La URL de registro ha sido copiada al portapapeles.'
                              );
                              setShowDropdown(null);
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                          >
                            <Users className="w-4 h-4" />
                            <span>Copiar URL de Registro</span>
                          </button>
                          <button
                            onClick={() => {
                              sessionStorage.setItem('selectedAppId', app.id);
                              const event = new CustomEvent('changeSectionWithApp', {
                                detail: { section: 'users', appId: app.id }
                              });
                              window.dispatchEvent(event);
                              setShowDropdown(null);
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                          >
                            <Users className="w-4 h-4" />
                            <span>Ver usuarios ({app.users_count || 0})</span>
                          </button>
                          {(app as any).auth_mode === 'tenant' && (
                            <button
                              onClick={() => {
                                setShowTenantsModal(app);
                                setShowDropdown(null);
                              }}
                              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                            >
                              <Building2 className="w-4 h-4" />
                              <span>Ver empresas</span>
                            </button>
                          )}
                          <button
                            onClick={() => {
                              handleBrandingClick(app.id);
                              setShowDropdown(null);
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                          >
                            <Palette className="w-4 h-4" />
                            <span>Configurar branding</span>
                          </button>
                          <button
                            onClick={() => {
                              handleSettingsClick(app.id);
                              setShowDropdown(null);
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                          >
                            <Settings className="w-4 h-4" />
                            <span>Configuración</span>
                          </button>
                          <button
                            onClick={() => {
                              handleDeploymentsClick(app.id);
                              setShowDropdown(null);
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                          >
                            <Rocket className="w-4 h-4" />
                            <span>Deployments</span>
                          </button>
                          <div className="border-t border-gray-100 my-1"></div>
                          <button
                            onClick={() => {
                              handleDeleteApp(app.id);
                              setShowDropdown(null);
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center space-x-2"
                          >
                            <Trash2 className="w-4 h-4" />
                            <span>Eliminar aplicación</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* App Info */}
                <div className="space-y-3 mb-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">ID de Aplicación</span>
                    <code className="text-sm bg-gray-100 px-2 py-1 rounded font-mono">
                      {app.application_id}
                    </code>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Ambiente</span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getEnvironmentColor(app.environment?.name || 'development')}`}>
                      {getEnvironmentIcon(app.environment?.name || 'development')} {app.environment?.name || 'development'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Usuarios</span>
                    <span className="text-sm font-medium text-gray-900">{app.users_count || 0}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Estado</span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      app.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {app.status === 'active' ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                </div>

                {/* Description */}
                {app.description && (
                  <p className="text-sm text-gray-600 mb-4 line-clamp-2">{app.description}</p>
                )}

                {/* Actions */}
                <div className="flex items-center space-x-2">
                  <button 
                    onClick={() => {
                      setShowUsersModal(app.id);
                      loadModalUsers(app.id);
                    }}
                    className="flex-1 bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center space-x-1"
                  >
                    <Users className="w-4 h-4" />
                    <span>Usuarios</span>
                    <span className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded text-xs font-semibold">
                      {app.users_count || 0}
                    </span>
                  </button>
                  
                  <button 
                    onClick={() => handleBrandingClick(app.id)}
                    className="bg-purple-50 text-purple-600 hover:bg-purple-100 px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-1"
                  >
                    <Palette className="w-4 h-4" />
                    <span>Branding</span>
                  </button>
                  
                  <button 
                    onClick={() => handleSettingsClick(app.id)}
                    className="p-2 bg-gray-50 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Configuración"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                  
                  <button 
                    onClick={() => handleDeleteApp(app.id)}
                    className="p-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                    title="Eliminar aplicación"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Created Date */}
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="flex items-center text-xs text-gray-500">
                    <Calendar className="w-4 h-4 mr-1" />
                    <span>Creado el {new Date(app.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Application Modal */}
      <CreateApplicationWizard
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreateApp}
        loading={createLoading}
      />

      {/* Edit Application Wizard */}
      <EditApplicationWizard
        isOpen={showEditWizard}
        onClose={() => {
          setShowEditWizard(false);
          setEditingApplication(null);
        }}
        onSubmit={handleUpdateApp}
        loading={createLoading}
        application={editingApplication}
      />

      {/* URL Configuration Modal */}
      {showUrlConfigModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
              <Globe className="w-5 h-5 text-blue-600" />
              <span>Configurar URLs por Ambiente</span>
            </h3>
            
            <div className="space-y-6">
              {(['development', 'testing', 'production'] as const).map((env) => (
                <div key={env} className="border border-gray-200 rounded-lg p-4">
                  <h4 className="text-md font-medium text-gray-900 mb-3 capitalize flex items-center space-x-2">
                    <span>{env === 'development' ? '⚡' : env === 'testing' ? '🧪' : '🚀'}</span>
                    <span>{env === 'development' ? 'Desarrollo' : env === 'testing' ? 'Testing' : 'Producción'}</span>
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">URL Base</label>
                      <input
                        type="url"
                        value={urlConfig[env].base_url}
                        onChange={(e) => setUrlConfig(prev => ({
                          ...prev,
                          [env]: {
                            ...prev[env],
                            base_url: e.target.value
                          }
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder={`https://auth-${env}.midominio.com`}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Se generarán automáticamente: /login, /register, /reset-password
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Callback URL</label>
                      <input
                        type="url"
                        value={urlConfig[env].callback_url}
                        onChange={(e) => setUrlConfig(prev => ({
                          ...prev,
                          [env]: {
                            ...prev[env],
                            callback_url: e.target.value
                          }
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder={`https://midominio.com/callback`}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="flex items-center space-x-3 pt-6 border-t border-gray-200">
              <button
                onClick={() => setShowUrlConfigModal(null)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveUrlConfig}
                disabled={createLoading}
                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                {createLoading ? 'Guardando...' : 'Guardar Configuración'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Users Modal */}
      {showUsersModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Usuarios de la Aplicación</h3>
              <button
                onClick={() => setShowUsersModal(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            
            {modalUsersLoading ? (
              <div className="flex items-center justify-center h-32">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : modalUsers.length === 0 ? (
              <div className="text-center py-8">
                <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h4 className="text-lg font-medium text-gray-900 mb-2">No hay usuarios</h4>
                <p className="text-gray-600">Esta aplicación aún no tiene usuarios registrados</p>
              </div>
            ) : (
              <div className="space-y-3">
                {modalUsers.map((user) => (
                  <div key={user.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-medium">
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{user.name}</p>
                        <p className="text-sm text-gray-600">{user.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        user.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {user.status === 'active' ? 'Activo' : 'Inactivo'}
                      </span>
                      <span className="text-xs text-gray-500">
                        {user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Nunca'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Click outside to close dropdown */}
      {showDropdown && (
        <div 
          className="fixed inset-0 z-5" 
          onClick={() => setShowDropdown(null)}
        ></div>
      )}
      
      {showTenantsModal && (
        <TenantsModal
          isOpen={!!showTenantsModal}
          onClose={() => setShowTenantsModal(null)}
          applicationId={showTenantsModal.id}
          applicationName={showTenantsModal.name}
          onShowSuccess={showSuccess}
          onShowError={showError}
          onShowConfirmation={showConfirmation}
          onCloseConfirmation={closeConfirmation}
          setConfirmationLoading={setConfirmationLoading}
        />
      )}

      {/* Notification Modal */}
      <NotificationModal
        notification={notification}
        onClose={closeNotification}
      />
      
      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmation.isOpen}
        onClose={closeConfirmation}
        onConfirm={confirmation.onConfirm || (() => {})}
        title={confirmation.title}
        message={confirmation.message}
        confirmText={confirmation.confirmText}
        cancelText={confirmation.cancelText}
        type={confirmation.type}
        loading={confirmation.loading}
      />
    </div>
  );
}
