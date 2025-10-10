import { useState, useEffect } from 'react';
import { Github, GitBranch, CheckCircle, X, ExternalLink, Unlink } from 'lucide-react';
import { githubService, GitConnection, GitRepository, GitHubRepo } from '../../services/githubService';
import NotificationModal from '../ui/NotificationModal';
import { supabase } from '../../lib/supabase';

interface GitHubConnectorProps {
  onRepositorySelected?: (repo: GitRepository) => void;
}

export default function GitHubConnector({ onRepositorySelected }: GitHubConnectorProps) {
  const [connection, setConnection] = useState<GitConnection | null>(null);
  const [repositories, setRepositories] = useState<GitHubRepo[]>([]);
  const [savedRepos, setSavedRepos] = useState<GitRepository[]>([]);
  const [loading, setLoading] = useState(false);
  const [showRepoList, setShowRepoList] = useState(false);
  const [newRepoName, setNewRepoName] = useState('');
  const [creatingRepo, setCreatingRepo] = useState(false);
  const [notification, setNotification] = useState({
    isOpen: false,
    type: 'success' as 'success' | 'error' | 'warning' | 'info',
    title: '',
    message: '',
  });

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

  useEffect(() => {
    loadConnection();
    loadSavedRepos();
  }, []);

  const loadConnection = async () => {
    try {
      const conn = await githubService.getActiveConnection();
      setConnection(conn);
    } catch (error) {
      console.error('Error loading GitHub connection:', error);
    }
  };

  const loadSavedRepos = async () => {
    try {
      const repos = await githubService.getSavedRepositories();
      setSavedRepos(repos);
    } catch (error) {
      console.error('Error loading saved repositories:', error);
    }
  };

  const handleConnect = async () => {
    const configured = await githubService.isConfigured();
    if (!configured) {
      const instructions = await githubService.getSetupInstructions();
      showNotification('warning', 'GitHub no Configurado', instructions);
      return;
    }
    await githubService.initiateOAuth();
  };

  const handleDisconnect = async () => {
    if (!confirm('¿Estás seguro de desconectar GitHub?')) return;

    try {
      await githubService.disconnect();
      setConnection(null);
      setRepositories([]);
    } catch (error: any) {
      showNotification('error', 'Error al Desconectar', error.message || 'No se pudo desconectar GitHub.');
    }
  };

  const handleLoadRepos = async () => {
    try {
      setLoading(true);
      const repos = await githubService.listRepositories();
      setRepositories(repos);
      setShowRepoList(true);
    } catch (error: any) {
      showNotification('error', 'Error al Cargar', error.message || 'No se pudieron cargar los repositorios.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRepo = async () => {
    if (!newRepoName.trim()) {
      showNotification('warning', 'Nombre Requerido', 'Por favor ingresa un nombre para el repositorio.');
      return;
    }

    try {
      setCreatingRepo(true);
      const repo = await githubService.createRepository(newRepoName, false, 'Created from AuthSystem - Public repository for Netlify deployment');
      const savedRepo = await githubService.saveRepository(repo);

      setSavedRepos([savedRepo, ...savedRepos]);
      setNewRepoName('');

      if (onRepositorySelected) {
        onRepositorySelected(savedRepo);
      }

      showNotification('success', 'Repositorio Creado', `El repositorio "${repo.name}" se ha creado exitosamente.`);
    } catch (error: any) {
      showNotification('error', 'Error al Crear', error.message || 'No se pudo crear el repositorio.');
    } finally {
      setCreatingRepo(false);
    }
  };

  const handleSelectRepo = async (repo: GitHubRepo) => {
    try {
      const savedRepo = await githubService.saveRepository(repo);
      setSavedRepos([savedRepo, ...savedRepos.filter(r => r.id !== savedRepo.id)]);

      if (onRepositorySelected) {
        onRepositorySelected(savedRepo);
      }

      setShowRepoList(false);
      showNotification('success', 'Repositorio Seleccionado', `El repositorio "${repo.name}" ha sido seleccionado.`);
    } catch (error: any) {
      showNotification('error', 'Error al Seleccionar', error.message || 'No se pudo seleccionar el repositorio.');
    }
  };

  const handleUnlinkNetlify = async (repoId: string, repoName: string) => {
    if (!confirm(`¿Estás seguro de desvincular Netlify del repositorio "${repoName}"?\n\nEsto eliminará la conexión, pero no borrará el sitio en Netlify. Podrás crear un nuevo deploy desde cero.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('git_repositories')
        .update({ netlify_site_id: null })
        .eq('id', repoId);

      if (error) throw error;

      await loadSavedRepos();
      showNotification('success', 'Desvinculado', `El repositorio "${repoName}" ha sido desvinculado de Netlify.`);
    } catch (error: any) {
      showNotification('error', 'Error al Desvincular', error.message || 'No se pudo desvincular el repositorio.');
    }
  };

  if (!connection) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <Github className="w-6 h-6 text-gray-700" />
            <div>
              <h3 className="font-semibold text-gray-900">Conectar con GitHub</h3>
              <p className="text-sm text-gray-600">
                Conecta tu cuenta de GitHub para deploys automáticos
              </p>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <h4 className="font-semibold text-blue-900 mb-2">¿Por qué conectar GitHub?</h4>
          <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
            <li>Deploys automáticos en cada push</li>
            <li>Historial de versiones completo</li>
            <li>Colaboración en equipo</li>
            <li>Integración directa con Netlify</li>
            <li>Sin necesidad de subir archivos manualmente</li>
          </ul>
        </div>

        <button
          onClick={handleConnect}
          className="w-full bg-gray-900 hover:bg-gray-800 text-white px-4 py-3 rounded-lg flex items-center justify-center space-x-2 transition-colors"
        >
          <Github className="w-5 h-5" />
          <span>Conectar con GitHub</span>
        </button>

        <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-sm text-blue-800">
            💡 Si GitHub no está configurado, ve a <strong>Conectores</strong> en el menú para configurarlo.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      {/* Connected Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-full bg-gray-900 flex items-center justify-center">
            {connection.avatar_url ? (
              <img src={connection.avatar_url} alt={connection.username} className="w-12 h-12 rounded-full" />
            ) : (
              <Github className="w-6 h-6 text-white" />
            )}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 flex items-center space-x-2">
              <span>{connection.username}</span>
              <CheckCircle className="w-4 h-4 text-green-500" />
            </h3>
            <p className="text-sm text-gray-600">Conectado a GitHub</p>
          </div>
        </div>
        <button
          onClick={handleDisconnect}
          className="text-red-600 hover:text-red-700 text-sm flex items-center space-x-1"
        >
          <X className="w-4 h-4" />
          <span>Desconectar</span>
        </button>
      </div>

      {/* Create New Repository */}
      <div className="mb-6">
        <h4 className="font-semibold text-gray-900 mb-3 flex items-center space-x-2">
          <GitBranch className="w-4 h-4" />
          <span>Crear Nuevo Repositorio</span>
        </h4>
        <div className="flex space-x-2">
          <input
            type="text"
            value={newRepoName}
            onChange={(e) => setNewRepoName(e.target.value)}
            placeholder="nombre-del-repositorio"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            onClick={handleCreateRepo}
            disabled={creatingRepo || !newRepoName.trim()}
            className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors disabled:opacity-50"
          >
            {creatingRepo ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Creando...</span>
              </>
            ) : (
              <>
                <Github className="w-4 h-4" />
                <span>Crear</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Load Existing Repositories */}
      <div className="mb-6">
        <button
          onClick={handleLoadRepos}
          disabled={loading}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center justify-center space-x-2 transition-colors disabled:opacity-50"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Cargando...</span>
            </>
          ) : (
            <>
              <Github className="w-4 h-4" />
              <span>Cargar Mis Repositorios</span>
            </>
          )}
        </button>
      </div>

      {/* Repository List Modal */}
      {showRepoList && (
        <div className="mb-6 border border-gray-200 rounded-lg p-4 max-h-64 overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-gray-900">Selecciona un Repositorio</h4>
            <button onClick={() => setShowRepoList(false)} className="text-gray-500 hover:text-gray-700">
              <X className="w-4 h-4" />
            </button>
          </div>
          {repositories.length === 0 ? (
            <p className="text-gray-500 text-sm">No se encontraron repositorios</p>
          ) : (
            <div className="space-y-2">
              {repositories.map((repo) => (
                <div
                  key={repo.id}
                  className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg cursor-pointer"
                  onClick={() => handleSelectRepo(repo)}
                >
                  <div>
                    <p className="font-medium text-gray-900">{repo.name}</p>
                    <p className="text-xs text-gray-500">{repo.full_name}</p>
                  </div>
                  <ExternalLink className="w-4 h-4 text-gray-400" />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Saved Repositories */}
      {savedRepos.length > 0 && (
        <div>
          <h4 className="font-semibold text-gray-900 mb-3">Repositorios Guardados</h4>
          <div className="space-y-2">
            {savedRepos.map((repo) => (
              <div
                key={repo.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{repo.repo_name}</p>
                  <p className="text-xs text-gray-500">{repo.repo_full_name}</p>
                  {repo.netlify_site_id && (
                    <div className="flex items-center space-x-2 mt-1">
                      <p className="text-xs text-green-600">✓ Conectado con Netlify</p>
                      <button
                        onClick={() => handleUnlinkNetlify(repo.id, repo.repo_name)}
                        className="text-xs text-red-600 hover:text-red-700 flex items-center space-x-1"
                        title="Desvincular de Netlify"
                      >
                        <Unlink className="w-3 h-3" />
                        <span>Desvincular</span>
                      </button>
                    </div>
                  )}
                </div>
                <a
                  href={repo.repo_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-700"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notification Modal */}
      <NotificationModal
        notification={notification}
        onClose={closeNotification}
      />
    </div>
  );
}
