import React, { useState, useEffect } from 'react';
import { Key, Plus, Copy, Eye, EyeOff, Trash2, Calendar, Shield, AlertTriangle, Crown } from 'lucide-react';
import { ApiKey } from '../../types';
import { applicationService } from '../../services/applicationService';
import { subscriptionService } from '../../services/subscriptionService';
import { supabase } from '../../lib/supabase';
import { useNotification } from '../../hooks/useNotification';
import SubscriptionGuard from '../subscription/SubscriptionGuard';
import NotificationModal from '../ui/NotificationModal';

export default function ApiKeysManager() {
  const [applications, setApplications] = useState<any[]>([]);
  const [selectedApp, setSelectedApp] = useState('');
  const [currentEnvironment, setCurrentEnvironment] = useState('development');
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState<string | null>(null);
  const [createLoading, setCreateLoading] = useState(false);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());

  const {
    notification,
    showSuccess,
    showError,
    closeNotification
  } = useNotification();
  const [newApiKey, setNewApiKey] = useState({
    name: '',
    permissions: ['read'],
    expires_at: ''
  });

  // Mock API keys data
  const mockApiKeys: ApiKey[] = [
    {
      id: '1',
      name: 'Frontend App',
      key: 'ak_live_1234567890abcdef1234567890abcdef',
      key_preview: 'ak_live_...abcdef',
      application_id: selectedApp,
      permissions: ['read', 'write'],
      created_at: '2024-01-15T10:30:00Z',
      last_used: '2024-02-20T09:15:00Z',
      is_active: true
    },
    {
      id: '2',
      name: 'Mobile App',
      key: 'ak_live_abcdef1234567890abcdef1234567890',
      key_preview: 'ak_live_...567890',
      application_id: selectedApp,
      permissions: ['read'],
      created_at: '2024-02-01T14:20:00Z',
      last_used: '2024-02-19T16:45:00Z',
      is_active: true
    },
    {
      id: '3',
      name: 'Analytics Service',
      key: 'ak_live_fedcba0987654321fedcba0987654321',
      key_preview: 'ak_live_...654321',
      application_id: selectedApp,
      permissions: ['read'],
      created_at: '2024-01-20T11:15:00Z',
      last_used: null,
      is_active: false
    }
  ];

  useEffect(() => {
    loadApplications();
  }, []);

  useEffect(() => {
    if (selectedApp) {
      loadApiKeys();
    }
  }, [selectedApp]);

  const loadApplications = async () => {
    try {
      const apps = await applicationService.getApplications();
      setApplications(apps);
      if (apps.length > 0) {
        setSelectedApp(apps[0].id);
      }
    } catch (error) {
      console.error('Error loading applications:', error);
    }
  };

  const loadApiKeys = async () => {
    try {
      setLoading(true);
      
      // Cargar API keys reales de la base de datos
      const { data: apiKeysData, error } = await supabase
        .from('api_keys')
        .select('*')
        .eq('application_id', selectedApp)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      // Convertir a formato esperado
      const formattedKeys: ApiKey[] = (apiKeysData || []).map(key => ({
        id: key.id,
        name: key.name,
        key: key.key_hash, // La key completa solo se muestra una vez
        key_preview: key.key_preview,
        application_id: key.application_id,
        permissions: key.permissions || [],
        created_at: key.created_at,
        last_used: key.last_used,
        is_active: key.is_active,
        expires_at: key.expires_at
      }));

      setApiKeys(formattedKeys);
    } catch (error) {
      console.error('Error loading API keys:', error);
      setApiKeys([]);
    } finally {
      setLoading(false);
    }
  };

  const generateApiKey = () => {
    const chars = 'abcdef0123456789';
    let result = `ak_${currentEnvironment}_`;
    for (let i = 0; i < 32; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const handleCreateApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setCreateLoading(true);
      
      const newKey = generateApiKey();
      const keyPreview = `${newKey.substring(0, 12)}...${newKey.substring(newKey.length - 6)}`;
      
      // Crear API key en la base de datos
      const { data: apiKeyData, error: apiKeyError } = await supabase
        .from('api_keys')
        .insert({
          application_id: selectedApp,
          name: newApiKey.name,
          key_hash: newKey, // Guardamos la key completa para validación
          key_preview: keyPreview,
          permissions: newApiKey.permissions,
          is_active: true,
          expires_at: newApiKey.expires_at || null
        })
        .select()
        .single();

      if (apiKeyError) {
        throw apiKeyError;
      }

      const apiKey: ApiKey = {
        id: apiKeyData.id,
        name: newApiKey.name,
        key: newKey,
        key_preview: keyPreview,
        application_id: selectedApp,
        permissions: newApiKey.permissions,
        created_at: apiKeyData.created_at,
        last_used: null,
        is_active: true,
        expires_at: apiKeyData.expires_at
      };

      setApiKeys(prev => [apiKey, ...prev]);
      setShowKeyModal(apiKey.id);
      setShowCreateModal(false);
      setNewApiKey({ name: '', permissions: ['read'], expires_at: '' });
    } catch (error) {
      console.error('Error creating API key:', error);
      showError(
        'Error al crear API Key',
        'Ha ocurrido un error al crear la API key. Por favor, inténtalo de nuevo.'
      );
    } finally {
      setCreateLoading(false);
    }
  };

  const handleDeleteApiKey = (keyId: string) => {
    if (confirm('¿Estás seguro de que deseas eliminar esta API key?')) {
      deleteApiKey(keyId);
    }
  };

  const deleteApiKey = async (keyId: string) => {
    try {
      const { error } = await supabase
        .from('api_keys')
        .delete()
        .eq('id', keyId);

      if (error) {
        throw error;
      }

      setApiKeys(prev => prev.filter(key => key.id !== keyId));
      showSuccess(
        'API Key eliminada',
        'La API key ha sido eliminada exitosamente.'
      );
    } catch (error) {
      console.error('Error deleting API key:', error);
      showError(
        'Error al eliminar',
        'Ha ocurrido un error al eliminar la API key.'
      );
    }
  };

  const toggleKeyVisibility = (keyId: string) => {
    setVisibleKeys(prev => {
      const newSet = new Set(prev);
      if (newSet.has(keyId)) {
        newSet.delete(keyId);
      } else {
        newSet.add(keyId);
      }
      return newSet;
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('API key copiada al portapapeles');
  };

  const getPermissionColor = (permission: string) => {
    switch (permission) {
      case 'read': return 'bg-blue-100 text-blue-800';
      case 'write': return 'bg-green-100 text-green-800';
      case 'delete': return 'bg-red-100 text-red-800';
      case 'admin': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">API Keys</h2>
          <p className="text-gray-600">Administra claves de API para integración externa</p>
        </div>
        <button 
          onClick={() => setShowCreateModal(true)}
          disabled={!selectedApp}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors disabled:opacity-50"
        >
          <Plus className="w-5 h-5" />
          <span>Nueva API Key</span>
        </button>
      </div>

      {/* Application Selector */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Seleccionar Aplicación</h3>
            <select 
              value={selectedApp}
              onChange={(e) => setSelectedApp(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Selecciona una aplicación</option>
              {applications.map((app) => (
                <option key={app.id} value={app.id}>
                  {app.name} ({app.domain})
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Ambiente</h3>
            <select 
              value={currentEnvironment}
              onChange={(e) => setCurrentEnvironment(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="development">⚡ Development</option>
              <option value="testing">🧪 Testing</option>
              <option value="production">🚀 Production</option>
            </select>
            
            {currentEnvironment === 'production' && (
              <SubscriptionGuard 
                feature="production_api_keys"
                fallback={
                  <div className="mt-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Crown className="w-5 h-5 text-purple-600" />
                      <div>
                        <h4 className="font-medium text-purple-900">Plan Profesional Requerido</h4>
                        <p className="text-sm text-purple-800 mt-1">
                          Las API Keys de producción están disponibles en el plan Profesional y superiores.
                        </p>
                      </div>
                    </div>
                  </div>
                }
                showUpgradePrompt={true}
              >
                <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <Shield className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-medium text-green-900">
                      Ambiente de producción habilitado
                    </span>
                  </div>
                </div>
              </SubscriptionGuard>
            )}
          </div>
        </div>
      </div>

      {selectedApp && (
        <>
          {/* Security Notice */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <Shield className="w-5 h-5 text-yellow-600 mt-0.5" />
              <div>
                <h3 className="font-medium text-yellow-900">Importante: Seguridad de API Keys</h3>
                <p className="text-sm text-yellow-800 mt-1">
                  • Nunca compartas tus API keys públicamente
                  • Usa diferentes keys para diferentes ambientes
                  • Revoca keys comprometidas inmediatamente
                  • Configura permisos mínimos necesarios
                </p>
              </div>
            </div>
          </div>

          {/* API Keys List */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
                <Key className="w-5 h-5" />
                <span>API Keys ({apiKeys.length})</span>
              </h3>
            </div>

            {loading ? (
              <div className="flex items-center justify-center h-32">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : apiKeys.length === 0 ? (
              <div className="text-center py-12">
                <Key className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No hay API keys</h3>
                <p className="text-gray-600">Crea tu primera API key para comenzar la integración</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {apiKeys.map((apiKey) => (
                  <div key={apiKey.id} className="p-6 hover:bg-gray-50">
                    {currentEnvironment === 'production' ? (
                      <SubscriptionGuard feature="production_api_keys">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3 mb-2">
                              <h4 className="text-lg font-medium text-gray-900">{apiKey.name}</h4>
                              <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                apiKey.is_active 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-red-100 text-red-800'
                              }`}>
                                {apiKey.is_active ? 'Activa' : 'Inactiva'}
                              </span>
                            </div>

                            {/* API Key Display */}
                            <div className="bg-gray-50 rounded-lg p-3 mb-3">
                              <div className="flex items-center justify-between">
                                <code className="text-sm font-mono text-gray-900">
                                  {visibleKeys.has(apiKey.id) ? apiKey.key : apiKey.key_preview}
                                </code>
                                <div className="flex items-center space-x-2">
                                  <button
                                    onClick={() => toggleKeyVisibility(apiKey.id)}
                                    className="text-gray-400 hover:text-gray-600"
                                  >
                                    {visibleKeys.has(apiKey.id) ? 
                                      <EyeOff className="w-4 h-4" /> : 
                                      <Eye className="w-4 h-4" />
                                    }
                                  </button>
                                  <button
                                    onClick={() => copyToClipboard(apiKey.key)}
                                    className="text-gray-400 hover:text-gray-600"
                                  >
                                    <Copy className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            </div>

                            {/* Permissions */}
                            <div className="flex flex-wrap gap-2 mb-3">
                              {apiKey.permissions.map((permission) => (
                                <span
                                  key={permission}
                                  className={`px-2 py-1 text-xs font-medium rounded-full ${getPermissionColor(permission)}`}
                                >
                                  {permission}
                                </span>
                              ))}
                            </div>

                            {/* Metadata */}
                            <div className="flex items-center space-x-4 text-sm text-gray-500">
                              <div className="flex items-center space-x-1">
                                <Calendar className="w-4 h-4" />
                                <span>Creada: {new Date(apiKey.created_at).toLocaleDateString()}</span>
                              </div>
                              {apiKey.last_used && (
                                <div className="flex items-center space-x-1">
                                  <span>Último uso: {new Date(apiKey.last_used).toLocaleDateString()}</span>
                                </div>
                              )}
                              {apiKey.expires_at && (
                                <div className="flex items-center space-x-1">
                                  <AlertTriangle className="w-4 h-4 text-yellow-500" />
                                  <span>Expira: {new Date(apiKey.expires_at).toLocaleDateString()}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center space-x-2 ml-4">
                            <button
                              onClick={() => handleDeleteApiKey(apiKey.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </SubscriptionGuard>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <h4 className="text-lg font-medium text-gray-900">{apiKey.name}</h4>
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                              apiKey.is_active 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {apiKey.is_active ? 'Activa' : 'Inactiva'}
                            </span>
                          </div>

                          {/* API Key Display */}
                          <div className="bg-gray-50 rounded-lg p-3 mb-3">
                            <div className="flex items-center justify-between">
                              <code className="text-sm font-mono text-gray-900">
                                {visibleKeys.has(apiKey.id) ? apiKey.key : apiKey.key_preview}
                              </code>
                              <div className="flex items-center space-x-2">
                                <button
                                  onClick={() => toggleKeyVisibility(apiKey.id)}
                                  className="text-gray-400 hover:text-gray-600"
                                >
                                  {visibleKeys.has(apiKey.id) ? 
                                    <EyeOff className="w-4 h-4" /> : 
                                    <Eye className="w-4 h-4" />
                                  }
                                </button>
                                <button
                                  onClick={() => copyToClipboard(apiKey.key)}
                                  className="text-gray-400 hover:text-gray-600"
                                >
                                  <Copy className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Permissions */}
                          <div className="flex flex-wrap gap-2 mb-3">
                            {apiKey.permissions.map((permission) => (
                              <span
                                key={permission}
                                className={`px-2 py-1 text-xs font-medium rounded-full ${getPermissionColor(permission)}`}
                              >
                                {permission}
                              </span>
                            ))}
                          </div>

                          {/* Metadata */}
                          <div className="flex items-center space-x-4 text-sm text-gray-500">
                            <div className="flex items-center space-x-1">
                              <Calendar className="w-4 h-4" />
                              <span>Creada: {new Date(apiKey.created_at).toLocaleDateString()}</span>
                            </div>
                            {apiKey.last_used && (
                              <div className="flex items-center space-x-1">
                                <span>Último uso: {new Date(apiKey.last_used).toLocaleDateString()}</span>
                              </div>
                            )}
                            {apiKey.expires_at && (
                              <div className="flex items-center space-x-1">
                                <AlertTriangle className="w-4 h-4 text-yellow-500" />
                                <span>Expira: {new Date(apiKey.expires_at).toLocaleDateString()}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center space-x-2 ml-4">
                          <button
                            onClick={() => handleDeleteApiKey(apiKey.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Production Environment Guard */}
          {currentEnvironment === 'production' && (
            <div className="mt-4">
              {subscriptionService.canAccessEnvironment('production') ? (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <Shield className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-medium text-green-900">
                      Ambiente de producción habilitado
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Crown className="w-5 h-5 text-purple-600" />
                      <div>
                        <h4 className="font-medium text-purple-900">Plan Profesional Requerido</h4>
                        <p className="text-sm text-purple-800 mt-1">
                          Las API Keys de producción requieren suscripción al plan Profesional ($29/mes).
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        // Redirigir a DLocal para suscripción
                        const dLocalUrl = 'https://checkout-sbx.dlocalgo.com/validate/subscription/Dktil5kCQtirHXx1PXWr02JXdPoEzxJU';
                        
                        localStorage.setItem('pending_subscription', JSON.stringify({
                          plan_name: 'Profesional',
                          user_id: currentUser?.id,
                          timestamp: Date.now(),
                          return_to: 'api-keys'
                        }));
                        
                        window.open(dLocalUrl, '_blank', 'width=800,height=600,scrollbars=yes,resizable=yes');
                      }}
                      className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                    >
                      Suscribirse
                    </button>
                    <button
                      onClick={() => {
                        // Redirigir a DLocal para plan empresarial
                        const dLocalUrl = 'https://checkout-sbx.dlocalgo.com/validate/subscription/pHmMNr9nB6jqz9kHnD77MGYK2mtC6YB1';
                        
                        localStorage.setItem('pending_subscription', JSON.stringify({
                          plan_name: 'Empresarial',
                          user_id: currentUser?.id,
                          timestamp: Date.now(),
                          return_to: 'api-keys'
                        }));
                        
                        window.open(dLocalUrl, '_blank', 'width=800,height=600,scrollbars=yes,resizable=yes');
                      }}
                      className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors ml-2"
                    >
                      Plan Empresarial
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Notification Modal */}
      <NotificationModal
        notification={notification}
        onClose={closeNotification}
      />
    </div>
  );
}