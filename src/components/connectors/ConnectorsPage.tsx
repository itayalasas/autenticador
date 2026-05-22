import { useState, useEffect } from 'react';
import { Github, Cloud, CheckCircle, AlertCircle, Settings, Link as LinkIcon, Trash2, Unlink } from 'lucide-react';
import { connectorsService, GitHubConfig, NetlifyConfig, AzureContainerAppsConfig } from '../../services/connectorsService';
import NotificationModal from '../ui/NotificationModal';
import GitHubConnector from '../github/GitHubConnector';
import { supabase } from '../../lib/supabase';
import { GitRepository } from '../../services/githubService';

export default function ConnectorsPage() {
  const [githubConfig, setGitHubConfig] = useState<GitHubConfig>({
    client_id: '',
    client_secret: '',
    redirect_uri: '',
  });
  const [netlifyConfig, setNetlifyConfig] = useState<NetlifyConfig>({
    access_token: '',
    site_id: '',
  });
  const [azureConfig, setAzureConfig] = useState<AzureContainerAppsConfig>({
    tenant_id: '',
    subscription_id: '',
    client_id: '',
    client_secret: '',
    resource_group: '',
    location: '',
    containerapps_environment: '',
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [summary, setSummary] = useState<any>(null);
  const [testResults, setTestResults] = useState<Record<string, any>>({});
  const [connectedRepos, setConnectedRepos] = useState<GitRepository[]>([]);
  const [notification, setNotification] = useState({
    isOpen: false,
    type: 'success' as 'success' | 'error' | 'warning' | 'info',
    title: '',
    message: '',
  });

  useEffect(() => {
    loadConfigs();
    loadSummary();
    loadConnectedRepos();
  }, []);

  const showNotification = (type: 'success' | 'error' | 'warning' | 'info', title: string, message: string) => {
    setNotification({
      isOpen: true,
      type,
      title,
      message,
    });
  };

  const closeNotification = () => {
    setNotification({
      ...notification,
      isOpen: false,
    });
  };

  const loadConfigs = async () => {
    try {
      setLoading(true);

      // Load GitHub config
      const github = await connectorsService.getGitHubConfig();
      if (github) {
        setGitHubConfig(github);
      }

      // Load Netlify config
      const netlify = await connectorsService.getNetlifyConfig();
      if (netlify) {
        setNetlifyConfig(netlify);
      }

      const azure = await connectorsService.getAzureContainerAppsConfig();
      if (azure) {
        setAzureConfig({
          tenant_id: azure.tenant_id || '',
          subscription_id: azure.subscription_id || '',
          client_id: azure.client_id || '',
          client_secret: azure.client_secret || '',
          resource_group: azure.resource_group || '',
          location: azure.location || '',
          containerapps_environment: azure.containerapps_environment || '',
        });
      }
    } catch (error) {
      console.error('Error loading configs:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSummary = async () => {
    try {
      const sum = await connectorsService.getConnectorsSummary();
      setSummary(sum);
    } catch (error) {
      console.error('Error loading summary:', error);
    }
  };

  const loadConnectedRepos = async () => {
    try {
      const { data, error } = await supabase
        .from('git_repositories')
        .select('*')
        .not('netlify_site_id', 'is', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setConnectedRepos(data || []);
    } catch (error) {
      console.error('Error loading connected repos:', error);
    }
  };

  const handleUnlinkNetlifySite = async (repoId: string, repoName: string) => {
    if (!confirm(`¿Estás seguro de desvincular Netlify del repositorio "${repoName}"?\n\nEsto eliminará la conexión, pero no borrará el sitio en Netlify. Podrás crear un nuevo deploy desde cero.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('git_repositories')
        .update({ netlify_site_id: null })
        .eq('id', repoId);

      if (error) throw error;

      await loadConnectedRepos();
      await loadSummary();
      showNotification('success', 'Desvinculado', `El repositorio "${repoName}" ha sido desvinculado de Netlify.`);
    } catch (error: any) {
      showNotification('error', 'Error al Desvincular', error.message || 'No se pudo desvincular el repositorio.');
    }
  };

  const handleSaveGitHub = async () => {
    try {
      setSaving('github');
      await connectorsService.saveGitHubConfig(githubConfig);
      await loadSummary();
      showNotification('success', 'Configuración Guardada', 'La configuración de GitHub se ha guardado exitosamente.');
    } catch (error: any) {
      showNotification('error', 'Error al Guardar', error.message || 'No se pudo guardar la configuración de GitHub.');
    } finally {
      setSaving(null);
    }
  };

  const handleSaveNetlify = async () => {
    try {
      setSaving('netlify');
      await connectorsService.saveNetlifyConfig(netlifyConfig);
      await loadSummary();
      showNotification('success', 'Configuración Guardada', 'La configuración de Netlify se ha guardado exitosamente.');
    } catch (error: any) {
      showNotification('error', 'Error al Guardar', error.message || 'No se pudo guardar la configuración de Netlify.');
    } finally {
      setSaving(null);
    }
  };

  const handleSaveAzure = async () => {
    try {
      setSaving('azure_container_apps');
      await connectorsService.saveAzureContainerAppsConfig({
        ...azureConfig,
        tenant_id: azureConfig.tenant_id.trim(),
        subscription_id: azureConfig.subscription_id.trim(),
        client_id: azureConfig.client_id.trim(),
        client_secret: azureConfig.client_secret.trim(),
        resource_group: azureConfig.resource_group.trim(),
        location: azureConfig.location.trim(),
        containerapps_environment: azureConfig.containerapps_environment?.trim() || '',
      });
      await loadSummary();
      showNotification('success', 'Configuracion Guardada', 'La configuracion de Azure Container Apps se ha guardado exitosamente.');
    } catch (error: any) {
      showNotification('error', 'Error al Guardar', error.message || 'No se pudo guardar la configuracion de Azure Container Apps.');
    } finally {
      setSaving(null);
    }
  };

  const handleTestConnection = async (connector: 'github' | 'netlify' | 'azure_container_apps') => {
    try {
      setTesting(connector);
      const result = connector === 'azure_container_apps'
        ? await connectorsService.testAzureContainerAppsConfig({
            ...azureConfig,
            tenant_id: azureConfig.tenant_id.trim(),
            subscription_id: azureConfig.subscription_id.trim(),
            client_id: azureConfig.client_id.trim(),
            client_secret: azureConfig.client_secret.trim(),
            resource_group: azureConfig.resource_group.trim(),
            location: azureConfig.location.trim(),
            containerapps_environment: azureConfig.containerapps_environment?.trim() || '',
          })
        : await connectorsService.testConnection(connector);
      setTestResults(prev => ({ ...prev, [connector]: result }));

      if (result.success) {
        showNotification('success', 'Conexión Exitosa', result.message);
      } else {
        showNotification('error', 'Error de Conexión', result.message);
      }
    } catch (error: any) {
      showNotification('error', 'Error', error.message || 'No se pudo probar la conexión.');
    } finally {
      setTesting(null);
    }
  };

  const handleDeleteConfig = async (connector: 'github' | 'netlify' | 'azure_container_apps') => {
    if (!confirm(`¿Estás seguro de eliminar la configuración de ${connector}?`)) return;

    try {
      await connectorsService.deleteConfig(connector);

      if (connector === 'github') {
        setGitHubConfig({
          client_id: '',
          client_secret: '',
          redirect_uri: '',
        });
      } else if (connector === 'netlify') {
        setNetlifyConfig({
          access_token: '',
          site_id: '',
        });
      } else {
        setAzureConfig({
          tenant_id: '',
          subscription_id: '',
          client_id: '',
          client_secret: '',
          resource_group: '',
          location: '',
          containerapps_environment: '',
        });
      }

      await loadSummary();
      showNotification('success', 'Configuración Eliminada', 'La configuración se ha eliminado correctamente.');
    } catch (error: any) {
      showNotification('error', 'Error al Eliminar', error.message || 'No se pudo eliminar la configuración.');
    }
  };

  const getRedirectUri = () => {
    return `${window.location.origin}/github/callback`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center space-x-3 mb-4">
          <LinkIcon className="w-6 h-6 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Conectores</h1>
            <p className="text-gray-600">Configura las integraciones externas para tu sistema</p>
          </div>
        </div>

        {/* Summary */}
        {summary && (
          <div className="grid grid-cols-3 gap-4 mt-6">
            <div className="bg-blue-50 rounded-lg p-4">
              <p className="text-sm text-blue-600 font-medium">Total Conectores</p>
              <p className="text-3xl font-bold text-blue-900">{summary.total}</p>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <p className="text-sm text-green-600 font-medium">Configurados</p>
              <p className="text-3xl font-bold text-green-900">{summary.configured}</p>
            </div>
            <div className="bg-red-50 rounded-lg p-4">
              <p className="text-sm text-red-600 font-medium">Pendientes</p>
              <p className="text-3xl font-bold text-red-900">{summary.missing}</p>
            </div>
          </div>
        )}
      </div>

      {/* GitHub Connector */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gray-900 rounded-lg flex items-center justify-center">
              <Github className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 flex items-center space-x-2">
                <span>GitHub</span>
                {githubConfig.client_id && <CheckCircle className="w-5 h-5 text-green-500" />}
              </h2>
              <p className="text-sm text-gray-600">Integración con repositorios de GitHub</p>
            </div>
          </div>
          {githubConfig.client_id && (
            <button
              onClick={() => handleDeleteConfig('github')}
              className="text-red-600 hover:text-red-700 text-sm flex items-center space-x-1"
            >
              <Trash2 className="w-4 h-4" />
              <span>Eliminar</span>
            </button>
          )}
        </div>

        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <h4 className="font-semibold text-blue-900 mb-2 flex items-center space-x-2">
              <Settings className="w-4 h-4" />
              <span>¿Cómo obtener las credenciales?</span>
            </h4>
            <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
              <li>Ve a <a href="https://github.com/settings/developers" target="_blank" rel="noopener noreferrer" className="underline">GitHub Settings → Developer Settings</a></li>
              <li>Haz clic en "OAuth Apps" → "New OAuth App"</li>
              <li>Llena el formulario con:
                <ul className="ml-6 mt-1 space-y-1">
                  <li>• Application name: AuthSystem</li>
                  <li>• Homepage URL: {window.location.origin}</li>
                  <li>• Authorization callback URL: {getRedirectUri()}</li>
                </ul>
              </li>
              <li>Copia el Client ID y genera un Client Secret</li>
              <li>Pégalos en los campos de abajo</li>
            </ol>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Client ID *
            </label>
            <input
              type="text"
              value={githubConfig.client_id}
              onChange={(e) => setGitHubConfig({ ...githubConfig, client_id: e.target.value })}
              placeholder="Iv1.a1b2c3d4e5f6g7h8"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Client Secret *
            </label>
            <input
              type="password"
              value={githubConfig.client_secret}
              onChange={(e) => setGitHubConfig({ ...githubConfig, client_secret: e.target.value })}
              placeholder="a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Redirect URI *
            </label>
            <input
              type="text"
              value={githubConfig.redirect_uri || getRedirectUri()}
              onChange={(e) => setGitHubConfig({ ...githubConfig, redirect_uri: e.target.value })}
              placeholder={getRedirectUri()}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              Sugerido: {getRedirectUri()}
            </p>
          </div>

          <div className="flex space-x-3">
            <button
              onClick={handleSaveGitHub}
              disabled={saving === 'github' || !githubConfig.client_id || !githubConfig.client_secret}
              className="flex-1 bg-gray-900 hover:bg-gray-800 text-white px-4 py-2 rounded-lg flex items-center justify-center space-x-2 transition-colors disabled:opacity-50"
            >
              {saving === 'github' ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <Github className="w-4 h-4" />
                  <span>Guardar Configuración</span>
                </>
              )}
            </button>
            {githubConfig.client_id && (
              <button
                onClick={() => handleTestConnection('github')}
                disabled={testing === 'github'}
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors disabled:opacity-50"
              >
                {testing === 'github' ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    <span>Probar</span>
                  </>
                )}
              </button>
            )}
          </div>

          {testResults.github && (
            <div className={`p-3 rounded-lg ${testResults.github.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
              <p className="text-sm flex items-center space-x-2">
                {testResults.github.success ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                <span>{testResults.github.message}</span>
              </p>
            </div>
          )}
        </div>
      </div>

      {/* GitHub Connection & Repositories */}
      {githubConfig.client_id && (
        <GitHubConnector />
      )}

      {/* Netlify Connector */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center">
              <Cloud className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 flex items-center space-x-2">
                <span>Netlify</span>
                {netlifyConfig.access_token && <CheckCircle className="w-5 h-5 text-green-500" />}
              </h2>
              <p className="text-sm text-gray-600">Despliegue y hosting en Netlify</p>
            </div>
          </div>
          {netlifyConfig.access_token && (
            <button
              onClick={() => handleDeleteConfig('netlify')}
              className="text-red-600 hover:text-red-700 text-sm flex items-center space-x-1"
            >
              <Trash2 className="w-4 h-4" />
              <span>Eliminar</span>
            </button>
          )}
        </div>

        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <h4 className="font-semibold text-blue-900 mb-2 flex items-center space-x-2">
              <Settings className="w-4 h-4" />
              <span>¿Cómo obtener el Access Token?</span>
            </h4>
            <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
              <li>Ve a <a href="https://app.netlify.com/user/applications" target="_blank" rel="noopener noreferrer" className="underline">Netlify → User Settings → Applications</a></li>
              <li>Haz clic en "New access token"</li>
              <li>Dale un nombre descriptivo (ej: "AuthSystem")</li>
              <li>Copia el token generado</li>
              <li>Pégalo en el campo de abajo</li>
            </ol>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Access Token *
            </label>
            <input
              type="password"
              value={netlifyConfig.access_token}
              onChange={(e) => setNetlifyConfig({ ...netlifyConfig, access_token: e.target.value })}
              placeholder="nfp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Site ID (Opcional)
            </label>
            <input
              type="text"
              value={netlifyConfig.site_id || ''}
              onChange={(e) => setNetlifyConfig({ ...netlifyConfig, site_id: e.target.value })}
              placeholder="abc123def-456-789-ghi-jklmno"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              Puedes seleccionarlo después al hacer deploy
            </p>
          </div>

          <div className="flex space-x-3">
            <button
              onClick={handleSaveNetlify}
              disabled={saving === 'netlify' || !netlifyConfig.access_token}
              className="flex-1 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center justify-center space-x-2 transition-colors disabled:opacity-50"
            >
              {saving === 'netlify' ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <Cloud className="w-4 h-4" />
                  <span>Guardar Configuración</span>
                </>
              )}
            </button>
            {netlifyConfig.access_token && (
              <button
                onClick={() => handleTestConnection('netlify')}
                disabled={testing === 'netlify'}
                className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors disabled:opacity-50"
              >
                {testing === 'netlify' ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    <span>Probar</span>
                  </>
                )}
              </button>
            )}
          </div>

          {testResults.netlify && (
            <div className={`p-3 rounded-lg ${testResults.netlify.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
              <p className="text-sm flex items-center space-x-2">
                {testResults.netlify.success ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                <span>{testResults.netlify.message}</span>
              </p>
            </div>
          )}
        </div>

        {/* Repositorios Conectados a Netlify */}
        {connectedRepos.length > 0 && (
          <div className="mt-6 border-t border-gray-200 pt-6">
            <h4 className="font-semibold text-gray-900 mb-3 flex items-center space-x-2">
              <LinkIcon className="w-4 h-4" />
              <span>Repositorios Conectados a Netlify</span>
            </h4>
            <div className="space-y-2">
              {connectedRepos.map((repo) => (
                <div
                  key={repo.id}
                  className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg"
                >
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{repo.repo_name}</p>
                    <p className="text-xs text-gray-500">{repo.repo_full_name}</p>
                    <p className="text-xs text-green-600 mt-1">
                      Site ID: {repo.netlify_site_id}
                    </p>
                  </div>
                  <button
                    onClick={() => handleUnlinkNetlifySite(repo.id, repo.repo_name)}
                    className="text-red-600 hover:text-red-700 text-sm flex items-center space-x-1 px-3 py-2 rounded-lg hover:bg-red-50 transition-colors"
                    title="Desvincular de Netlify"
                  >
                    <Unlink className="w-4 h-4" />
                    <span>Desvincular</span>
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-800">
                💡 Al desvincular un repositorio, podrás crear un nuevo sitio desde cero en el próximo deploy.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Azure Container Apps Connector */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-sky-600 rounded-lg flex items-center justify-center">
              <Cloud className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 flex items-center space-x-2">
                <span>Azure Container Apps</span>
                {azureConfig.tenant_id && <CheckCircle className="w-5 h-5 text-green-500" />}
              </h2>
              <p className="text-sm text-gray-600">Credenciales para crear y actualizar formularios en Azure Container Apps</p>
            </div>
          </div>
          {azureConfig.tenant_id && (
            <button
              onClick={() => handleDeleteConfig('azure_container_apps')}
              className="text-red-600 hover:text-red-700 text-sm flex items-center space-x-1"
            >
              <Trash2 className="w-4 h-4" />
              <span>Eliminar</span>
            </button>
          )}
        </div>

        <div className="space-y-4">
          <div className="bg-sky-50 border border-sky-200 rounded-lg p-4 mb-4">
            <h4 className="font-semibold text-sky-900 mb-2 flex items-center space-x-2">
              <Settings className="w-4 h-4" />
              <span>Credenciales requeridas</span>
            </h4>
            <ol className="text-sm text-sky-800 space-y-1 list-decimal list-inside">
              <li>Crea o reutiliza un Service Principal con permisos sobre el resource group donde se desplegaran las apps.</li>
              <li>Guarda Tenant ID, Subscription ID, Client ID y Client Secret.</li>
              <li>Configura el Resource Group y la region base para los ambientes.</li>
              <li>El Container Apps Environment por defecto es opcional: si lo dejas vacio se genera en el primer deploy y luego se reutiliza en los redeploys.</li>
            </ol>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Tenant ID *</label>
              <input
                type="text"
                value={azureConfig.tenant_id}
                onChange={(e) => setAzureConfig({ ...azureConfig, tenant_id: e.target.value })}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Subscription ID *</label>
              <input
                type="text"
                value={azureConfig.subscription_id}
                onChange={(e) => setAzureConfig({ ...azureConfig, subscription_id: e.target.value })}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Client ID *</label>
              <input
                type="text"
                value={azureConfig.client_id}
                onChange={(e) => setAzureConfig({ ...azureConfig, client_id: e.target.value })}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Client Secret *</label>
              <input
                type="password"
                value={azureConfig.client_secret}
                onChange={(e) => setAzureConfig({ ...azureConfig, client_secret: e.target.value })}
                placeholder="Azure client secret"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Resource Group *</label>
              <input
                type="text"
                value={azureConfig.resource_group}
                onChange={(e) => setAzureConfig({ ...azureConfig, resource_group: e.target.value })}
                placeholder="rg-auth-forms"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Region *</label>
              <input
                type="text"
                value={azureConfig.location}
                onChange={(e) => setAzureConfig({ ...azureConfig, location: e.target.value })}
                placeholder="eastus"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Container Apps Environment por defecto (opcional)</label>
            <input
              type="text"
              value={azureConfig.containerapps_environment || ''}
              onChange={(e) => setAzureConfig({ ...azureConfig, containerapps_environment: e.target.value })}
              placeholder="Dejar vacio para generarlo durante el primer deploy"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              Si no lo defines, el primer deploy genera uno con el nombre de la app y el ambiente. Ese mismo valor queda guardado para reutilizarlo en redeploys.
            </p>
          </div>

          <div className="flex space-x-3">
            <button
              onClick={handleSaveAzure}
              disabled={
                saving === 'azure_container_apps' ||
                !azureConfig.tenant_id ||
                !azureConfig.subscription_id ||
                !azureConfig.client_id ||
                !azureConfig.client_secret ||
                !azureConfig.resource_group ||
                !azureConfig.location
              }
              className="flex-1 bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-lg flex items-center justify-center space-x-2 transition-colors disabled:opacity-50"
            >
              {saving === 'azure_container_apps' ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <Cloud className="w-4 h-4" />
                  <span>Guardar Configuracion</span>
                </>
              )}
            </button>
            {azureConfig.tenant_id && (
              <button
                onClick={() => handleTestConnection('azure_container_apps')}
                disabled={testing === 'azure_container_apps'}
                className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors disabled:opacity-50"
              >
                {testing === 'azure_container_apps' ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    <span>Probar</span>
                  </>
                )}
              </button>
            )}
          </div>

          {testResults.azure_container_apps && (
            <div className={`p-3 rounded-lg ${testResults.azure_container_apps.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
              <p className="text-sm flex items-center space-x-2">
                {testResults.azure_container_apps.success ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                <span>{testResults.azure_container_apps.message}</span>
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Notification Modal */}
      <NotificationModal
        notification={notification}
        onClose={closeNotification}
      />
    </div>
  );
}
