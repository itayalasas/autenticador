import React, { useState, useEffect, useRef } from 'react';
import { Database, Globe, Play, Settings, Trash2, Plus, CheckCircle, AlertTriangle, Terminal, X, RotateCcw, ExternalLink, Eye } from 'lucide-react';
import { applicationService } from '../../services/applicationService';
import { supabase } from '../../lib/supabase';

interface Environment {
  id: string;
  name: 'development' | 'testing' | 'production';
  domain: string;
  is_active: boolean;
  auth_url?: string;
  callback_url?: string;
  created_at: string;
  metadata?: {
    generated_urls?: {
      login: string;
      register: string;
      reset_password: string;
      callback: string;
      api_base: string;
    };
    api_key?: string;
    deployment_status?: 'deployed' | 'testing' | 'ready';
    test_results?: Record<string, any>;
    [key: string]: any;
  };
}

interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'success' | 'warning' | 'error';
  message: string;
}

export default function EnvironmentsManager() {
  const [applications, setApplications] = useState<any[]>([]);
  const [selectedApp, setSelectedApp] = useState('');
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [loading, setLoading] = useState(false);
  const [deployLoading, setDeployLoading] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showConsole, setShowConsole] = useState(false);
  const [showUrlsModal, setShowUrlsModal] = useState<string | null>(null);
  const [consoleLogs, setConsoleLogs] = useState<LogEntry[]>([]);
  const [isDeploying, setIsDeploying] = useState(false);
  const consoleRef = useRef<HTMLDivElement>(null);
  
  const [newEnvironment, setNewEnvironment] = useState({
    name: 'development' as 'development' | 'testing' | 'production',
    domain: '',
    base_url: '',
    callback_url: ''
  });

  useEffect(() => {
    loadApplications();
  }, []);

  useEffect(() => {
    if (selectedApp) {
      loadEnvironments();
    }
  }, [selectedApp]);

  // Auto-scroll console to bottom
  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [consoleLogs]);

  const addLog = (message: string, level: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    const newLog: LogEntry = {
      id: Date.now().toString(),
      timestamp: new Date().toLocaleTimeString(),
      level,
      message
    };
    setConsoleLogs(prev => [...prev, newLog]);
  };

  const clearLogs = () => {
    setConsoleLogs([]);
  };

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

  const loadEnvironments = async () => {
    try {
      setLoading(true);
      const envs = await applicationService.getEnvironments(selectedApp);
      setEnvironments(envs);
    } catch (error) {
      console.error('Error loading environments:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateApiKey = (environment: string) => {
    const chars = 'abcdef0123456789';
    let result = `ak_development_`;
    for (let i = 0; i < 32; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const handleCreateEnvironment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await applicationService.createEnvironment({
        application_id: selectedApp,
        name: newEnvironment.name,
        domain: newEnvironment.domain,
        base_url: newEnvironment.base_url,
        callback_url: newEnvironment.callback_url
      });
      setShowCreateModal(false);
      setNewEnvironment({
        name: 'development',
        domain: '',
        base_url: '',
        callback_url: ''
      });
      await loadEnvironments();
    } catch (error) {
      console.error('Error creating environment:', error);
    }
  };

  const handleDeploy = async (environmentId: string, environmentName: string) => {
    try {
      setDeployLoading(environmentId);
      setIsDeploying(true);
      setShowConsole(true);
      clearLogs();

      addLog(`🚀 Starting deployment for ${environmentName} environment`, 'info');
      
      // Get selected application data
      const selectedApplication = applications.find(app => app.id === selectedApp);
      if (!selectedApplication) {
        addLog('❌ No application selected', 'error');
        return;
      }

      const applicationId = selectedApplication.application_id;
      addLog(`📱 Application ID: ${applicationId}`, 'info');

      // Get environment configuration
      const environment = environments.find(env => env.id === environmentId);
      if (!environment) {
        addLog('❌ Environment not found', 'error');
        return;
      }

      // Get base URL from application metadata or environment
      const envUrls = selectedApplication.metadata?.environment_urls || {};
      const envConfig = envUrls[environmentName];
      const baseUrl = envConfig?.base_url || environment.auth_url || `https://auth-${environmentName}.${selectedApplication.domain}`;
      const callbackUrl = envConfig?.callback_url || environment.callback_url || `https://${selectedApplication.domain}/auth/callback`;

      addLog(`🌐 Base URL: ${baseUrl}`, 'info');
      addLog(`🔄 Callback URL: ${callbackUrl}`, 'info');

      // Generate API key for this environment
      const apiKey = generateApiKey(environmentName);
      addLog(`🔑 Generated API Key: ${apiKey}`, 'info');

      // Generate URLs for forms and API
      const webContainerBaseUrl = 'http://localhost:5173';
      const apiBaseUrl = 'http://localhost:3001';
      const generatedUrls = {
        api_base: `${apiBaseUrl}/api`, 
        login: `${webContainerBaseUrl}/login?app_id=${applicationId}&api_key=${apiKey}`,
        register: `${webContainerBaseUrl}/register?app_id=${applicationId}&api_key=${apiKey}`,
        reset_password: `${webContainerBaseUrl}/reset-password?app_id=${applicationId}&api_key=${apiKey}`,
        callback: callbackUrl
      };

      addLog('📋 Generated URLs:', 'info');
      Object.entries(generatedUrls).forEach(([key, url]) => {
        addLog(`   ${key}: ${url}`, 'info');
      });

      // Save API key to database
      addLog('💾 Saving API key to database...', 'info');
      try {
        const { data: apiKeyData, error: apiKeyError } = await supabase
          .from('api_keys')
          .insert({
            application_id: selectedApp,
            name: `${environmentName.charAt(0).toUpperCase() + environmentName.slice(1)} Environment Key`,
            key_hash: apiKey,
            key_preview: `${apiKey.substring(0, 12)}...${apiKey.substring(apiKey.length - 6)}`,
            permissions: ['read', 'write'],
            is_active: true
          })
          .select()
          .single();

        if (apiKeyError) {
          addLog(`⚠️ Warning: Could not save API key: ${apiKeyError.message}`, 'warning');
        } else {
          addLog('✅ API key saved successfully', 'success');
        }
      } catch (error) {
        addLog(`⚠️ Warning: Could not save API key: ${error.message}`, 'warning');
      }

      // Test API endpoints
      addLog('🧪 Testing API endpoints...', 'info');
      const testResults = await testAllEndpoints(apiBaseUrl, applicationId, apiKey);

      // Update environment with generated URLs and test results
      addLog('💾 Updating environment configuration...', 'info');
      try {
        await applicationService.updateEnvironment(environmentId, {
          auth_url: baseUrl,
          callback_url: callbackUrl,
          metadata: {
            ...environment.metadata,
            generated_urls: generatedUrls,
            api_key: apiKey,
            deployment_status: 'deployed',
            test_results: testResults,
            deployed_at: new Date().toISOString()
          }
        });
        addLog('✅ Environment updated successfully', 'success');
        
        // Reload environments to show updated data
        await loadEnvironments();
      } catch (updateError) {
        addLog(`⚠️ Warning: Could not update environment: ${updateError.message}`, 'warning');
      }

      // Show test results summary
      addLog('📊 API Test Results:', 'info');
      Object.entries(testResults).forEach(([endpoint, result]) => {
        const status = result.success ? '✅' : '❌';
        const time = result.responseTime ? `(${result.responseTime}ms)` : '';
        addLog(`   ${status} ${endpoint}: ${result.status} ${time}`, result.success ? 'success' : 'error');
      });

      const allTestsPassed = Object.values(testResults).every(result => result.success);
      
      if (allTestsPassed) {
        addLog(`🎉 Deployment completed successfully for ${environmentName}!`, 'success');
        addLog(`🌍 Environment is ready for integration`, 'success');
      } else {
        addLog(`⚠️ Deployment completed with some test failures`, 'warning');
        addLog(`🔧 Check the test results and fix any issues`, 'warning');
      }

    } catch (error) {
      console.error('Deploy error:', error);
      addLog(`❌ Deployment failed: ${error.message || 'Unknown error'}`, 'error');
    } finally {
      setDeployLoading(null);
      setIsDeploying(false);
    }
  };

  // Test all API endpoints
  const testAllEndpoints = async (apiBaseUrl: string, appId: string, apiKey: string) => {
    const results: Record<string, any> = {};
    
    // Test health endpoint
    results.health = await testEndpoint(`${apiBaseUrl}/health`, 'GET', null, apiKey);
    
    // Test auth endpoints
    results.login = await testEndpoint(`${apiBaseUrl}/auth/login`, 'POST', {
      email: 'test@example.com',
      password: 'testpassword123',
      application_id: appId
    }, apiKey);
    
    results.register = await testEndpoint(`${apiBaseUrl}/auth/register`, 'POST', {
      email: `test-${Date.now()}@example.com`,
      password: 'testpassword123',
      name: 'Test User',
      application_id: appId
    }, apiKey);
    
    results.resetPassword = await testEndpoint(`${apiBaseUrl}/auth/reset-password`, 'POST', {
      email: 'test@example.com',
      application_id: appId
    }, apiKey);
    
    results.verify = await testEndpoint(`${apiBaseUrl}/auth/verify`, 'POST', {
      token: 'test-jwt-token-123',
      application_id: appId
    }, apiKey);
    
    results.users = await testEndpoint(`${apiBaseUrl}/users?application_id=${appId}&page=1&limit=10`, 'GET', null, apiKey);
    
    return results;
  };

  // Test individual endpoint
  const testEndpoint = async (url: string, method: string, body: any, apiKey: string) => {
    try {
      const startTime = Date.now();
      
      const options: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
          'User-Agent': 'AuthSystem-Test/1.0'
        },
        signal: AbortSignal.timeout(15000)
      };

      if (body && method !== 'GET') {
        options.body = JSON.stringify(body);
      }

      const response = await fetch(url, options);
      const responseTime = Date.now() - startTime;
      
      let data;
      try {
        data = await response.json();
      } catch (e) {
        data = { error: 'Invalid JSON response' };
      }
      
      return {
        success: response.ok,
        status: response.status,
        responseTime,
        data,
        url
      };
    } catch (error) {
      return {
        success: false,
        status: 'error',
        error: error.message,
        url
      };
    }
  };

  const handleViewUrls = (environmentId: string) => {
    setShowUrlsModal(environmentId);
  };

  const getEnvironmentIcon = (name: string) => {
    switch (name) {
      case 'development': return '⚡';
      case 'testing': return '🧪';
      case 'production': return '🚀';
      default: return '📦';
    }
  };

  const getEnvironmentColor = (name: string) => {
    switch (name) {
      case 'development': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'testing': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'production': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getLogColor = (level: string) => {
    switch (level) {
      case 'success': return 'text-green-400';
      case 'error': return 'text-red-400';
      case 'warning': return 'text-yellow-400';
      default: return 'text-gray-300';
    }
  };

  const getDeploymentStatusColor = (status?: string) => {
    switch (status) {
      case 'deployed': return 'bg-green-100 text-green-800';
      case 'testing': return 'bg-yellow-100 text-yellow-800';
      case 'ready': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    addLog(`📋 Copied to clipboard: ${text}`, 'success');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Gestión de Ambientes</h2>
          <p className="text-gray-600">Gestiona ambientes de desarrollo, testing y producción</p>
        </div>
        <button 
          onClick={() => setShowCreateModal(true)}
          disabled={!selectedApp}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors disabled:opacity-50"
        >
          <Plus className="w-5 h-5" />
          <span>Nuevo Ambiente</span>
        </button>
      </div>

      {/* Application Selector */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Seleccionar Aplicación</h3>
        <select 
          value={selectedApp}
          onChange={(e) => setSelectedApp(e.target.value)}
          className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">Selecciona una aplicación</option>
          {applications.map((app) => (
            <option key={app.id} value={app.id}>
              {app.name} ({app.domain})
            </option>
          ))}
        </select>
      </div>

      {selectedApp && (
        <>
          {/* Environments Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {loading ? (
              <div className="col-span-full flex items-center justify-center h-32">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : environments.length === 0 ? (
              <div className="col-span-full text-center py-12">
                <Database className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No hay ambientes</h3>
                <p className="text-gray-600">Comienza creando tu primer ambiente</p>
              </div>
            ) : (
              environments.map((env) => (
                <div key={env.id} className="bg-white rounded-lg border border-gray-200 hover:shadow-lg transition-shadow">
                  <div className="p-6">
                    {/* Environment Header */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div className="text-2xl">{getEnvironmentIcon(env.name)}</div>
                        <div>
                          <h3 className="font-semibold text-gray-900 capitalize">{env.name}</h3>
                          <p className="text-sm text-gray-600">{env.domain}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getEnvironmentColor(env.name)}`}>
                          {env.is_active ? 'Activo' : 'Inactivo'}
                        </span>
                        {env.metadata?.deployment_status && (
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getDeploymentStatusColor(env.metadata.deployment_status)}`}>
                            {env.metadata.deployment_status}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Environment Info */}
                    <div className="space-y-2 mb-4">
                      {env.auth_url && (
                        <div>
                          <span className="text-xs text-gray-500">Auth URL:</span>
                          <p className="text-sm text-gray-900 truncate">{env.auth_url}</p>
                        </div>
                      )}
                      {env.metadata?.api_key && (
                        <div>
                          <span className="text-xs text-gray-500">API Key:</span>
                          <p className="text-sm text-gray-900 font-mono truncate">{env.metadata.api_key}</p>
                        </div>
                      )}
                    </div>

                    {/* Test Results Summary */}
                    {env.metadata?.test_results && (
                      <div className="mb-4">
                        <h4 className="text-xs font-medium text-gray-700 mb-2">Últimas Pruebas:</h4>
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(env.metadata.test_results).map(([endpoint, result]) => (
                            <span
                              key={endpoint}
                              className={`px-2 py-1 text-xs rounded-full ${
                                result.success 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {endpoint} {result.success ? '✅' : '❌'}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center space-x-2">
                      <button 
                        onClick={() => handleDeploy(env.id, env.name)}
                        disabled={deployLoading === env.id}
                        className="flex-1 bg-green-500 hover:bg-green-600 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
                      >
                        {deployLoading === env.id ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Play className="w-4 h-4" />
                        )}
                        <span>{deployLoading === env.id ? 'Desplegando...' : 'Desplegar'}</span>
                      </button>
                      
                      {env.metadata?.generated_urls && (
                        <button 
                          onClick={() => handleViewUrls(env.id)}
                          className="p-2 bg-blue-100 text-blue-600 hover:bg-blue-200 rounded-lg transition-colors"
                          title="Ver URLs"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      )}
                      
                      <button className="p-2 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors">
                        <Settings className="w-4 h-4" />
                      </button>
                      
                      <button className="p-2 bg-red-100 text-red-600 hover:bg-red-200 rounded-lg transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Created Date */}
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <p className="text-xs text-gray-500">
                        Creado el {new Date(env.created_at).toLocaleDateString()}
                      </p>
                      {env.metadata?.deployed_at && (
                        <p className="text-xs text-gray-500">
                          Desplegado el {new Date(env.metadata.deployed_at).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Deploy Console */}
          {showConsole && (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              {/* Console Header */}
              <div className="bg-gray-800 text-white px-4 py-3 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`w-3 h-3 rounded-full ${isDeploying ? 'bg-green-400 animate-pulse' : 'bg-gray-400'}`}></div>
                  <div className="flex items-center space-x-2">
                    <Terminal className="w-4 h-4" />
                    <span className="font-medium">Deploy Console</span>
                    <span className="text-sm text-gray-300">
                      {isDeploying ? 'Deploying...' : 'Ready'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={clearLogs}
                    className="text-gray-300 hover:text-white text-sm flex items-center space-x-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Clear</span>
                  </button>
                  <button
                    onClick={() => setShowConsole(false)}
                    className="text-gray-300 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Console Content */}
              <div 
                ref={consoleRef}
                className="bg-gray-900 text-gray-100 p-4 font-mono text-sm h-64 overflow-y-auto"
              >
                {consoleLogs.length === 0 ? (
                  <div className="text-gray-500">Console ready. Click "Desplegar" to start deployment...</div>
                ) : (
                  consoleLogs.map((log) => (
                    <div key={log.id} className="mb-1">
                      <span className="text-gray-500">[{log.timestamp}]</span>
                      <span className={`ml-2 ${getLogColor(log.level)}`}>
                        {log.level.toUpperCase()}:
                      </span>
                      <span className="ml-2">{log.message}</span>
                    </div>
                  ))
                )}
              </div>

              {/* Console Footer */}
              <div className="bg-gray-100 px-4 py-2 text-xs text-gray-600 flex items-center justify-between">
                <span>{consoleLogs.length} lines</span>
                <span>Deploy Console v1.0</span>
              </div>
            </div>
          )}
        </>
      )}

      {/* URLs Modal */}
      {showUrlsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            {(() => {
              const environment = environments.find(env => env.id === showUrlsModal);
              if (!environment || !environment.metadata?.generated_urls) return null;
              
              const urls = environment.metadata.generated_urls;
              const apiKey = environment.metadata.api_key;
              
              return (
                <>
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
                      <Globe className="w-5 h-5" />
                      <span>URLs del Ambiente {environment.name}</span>
                    </h3>
                    <button
                      onClick={() => setShowUrlsModal(null)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* API Key */}
                  {apiKey && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                      <h4 className="font-medium text-blue-900 mb-2">API Key para este ambiente</h4>
                      <div className="flex items-center space-x-2">
                        <code className="flex-1 bg-white px-3 py-2 rounded border text-sm font-mono">
                          {apiKey}
                        </code>
                        <button
                          onClick={() => copyToClipboard(apiKey)}
                          className="p-2 text-blue-600 hover:bg-blue-100 rounded"
                        >
                          📋
                        </button>
                      </div>
                      <p className="text-xs text-blue-700 mt-2">
                        Usa esta API key en el header X-API-Key para todas las requests
                      </p>
                    </div>
                  )}

                  {/* URLs */}
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium text-gray-900 mb-3">🔗 URLs de Formularios Públicos</h4>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div>
                            <p className="font-medium text-gray-900">Login</p>
                            <p className="text-sm text-gray-600 truncate">{urls.login}</p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => copyToClipboard(urls.login)}
                              className="p-2 text-gray-600 hover:bg-gray-200 rounded"
                            >
                              📋
                            </button>
                            <button
                              onClick={() => window.open(urls.login, '_blank')}
                              className="p-2 text-blue-600 hover:bg-blue-100 rounded"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div>
                            <p className="font-medium text-gray-900">Registro</p>
                            <p className="text-sm text-gray-600 truncate">{urls.register}</p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => copyToClipboard(urls.register)}
                              className="p-2 text-gray-600 hover:bg-gray-200 rounded"
                            >
                              📋
                            </button>
                            <button
                              onClick={() => window.open(urls.register, '_blank')}
                              className="p-2 text-blue-600 hover:bg-blue-100 rounded"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div>
                            <p className="font-medium text-gray-900">Recuperar Contraseña</p>
                            <p className="text-sm text-gray-600 truncate">{urls.reset_password}</p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => copyToClipboard(urls.reset_password)}
                              className="p-2 text-gray-600 hover:bg-gray-200 rounded"
                            >
                              📋
                            </button>
                            <button
                              onClick={() => window.open(urls.reset_password, '_blank')}
                              className="p-2 text-blue-600 hover:bg-blue-100 rounded"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium text-gray-900 mb-3">🔌 URLs de API</h4>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div>
                            <p className="font-medium text-gray-900">API Base</p>
                            <p className="text-sm text-gray-600 truncate">{urls.api_base}</p>
                          </div>
                          <button
                            onClick={() => copyToClipboard(urls.api_base)}
                            className="p-2 text-gray-600 hover:bg-gray-200 rounded"
                          >
                            📋
                          </button>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div>
                            <p className="font-medium text-gray-900">Callback URL</p>
                            <p className="text-sm text-gray-600 truncate">{urls.callback}</p>
                          </div>
                          <button
                            onClick={() => copyToClipboard(urls.callback)}
                            className="p-2 text-gray-600 hover:bg-gray-200 rounded"
                          >
                            📋
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Test Results */}
                    {environment.metadata?.test_results && (
                      <div>
                        <h4 className="font-medium text-gray-900 mb-3">🧪 Resultados de Pruebas</h4>
                        <div className="space-y-2">
                          {Object.entries(environment.metadata.test_results).map(([endpoint, result]) => (
                            <div key={endpoint} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                              <span className="text-sm text-gray-700 capitalize">{endpoint}</span>
                              <div className="flex items-center space-x-2">
                                <span className={`px-2 py-1 text-xs rounded-full ${
                                  result.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                }`}>
                                  {result.success ? '✅ OK' : '❌ Error'}
                                </span>
                                {result.responseTime && (
                                  <span className="text-xs text-gray-500">{result.responseTime}ms</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="px-6 pb-6">
                    <button
                      onClick={() => setShowUrlsModal(null)}
                      className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      Cerrar
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Create Environment Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Nuevo Ambiente</h3>
            <form onSubmit={handleCreateEnvironment} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo de Ambiente
                </label>
                <select
                  value={newEnvironment.name}
                  onChange={(e) => setNewEnvironment(prev => ({ ...prev, name: e.target.value as any }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="development">⚡ Development</option>
                  <option value="testing">🧪 Testing</option>
                  <option value="production">🚀 Production</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Dominio
                </label>
                <input
                  type="text"
                  value={newEnvironment.domain}
                  onChange={(e) => setNewEnvironment(prev => ({ ...prev, domain: e.target.value }))}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="auth-dev.miapp.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  URL Base
                </label>
                <input
                  type="url"
                  value={newEnvironment.base_url}
                  onChange={(e) => setNewEnvironment(prev => ({ ...prev, base_url: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="https://auth-dev.miapp.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Callback URL
                </label>
                <input
                  type="url"
                  value={newEnvironment.callback_url}
                  onChange={(e) => setNewEnvironment(prev => ({ ...prev, callback_url: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="https://miapp.com/auth/callback"
                />
              </div>

              <div className="flex items-center space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                >
                  Crear Ambiente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}