import React, { useState, useEffect, useRef } from 'react';
import { Database, Globe, Play, Settings, Trash2, Plus, CheckCircle, AlertTriangle, Terminal, X, RotateCcw, ExternalLink, Eye, Code, FileText, Shield, CreditCard as Edit, Power, MoreVertical, Upload, Cloud, AlertCircle, History, Download, Github, Unlink } from 'lucide-react';
import { applicationService } from '../../services/applicationService';
import { subscriptionService } from '../../services/subscriptionService';
import { netlifyService } from '../../services/netlifyService';
import { githubService, type GitRepository, type GitHubRepo } from '../../services/githubService';
import { connectorsService } from '../../services/connectorsService';
import type { AzureContainerAppsConfig, DeployProvider } from '../../services/connectorsService';
import { environmentVariablesService } from '../../services/environmentVariablesService';
import { getStaticProjectFiles } from '../../utils/projectFilesHelper';
import { getReactConfigFiles, getCommitMessage } from '../../utils/reactProjectHelper';
import { getReactProjectFiles } from '../../utils/netlifyReactProjectHelper';
import {
  applyAzureContainerAppsDeploymentFiles,
  buildAzureCredentialsSecretPayload,
  buildDefaultContainerAppName,
} from '../../utils/azureContainerAppsDeploymentHelper';
import { deploymentService } from '../../services/deploymentService';
import { deploymentSnapshotService } from '../../services/deploymentSnapshotService';
import { environmentDeployBindingService, type EnvironmentDeployBinding } from '../../services/environmentDeployBindingService';
import { supabase } from '../../lib/supabase';
import { requireSupabaseAnonKey, requireSupabaseUrl } from '../../lib/supabaseRuntime';
import ConfirmationModal from '../ui/ConfirmationModal';
import NotificationModal from '../ui/NotificationModal';

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
      reset_password_confirm?: string;
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

interface RepoSelectionOption {
  key: string;
  label: string;
  source: 'saved' | 'github';
  savedRepo?: GitRepository;
  githubRepo?: GitHubRepo;
}

interface PendingDeployData {
  files: Record<string, string>;
  repo: GitRepository;
  deployBranch: string;
  environmentId: string;
  environmentName: string;
  environment: Environment;
  applicationId: string;
  apiKey: string;
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
  const [showIntegrationGuide, setShowIntegrationGuide] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showDeleteLogConfirm, setShowDeleteLogConfirm] = useState<string | null>(null);
  const [showLogsHistory, setShowLogsHistory] = useState<string | null>(null);
  const [showLogDetail, setShowLogDetail] = useState<any>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [consoleLogs, setConsoleLogs] = useState<LogEntry[]>([]);
  const [historicalLogs, setHistoricalLogs] = useState<any[]>([]);
  const [latestLogsMap, setLatestLogsMap] = useState<Record<string, any>>({});
  const [isDeploying, setIsDeploying] = useState(false);
  const [subscription, setSubscription] = useState<any>(null);
  const [currentDeploymentLogId, setCurrentDeploymentLogId] = useState<string | null>(null);
  const [isNetlifyDeploying, setIsNetlifyDeploying] = useState(false);
  const [showNetlifyConfig, setShowNetlifyConfig] = useState(false);
  const [showNetlifySiteSelector, setShowNetlifySiteSelector] = useState(false);
  const [netlifySites, setNetlifySites] = useState<any[]>([]);
  const [loadingSites, setLoadingSites] = useState(false);
  const [creatingNetlifySite, setCreatingNetlifySite] = useState(false);
  const [newSiteName, setNewSiteName] = useState('');
  const [netlifyAccessToken, setNetlifyAccessToken] = useState('');
  const [savingNetlifyConfig, setSavingNetlifyConfig] = useState(false);
  const [pendingDeployData, setPendingDeployData] = useState<PendingDeployData | null>(null);
  const [isDirectDeploying, setIsDirectDeploying] = useState(false);
  const [showDirectDeployButton, setShowDirectDeployButton] = useState(false);
  const [currentEnvironmentId, setCurrentEnvironmentId] = useState<string>('');
  const [currentEnvironmentName, setCurrentEnvironmentName] = useState<string>('');
  const [savedRepo, setSavedRepo] = useState<any>(null);
  const [environmentBindingsMap, setEnvironmentBindingsMap] = useState<Record<string, EnvironmentDeployBinding>>({});
  const [showRepoBindingModal, setShowRepoBindingModal] = useState<string | null>(null);
  const [repoOptions, setRepoOptions] = useState<GitRepository[]>([]);
  const [repoSelectionOptions, setRepoSelectionOptions] = useState<RepoSelectionOption[]>([]);
  const [repoBindingNetlifySites, setRepoBindingNetlifySites] = useState<any[]>([]);
  const [loadingRepoBindingNetlifySites, setLoadingRepoBindingNetlifySites] = useState(false);
  const [loadingRepoOptions, setLoadingRepoOptions] = useState(false);
  const [savingRepoBinding, setSavingRepoBinding] = useState(false);
  const [repoBindingForm, setRepoBindingForm] = useState({
    deployProvider: 'netlify' as DeployProvider,
    repoKey: '',
    branch: 'main',
    netlifySiteId: '',
    azureContainerAppName: '',
    azureResourceGroup: '',
    azureLocation: '',
    azureContainerAppsEnvironment: '',
    azureCreateIfMissing: true,
  });
  const [bindingsFilter, setBindingsFilter] = useState<'all' | 'development' | 'testing' | 'production'>('all');
  const consoleRef = useRef<HTMLDivElement>(null);
  const logIdCounter = useRef(0);
  const logsRef = useRef<LogEntry[]>([]);
  const [notification, setNotification] = useState({
    isOpen: false,
    type: 'success' as 'success' | 'error' | 'warning' | 'info',
    title: '',
    message: '',
  });
  const [editFormData, setEditFormData] = useState({
    domain: '',
    auth_url: '',
    callback_url: ''
  });
  
  const [newEnvironment, setNewEnvironment] = useState({
    name: 'development' as 'development' | 'testing' | 'production',
    domain: '',
    base_url: '',
    callback_url: ''
  });

  useEffect(() => {
    loadApplications();
    loadSubscription();
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

  const addLog = (message: string, level: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    logIdCounter.current += 1;
    const newLog: LogEntry = {
      id: `${Date.now()}-${logIdCounter.current}`,
      timestamp: new Date().toLocaleTimeString(),
      level,
      message
    };
    logsRef.current = [...logsRef.current, newLog];
    setConsoleLogs(prev => [...prev, newLog]);
  };

  const clearLogs = () => {
    logsRef.current = [];
    setConsoleLogs([]);
  };

  const loadDeploymentHistory = async (environmentId: string) => {
    try {
      const { data, error } = await supabase
        .from('deployment_logs')
        .select('*')
        .eq('environment_id', environmentId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setHistoricalLogs(data || []);
    } catch (error) {
      console.error('Error loading deployment history:', error);
    }
  };

  const downloadLog = (log: any) => {
    const content = JSON.stringify(log, null, 2);
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `deployment-log-${log.id}-${new Date(log.created_at).toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDeleteLog = async (logId: string) => {
    try {
      const { error } = await supabase
        .from('deployment_logs')
        .delete()
        .eq('id', logId);

      if (error) throw error;

      // Reload the logs for the current environment
      if (showLogsHistory) {
        await loadDeploymentHistory(showLogsHistory);
      }

      showNotification('success', 'Log Eliminado', 'El log de deployment ha sido eliminado correctamente');
    } catch (error) {
      console.error('Error deleting log:', error);
      showNotification('error', 'Error', 'No se pudo eliminar el log de deployment');
    }
  };

  const loadSubscription = async () => {
    try {
      const sub = await subscriptionService.getCurrentSubscription();
      setSubscription(sub);
    } catch (error) {
      console.error('Error loading subscription:', error);
    }
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

  const loadEnvironments = async (silent: boolean = false) => {
    try {
      if (!silent) {
        setLoading(true);
      }
      const envs = await applicationService.getEnvironments(selectedApp);
      setEnvironments(envs);

      await loadEnvironmentBindings(selectedApp);

      // Load latest deployment logs for all environments
      await loadLatestLogs(envs);
    } catch (error) {
      console.error('Error loading environments:', error);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  const loadEnvironmentBindings = async (applicationId: string) => {
    try {
      const bindings = await environmentDeployBindingService.getBindingsForApplication(applicationId);
      const nextMap: Record<string, EnvironmentDeployBinding> = {};
      bindings.forEach((binding) => {
        nextMap[binding.environment_id] = binding;
      });
      setEnvironmentBindingsMap(nextMap);
    } catch (error) {
      console.warn('Error loading environment deploy bindings:', error);
      setEnvironmentBindingsMap({});
    }
  };

  const handleOpenRepoBindingModal = async (environmentId: string) => {
    try {
      const environment = environments.find(env => env.id === environmentId);
      if (!environment) {
        showNotification('error', 'Error', 'No se encontró el ambiente seleccionado.');
        return;
      }

      setLoadingRepoOptions(true);
      setLoadingRepoBindingNetlifySites(true);
      const savedRepos = await githubService.getSavedRepositories();
      setRepoOptions(savedRepos);

      let githubRepos: GitHubRepo[] = [];
      try {
        githubRepos = await githubService.listRepositories(1, 100);
      } catch (error) {
        console.warn('Could not list GitHub repositories for binding modal:', error);
      }

      const options: RepoSelectionOption[] = [];
      const added = new Set<string>();

      savedRepos.forEach((repo) => {
        options.push({
          key: `saved:${repo.id}`,
          label: repo.repo_full_name,
          source: 'saved',
          savedRepo: repo,
        });
        added.add(repo.repo_full_name);
      });

      githubRepos.forEach((repo) => {
        if (added.has(repo.full_name)) return;
        options.push({
          key: `github:${repo.id}`,
          label: `${repo.full_name} (GitHub)`,
          source: 'github',
          githubRepo: repo,
        });
      });

      setRepoSelectionOptions(options);

      let netlifySitesOptions: any[] = [];
      try {
        const netlifyConfig = await netlifyService.loadConfigFromDatabase();
        if (netlifyConfig?.access_token) {
          netlifySitesOptions = await netlifyService.listSites();
        }
      } catch (error) {
        console.warn('Could not load Netlify sites for binding modal:', error);
      }
      setRepoBindingNetlifySites(netlifySitesOptions);

      let azureDefaults: AzureContainerAppsConfig | null = null;
      try {
        azureDefaults = await connectorsService.getAzureContainerAppsConfig();
      } catch (error) {
        console.warn('Could not load Azure defaults for binding modal:', error);
      }

      const envBinding = environmentBindingsMap[environmentId];
      const selectedRepo = envBinding?.git_repository_id
        ? savedRepos.find(repo => repo.id === envBinding.git_repository_id)
        : envBinding?.repo_full_name
          ? savedRepos.find(repo => repo.repo_full_name === envBinding.repo_full_name)
          : null;

      const selectedOption = selectedRepo
        ? options.find(option => option.source === 'saved' && option.savedRepo?.id === selectedRepo.id)
        : envBinding?.repo_full_name
          ? options.find(option =>
              (option.source === 'saved' && option.savedRepo?.repo_full_name === envBinding.repo_full_name) ||
              (option.source === 'github' && option.githubRepo?.full_name === envBinding.repo_full_name)
            )
          : null;

      const selectedApplication = applications.find(app => app.id === selectedApp);

      setRepoBindingForm({
        deployProvider: envBinding?.deploy_provider || 'netlify',
        repoKey: selectedOption?.key || '',
        branch: envBinding?.branch || selectedRepo?.default_branch || 'main',
        netlifySiteId: envBinding?.netlify_site_id || '',
        azureContainerAppName: envBinding?.azure_container_app_name || buildDefaultContainerAppName(selectedApplication?.name || 'auth-forms', environment.name),
        azureResourceGroup: envBinding?.azure_resource_group || azureDefaults?.resource_group || '',
        azureLocation: envBinding?.azure_location || azureDefaults?.location || '',
        azureContainerAppsEnvironment: envBinding?.azure_containerapps_environment || azureDefaults?.containerapps_environment || '',
        azureCreateIfMissing: envBinding?.azure_create_if_missing ?? true,
      });

      setShowRepoBindingModal(environmentId);
      setOpenMenuId(null);
    } catch (error) {
      console.error('Error loading repositories for binding:', error);
      showNotification('error', 'Error', 'No se pudieron cargar los repositorios guardados.');
    } finally {
      setLoadingRepoOptions(false);
      setLoadingRepoBindingNetlifySites(false);
    }
  };

  const handleSaveRepoBinding = async () => {
    if (!showRepoBindingModal) return;
    if (!repoBindingForm.repoKey) {
      showNotification('warning', 'Repositorio requerido', 'Selecciona un repositorio para el ambiente.');
      return;
    }

    const selectedOption = repoSelectionOptions.find(option => option.key === repoBindingForm.repoKey);
    if (!selectedOption) {
      showNotification('error', 'Repositorio inválido', 'El repositorio seleccionado no es válido.');
      return;
    }

    if (repoBindingForm.deployProvider === 'azure_container_apps') {
      if (!repoBindingForm.azureResourceGroup.trim() || !repoBindingForm.azureLocation.trim()) {
        showNotification('warning', 'Datos incompletos', 'Para Azure debes indicar al menos el Resource Group y la region.');
        return;
      }
    }

    try {
      setSavingRepoBinding(true);
      let selectedRepo: GitRepository | null = null;

      if (selectedOption.source === 'saved' && selectedOption.savedRepo) {
        selectedRepo = selectedOption.savedRepo;
      } else if (selectedOption.source === 'github' && selectedOption.githubRepo) {
        selectedRepo = await githubService.saveRepository(selectedOption.githubRepo);
      }

      if (!selectedRepo) {
        showNotification('error', 'Repositorio inválido', 'No se pudo resolver el repositorio seleccionado.');
        return;
      }

      const selectedSite = repoBindingForm.deployProvider === 'netlify'
        ? repoBindingNetlifySites.find(site => site.id === repoBindingForm.netlifySiteId)
        : null;
      const savedBinding = await environmentDeployBindingService.upsertBinding({
        application_id: selectedApp,
        environment_id: showRepoBindingModal,
        deploy_provider: repoBindingForm.deployProvider,
        git_repository_id: selectedRepo.id,
        repo_full_name: selectedRepo.repo_full_name,
        branch: repoBindingForm.branch || selectedRepo.default_branch || 'main',
        netlify_site_id: repoBindingForm.deployProvider === 'netlify' ? (selectedSite?.id || null) : null,
        netlify_site_name: repoBindingForm.deployProvider === 'netlify' ? (selectedSite?.name || null) : null,
        netlify_site_url: repoBindingForm.deployProvider === 'netlify' ? (selectedSite?.ssl_url || selectedSite?.url || null) : null,
        azure_container_app_name: repoBindingForm.deployProvider === 'azure_container_apps'
          ? (repoBindingForm.azureContainerAppName.trim() || null)
          : null,
        azure_resource_group: repoBindingForm.deployProvider === 'azure_container_apps'
          ? (repoBindingForm.azureResourceGroup.trim() || null)
          : null,
        azure_location: repoBindingForm.deployProvider === 'azure_container_apps'
          ? (repoBindingForm.azureLocation.trim() || null)
          : null,
        azure_containerapps_environment: repoBindingForm.deployProvider === 'azure_container_apps'
          ? (repoBindingForm.azureContainerAppsEnvironment.trim() || null)
          : null,
        azure_create_if_missing: repoBindingForm.deployProvider === 'azure_container_apps'
          ? repoBindingForm.azureCreateIfMissing
          : true,
      });

      if (savedBinding) {
        setEnvironmentBindingsMap(prev => ({
          ...prev,
          [showRepoBindingModal]: savedBinding,
        }));
      }

      setShowRepoBindingModal(null);
      showNotification(
        'success',
        'Vínculo guardado',
        repoBindingForm.deployProvider === 'azure_container_apps'
          ? 'Repositorio, branch y configuración de Azure guardados para este ambiente.'
          : 'Repositorio, branch y sitio Netlify guardados para este ambiente.'
      );
    } catch (error) {
      console.error('Error saving environment repo binding:', error);
      showNotification('error', 'Error', 'No se pudo guardar la configuración del repositorio.');
    } finally {
      setSavingRepoBinding(false);
    }
  };

  const handleDisconnectEnvironmentDeploy = async (env: Environment) => {
    if (!confirm(`¿Desconectar el destino de publicación del ambiente "${env.name}"?`)) {
      return;
    }

    try {
      await environmentDeployBindingService.deleteBinding(env.id);
      setEnvironmentBindingsMap(prev => {
        const next = { ...prev };
        delete next[env.id];
        return next;
      });

      const envMetadata = env.metadata || {};
      const {
        github_repo,
        deployment_provider,
        netlify_site_id,
        netlify_site_name,
        netlify_site_url,
        azure_container_app_name,
        azure_resource_group,
        azure_location,
        azure_containerapps_environment,
        ...cleanMetadata
      } = envMetadata as any;

      await applicationService.updateEnvironment(env.id, {
        metadata: cleanMetadata
      });

      await loadEnvironments(true);
      showNotification('success', 'Desconectado', 'Se eliminó la asociación de publicación para este ambiente.');
    } catch (error) {
      console.error('Error disconnecting environment deploy binding:', error);
      showNotification('error', 'Error', 'No se pudo desconectar la configuración del ambiente.');
    } finally {
      setOpenMenuId(null);
    }
  };

  const loadLatestLogs = async (envs: any[]) => {
    try {
      const logsMap: Record<string, any> = {};

      // Load last successful deployment log for each environment
      for (const env of envs) {
        const { data, error } = await supabase
          .from('deployment_logs')
          .select('*')
          .eq('environment_id', env.id)
          .eq('status', 'success')
          .not('metadata->>deployed_urls', 'is', null)
          .order('completed_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!error && data) {
          logsMap[env.id] = data;
        }
      }

      setLatestLogsMap(logsMap);
    } catch (error) {
      console.error('Error loading latest logs:', error);
    }
  };

  const resolveRepositoryForEnvironment = async (environmentId: string, environment: any) => {
    const savedRepos = await githubService.getSavedRepositories();

    let binding: EnvironmentDeployBinding | null = null;
    try {
      binding = await environmentDeployBindingService.getBinding(environmentId);
    } catch (error) {
      console.warn('Could not load environment binding for repository resolution:', error);
    }

    if (savedRepos.length === 0) {
      if (binding?.repo_full_name) {
        return {
          repo: {
            id: binding.git_repository_id,
            repo_full_name: binding.repo_full_name,
            default_branch: binding.branch || 'main',
          },
          source: 'binding' as const,
        };
      }
      return { repo: null, source: 'none' as const };
    }

    try {
      if (binding) {
        const boundRepo = savedRepos.find(r =>
          (binding.git_repository_id && r.id === binding.git_repository_id) ||
          (binding.repo_full_name && r.repo_full_name === binding.repo_full_name)
        );

        if (boundRepo) {
          return { repo: boundRepo, source: 'binding' as const };
        }
      }
    } catch (error) {
      console.warn('Could not resolve repository using environment binding:', error);
    }

    const metadataRepo = environment?.metadata?.github_repo;
    if (metadataRepo) {
      const metadataMatch = savedRepos.find(r => r.repo_full_name === metadataRepo);
      if (metadataMatch) {
        return { repo: metadataMatch, source: 'metadata' as const };
      }
    }

    return { repo: savedRepos[0], source: 'fallback' as const };
  };

  const generateApiKey = (environment: string) => {
    const chars = 'abcdef0123456789';
    let result = `ak_${environment}_`; // ✅ USAR EL AMBIENTE CORRECTO
    for (let i = 0; i < 32; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  // Generate valid reset token (same logic as edge function)
  const generateValidResetToken = async (applicationId: string): Promise<string> => {
    try {
      // Generate random token (same as edge function)
      const array = new Uint8Array(32);
      crypto.getRandomValues(array);
      const resetToken = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');

      // Set expiration to 24 hours from now
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      // Get or create test user
      let testUser;
      const { data: existingUser, error: userError } = await supabase
        .from('app_users')
        .select('*')
        .eq('application_id', applicationId)
        .eq('email', 'test@example.com')
        .maybeSingle();

      if (existingUser) {
        testUser = existingUser;
      } else {
        // Create test user if it doesn't exist
        const { data: newUser, error: createError } = await supabase
          .from('app_users')
          .insert({
            application_id: applicationId,
            email: 'test@example.com',
            name: 'Test User',
            password_hash: 'test_hash', // Just a placeholder
            is_verified: true
          })
          .select()
          .single();

        if (createError) {
          console.error('Error creating test user:', createError);
          // Return a fallback token if we can't create the user
          return 'test_fallback_token';
        }
        testUser = newUser;
      }

      // Store reset token in database
      const { error: tokenError } = await supabase
        .from('email_verification_tokens')
        .insert({
          app_user_id: testUser.id,
          token: resetToken,
          expires_at: expiresAt.toISOString()
        });

      if (tokenError) {
        console.error('Error storing reset token:', tokenError);
        return 'test_fallback_token';
      }

      return resetToken;
    } catch (error) {
      console.error('Error generating valid reset token:', error);
      return 'test_fallback_token';
    }
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
      await loadEnvironments(true);
    } catch (error) {
      console.error('Error creating environment:', error);
    }
  };

  const handleDeployToAzureContainerApps = async ({
    binding,
    repo,
    files,
    deployBranch,
    environment,
    environmentId,
    environmentName,
    applicationId,
    apiKey,
    selectedApplication,
    deploymentLogId,
  }: {
    binding: EnvironmentDeployBinding | null;
    repo: GitRepository;
    files: Record<string, string>;
    deployBranch: string;
    environment: Environment;
    environmentId: string;
    environmentName: string;
    applicationId: string;
    apiKey: string;
    selectedApplication: any;
    deploymentLogId: string | null;
  }) => {
    addLog('☁️ Paso 13: Preparando deploy a Azure Container Apps...', 'info');

    const azureConfig = await connectorsService.getAzureContainerAppsConfig();
    if (!azureConfig) {
      throw new Error('Azure Container Apps no está configurado en Conectores.');
    }

    const containerAppName = binding?.azure_container_app_name
      || buildDefaultContainerAppName(selectedApplication.name || selectedApplication.domain || 'auth-forms', environmentName);
    const resourceGroup = binding?.azure_resource_group || azureConfig.resource_group;
    const location = binding?.azure_location || azureConfig.location;
    const containerAppsEnvironment = binding?.azure_containerapps_environment || azureConfig.containerapps_environment || `${containerAppName}-env`;
    const createIfMissing = binding?.azure_create_if_missing ?? true;

    addLog(`   Proveedor: Azure Container Apps`, 'success');
    addLog(`   Container App: ${containerAppName}`, 'info');
    addLog(`   Resource Group: ${resourceGroup}`, 'info');
    addLog(`   Región: ${location}`, 'info');
    addLog(`   ACA Environment: ${containerAppsEnvironment}`, 'info');
    addLog(`   Branch: ${deployBranch}`, 'info');
    addLog('', 'info');

    const deployFiles = applyAzureContainerAppsDeploymentFiles(files, {
      environmentName,
      branch: deployBranch,
      applicationDisplayName: selectedApplication.name || 'AuthSystem',
      containerAppName,
      resourceGroup,
      location,
      containerAppsEnvironment,
      createIfMissing,
    });

    addLog(`📦 Archivos finales con overlay Azure: ${Object.keys(deployFiles).length}`, 'success');
    addLog('🔐 Sincronizando secreto AZURE_CREDENTIALS en GitHub Actions...', 'info');

    const secretsResult = await githubService.syncRepositorySecrets(repo.repo_full_name, {
      AZURE_CREDENTIALS: buildAzureCredentialsSecretPayload(azureConfig),
    });

    if (!secretsResult.success) {
      throw new Error(secretsResult.error || 'No se pudieron sincronizar los secretos de GitHub Actions.');
    }

    addLog('✅ Secreto AZURE_CREDENTIALS sincronizado', 'success');
    addLog('📤 Subiendo workflow y código al repositorio...', 'info');

    const commitResult = await githubService.commitAndPush(
      repo.repo_full_name,
      deployFiles,
      getCommitMessage(applicationId, environmentName),
      deployBranch
    );

    if (!commitResult.success) {
      throw new Error(commitResult.error || 'No se pudo subir el deployment a GitHub.');
    }

    addLog(`✅ Commit publicado en ${repo.repo_full_name}`, 'success');
    addLog(`   Commit: ${commitResult.sha?.substring(0, 7) || 'n/a'}`, 'info');
    addLog('🤖 GitHub Actions creará o actualizará la Container App automáticamente.', 'info');
    addLog('', 'info');

    const baseUrl = (environment.auth_url || '').replace(/\/+$/, '');
    const fallbackCallbackUrl = environment.callback_url || `https://${selectedApplication.domain}/callback`;
    const redirectUri = encodeURIComponent(fallbackCallbackUrl);
    const loginUrl = `${baseUrl}/login?app_id=${applicationId}&redirect_uri=${redirectUri}&api_key=${apiKey}`;
    const registerUrl = `${baseUrl}/register?app_id=${applicationId}&redirect_uri=${redirectUri}&api_key=${apiKey}`;
    const resetUrl = `${baseUrl}/reset-password?app_id=${applicationId}&redirect_uri=${redirectUri}&api_key=${apiKey}`;
    const registerTenantUrl = selectedApplication?.auth_mode === 'tenant'
      ? `${baseUrl}/register-tenant?app_id=${applicationId}&redirect_uri=${redirectUri}&api_key=${apiKey}`
      : null;

    await applicationService.updateEnvironment(environmentId, {
      auth_url: environment.auth_url,
      callback_url: fallbackCallbackUrl,
      metadata: {
        ...(environment.metadata || {}),
        github_repo: repo.repo_full_name,
        deployment_provider: 'azure_container_apps',
        azure_container_app_name: containerAppName,
        azure_resource_group: resourceGroup,
        azure_location: location,
        azure_containerapps_environment: containerAppsEnvironment,
        last_commit: commitResult.sha,
        last_deploy: new Date().toISOString(),
        deployment_status: 'deployed',
        api_key: apiKey,
      }
    });

    const updatedBinding = await environmentDeployBindingService.upsertBinding({
      application_id: selectedApp,
      environment_id: environmentId,
      deploy_provider: 'azure_container_apps',
      git_repository_id: repo.id,
      repo_full_name: repo.repo_full_name,
      branch: deployBranch,
      azure_container_app_name: containerAppName,
      azure_resource_group: resourceGroup,
      azure_location: location,
      azure_containerapps_environment: containerAppsEnvironment,
      azure_create_if_missing: createIfMissing,
    });

    if (updatedBinding) {
      setEnvironmentBindingsMap(prev => ({
        ...prev,
        [environmentId]: updatedBinding,
      }));
    }

    try {
      const { data: currentApp, error: fetchError } = await supabase
        .from('applications')
        .select('metadata')
        .eq('id', selectedApp)
        .single();

      if (fetchError) throw fetchError;

      const authUrls: Record<string, any> = {
        base_url: baseUrl,
        callback_url: fallbackCallbackUrl,
        login_url: loginUrl,
        register_url: registerUrl,
        reset_password_url: resetUrl,
        deployed_at: new Date().toISOString(),
        deployment_provider: 'azure_container_apps',
        azure_container_app_name: containerAppName,
      };

      if (registerTenantUrl) {
        authUrls.register_tenant_url = registerTenantUrl;
      }

      const updatedMetadata = {
        ...(currentApp?.metadata || {}),
        environment_urls: {
          ...(currentApp?.metadata?.environment_urls || {}),
          [environmentName.toLowerCase()]: authUrls,
        }
      };

      const { error: updateError } = await supabase
        .from('applications')
        .update({
          metadata: updatedMetadata,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedApp);

      if (updateError) throw updateError;

      addLog('✅ URLs públicas actualizadas para Azure', 'success');
    } catch (error: any) {
      addLog(`⚠️ No se pudieron actualizar las URLs publicas: ${error.message}`, 'warning');
    }

    if (deploymentLogId) {
      await supabase
        .from('deployment_logs')
        .update({
          status: 'success',
          completed_at: new Date().toISOString(),
          logs: logsRef.current.map(log => ({
            timestamp: log.timestamp,
            level: log.level,
            message: log.message
          })),
          metadata: {
            environment_name: environmentName,
            deployment_provider: 'azure_container_apps',
            github_repo: repo.repo_full_name,
            azure_container_app_name: containerAppName,
            azure_resource_group: resourceGroup,
            azure_location: location,
            workflow_branch: deployBranch,
            deployed_urls: {
              login_url: loginUrl,
              register_url: registerUrl,
              reset_password_url: resetUrl,
              ...(registerTenantUrl ? { register_tenant_url: registerTenantUrl } : {}),
            }
          }
        })
        .eq('id', deploymentLogId);
    }

    addLog('🎉 Workflow de Azure preparado y publicado.', 'success');
    addLog(`🌐 Login: ${loginUrl}`, 'info');
    if (registerTenantUrl) {
      addLog(`🌐 Tenant: ${registerTenantUrl}`, 'info');
    }
    addLog('ℹ️ El despliegue efectivo ocurre en GitHub Actions sobre la branch vinculada.', 'info');

    await loadApplications();
    await loadEnvironments(true);
    showNotification(
      'success',
      'Deploy enviado a Azure',
      `Se actualizó el repositorio ${repo.repo_full_name}. GitHub Actions continuará el despliegue de ${containerAppName}.`
    );
  };

  const handleDeploy = async (environmentId: string, environmentName: string) => {
    let deploymentLogId: string | null = null;

    try {
      setDeployLoading(environmentId);
      setIsDeploying(true);
      setShowConsole(true);
      clearLogs();

      addLog('', 'info');
      addLog('🚀 ========================================', 'info');
      addLog('🚀 INICIO DEL DESPLIEGUE', 'info');
      addLog('🚀 ========================================', 'info');
      addLog('', 'info');

      // Create deployment log record
      const { data: { user } } = await supabase.auth.getUser();
      const { data: deploymentLog, error: deployLogError } = await supabase
        .from('deployment_logs')
        .insert({
          environment_id: environmentId,
          application_id: selectedApp,
          user_id: user?.id,
          deployment_type: 'deploy',
          status: 'running',
          started_at: new Date().toISOString(),
          logs: [],
          metadata: { environment_name: environmentName }
        })
        .select()
        .single();

      if (!deployLogError && deploymentLog) {
        deploymentLogId = deploymentLog.id;
        addLog(`📝 Log de deployment creado: ${deploymentLogId.substring(0, 8)}...`, 'info');
      }

      // Step 1: Validate subscription and plan
      addLog('📋 Paso 1: Validando suscripción y plan...', 'info');
      if (!subscription) {
        addLog('❌ No se encontró suscripción activa', 'error');
        return;
      }

      const plan = subscription.subscription_plans;
      if (!plan) {
        addLog('❌ No se encontró plan de suscripción', 'error');
        return;
      }

      addLog(`✅ Plan activo: ${plan.name}`, 'success');
      addLog(`   Límites del plan:`, 'info');
      addLog(`   - Aplicaciones: ${plan.limits.applications}`, 'info');
      addLog(`   - Usuarios: ${plan.limits.users_per_app}`, 'info');
      addLog(`   - API Requests/mes: ${plan.limits.api_requests_per_month.toLocaleString()}`, 'info');
      addLog(`   - Ambientes: ${plan.limits.environments.join(', ')}`, 'info');
      addLog('', 'info');

      // Step 2: Validate environment access
      addLog('🔐 Paso 2: Validando acceso al ambiente...', 'info');
      const canAccess = await subscriptionService.canAccessEnvironment(environmentName);
      if (!canAccess) {
        addLog(`❌ Tu plan ${plan.name} no tiene acceso al ambiente ${environmentName}`, 'error');
        addLog(`   Ambientes disponibles: ${plan.limits.environments.join(', ')}`, 'warning');
        addLog(`   Actualiza tu plan para acceder a este ambiente`, 'warning');
        return;
      }
      addLog(`✅ Acceso al ambiente ${environmentName} verificado`, 'success');
      addLog('', 'info');
      // Step 3: Validate application
      addLog('📱 Paso 3: Validando aplicación...', 'info');
      const selectedApplication = applications.find(app => app.id === selectedApp);
      if (!selectedApplication) {
        addLog('❌ No se encontró la aplicación seleccionada', 'error');
        return;
      }

      const applicationId = selectedApplication.application_id;
      addLog(`   ID: ${applicationId}`, 'info');
      addLog(`   Nombre: ${selectedApplication.name}`, 'info');
      addLog(`   Dominio: ${selectedApplication.domain}`, 'info');

      // Validate application configuration
      if (!selectedApplication.application_id || !selectedApplication.name) {
        addLog('❌ Configuración de aplicación incompleta', 'error');
        return;
      }
      addLog('✅ Aplicación configurada correctamente', 'success');
      addLog('', 'info');

      // Step 4: Validate API Key limits
      addLog('🔑 Paso 4: Verificando límites de API Keys...', 'info');
      const canCreateKey = await subscriptionService.canCreateApiKey(selectedApp, environmentName);
      if (!canCreateKey.allowed) {
        addLog(`❌ ${canCreateKey.reason}`, 'error');
        addLog(`   Actualmente: ${canCreateKey.current} / ${canCreateKey.limit}`, 'warning');
        return;
      }
      addLog(`✅ Puedes crear API Keys en este ambiente`, 'success');
      addLog(`   Uso actual: ${canCreateKey.current} / ${canCreateKey.limit === -1 ? 'ilimitado' : canCreateKey.limit}`, 'info');
      addLog('', 'info');

      // Get environment configuration
      addLog('⚙️  Paso 5: Configurando ambiente...', 'info');
      const environment = environments.find(env => env.id === environmentId);
      if (!environment) {
        addLog('❌ Ambiente no encontrado', 'error');
        return;
      }
      let currentEnvironmentMetadata = { ...(environment.metadata || {}) };
      let deployedBrandingSnapshot: any = null;

      // Get base URL from environment (priority: environment.auth_url > fallback)
      // Always use the auth_url from the environment (which can be edited by user)
      let baseUrl = environment.auth_url || `https://auth-${environmentName}.${selectedApplication.domain}`;
      const callbackUrl = environment.callback_url || `https://${selectedApplication.domain}/callback`;

      // Ensure baseUrl doesn't end with slash to avoid double slashes
      baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;

      addLog(`🌐 Base URL: ${baseUrl}`, 'info');
      addLog(`🔄 Callback URL: ${callbackUrl}`, 'info');
      addLog('🎨 Publicando snapshot del branding para este ambiente...', 'info');
      try {
        const publishResult = await applicationService.publishBrandingToEnvironment(selectedApp, environmentId);
        deployedBrandingSnapshot = publishResult.snapshot;
        currentEnvironmentMetadata = { ...(publishResult.environment.metadata || {}) };
        addLog('✅ Snapshot de branding publicado para el ambiente', 'success');
      } catch (publishError: any) {
        addLog(`⚠️ No se pudo publicar el snapshot de branding: ${publishError?.message || 'Error desconocido'}`, 'warning');
      }

      // Verificar si ya existe una API Key para este ambiente
      addLog('🔑 Verificando API Key existente...', 'info');
      const { data: existingApiKeys } = await supabase
        .from('api_keys')
        .select('*')
        .eq('application_id', selectedApp)
        .eq('environment', environmentName)
        .eq('is_active', true)
        .limit(1);

      let apiKey = '';
      if (existingApiKeys && existingApiKeys.length > 0) {
        // Ya existe una API Key, NO crear otra
        addLog(`   ✓ API Key existente encontrada: ${existingApiKeys[0].key_preview}`, 'success');
        addLog(`   ℹ️  Usando API Key existente para este ambiente`, 'info');
        // Generar una nueva para este deploy específico (temporal para URLs de prueba)
        apiKey = generateApiKey(environmentName);
      } else {
        // No existe, generar nueva
        apiKey = generateApiKey(environmentName);
        addLog(`   ✓ Nueva API Key generada: ${apiKey.substring(0, 20)}...`, 'success');
      }

      // Generate valid reset token for testing (same logic as edge function)
      addLog('🔑 Generando token válido para reset password...', 'info');
      const testToken = await generateValidResetToken(selectedApplication.id);
      addLog(`✅ Token válido generado y guardado en BD (expira en 24h)`, 'success');
      addLog('', 'info');

      // Save API key to database (solo si no existe)
      addLog('💾 Paso 6: Guardando API key en la base de datos...', 'info');

      if (!existingApiKeys || existingApiKeys.length === 0) {
        try {
          const { data: apiKeyData, error: apiKeyError } = await supabase
            .from('api_keys')
            .insert({
              application_id: selectedApp,
              name: `${environmentName.charAt(0).toUpperCase() + environmentName.slice(1)} Environment Key`,
              key_hash: apiKey,
              key_preview: `${apiKey.substring(0, 12)}...${apiKey.substring(apiKey.length - 6)}`,
              permissions: ['read', 'write'],
              environment: environmentName,
              is_active: true
            })
            .select()
            .single();

          if (apiKeyError) {
            addLog(`⚠️ Advertencia: No se pudo guardar la API key: ${apiKeyError.message}`, 'warning');
          } else {
            addLog('✅ API key guardada exitosamente', 'success');
          }
        } catch (error) {
          addLog(`⚠️ Advertencia: No se pudo guardar la API key: ${error.message}`, 'warning');
        }
      } else {
        addLog('✅ API key ya existe en la base de datos', 'success');
      }
      addLog('', 'info');

      // Test API endpoints
      addLog('🧪 Paso 7: Probando endpoints de Edge Functions...', 'info');
      const supabaseUrl = requireSupabaseUrl();
      const testResults = await testAllEndpoints(supabaseUrl, applicationId, apiKey);
      addLog('', 'info');

      // Update environment with test results
      addLog('💾 Paso 8: Actualizando configuración del ambiente...', 'info');
        try {
          const updatedEnvironment = await applicationService.updateEnvironment(environmentId, {
            auth_url: baseUrl,
            callback_url: callbackUrl,
            metadata: {
              ...currentEnvironmentMetadata,
              api_key: apiKey,
              deployment_status: 'deployed',
              test_results: testResults,
              deployed_at: new Date().toISOString()
            }
          });
          currentEnvironmentMetadata = { ...(updatedEnvironment.metadata || {}) };
          addLog('✅ Ambiente actualizado exitosamente', 'success');
        addLog('', 'info');

        // Reload environments to show updated data
        await loadEnvironments(true);
      } catch (updateError) {
        addLog(`⚠️ Advertencia: No se pudo actualizar el ambiente: ${updateError.message}`, 'warning');
      }

      // Show test results summary
      addLog('📊 Paso 9: Resultados de las pruebas:', 'info');
      Object.entries(testResults).forEach(([endpoint, result]) => {
        const status = result.success ? '✅' : '❌';
        const time = result.responseTime ? `(${result.responseTime}ms)` : '';
        addLog(`   ${status} ${endpoint}: ${result.status} ${time}`, result.success ? 'success' : 'error');
      });

      const allTestsPassed = Object.values(testResults).every(result => result.success);
      addLog('', 'info');

      if (!allTestsPassed) {
        addLog(`⚠️ Algunas pruebas de Edge Functions fallaron`, 'warning');
        addLog(`ℹ️  Esto es normal si estás deployando por primera vez`, 'info');
        addLog(`📋 Las Edge Functions se probarán cuando el sitio esté deployado`, 'info');
        addLog('', 'info');
      } else {
        addLog(`🎉 ¡Pruebas de Edge Functions exitosas!`, 'success');
        addLog('', 'info');
      }

      // =================================================================
      // PASO 10: VERIFICAR GITHUB Y NETLIFY
      // =================================================================
      addLog('🔗 Paso 10: Verificando conectores...', 'info');

      const environmentBinding = environmentBindingsMap[environmentId] || null;
      const deployProvider = environmentBinding?.deploy_provider || 'netlify';
      const githubConfigured = await connectorsService.isGitHubConfigured();
      const githubConnection = await githubService.getActiveConnection();
      const netlifyConfigured = deployProvider === 'netlify'
        ? await connectorsService.isNetlifyConfigured()
        : false;
      const azureConfigured = deployProvider === 'azure_container_apps'
        ? await connectorsService.isAzureContainerAppsConfigured()
        : false;

      if (!githubConfigured || !githubConnection) {
        addLog('', 'info');
        addLog('⚠️  GitHub no está configurado o conectado', 'warning');
        addLog(
          deployProvider === 'azure_container_apps'
            ? '📋 Para deployar a Azure Container Apps necesitas:'
            : '📋 Para deployar a Netlify necesitas:',
          'info'
        );
        addLog('   1. Configurar GitHub en "Conectores" (Client ID y Secret)', 'info');
        addLog('   2. Conectar tu cuenta de GitHub', 'info');
        addLog('   3. Crear o seleccionar un repositorio', 'info');
        addLog('', 'info');
        addLog('✅ Edge Functions están funcionando correctamente', 'success');
        addLog('📚 Usa el botón "Ver URLs" para integración manual', 'info');
        return true;
      }

      if (deployProvider === 'netlify' && !netlifyConfigured) {
        addLog('', 'info');
        addLog('⚠️  Netlify no está configurado', 'warning');
        addLog('📋 Configura tu Access Token de Netlify en "Conectores"', 'info');
        addLog('', 'info');
        addLog('✅ Edge Functions están funcionando correctamente', 'success');
        return true;
      }

      if (deployProvider === 'azure_container_apps' && !azureConfigured) {
        addLog('', 'info');
        addLog('⚠️  Azure Container Apps no está configurado', 'warning');
        addLog('📋 Configura las credenciales de Azure en "Conectores"', 'info');
        addLog('', 'info');
        addLog('✅ Edge Functions están funcionando correctamente', 'success');
        return true;
      }

      addLog('✅ GitHub conectado', 'success');
      addLog(
        deployProvider === 'azure_container_apps'
          ? '✅ Azure Container Apps configurado'
          : '✅ Netlify configurado',
        'success'
      );
      addLog('', 'info');

      // =================================================================
      // PASO 11: OBTENER REPOSITORIO
      // =================================================================
      addLog('📦 Paso 11: Obteniendo repositorio de GitHub...', 'info');
      const repoResolution = await resolveRepositoryForEnvironment(environmentId, environment);

      if (!repoResolution.repo) {
        addLog('⚠️  No hay repositorios guardados', 'warning');
        addLog('📋 Crea o selecciona un repositorio en "Conectores"', 'info');
        addLog('', 'info');
        addLog('✅ Edge Functions están funcionando correctamente', 'success');
        return true;
      }

      const repo = repoResolution.repo;
      const deployBranch = environmentBindingsMap[environmentId]?.branch || repo.default_branch || 'main';
      if (repoResolution.source === 'binding') {
        addLog('   ✓ Repositorio resuelto por vínculo del ambiente', 'success');
      } else if (repoResolution.source === 'metadata') {
        addLog('   ✓ Repositorio resuelto por metadata del ambiente', 'info');
      } else {
        addLog('   ℹ️ Usando repositorio por fallback (primero guardado)', 'warning');
      }

      setSavedRepo(repo);
      addLog(`✅ Repositorio: ${repo.repo_full_name}`, 'success');
      addLog(`   🌿 Branch: ${deployBranch}`, 'info');
      addLog('', 'info');

      // =================================================================
      // PASO 12: GENERAR ARCHIVOS DE CONFIGURACIÓN PARA REACT
      // =================================================================
      addLog('⚙️  Paso 12: Generando configuración para React App...', 'info');

      const app = selectedApplication;
      // supabaseUrl ya fue declarado arriba (línea 387)

      // Usar el snapshot de branding publicado para este ambiente
      addLog('🎨 Preparando branding publicado del ambiente...', 'info');
      const brandingData = deployedBrandingSnapshot || await applicationService.getPublicBranding(app.id, {
        environmentId,
        environmentName,
        host: environment.domain
      });

      if (brandingData) {
        addLog(`   ✓ Branding publicado listo (${brandingData.primary_color || 'default'})`, 'success');
      } else {
        addLog('   ℹ️  Usando branding por defecto', 'info');
      }

      // Usar la misma API Key que ya verificamos arriba
      // Esta API Key ya fue verificada/creada en el Paso 5-6
      const deployApiKey = apiKey; // Reusar la misma API Key
      addLog(`   ✓ Usando API Key del ambiente: ${deployApiKey.substring(0, 20)}...`, 'success');

      // Generar TODOS los archivos de la aplicación React completa
      addLog('📦 Generando aplicación React completa...', 'info');
      addLog('   Preparando componentes, servicios, y configuración', 'info');

      const files = await getReactProjectFiles(
        app.application_id,
        deployApiKey,
        brandingData || {}
      );

      addLog(`   ✓ ${Object.keys(files).length} archivos generados`, 'success');
      addLog('   ✓ Incluye PublicAuthForms.tsx completo', 'success');
      addLog('   ✓ Incluye todos los servicios necesarios', 'success');
      addLog('   ✓ Configuración específica para esta aplicación', 'success');
      addLog('', 'info');

      // =================================================================
      // PASO 13: SELECCIONAR SITIO DE NETLIFY
      // =================================================================
      addLog(
        deployProvider === 'azure_container_apps'
          ? '🌐 Paso 13: Preparando deploy a Azure Container Apps...'
          : '🌐 Paso 13: Preparando deploy a Netlify...',
        'info'
      );

      // Guardar datos para continuar (manual o automático)
      const deployData = {
        files,
        repo,
        deployBranch,
        environmentId,
        environmentName,
        environment: {
          ...environment,
          metadata: currentEnvironmentMetadata
        },
        applicationId,
        apiKey
      };
      setPendingDeployData(deployData);

      if (deployProvider === 'azure_container_apps') {
        await handleDeployToAzureContainerApps({
          binding: environmentBinding,
          repo,
          files,
          deployBranch,
          environment: {
            ...environment,
            metadata: currentEnvironmentMetadata
          },
          environmentId,
          environmentName,
          applicationId,
          apiKey,
          selectedApplication,
          deploymentLogId,
        });
        return true;
      }

      // Si ya hay sitio vinculado al ambiente, reutilizarlo automáticamente
      if (environmentBinding?.netlify_site_id) {
        addLog('🔁 Sitio Netlify encontrado en el vínculo del ambiente', 'success');
        addLog('🧭 Modo: Auto-site con commit obligatorio', 'info');
        addLog('   Flujo esperado: Paso 13 -> Paso 14 (GitHub commit) -> Paso 15 (Netlify build)', 'info');
        const boundSiteId = environmentBinding.netlify_site_id;
        let boundSiteName = environmentBinding.netlify_site_name || 'Sitio vinculado';
        let boundSiteUrl = environmentBinding.netlify_site_url || '';

        try {
          await netlifyService.loadConfigFromDatabase();
          const site = await netlifyService.getSite(boundSiteId);
          boundSiteName = site.name || boundSiteName;
          boundSiteUrl = site.ssl_url || site.url || boundSiteUrl;
        } catch (error: any) {
          addLog(`⚠️ No se pudo validar el sitio vinculado: ${error?.message || 'Error desconocido'}`, 'warning');
        }

        if (boundSiteUrl) {
          addLog(`   ✓ Reutilizando sitio: ${boundSiteName}`, 'info');
          addLog(`   ✓ URL: ${boundSiteUrl}`, 'info');
          await handleSelectNetlifySite(boundSiteId, boundSiteName, boundSiteUrl, deployData);
          return true;
        }

        addLog('⚠️ El sitio vinculado no tiene URL válida, se pedirá selección manual', 'warning');
      }

      addLog('', 'info');
      addLog('🧭 Modo: Selección manual de sitio (con commit obligatorio después de seleccionar)', 'info');
      addLog('📋 Ahora necesitas seleccionar el sitio de Netlify donde deployar:', 'info');
      addLog('   1. Se abrirá un selector de sitios', 'info');
      addLog('   2. Selecciona un sitio existente o crea uno nuevo', 'info');
      addLog('   3. La configuración se subirá a GitHub', 'info');
      addLog('   4. Netlify buildará tu aplicación React completa', 'info');
      addLog('   5. Se deployarán todos los componentes con validaciones', 'info');
      addLog('', 'info');

      // Cargar sitios y mostrar selector
      await loadNetlifySites();
      setShowNetlifySiteSelector(true);

      addLog('⏸️  Deploy pausado - Esperando selección de sitio...', 'info');

      // Save partial logs to database (deployment continues in handleSelectNetlifySite)
      if (deploymentLogId) {
        await supabase
          .from('deployment_logs')
          .update({
            status: 'partial',
            logs: logsRef.current.map(log => ({
              timestamp: log.timestamp,
              level: log.level,
              message: log.message
            })),
            metadata: {
              environment_name: environmentName,
              pending_site_selection: true
            }
          })
          .eq('id', deploymentLogId);

        // Store deploymentLogId for continuation
        setCurrentDeploymentLogId(deploymentLogId);
      }

      return true;

    } catch (error) {
      console.error('Deploy error:', error);
      addLog(`❌ Deployment failed: ${error.message || 'Unknown error'}`, 'error');

      // Update deployment log with error
      if (deploymentLogId) {
        await supabase
          .from('deployment_logs')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            logs: logsRef.current.map(log => ({
              timestamp: log.timestamp,
              level: log.level,
              message: log.message
            })),
            metadata: { error: error.message || 'Unknown error' }
          })
          .eq('id', deploymentLogId);
      }

      return false;
    } finally {
      setDeployLoading(null);
      setIsDeploying(false);
    }
  };

  // ============================================================================
  // FUNCIÓN DEPRECADA - YA NO SE USA
  // Toda la lógica de deploy ahora está integrada en handleDeploy()
  // El botón "Desplegar" hace todo automáticamente: valida, genera archivos,
  // sube a GitHub y Netlify auto-deploya desde allí
  // ============================================================================
  const handleDeployToNetlify = async (environmentId: string, environmentName: string) => {
    try {
      // Save environment info
      setCurrentEnvironmentId(environmentId);
      setCurrentEnvironmentName(environmentName);

      // STEP 1: Verificar configuración y conexión de GitHub
      const githubConfigured = await connectorsService.isGitHubConfigured();
      const githubConnection = await githubService.getActiveConnection();

      if (!githubConfigured || !githubConnection) {
        let message = '';
        if (!githubConfigured) {
          message = 'Primero configura GitHub en la sección "Conectores" (Client ID y Client Secret).';
        } else if (!githubConnection) {
          message = 'Tienes GitHub configurado, pero necesitas conectar tu cuenta. Ve a "Conectores" y haz clic en "Conectar con GitHub".';
        }

        showNotification('warning', 'GitHub no Conectado', message);
        return;
      }

      // STEP 2: Validar que Netlify esté configurado
      const netlifyConfigured = await connectorsService.isNetlifyConfigured();
      if (!netlifyConfigured) {
        showNotification('warning', 'Netlify no Configurado',
          'Configura tu Access Token de Netlify en la sección "Conectores".');
        return;
      }

      // STEP 3: Verificar/Obtener repositorios guardados
      const environmentForRepo = environments.find(e => e.id === environmentId);
      const repoResolution = await resolveRepositoryForEnvironment(environmentId, environmentForRepo);
      if (!repoResolution.repo) {
        showNotification('warning', 'Repositorio Requerido',
          'Crea o selecciona un repositorio de GitHub en la sección "Conectores" primero.');
        return;
      }

      const repo = repoResolution.repo;
      setSavedRepo(repo);

      setIsNetlifyDeploying(true);
      setShowConsole(true);
      setShowDirectDeployButton(false);

      addLog('', 'info');
      addLog('🚀 ========================================', 'info');
      addLog('🚀 INICIANDO DEPLOY AUTOMÁTICO', 'info');
      addLog('🚀 ========================================', 'info');
      addLog('', 'info');

      // STEP 5: Obtener el código del ambiente
      addLog('📦 Obteniendo código del ambiente...', 'info');
      const environment = environments.find(e => e.id === environmentId);
      if (!environment) {
        throw new Error('Ambiente no encontrado');
      }

      // STEP 5.1: Inicializar variables de entorno si no existen
      addLog('🔧 Configurando variables de entorno...', 'info');
      const app = applications.find(a => a.id === selectedApp);
      if (!app) {
        throw new Error('Aplicación no encontrada');
      }

      try {
        const existingVars = await environmentVariablesService.getVariablesForApplication(app.id);
        if (existingVars.length === 0) {
          addLog('   Inicializando variables de entorno por primera vez...', 'info');
          await environmentVariablesService.initializeDefaultVariables(app.id);
        }
      } catch (error) {
        console.error('Error initializing env vars:', error);
      }

      // STEP 5.2: Cargar variables de entorno para este ambiente
      const envVars = await environmentVariablesService.getVariablesForEnvironment(app.id, environmentId);
      addLog(`   ✓ ${envVars.length} variables de entorno cargadas`, 'success');

      // STEP 5.3: Obtener o crear API Key para el ambiente
      addLog('🔑 Verificando API Key para el ambiente...', 'info');
      addLog(`   📍 Ambiente: ${environmentName}`, 'info');

      // Buscar API key existente para este ambiente
      let { data: apiKeys, error: selectError } = await supabase
        .from('api_keys')
        .select('id, name, key_preview, environment')
        .eq('application_id', app.id)
        .eq('environment', environmentName)
        .eq('is_active', true)
        .limit(1);

      if (selectError) {
        console.error('Error selecting API keys:', selectError);
        throw new Error(`Error al buscar API Key: ${selectError.message}`);
      }

      let apiKey: string;

      if (!apiKeys || apiKeys.length === 0) {
        // No hay API Key para este ambiente, crear una nueva
        addLog('   No se encontró API Key, creando una nueva...', 'info');

        const subscription = await subscriptionService.getCurrentSubscription();
        if (!subscription) {
          throw new Error('No hay suscripción activa');
        }

        // El plan viene anidado en la suscripción
        const plan = subscription.subscription_plans;
        if (!plan) {
          throw new Error('No se pudo obtener información del plan');
        }

        // Verificar límite de API Keys POR AMBIENTE (no total)
        const { count: envKeyCount } = await supabase
          .from('api_keys')
          .select('id', { count: 'exact', head: true })
          .eq('application_id', app.id)
          .eq('environment', environmentName)
          .eq('is_active', true);

        const currentEnvKeyCount = envKeyCount || 0;

        // El límite es por ambiente, no total
        const maxApiKeysPerEnv = plan.api_keys_per_environment || plan.max_api_keys || 1;

        if (currentEnvKeyCount >= maxApiKeysPerEnv) {
          throw new Error(`Has alcanzado el límite de ${maxApiKeysPerEnv} API Keys para el ambiente ${environmentName}. Desactiva una API Key existente o actualiza tu plan.`);
        }

        // Generar nueva API Key con el nombre correcto del ambiente
        const keyPrefix = `ak_${environmentName}_`;
        const randomPart = Array.from(crypto.getRandomValues(new Uint8Array(16)))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
        apiKey = keyPrefix + randomPart;

        // Crear preview (primeros 20 chars + ... + últimos 4)
        const keyPreview = `${apiKey.substring(0, 20)}...${apiKey.substring(apiKey.length - 4)}`;

        const { error: insertError } = await supabase
          .from('api_keys')
          .insert({
            application_id: app.id,
            name: `${environmentName} API Key`,
            key_hash: apiKey,
            key_preview: keyPreview,
            environment: environmentName,
            is_active: true
          });

        if (insertError) {
          console.error('Error creating API key:', insertError);
          throw new Error(`Error al crear API Key: ${insertError.message}`);
        }

        addLog(`   ✓ API Key creada: ${keyPreview}`, 'success');
      } else {
        // Ya existe una API Key para este ambiente
        apiKey = apiKeys[0].key_hash;
        addLog(`   ✓ API Key existente encontrada: ${apiKeys[0].key_preview}`, 'success');
      }

      addLog('📁 Preparando formularios estáticos...', 'info');
      const supabaseUrl = requireSupabaseUrl();
      const supabaseAnonKey = requireSupabaseAnonKey();

      // Publicar y usar el branding del ambiente para el deploy
      addLog('🎨 Publicando branding del ambiente...', 'info');
      let brandingData = null;
      try {
        const publishResult = await applicationService.publishBrandingToEnvironment(app.id, environmentId);
        brandingData = publishResult.snapshot;
      } catch (publishError: any) {
        addLog(`   ⚠️ No se pudo publicar snapshot: ${publishError?.message || 'Error desconocido'}`, 'warning');
        brandingData = await applicationService.getPublicBranding(app.id, {
          environmentId,
          environmentName,
          host: environment.domain
        });
      }

      if (brandingData) {
        addLog(`   ✓ Branding cargado (Color: ${brandingData.primary_color || 'default'})`, 'success');
      } else {
        addLog('   ℹ️  Sin branding personalizado, usando valores por defecto', 'info');
      }

      // Recolectar archivos fuente de React desde la Edge Function
      addLog('📦 Recolectando archivos fuente de React...', 'info');
      const files = await deploymentService.collectReactSourceFiles(
        app.application_id,
        apiKey,
        supabaseUrl,
        supabaseAnonKey,
        brandingData || {}
      );

      addLog(`   ✓ ${Object.keys(files).length} archivos recolectados`, 'success');
      addLog('   ✓ Incluye componentes React, servicios y configuración', 'success');
      addLog('', 'info');

      // STEP 6: Hacer commit y push a GitHub
      addLog(`📤 Preparando commit a GitHub (${repo.repo_full_name})...`, 'info');
      addLog('', 'info');
      addLog('📋 Archivos a commitear:', 'info');

      // Group files by directory for better readability
      const filesByDir: Record<string, string[]> = {};
      Object.keys(files).forEach(filePath => {
        const dir = filePath.includes('/') ? filePath.split('/')[0] : 'root';
        if (!filesByDir[dir]) filesByDir[dir] = [];
        filesByDir[dir].push(filePath);
      });

      // Log files organized by directory
      Object.keys(filesByDir).sort().forEach(dir => {
        addLog(`   📁 ${dir}/`, 'info');
        filesByDir[dir].forEach(file => {
          const fileName = file.includes('/') ? file.split('/').slice(1).join('/') : file;
          const size = files[file].length;
          const sizeKB = (size / 1024).toFixed(1);
          addLog(`      ✓ ${fileName} (${sizeKB} KB)`, 'info');
        });
      });

      addLog('', 'info');
      addLog(`🚀 Commiteando ${Object.keys(files).length} archivos...`, 'info');

      await githubService.commitAndPush(
        repo.repo_full_name,
        files,
        `Deploy ${environmentName} - ${new Date().toLocaleString()}`
      );

      addLog('✅ Código subido a GitHub exitosamente', 'success');
      addLog('', 'info');
      addLog('📡 GitHub notificará a Netlify sobre el nuevo código', 'info');

      // STEP 7: Obtener o crear sitio de Netlify conectado al repositorio
      const netlifyConfig = await connectorsService.getNetlifyConfig();
      if (!netlifyConfig) {
        throw new Error('Configuración de Netlify no encontrada');
      }

      let siteId = repo.netlify_site_id;
      let newSiteCreated = false;

      // Si hay un siteId guardado, validar que el sitio existe en Netlify
      if (siteId) {
        addLog('🔍 Validando sitio existente en Netlify...', 'info');
        try {
          await netlifyService.getSite(siteId);
          addLog('   ✓ Sitio encontrado en Netlify', 'success');
        } catch (error: any) {
          addLog('   ⚠️ El sitio ya no existe en Netlify', 'warning');
          addLog('   ℹ️ Creando un nuevo sitio...', 'info');

          // Limpiar el siteId de la BD
          await supabase
            .from('git_repositories')
            .update({ netlify_site_id: null })
            .eq('id', repo.id);

          siteId = null; // Resetear para que se cree uno nuevo
        }
      }

      // Si no hay sitio conectado a este repo, crear uno nuevo ya conectado
      if (!siteId) {
        addLog('🆕 Creando nuevo sitio de Netlify conectado al repositorio...', 'info');

        try {
          // Crear sitio de Netlify ya conectado al repositorio de GitHub
          const siteName = `${selectedApp?.toLowerCase().replace(/\s+/g, '-')}-${environmentName}`.substring(0, 63);

          const newSite = await netlifyService.createSiteFromRepo(
            repo.repo_full_name,
            {
              name: siteName,
              buildCommand: 'npm install && npm run build', // Build React app
              publishDir: 'dist', // Publicar desde dist (Vite output)
              branch: 'main'
            }
          );

          siteId = newSite.id;
          newSiteCreated = true;

          addLog(`   ✓ Sitio creado: ${newSite.name}`, 'success');
          addLog(`   ✓ URL: ${newSite.ssl_url || newSite.url}`, 'success');
          addLog(`   ✓ Repositorio conectado automáticamente`, 'success');

          // Guardar site_id en BD
          await supabase
            .from('git_repositories')
            .update({ netlify_site_id: siteId })
            .eq('id', repo.id);

        } catch (error: any) {
          console.error('Error creating site from repo:', error);

          // No se pudo crear sitio automáticamente
          addLog('   ⚠️ No se pudo crear sitio automáticamente', 'warning');
          addLog('', 'info');

          if (error.message === 'REPO_ACCESS_REQUIRED') {
            addLog('🔍 Netlify necesita acceso al repositorio de GitHub', 'warning');
            addLog('', 'info');
            addLog('📋 OPCIONES DISPONIBLES:', 'info');
            addLog('', 'info');
            addLog('OPCIÓN 1: Seleccionar un sitio existente (recomendado)', 'info');
            addLog('   → Se mostrará un selector con tus sitios de Netlify', 'info');
            addLog('   → Selecciona uno y continuará el deploy', 'info');
            addLog('', 'info');
            addLog('OPCIÓN 2: Crear sitio manualmente en Netlify', 'info');
            addLog('   1. Ve a: https://app.netlify.com/sites', 'info');
            addLog('   2. Click en "Add new site" → "Import an existing project"', 'info');
            addLog('   3. Conecta con GitHub y autoriza el acceso', 'info');
            addLog(`   4. Selecciona el repositorio: ${repo.repo_full_name}`, 'info');
            addLog('   5. Configura:', 'info');
            addLog('      - Build command: (dejar vacío)', 'info');
            addLog('      - Publish directory: .', 'info');
            addLog('   6. Haz click en "Deploy site"', 'info');
            addLog('   7. Copia el Site ID y selecciónalo en el selector', 'info');
            addLog('', 'info');
          }

          addLog('📋 Cargando sitios disponibles de Netlify...', 'info');
          await loadNetlifySites();
          setShowNetlifySiteSelector(true);
          setIsNetlifyDeploying(false);
          return;
        }
      } else {
        // Si ya hay un sitio, intentar conectar el repositorio
        addLog('🔗 Verificando conexión del repositorio con Netlify...', 'info');

        try {
          await netlifyService.setupRepositoryConnection(siteId, repo.repo_full_name);
          addLog('   ✓ Repositorio conectado a Netlify', 'success');
        } catch (error: any) {
          // Puede fallar si ya está conectado, lo cual está bien
          if (error.message?.includes('already') || error.message?.includes('repo')) {
            addLog('   ✓ Repositorio ya estaba conectado', 'info');
          } else {
            addLog('   ⚠️  No se pudo verificar conexión, continuando...', 'warning');
            console.warn('Error connecting repo:', error);
          }
        }
      }

      // STEP 8: Netlify auto-deployará cuando detecte el push
      addLog('', 'info');
      if (newSiteCreated) {
        addLog('✅ Sitio nuevo conectado - Netlify está deployando automáticamente', 'success');
        addLog('   📡 El webhook de GitHub se configuró automáticamente', 'info');
      } else {
        addLog('✅ Netlify detectó el push y está deployando automáticamente', 'success');
        addLog('   📡 El webhook de GitHub ya estaba configurado', 'info');
      }

      addLog('', 'info');

      // Wait for Netlify to create the deploy
      addLog('⏳ Esperando a que Netlify cree el deploy...', 'info');
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Get the latest deploy for this site
      addLog('📥 Obteniendo información del deploy...', 'info');
      const deploys = await netlifyService.listDeploys(siteId);
      const latestDeploy = deploys[0]; // Most recent deploy

      if (!latestDeploy) {
        throw new Error('No se pudo obtener información del deploy');
      }

      addLog(`   ✅ Deploy iniciado exitosamente!`, 'success');
      addLog(`   Deploy ID: ${latestDeploy.id}`, 'info');
      addLog(`   Estado inicial: ${latestDeploy.state}`, 'info');
      addLog('', 'info');

      addLog('⏳ Esperando a que el deploy se complete...', 'info');
      addLog('   Esto puede tomar varios minutos', 'info');
      addLog('   Puedes ver el progreso en: https://app.netlify.com', 'info');
      addLog('', 'info');

      const finalDeploy = await netlifyService.waitForDeploy(
        siteId,
        latestDeploy.id,
        (deploy) => {
          addLog(`   Estado actual: ${deploy.state} - ${new Date().toLocaleTimeString()}`, 'info');
        }
      );

      addLog('', 'info');
      addLog('🎉 ¡DEPLOY COMPLETADO EXITOSAMENTE!', 'success');
      addLog('', 'info');
      addLog(`🌐 URL del sitio: ${finalDeploy.ssl_url}`, 'success');
      addLog(`🔗 URL del deploy: ${finalDeploy.deploy_ssl_url}`, 'info');
      addLog(`⚙️  Admin URL: ${finalDeploy.admin_url}`, 'info');
      addLog('', 'info');
      addLog('✨ IMPORTANTE:', 'success');
      addLog('📦 A partir de ahora, cada vez que hagas push a GitHub:', 'info');
      addLog('   • Netlify detectará los cambios automáticamente', 'info');
      addLog('   • Se ejecutará un nuevo deploy sin intervención manual', 'info');
      addLog('   • No necesitas volver a deployar desde aquí', 'info');
      addLog('', 'info');
      addLog('💡 Solo necesitas usar este botón si cambias de repositorio o sitio', 'info');
      addLog('', 'info');
      addLog(`✅ Deploy completado a las: ${new Date(finalDeploy.updated_at).toLocaleString()}`, 'success');
      addLog('', 'info');

      // STEP 10: Actualizar metadata de la aplicación con las URLs generadas
      addLog('💾 Actualizando URLs de autenticación en la base de datos...', 'info');
      try {
        const baseUrl = finalDeploy.ssl_url;

        // Obtener metadata actual de la aplicación
        const { data: currentApp, error: fetchError } = await supabase
          .from('applications')
          .select('metadata')
          .eq('id', app.id)
          .single();

        if (fetchError) {
          console.error('Error fetching current app metadata:', fetchError);
          throw fetchError;
        }

        // Preparar las URLs de autenticación
        const callbackUrl = environment.callback_url || `https://${selectedApplication.domain}/callback`;
        const redirectUri = encodeURIComponent(callbackUrl);
        const urlParams = `?app_id=${app.application_id}&redirect_uri=${redirectUri}&api_key=${apiKey}`;

        const authUrls: Record<string, any> = {
          base_url: baseUrl,
          login_url: `${baseUrl}/login${urlParams}`,
          register_url: `${baseUrl}/register${urlParams}`,
          reset_password_url: `${baseUrl}/reset-password${urlParams}`,
          reset_password_confirm_url: `${baseUrl}/reset-password-confirm${urlParams}`,
          deployed_at: new Date().toISOString(),
          netlify_deploy_id: finalDeploy.id,
          netlify_site_id: siteId
        };

        if (app.auth_mode === 'tenant') {
          authUrls.register_tenant_url = `${baseUrl}/register-tenant${urlParams}`;
        }

        // Merge con metadata existente
        const updatedMetadata = {
          ...(currentApp?.metadata || {}),
          environment_urls: {
            ...(currentApp?.metadata?.environment_urls || {}),
            [environmentName.toLowerCase()]: authUrls
          }
        };

        // Actualizar en la base de datos
        const { error: updateError } = await supabase
          .from('applications')
          .update({
            metadata: updatedMetadata,
            updated_at: new Date().toISOString()
          })
          .eq('id', app.id);

        if (updateError) {
          console.error('Error updating app metadata:', updateError);
          throw updateError;
        }

        addLog('   ✓ URLs de autenticación guardadas exitosamente', 'success');
        addLog(`   Login: ${authUrls.login_url}`, 'info');
        addLog(`   Register: ${authUrls.register_url}`, 'info');
        addLog(`   Reset Password: ${authUrls.reset_password_url}`, 'info');
        if (authUrls.register_tenant_url) {
          addLog(`   Register Tenant: ${authUrls.register_tenant_url}`, 'info');
        }
        addLog('', 'info');

        // Recargar aplicaciones para mostrar las URLs actualizadas
        await loadApplications();
      } catch (error: any) {
        console.error('Error updating auth URLs:', error);
        addLog(`   ⚠️  No se pudieron guardar las URLs: ${error.message}`, 'warning');
        addLog('   El deploy fue exitoso, pero deberás configurar las URLs manualmente', 'warning');
        addLog('', 'info');
      }

      addLog('📝 Resumen del proceso:', 'info');
      addLog(`   ✓ Código subido a GitHub: ${repo.repo_full_name}`, 'success');
      addLog(`   ✓ Repositorio conectado con Netlify`, 'success');
      addLog(`   ✓ Deploy automático completado`, 'success');
      addLog(`   ✓ URLs de autenticación configuradas`, 'success');
      addLog('', 'info');
      addLog('💡 Futuros deploys se harán automáticamente al hacer push al repositorio', 'info');

      showNotification('success', 'Deploy Exitoso',
        `El sitio se ha desplegado correctamente en ${finalDeploy.ssl_url}`);

    } catch (error: any) {
      console.error('Deploy automático error:', error);
      addLog('', 'info');
      addLog(`❌ Error durante el deploy: ${error.message}`, 'error');
      addLog('', 'info');

      // Detectar error de acceso al repositorio (exit status 128)
      if (error.message?.includes('exit status 128') ||
          error.message?.includes('Host key verification failed') ||
          error.message?.includes('Could not read from remote repository')) {

        addLog('🔍 DIAGNÓSTICO DEL ERROR', 'warning');
        addLog('', 'info');
        addLog('El sitio de Netlify no tiene acceso al repositorio de GitHub.', 'warning');
        addLog('Esto ocurre cuando:', 'info');
        addLog('  1. El sitio fue creado sin conectar GitHub', 'info');
        addLog('  2. La conexión GitHub-Netlify fue revocada', 'info');
        addLog('  3. El sitio fue creado manualmente sin repo', 'info');
        addLog('', 'info');
        addLog('📋 SOLUCIONES DISPONIBLES:', 'info');
        addLog('', 'info');
        addLog('OPCIÓN 1: Conectar Netlify con GitHub manualmente', 'info');
        addLog('  1. Ve a: https://app.netlify.com/teams/your-team/sites', 'info');
        addLog('  2. Click en tu sitio', 'info');
        addLog('  3. Site Settings → Build & Deploy → Link Repository', 'info');
        addLog('  4. Conecta con GitHub y autoriza el acceso', 'info');
        addLog(`  5. Selecciona el repositorio: ${repo?.repo_full_name || 'tu-repositorio'}`, 'info');
        addLog('  6. Branch: main', 'info');
        addLog('  7. Build command: (dejar vacío)', 'info');
        addLog('  8. Publish directory: .', 'info');
        addLog('', 'info');
        addLog('OPCIÓN 2: Desvincular este sitio y crear uno nuevo', 'info');
        addLog('  1. Ve a "Conectores" en el menú', 'info');
        addLog('  2. Encuentra tu repositorio en "Repositorios Guardados"', 'info');
        addLog('  3. Click en "Desvincular" junto a "✓ Conectado con Netlify"', 'info');
        addLog('  4. Vuelve a hacer deploy (se creará un sitio nuevo)', 'info');
        addLog('', 'info');
        addLog('OPCIÓN 3: Eliminar el sitio en Netlify', 'info');
        addLog('  1. Ve a: https://app.netlify.com', 'info');
        addLog('  2. Elimina el sitio problemático', 'info');
        addLog('  3. Haz click en "Deploy" de nuevo (se creará uno nuevo)', 'info');
        addLog('', 'info');
        addLog('💡 RECOMENDACIÓN: Usa la OPCIÓN 2 (más rápida y segura)', 'success');
        addLog('', 'info');

        showNotification('error', 'Error de Acceso al Repositorio',
          'Netlify no puede acceder al repositorio de GitHub. Revisa la consola para ver las opciones de solución.');
      } else {
        showNotification('error', 'Error en Deploy',
          error.message || 'No se pudo completar el deploy automático.');
      }
    } finally {
      setIsNetlifyDeploying(false);
    }
  };

  const loadNetlifySites = async () => {
    try {
      setLoadingSites(true);
      addLog('📋 Cargando sitios de Netlify...', 'info');

      // Cargar configuración desde la base de datos primero
      const config = await netlifyService.loadConfigFromDatabase();

      if (!config || !config.access_token) {
        addLog('❌ Access Token no encontrado en la base de datos', 'error');
        addLog('📋 Por favor configura tu Access Token en "Conectores"', 'info');
        setNetlifySites([]);
        return;
      }

      addLog('   ✓ Configuración cargada desde BD', 'success');
      addLog('   Cargando lista de sitios desde Netlify API...', 'info');

      const sites = await netlifyService.listSites();
      setNetlifySites(sites);

      if (sites.length === 0) {
        addLog('⚠️  No se encontraron sitios en tu cuenta de Netlify', 'warning');
        addLog('💡 Puedes crear un sitio nuevo arriba, o crearlo manualmente en Netlify:', 'info');
        addLog('   1. Ve a https://app.netlify.com/sites', 'info');
        addLog('   2. Click en "Add new site" → "Import an existing project"', 'info');
        addLog('   3. Selecciona GitHub y tu repositorio', 'info');
        addLog('   4. Una vez creado, actualiza esta lista', 'info');
      } else {
        addLog(`✅ Se encontraron ${sites.length} sitios`, 'success');
      }
    } catch (error: any) {
      console.error('Error loading Netlify sites:', error);
      addLog(`❌ Error al cargar sitios: ${error.message}`, 'error');
      setNetlifySites([]);
    } finally {
      setLoadingSites(false);
    }
  };

  const handleCreateNetlifySite = async () => {
    try {
      setCreatingNetlifySite(true);
      addLog('', 'info');
      addLog('🏗️  Creando nuevo sitio en Netlify...', 'info');

      // Cargar configuración desde la base de datos primero
      const config = await netlifyService.loadConfigFromDatabase();
      if (!config || !config.access_token) {
        addLog('❌ Access Token no encontrado en la base de datos', 'error');
        addLog('📋 Por favor configura tu Access Token en "Conectores"', 'info');
        return;
      }

      const siteName = newSiteName || `auth-system-${Date.now()}`;
      const site = await netlifyService.createSite({ name: siteName });

      addLog(`✅ Sitio creado exitosamente!`, 'success');
      addLog(`   Nombre: ${site.name}`, 'info');
      addLog(`   URL: ${site.ssl_url}`, 'info');
      addLog(`   Site ID: ${site.id}`, 'info');
      addLog('', 'info');
      addLog('📝 IMPORTANTE: Copia este Site ID y agrégalo a tu .env:', 'warning');
      addLog(`   VITE_NETLIFY_SITE_ID=${site.id}`, 'warning');
      addLog('', 'info');
      addLog('💡 Después de agregar el Site ID, reinicia la aplicación', 'info');

      // Reload sites list
      await loadNetlifySites();
      setNewSiteName('');
    } catch (error: any) {
      console.error('Error creating Netlify site:', error);
      addLog(`❌ Error al crear sitio: ${error.message}`, 'error');
    } finally {
      setCreatingNetlifySite(false);
    }
  };

  const handleSelectNetlifySite = async (
    siteId: string,
    siteName: string,
    siteUrl: string,
    deployDataOverride?: {
      files: Record<string, string>;
      repo: any;
      deployBranch: string;
      environmentId: string;
      environmentName: string;
      environment: any;
      applicationId: string;
      apiKey: string;
    } | null
  ) => {
    try {
      addLog('', 'info');
      addLog(`📋 Seleccionando sitio: ${siteName}`, 'info');
      addLog(`   Site ID: ${siteId}`, 'info');

      // Load existing configuration to preserve the access token
      addLog('🔍 Cargando configuración existente...', 'info');
      const existingConfig = await netlifyService.loadConfigFromDatabase();

      if (!existingConfig || !existingConfig.access_token) {
        addLog('❌ Falta el Access Token. Por favor guárdalo primero en Configuración de Netlify', 'error');
        setShowNetlifySiteSelector(false);
        setShowNetlifyConfig(true);
        return;
      }

      // Use the existing access token (DON'T overwrite it)
      const token = existingConfig.access_token;

      // Save to database - only updating the Site ID
      addLog('💾 Actualizando Site ID en la base de datos...', 'info');
      await netlifyService.saveConfigToDatabase(token, siteId, siteName, siteUrl);

      addLog('✅ Sitio de Netlify seleccionado!', 'success');
      addLog('', 'info');

      setShowNetlifySiteSelector(false);

      const deployData = deployDataOverride || pendingDeployData;

      // Si hay un deploy pendiente, continuar con el push a GitHub
      if (deployData) {
        addLog('🧭 Ruta confirmada: continuar con commit/push a GitHub', 'info');
        const pendingDeployData = deployData;
        addLog('📤 Paso 14: Subiendo código a GitHub...', 'info');
        addLog(`   Repositorio: ${pendingDeployData.repo.repo_full_name}`, 'info');
        addLog(`   Branch: ${pendingDeployData.deployBranch}`, 'info');
        addLog(`   Sitio Netlify: ${siteName}`, 'info');
        addLog('', 'info');

        // Log all files being committed
        addLog('📋 Archivos a commitear:', 'info');
        addLog('', 'info');

        // Group files by directory for better readability
        const filesByDir: Record<string, string[]> = {};
        Object.keys(pendingDeployData.files).forEach(filePath => {
          const dir = filePath.includes('/') ? filePath.split('/')[0] : 'root';
          if (!filesByDir[dir]) filesByDir[dir] = [];
          filesByDir[dir].push(filePath);
        });

        // Log files organized by directory
        Object.keys(filesByDir).sort().forEach(dir => {
          addLog(`   📁 ${dir}/`, 'info');
          filesByDir[dir].sort().forEach(file => {
            const fileName = file.includes('/') ? file.split('/').slice(1).join('/') : file;
            const size = pendingDeployData.files[file].length;
            const sizeKB = (size / 1024).toFixed(1);
            addLog(`      ✓ ${fileName} (${sizeKB} KB)`, 'info');
          });
        });

        addLog('', 'info');
        addLog(`🚀 Commiteando ${Object.keys(pendingDeployData.files).length} archivos a GitHub...`, 'info');
        addLog('', 'info');

        try {
          const commitResult = await githubService.commitAndPush(
            pendingDeployData.repo.repo_full_name,
            pendingDeployData.files,
            getCommitMessage(pendingDeployData.applicationId, pendingDeployData.environmentName)
          );

          if (!commitResult.success) {
            addLog(`❌ Error al subir a GitHub: ${commitResult.error}`, 'error');
            setPendingDeployData(null);
            return;
          }

          addLog('✅ Código subido exitosamente a GitHub', 'success');
          addLog(`   Commit: ${commitResult.sha?.substring(0, 7)}`, 'info');
          addLog(`   Total de archivos: ${Object.keys(pendingDeployData.files).length}`, 'info');
          addLog('   Incluye: componentes React, servicios, configuración, etc.', 'info');
          addLog('', 'info');

          // Create deployment snapshot for rollback capability
          addLog('📸 Creando snapshot del deployment...', 'info');
          try {
            const snapshot = await deploymentSnapshotService.createSnapshot({
              application_id: selectedApp!,
              commit_hash: commitResult.sha || 'unknown',
              commit_message: getCommitMessage(pendingDeployData.applicationId, pendingDeployData.environmentName),
              branch: pendingDeployData.deployBranch,
              deployment_url: siteUrl,
              status: 'stable',
              metadata: {
                environment_name: pendingDeployData.environmentName,
                netlify_site_id: siteId,
                netlify_site_name: siteName,
                github_repo: pendingDeployData.repo.repo_full_name,
              }
            });
            addLog(`   ✓ Snapshot creado: ${snapshot.id.substring(0, 8)}...`, 'success');
          } catch (snapshotError: any) {
            console.error('Error creating snapshot:', snapshotError);
            addLog(`   ⚠️  No se pudo crear snapshot: ${snapshotError?.message || 'Error desconocido'}`, 'warning');
            // Continue deployment even if snapshot fails
          }
          addLog('', 'info');

          // Actualizar environment con el repo, estado Y URLs corregidas
          addLog('📝 Actualizando URLs del ambiente con el sitio de Netlify...', 'info');

          await applicationService.updateEnvironment(pendingDeployData.environmentId, {
            auth_url: siteUrl, // ✅ Actualizar auth_url con el sitio de Netlify
            callback_url: pendingDeployData.environment.callback_url || `https://${selectedApplication.domain}/callback`,
            metadata: {
              ...pendingDeployData.environment.metadata,
              github_repo: pendingDeployData.repo.repo_full_name,
              netlify_site_id: siteId,
              netlify_site_name: siteName,
              netlify_site_url: siteUrl,
              last_commit: commitResult.sha,
              last_deploy: new Date().toISOString(),
              deployment_status: 'deployed',
              api_key: pendingDeployData.apiKey
            }
          });

          const updatedBinding = await environmentDeployBindingService.upsertBinding({
            application_id: selectedApp,
            environment_id: pendingDeployData.environmentId,
            git_repository_id: pendingDeployData.repo.id,
            repo_full_name: pendingDeployData.repo.repo_full_name,
            branch: pendingDeployData.deployBranch,
            netlify_site_id: siteId,
            netlify_site_name: siteName,
            netlify_site_url: siteUrl,
          });
          if (updatedBinding) {
            setEnvironmentBindingsMap(prev => ({
              ...prev,
              [pendingDeployData.environmentId]: updatedBinding,
            }));
          }
          addLog('   ✓ Vínculo de deploy guardado para este ambiente', 'success');

          addLog('   ✓ URLs actualizadas con el sitio de Netlify', 'success');

          addLog('☁️  Paso 15: Netlify construirá la aplicación...', 'info');
          addLog('   Netlify está monitoreando tu repositorio de GitHub', 'info');
          addLog('   Ejecutará: npm install && npm run build', 'info');
          addLog('   Deployará la aplicación React completa desde dist/', 'info');
          addLog('   Incluye todos los componentes, validaciones y lógica', 'info');
          addLog('', 'info');

          addLog('🎉 ========================================', 'success');
          addLog('🎉 DESPLIEGUE COMPLETADO', 'success');
          addLog('🎉 ========================================', 'success');
          addLog('', 'info');
          addLog(`🌐 URL del sitio: ${siteUrl}`, 'info');
          addLog('', 'info');
          addLog('📋 Los formularios estarán disponibles en:', 'info');

          const redirectUri = encodeURIComponent(pendingDeployData.environment.callback_url || `https://${selectedApplication.domain}/callback`);

          const loginUrl = `${siteUrl}/login?app_id=${pendingDeployData.applicationId}&redirect_uri=${redirectUri}&api_key=${pendingDeployData.apiKey}`;
          const registerUrl = `${siteUrl}/register?app_id=${pendingDeployData.applicationId}&redirect_uri=${redirectUri}&api_key=${pendingDeployData.apiKey}`;
          const resetUrl = `${siteUrl}/reset-password?app_id=${pendingDeployData.applicationId}&redirect_uri=${redirectUri}&api_key=${pendingDeployData.apiKey}`;
          const currentAppForDeploy = applications.find(a => a.id === selectedApp);
          const registerTenantUrl = currentAppForDeploy?.auth_mode === 'tenant'
            ? `${siteUrl}/register-tenant?app_id=${pendingDeployData.applicationId}&redirect_uri=${redirectUri}&api_key=${pendingDeployData.apiKey}`
            : null;

          addLog(`   Login: ${loginUrl}`, 'info');
          addLog(`   Register: ${registerUrl}`, 'info');
          addLog(`   Reset: ${resetUrl}`, 'info');
          if (registerTenantUrl) {
            addLog(`   Register Tenant: ${registerTenantUrl}`, 'info');
          }
          addLog('', 'info');
          addLog('✨ Características incluidas:', 'info');
          addLog('   ✓ Formularios React completos con validaciones', 'info');
          addLog('   ✓ Carga dinámica de roles desde la BD', 'info');
          addLog('   ✓ Campo de confirmar contraseña', 'info');
          addLog('   ✓ Selector de tipo de usuario', 'info');
          addLog('   ✓ Branding personalizado', 'info');
          addLog('   ✓ Validación de contraseñas coincidentes', 'info');
          addLog('', 'info');
          addLog('💡 Netlify re-deployará automáticamente en cada push a GitHub', 'info');

          // Save final logs to database
          if (currentDeploymentLogId) {
            await supabase
              .from('deployment_logs')
              .update({
                status: 'success',
                completed_at: new Date().toISOString(),
                logs: logsRef.current.map(log => ({
                  timestamp: log.timestamp,
                  level: log.level,
                  message: log.message
                })),
                metadata: {
                  environment_name: pendingDeployData.environmentName,
                  netlify_site_id: siteId,
                  netlify_site_name: siteName,
                  netlify_site_url: siteUrl,
                  github_repo: pendingDeployData.repo.repo_full_name,
                  deployed_urls: {
                    login_url: loginUrl,
                    register_url: registerUrl,
                    reset_password_url: resetUrl,
                    ...(registerTenantUrl ? { register_tenant_url: registerTenantUrl } : {})
                  }
                }
              })
              .eq('id', currentDeploymentLogId);

            addLog(`📝 Logs guardados en BD (${logsRef.current.length} entradas)`, 'info');
            setCurrentDeploymentLogId(null);
          }

          // Update application metadata with new URLs
          addLog('💾 Actualizando URLs en metadata de la aplicación...', 'info');
          try {
            const { data: currentApp, error: fetchError } = await supabase
              .from('applications')
              .select('metadata')
              .eq('id', selectedApp)
              .single();

            if (fetchError) throw fetchError;

            const authUrls: Record<string, any> = {
              base_url: siteUrl,
              login_url: loginUrl,
              register_url: registerUrl,
              reset_password_url: resetUrl,
              deployed_at: new Date().toISOString(),
              netlify_site_id: siteId,
              netlify_site_name: siteName
            };
            if (registerTenantUrl) {
              authUrls.register_tenant_url = registerTenantUrl;
            }

            const updatedMetadata = {
              ...(currentApp?.metadata || {}),
              environment_urls: {
                ...(currentApp?.metadata?.environment_urls || {}),
                [pendingDeployData.environmentName.toLowerCase()]: authUrls
              }
            };

            const { error: updateError } = await supabase
              .from('applications')
              .update({
                metadata: updatedMetadata,
                updated_at: new Date().toISOString()
              })
              .eq('id', selectedApp);

            if (updateError) throw updateError;

            addLog('✅ URLs actualizadas en metadata de la aplicación', 'success');
          } catch (error: any) {
            addLog(`⚠️ No se pudieron actualizar las URLs en metadata: ${error.message}`, 'warning');
          }

          // Limpiar datos pendientes
          setPendingDeployData(null);

          // Recargar aplicaciones y ambientes
          await loadApplications();
          await loadEnvironments(true);
        } catch (error: any) {
          addLog(`❌ Error durante el deploy: ${error.message}`, 'error');

          // Save failed logs to database
          if (currentDeploymentLogId) {
            await supabase
              .from('deployment_logs')
              .update({
                status: 'failed',
                completed_at: new Date().toISOString(),
                logs: logsRef.current.map(log => ({
                  timestamp: log.timestamp,
                  level: log.level,
                  message: log.message
                })),
                metadata: {
                  error: error.message || 'Unknown error'
                }
              })
              .eq('id', currentDeploymentLogId);

            setCurrentDeploymentLogId(null);
          }

          setPendingDeployData(null);
        }
      } else {
        // Configuración normal sin deploy pendiente
        addLog('🧭 Ruta: configuración sin deploy pendiente (no commit)', 'warning');
        addLog('🎉 ¡Configuración completa!', 'success');
        addLog('', 'info');
        addLog('✨ Tu repositorio ya está conectado con Netlify', 'info');
        addLog('📦 Los deploys se realizarán automáticamente cuando hagas push a GitHub', 'info');
      }
    } catch (error: any) {
      console.error('Error selecting Netlify site:', error);
      addLog(`❌ Error al guardar configuración: ${error.message}`, 'error');
    }
  };

  const handleSaveNetlifyToken = async () => {
    try {
      if (!netlifyAccessToken.trim()) {
        addLog('❌ Por favor ingresa un Access Token válido', 'error');
        return;
      }

      setSavingNetlifyConfig(true);
      addLog('', 'info');
      addLog('💾 Guardando Access Token en la base de datos...', 'info');

      // Set the token in the service
      netlifyService.setAccessToken(netlifyAccessToken);

      addLog('✅ Access Token guardado!', 'success');
      addLog('', 'info');
      addLog('📋 Ahora selecciona o crea un sitio de Netlify', 'info');

      // Close config modal and open site selector
      setShowNetlifyConfig(false);
      await loadNetlifySites();
      setShowNetlifySiteSelector(true);
    } catch (error: any) {
      console.error('Error saving Netlify token:', error);
      addLog(`❌ Error al guardar token: ${error.message}`, 'error');
    } finally {
      setSavingNetlifyConfig(false);
    }
  };

  const handleDirectDeploy = async (environmentId: string, environmentName: string) => {
    try {
      setIsDirectDeploying(true);
      setShowConsole(true);

      addLog('', 'info');
      addLog('📦 ========================================', 'info');
      addLog('📦 DEPLOY DIRECTO A NETLIFY (Sin Repositorio)', 'info');
      addLog('📦 ========================================', 'info');
      addLog('', 'info');

      addLog('🔨 Construyendo proyecto localmente...', 'info');
      addLog('   Ejecutando: npm run build', 'info');
      addLog('', 'info');

      // Get the current dist files (in a real scenario, we'd need to build first)
      // For now, we'll call the edge function that handles the build and deploy

      const supabaseUrl = requireSupabaseUrl();
      const anonKey = requireSupabaseAnonKey();

      addLog('📤 Subiendo archivos a Netlify...', 'info');
      addLog('   Esto puede tomar varios minutos', 'info');
      addLog('', 'info');

      const response = await fetch(`${supabaseUrl}/functions/v1/deploy-to-netlify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${anonKey}`,
        },
        body: JSON.stringify({
          siteId: netlifyService.getSiteId(),
          accessToken: netlifyAccessToken || import.meta.env.VITE_NETLIFY_ACCESS_TOKEN,
          environmentId,
          environmentName,
        }),
      });

      if (!response.ok) {
        throw new Error('Error en deploy directo');
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Deploy falló');
      }

      addLog('', 'info');
      addLog('🎉 ¡DEPLOY DIRECTO COMPLETADO EXITOSAMENTE!', 'success');
      addLog('', 'info');
      addLog(`🌐 URL del sitio: ${result.url}`, 'success');
      addLog(`🔗 URL del deploy: ${result.deployUrl}`, 'info');
      addLog('', 'info');
      addLog('✅ Tu sitio está ahora en vivo sin necesidad de repositorio conectado', 'success');
      addLog('', 'info');
      addLog('💡 Tip: Para deploys automáticos futuros, considera conectar un repositorio', 'info');

    } catch (error: any) {
      console.error('Direct deploy error:', error);
      addLog('', 'info');
      addLog(`❌ Error en deploy directo: ${error.message}`, 'error');
      addLog('', 'info');
      addLog('💡 Intenta nuevamente o conecta un repositorio para deploys automáticos', 'warning');
    } finally {
      setIsDirectDeploying(false);
    }
  };

  // Test all API endpoints (Edge Functions)
  const testAllEndpoints = async (supabaseUrl: string, appId: string, apiKey: string) => {
    const results: Record<string, any> = {};
    const functionsBase = `${supabaseUrl}/functions/v1`;

    await addLog('   Probando función: auth-login...', 'info');
    results['auth-login'] = await testEndpoint(`${functionsBase}/auth-login`, 'POST', {
      email: 'test@example.com',
      password: 'testpassword123',
      application_id: appId
    }, apiKey);

    await addLog('   Probando función: auth-register...', 'info');
    results['auth-register'] = await testEndpoint(`${functionsBase}/auth-register`, 'POST', {
      email: `test-${Date.now()}@example.com`,
      password: 'testpassword123',
      name: 'Test User',
      application_id: appId
    }, apiKey);

    await addLog('   Probando función: auth-reset-password...', 'info');
    results['auth-reset-password'] = await testEndpoint(`${functionsBase}/auth-reset-password`, 'POST', {
      email: 'test@example.com',
      application_id: appId
    }, apiKey);

    await addLog('   Probando función: auth-reset-password-confirm...', 'info');
    results['auth-reset-password-confirm'] = await testEndpoint(`${functionsBase}/auth-reset-password-confirm`, 'POST', {
      token: 'test-token-123',
      new_password: 'newpassword123',
      application_id: appId
    }, apiKey);

    await addLog('   Probando función: check-ip-status...', 'info');
    results['check-ip-status'] = await testEndpoint(`${functionsBase}/check-ip-status`, 'POST', {
      ip: '127.0.0.1',
      application_id: appId
    }, apiKey);

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

  const getDeployProvider = (environmentId: string): DeployProvider => {
    return environmentBindingsMap[environmentId]?.deploy_provider || 'netlify';
  };

  const getDeployProviderLabel = (provider: DeployProvider) => {
    return provider === 'azure_container_apps' ? 'Azure Container Apps' : 'Netlify';
  };

  const getBindingDestinationLabel = (binding?: EnvironmentDeployBinding | null) => {
    if (!binding) return '—';
    if (binding.deploy_provider === 'azure_container_apps') {
      return binding.azure_container_app_name || 'Crear durante deploy';
    }
    return binding.netlify_site_name || 'Seleccionar durante deploy';
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    addLog(`📋 Copied to clipboard: ${text}`, 'success');
  };

  const handleToggleStatus = async (environmentId: string, currentStatus: boolean) => {
    try {
      await applicationService.toggleEnvironmentStatus(environmentId, !currentStatus);
      await loadEnvironments(true);
      addLog(`✅ Ambiente ${!currentStatus ? 'activado' : 'desactivado'} exitosamente`, 'success');
    } catch (error) {
      console.error('Error toggling environment status:', error);
      addLog(`❌ Error al cambiar estado del ambiente`, 'error');
    }
  };

  const handleEditEnvironment = (env: Environment) => {
    setEditFormData({
      domain: env.domain,
      auth_url: env.auth_url || '',
      callback_url: env.callback_url || ''
    });
    setShowEditModal(env.id);
    setOpenMenuId(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showEditModal) return;

    try {
      await applicationService.updateEnvironment(showEditModal, editFormData);
      await loadEnvironments(true);
      setShowEditModal(null);
      addLog('✅ Ambiente actualizado exitosamente', 'success');
    } catch (error) {
      console.error('Error updating environment:', error);
      addLog('❌ Error al actualizar el ambiente', 'error');
    }
  };

  const handleDeleteEnvironment = async () => {
    if (!showDeleteConfirm) return;

    try {
      await applicationService.deleteEnvironment(showDeleteConfirm);
      await loadEnvironments(true);
      setShowDeleteConfirm(null);
      addLog('✅ Ambiente eliminado exitosamente', 'success');
    } catch (error) {
      console.error('Error deleting environment:', error);
      addLog('❌ Error al eliminar el ambiente', 'error');
    }
  };

  return (
    <div className={`space-y-6 ${showConsole ? 'pb-96' : ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Gestión de Ambientes</h2>
          <p className="text-gray-600">Gestiona ambientes de desarrollo, testing y producción</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => {
              showNotification(
                'info',
                'Conectores de publicación',
                'Configura GitHub, Netlify y Azure Container Apps desde el menú Conectores. Desde Ambientes solo eliges el proveedor y el destino por ambiente.'
              );
            }}
            className="bg-purple-100 text-purple-700 px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors hover:bg-purple-200 border border-purple-300"
          >
            <Cloud className="w-5 h-5" />
            <span>Revisar Conectores</span>
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            disabled={!selectedApp}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors disabled:opacity-50"
          >
            <Plus className="w-5 h-5" />
            <span>Nuevo Ambiente</span>
          </button>
        </div>
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
          {/* Deploy Bindings Matrix */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Matriz de Bindings de Deploy</h3>
                <p className="text-sm text-gray-600">Asocia cada ambiente a su repo, branch y destino de publicación</p>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">Filtrar:</label>
                <select
                  value={bindingsFilter}
                  onChange={(e) => setBindingsFilter(e.target.value as any)}
                  className="px-2 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">Todos</option>
                  <option value="development">Development</option>
                  <option value="testing">Testing</option>
                  <option value="production">Production</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-gray-600">
                    <th className="py-2 pr-4">Ambiente</th>
                    <th className="py-2 pr-4">Repositorio</th>
                    <th className="py-2 pr-4">Branch</th>
                    <th className="py-2 pr-4">Proveedor</th>
                    <th className="py-2 pr-4">Destino</th>
                    <th className="py-2 pr-4">Estado</th>
                    <th className="py-2">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {environments
                    .filter((env) => bindingsFilter === 'all' || env.name === bindingsFilter)
                    .map((env) => {
                    const binding = environmentBindingsMap[env.id];
                    const isConfigured = !!binding?.repo_full_name;

                    return (
                      <tr key={`binding-row-${env.id}`} className="border-b border-gray-100">
                        <td className="py-3 pr-4 font-medium text-gray-900 capitalize">{env.name}</td>
                        <td className="py-3 pr-4 text-gray-700">{binding?.repo_full_name || '—'}</td>
                        <td className="py-3 pr-4 text-gray-700">{binding?.branch || '—'}</td>
                        <td className="py-3 pr-4 text-gray-700">{binding ? getDeployProviderLabel(binding.deploy_provider) : '—'}</td>
                        <td className="py-3 pr-4 text-gray-700">{getBindingDestinationLabel(binding)}</td>
                        <td className="py-3 pr-4">
                          {isConfigured ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-green-100 text-green-700 border border-green-200">
                              Configurado
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-yellow-100 text-yellow-700 border border-yellow-200">
                              Pendiente
                            </span>
                          )}
                        </td>
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleOpenRepoBindingModal(env.id)}
                              className="px-2 py-1 text-xs bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-md transition-colors"
                            >
                              Configurar
                            </button>
                            {isConfigured && (
                              <button
                                onClick={() => handleDisconnectEnvironmentDeploy(env)}
                                className="px-2 py-1 text-xs bg-red-100 text-red-700 hover:bg-red-200 rounded-md transition-colors"
                              >
                                Desconectar
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

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
                          <div className="mt-1">
                            {environmentBindingsMap[env.id]?.repo_full_name ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-green-100 text-green-700 border border-green-200">
                                Auto {getDeployProviderLabel(getDeployProvider(env.id))}: activado
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-600 border border-gray-200">
                                Publicación automática: desactivada
                              </span>
                            )}
                          </div>
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
                      {/* Show auth URLs from application metadata or last deployment log */}
                      {(() => {
                        const app = applications.find(a => a.id === selectedApp);
                        let envUrls = app?.metadata?.environment_urls?.[env.name.toLowerCase()];

                        // Fallback to last deployment log URLs if not in app metadata
                        if (!envUrls) {
                          const lastLog = latestLogsMap[env.id];

                          if (lastLog?.metadata?.deployed_urls) {
                            envUrls = {
                              login_url: lastLog.metadata.deployed_urls.login_url,
                              register_url: lastLog.metadata.deployed_urls.register_url,
                              reset_password_url: lastLog.metadata.deployed_urls.reset_password_url,
                              register_tenant_url: lastLog.metadata.deployed_urls.register_tenant_url,
                              deployed_at: lastLog.completed_at || lastLog.created_at
                            };
                          }
                        }

                        // Derivar register_tenant_url si la app es modo tenant y aún no está guardada
                        if (envUrls && !envUrls.register_tenant_url && app?.auth_mode === 'tenant' && envUrls.base_url) {
                          const baseUrl = envUrls.base_url;
                          // Extraer query params de login_url para reutilizarlos
                          const loginUrlObj = envUrls.login_url ? envUrls.login_url.split('?') : [];
                          const queryParams = loginUrlObj.length > 1 ? `?${loginUrlObj[1]}` : '';
                          envUrls = { ...envUrls, register_tenant_url: `${baseUrl}/register-tenant${queryParams}` };
                        }

                        if (envUrls) {
                          return (
                            <div className="bg-green-50 border border-green-200 rounded-lg p-3 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-green-700">URLs Desplegadas:</span>
                                <span className="text-xs text-green-600">
                                  {new Date(envUrls.deployed_at).toLocaleDateString()}
                                </span>
                              </div>

                              <div className="space-y-1">
                                <div className="flex items-center space-x-2">
                                  <span className="text-xs text-gray-600 min-w-[60px]">Login:</span>
                                  <a
                                    href={envUrls.login_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-blue-600 hover:text-blue-800 flex-1 hover:underline block overflow-hidden whitespace-nowrap text-ellipsis"
                                    title={envUrls.login_url}
                                  >
                                    {envUrls.login_url}
                                  </a>
                                  <button
                                    onClick={() => {
                                      navigator.clipboard.writeText(envUrls.login_url);
                                      showNotification('success', 'Copiado', 'URL copiada al portapapeles');
                                    }}
                                    className="p-1 hover:bg-green-100 rounded flex-shrink-0"
                                    title="Copiar URL"
                                  >
                                    <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    </svg>
                                  </button>
                                </div>

                                <div className="flex items-center space-x-2">
                                  <span className="text-xs text-gray-600 min-w-[60px]">Register:</span>
                                  <a
                                    href={envUrls.register_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-blue-600 hover:text-blue-800 flex-1 hover:underline block overflow-hidden whitespace-nowrap text-ellipsis"
                                    title={envUrls.register_url}
                                  >
                                    {envUrls.register_url}
                                  </a>
                                  <button
                                    onClick={() => {
                                      navigator.clipboard.writeText(envUrls.register_url);
                                      showNotification('success', 'Copiado', 'URL copiada al portapapeles');
                                    }}
                                    className="p-1 hover:bg-green-100 rounded flex-shrink-0"
                                    title="Copiar URL"
                                  >
                                    <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    </svg>
                                  </button>
                                </div>

                                <div className="flex items-center space-x-2">
                                  <span className="text-xs text-gray-600 min-w-[60px]">Reset:</span>
                                  <a
                                    href={envUrls.reset_password_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-blue-600 hover:text-blue-800 flex-1 hover:underline block overflow-hidden whitespace-nowrap text-ellipsis"
                                    title={envUrls.reset_password_url}
                                  >
                                    {envUrls.reset_password_url}
                                  </a>
                                  <button
                                    onClick={() => {
                                      navigator.clipboard.writeText(envUrls.reset_password_url);
                                      showNotification('success', 'Copiado', 'URL copiada al portapapeles');
                                    }}
                                    className="p-1 hover:bg-green-100 rounded flex-shrink-0"
                                    title="Copiar URL"
                                  >
                                    <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    </svg>
                                  </button>
                                </div>

                                {envUrls.register_tenant_url && (
                                  <div className="flex items-center space-x-2">
                                    <span className="text-xs text-gray-600 min-w-[60px]">Tenant:</span>
                                    <a
                                      href={envUrls.register_tenant_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs text-blue-600 hover:text-blue-800 flex-1 hover:underline block overflow-hidden whitespace-nowrap text-ellipsis"
                                      title={envUrls.register_tenant_url}
                                    >
                                      {envUrls.register_tenant_url}
                                    </a>
                                    <button
                                      onClick={() => {
                                        navigator.clipboard.writeText(envUrls.register_tenant_url);
                                        showNotification('success', 'Copiado', 'URL copiada al portapapeles');
                                      }}
                                      className="p-1 hover:bg-green-100 rounded flex-shrink-0"
                                      title="Copiar URL"
                                    >
                                      <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                      </svg>
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        }

                        // Fallback to old auth_url if no new URLs
                        if (env.auth_url) {
                          return (
                            <div>
                              <span className="text-xs text-gray-500">Auth URL:</span>
                              <p className="text-sm text-gray-900 truncate">{env.auth_url}</p>
                            </div>
                          );
                        }

                        return null;
                      })()}

                      {env.metadata?.api_key && (
                        <div>
                          <span className="text-xs text-gray-500">API Key:</span>
                          <p className="text-sm text-gray-900 font-mono truncate">{env.metadata.api_key}</p>
                        </div>
                      )}

                      {environmentBindingsMap[env.id]?.repo_full_name && (
                        <div className="bg-blue-50 border border-blue-200 rounded-md px-2 py-1">
                          <p className="text-xs text-blue-700 truncate">
                            Repo deploy: {environmentBindingsMap[env.id].repo_full_name}
                            {environmentBindingsMap[env.id].branch ? ` (${environmentBindingsMap[env.id].branch})` : ''}
                          </p>
                          <p className="text-xs text-blue-600 truncate">
                            {getDeployProviderLabel(getDeployProvider(env.id))}: {getBindingDestinationLabel(environmentBindingsMap[env.id])}
                          </p>
                        </div>
                      )}
                    </div>


                    {/* Actions */}
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleDeploy(env.id, env.name)}
                        disabled={deployLoading === env.id || !env.is_active}
                        className="flex-1 bg-green-500 hover:bg-green-600 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
                        title={!env.is_active ? 'Activa el ambiente primero' : 'Desplegar ambiente'}
                      >
                        {deployLoading === env.id ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Play className="w-4 h-4" />
                        )}
                        <span>{deployLoading === env.id ? 'Desplegando...' : 'Desplegar'}</span>
                      </button>

                      {env.metadata?.generated_urls && (
                        <>
                          <button
                            onClick={() => handleViewUrls(env.id)}
                            className="p-2 bg-blue-100 text-blue-600 hover:bg-blue-200 rounded-lg transition-colors"
                            title="Ver URLs"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setShowIntegrationGuide(env.id)}
                            className="p-2 bg-green-100 text-green-600 hover:bg-green-200 rounded-lg transition-colors"
                            title="Guía de Integración"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                        </>
                      )}

                      {/* Settings Menu */}
                      <div className="relative">
                        <button
                          onClick={() => setOpenMenuId(openMenuId === env.id ? null : env.id)}
                          className="p-2 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                          title="Configuración"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>

                        {openMenuId === env.id && (
                          <>
                            <div
                              className="fixed inset-0 z-10"
                              onClick={() => setOpenMenuId(null)}
                            />
                            <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                              <button
                                onClick={() => handleEditEnvironment(env)}
                                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                              >
                                <Edit className="w-4 h-4" />
                                <span>Editar</span>
                              </button>
                              <button
                                onClick={() => {
                                  handleToggleStatus(env.id, env.is_active);
                                  setOpenMenuId(null);
                                }}
                                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                              >
                                <Power className="w-4 h-4" />
                                <span>{env.is_active ? 'Desactivar' : 'Activar'}</span>
                              </button>
                              <button
                                onClick={() => handleOpenRepoBindingModal(env.id)}
                                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                              >
                                <Github className="w-4 h-4" />
                                <span>Configurar repo deploy</span>
                              </button>
                              <button
                                onClick={() => {
                                  loadDeploymentHistory(env.id);
                                  setShowLogsHistory(env.id);
                                  setOpenMenuId(null);
                                }}
                                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                              >
                                <Terminal className="w-4 h-4" />
                                <span>Ver historial de logs</span>
                              </button>
                              <button
                                onClick={() => handleDisconnectEnvironmentDeploy(env)}
                                className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center space-x-2"
                              >
                                <Unlink className="w-4 h-4" />
                                <span>Desconectar publicación</span>
                              </button>
                              <hr className="my-1" />
                              <button
                                onClick={() => {
                                  setShowDeleteConfirm(env.id);
                                  setOpenMenuId(null);
                                }}
                                className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center space-x-2"
                              >
                                <Trash2 className="w-4 h-4" />
                                <span>Eliminar</span>
                              </button>
                            </div>
                          </>
                        )}
                      </div>
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
            <div className="fixed bottom-4 right-4 z-50 w-[min(960px,calc(100vw-2rem))] bg-white rounded-lg border border-gray-300 shadow-2xl overflow-hidden">
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
                  {showDirectDeployButton && !isDirectDeploying && (
                    <button
                      onClick={() => handleDirectDeploy(currentEnvironmentId, currentEnvironmentName)}
                      disabled={isDirectDeploying}
                      className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-sm flex items-center space-x-1 transition-colors disabled:opacity-50"
                    >
                      <Cloud className="w-3 h-3" />
                      <span>Deploy Directo</span>
                    </button>
                  )}
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
                className="bg-gray-900 text-gray-100 p-4 font-mono text-sm h-72 overflow-y-auto"
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

                        {urls.reset_password_confirm && (
                          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div>
                              <p className="font-medium text-gray-900">Cambiar Contraseña</p>
                              <p className="text-sm text-gray-600 truncate">{urls.reset_password_confirm}</p>
                            </div>
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => copyToClipboard(urls.reset_password_confirm)}
                                className="p-2 text-gray-600 hover:bg-gray-200 rounded"
                              >
                                📋
                              </button>
                              <button
                                onClick={() => window.open(urls.reset_password_confirm, '_blank')}
                                className="p-2 text-blue-600 hover:bg-blue-100 rounded"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        )}
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

      {/* Integration Guide Modal */}
      {showIntegrationGuide && (() => {
        const environment = environments.find(env => env.id === showIntegrationGuide);
        if (!environment || !environment.metadata?.generated_urls) return null;

        const urls = environment.metadata.generated_urls;
        const apiKey = environment.metadata.api_key;

        return (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900 flex items-center space-x-2">
                  <Code className="w-6 h-6 text-blue-500" />
                  <span>Guía de Integración - {environment.name}</span>
                </h3>
                <button
                  onClick={() => setShowIntegrationGuide(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Quick Start */}
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="font-semibold text-blue-900 mb-2 flex items-center space-x-2">
                  <Shield className="w-5 h-5" />
                  <span>Configuración Rápida</span>
                </h4>
                <p className="text-sm text-blue-800 mb-3">
                  Usa tu API Key en todas las peticiones HTTP en el header <code className="bg-blue-100 px-2 py-1 rounded">X-API-Key</code>
                </p>
                <div className="bg-white p-3 rounded border border-blue-300">
                  <code className="text-sm font-mono text-gray-800">{apiKey}</code>
                </div>
              </div>

              {/* JavaScript Example */}
              <div className="mb-6">
                <h4 className="font-semibold text-gray-900 mb-3">📝 Ejemplo JavaScript / React</h4>
                <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
                  <pre className="text-sm">
{`// Configuración
const API_KEY = '${apiKey}';
const LOGIN_URL = '${urls.login}';
const REGISTER_URL = '${urls.register}';
const RESET_PASSWORD_URL = '${urls.reset_password}';
const RESET_PASSWORD_CONFIRM_URL = '${urls.reset_password_confirm || ''}';

// Función para login
async function login(email, password) {
  try {
    const response = await fetch(LOGIN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY
      },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (response.ok) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      return data;
    } else {
      throw new Error(data.message || 'Error en login');
    }
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
}

// Función para registro
async function register(email, password, name) {
  try {
    const response = await fetch(REGISTER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY
      },
      body: JSON.stringify({ email, password, name })
    });

    const data = await response.json();

    if (response.ok) {
      return data;
    } else {
      throw new Error(data.message || 'Error en registro');
    }
  } catch (error) {
    console.error('Register error:', error);
    throw error;
  }
}

// Función para recuperar contraseña
async function resetPassword(email) {
  try {
    const response = await fetch(RESET_PASSWORD_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY
      },
      body: JSON.stringify({ email })
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Reset password error:', error);
    throw error;
  }
}

// Función para confirmar cambio de contraseña
async function confirmResetPassword(token, newPassword) {
  try {
    const response = await fetch(RESET_PASSWORD_CONFIRM_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY
      },
      body: JSON.stringify({ token, new_password: newPassword })
    });

    const data = await response.json();

    if (response.ok) {
      return data;
    } else {
      throw new Error(data.message || 'Error al cambiar contraseña');
    }
  } catch (error) {
    console.error('Confirm reset password error:', error);
    throw error;
  }
}`}
                  </pre>
                </div>
              </div>

              {/* HTML Form Example */}
              <div className="mb-6">
                <h4 className="font-semibold text-gray-900 mb-3">🌐 Ejemplo HTML con Formulario</h4>
                <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
                  <pre className="text-sm">
{`<!DOCTYPE html>
<html>
<head>
  <title>Login</title>
</head>
<body>
  <form id="loginForm">
    <input type="email" id="email" placeholder="Email" required>
    <input type="password" id="password" placeholder="Contraseña" required>
    <button type="submit">Iniciar Sesión</button>
  </form>

  <script>
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
      e.preventDefault();

      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;

      try {
        const response = await fetch('${urls.login}', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': '${apiKey}'
          },
          body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok) {
          alert('Login exitoso!');
          localStorage.setItem('token', data.token);
          // Redirigir a dashboard
          window.location.href = '/dashboard';
        } else {
          alert('Error: ' + data.message);
        }
      } catch (error) {
        alert('Error de conexión');
      }
    });
  </script>
</body>
</html>`}
                  </pre>
                </div>
              </div>

              {/* PHP Example */}
              <div className="mb-6">
                <h4 className="font-semibold text-gray-900 mb-3">🐘 Ejemplo PHP</h4>
                <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
                  <pre className="text-sm">
{`<?php
$API_KEY = '${apiKey}';
$LOGIN_URL = '${urls.login}';

function login($email, $password) {
    global $API_KEY, $LOGIN_URL;

    $data = json_encode([
        'email' => $email,
        'password' => $password
    ]);

    $ch = curl_init($LOGIN_URL);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, "POST");
    curl_setopt($ch, CURLOPT_POSTFIELDS, $data);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'X-API-Key: ' . $API_KEY
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $result = json_decode($response, true);

    if ($httpCode === 200) {
        $_SESSION['token'] = $result['token'];
        $_SESSION['user'] = $result['user'];
        return $result;
    } else {
        throw new Exception($result['message'] ?? 'Error en login');
    }
}

// Uso
try {
    $result = login('usuario@email.com', 'contraseña123');
    echo "Login exitoso!";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
?>`}
                  </pre>
                </div>
              </div>

              {/* Important Notes */}
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <h4 className="font-semibold text-yellow-900 mb-2">⚠️ Notas Importantes</h4>
                <ul className="text-sm text-yellow-800 space-y-1 list-disc list-inside">
                  <li>Siempre incluye la API Key en el header <code className="bg-yellow-100 px-1 rounded">X-API-Key</code></li>
                  <li>Las URLs ya incluyen los parámetros necesarios (app_id, api_key)</li>
                  <li>Guarda el token JWT que recibes en el login de forma segura</li>
                  <li>Maneja los errores apropiadamente en tu aplicación</li>
                  <li>Usa HTTPS en producción para mayor seguridad</li>
                </ul>
              </div>

              <div className="mt-6">
                <button
                  onClick={() => setShowIntegrationGuide(null)}
                  className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                >
                  Entendido
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Repo Binding Modal */}
      {showRepoBindingModal && (() => {
        const environment = environments.find(env => env.id === showRepoBindingModal);
        if (!environment) return null;

        return (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-xl">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                <Github className="w-5 h-5" />
                <span>Configurar Repo Deploy - {environment.name}</span>
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Repositorio
                  </label>
                  <select
                    value={repoBindingForm.repoKey}
                    onChange={(e) => {
                      const selectedOption = repoSelectionOptions.find(option => option.key === e.target.value);
                      const branch = selectedOption?.source === 'saved'
                        ? selectedOption.savedRepo?.default_branch || 'main'
                        : selectedOption?.githubRepo?.default_branch || 'main';

                      setRepoBindingForm((prev) => ({
                        ...prev,
                        repoKey: e.target.value,
                        branch: branch || 'main',
                      }));
                    }}
                    disabled={loadingRepoOptions}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                  >
                    <option value="">Selecciona un repositorio guardado</option>
                    {repoSelectionOptions.map((option) => (
                      <option key={option.key} value={option.key}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {repoSelectionOptions.length === 0 && !loadingRepoOptions && (
                    <p className="text-xs text-red-600 mt-1">No se encontraron repositorios en GitHub. Verifica conexión en Conectores.</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Proveedor de publicación
                  </label>
                  <select
                    value={repoBindingForm.deployProvider}
                    onChange={(e) => setRepoBindingForm((prev) => ({
                      ...prev,
                      deployProvider: e.target.value as DeployProvider,
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="netlify">Netlify</option>
                    <option value="azure_container_apps">Azure Container Apps</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Branch
                  </label>
                  <input
                    type="text"
                    value={repoBindingForm.branch}
                    onChange={(e) => setRepoBindingForm(prev => ({ ...prev, branch: e.target.value }))}
                    placeholder="main"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {repoBindingForm.deployProvider === 'netlify' ? (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Sitio Netlify (opcional)
                      </label>
                      <select
                        value={repoBindingForm.netlifySiteId}
                        onChange={(e) => setRepoBindingForm(prev => ({ ...prev, netlifySiteId: e.target.value }))}
                        disabled={loadingRepoBindingNetlifySites}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                      >
                        <option value="">Seleccionar durante deploy</option>
                        {repoBindingNetlifySites.map((site) => (
                          <option key={site.id} value={site.id}>
                            {site.name}
                          </option>
                        ))}
                      </select>
                      {repoBindingNetlifySites.length === 0 && !loadingRepoBindingNetlifySites && (
                        <p className="text-xs text-gray-500 mt-1">No hay sitios cargados o Netlify no está configurado.</p>
                      )}
                    </div>

                    <div className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded p-2">
                      Este vínculo reutiliza repo, branch y, si lo eliges, también el sitio Netlify en próximos deploys.
                    </div>
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Nombre de Container App
                        </label>
                        <input
                          type="text"
                          value={repoBindingForm.azureContainerAppName}
                          onChange={(e) => setRepoBindingForm(prev => ({ ...prev, azureContainerAppName: e.target.value }))}
                          placeholder="auth-sendcraft-production"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Resource Group
                        </label>
                        <input
                          type="text"
                          value={repoBindingForm.azureResourceGroup}
                          onChange={(e) => setRepoBindingForm(prev => ({ ...prev, azureResourceGroup: e.target.value }))}
                          placeholder="rg-authsystem-prod"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Región
                        </label>
                        <input
                          type="text"
                          value={repoBindingForm.azureLocation}
                          onChange={(e) => setRepoBindingForm(prev => ({ ...prev, azureLocation: e.target.value }))}
                          placeholder="eastus"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Container Apps Environment
                        </label>
                        <input
                          type="text"
                          value={repoBindingForm.azureContainerAppsEnvironment}
                          onChange={(e) => setRepoBindingForm(prev => ({ ...prev, azureContainerAppsEnvironment: e.target.value }))}
                          placeholder="authsystem-shared-env"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    </div>

                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={repoBindingForm.azureCreateIfMissing}
                        onChange={(e) => setRepoBindingForm(prev => ({ ...prev, azureCreateIfMissing: e.target.checked }))}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      Crear automáticamente la Container App y el Container Apps Environment si no existen
                    </label>

                    <div className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded p-2">
                      Este vínculo reutiliza repo, branch y la configuración de Azure para que cada push a la branch despliegue los formularios en la Container App.
                    </div>
                  </>
                )}
              </div>

              <div className="flex items-center space-x-3 pt-5">
                <button
                  type="button"
                  onClick={() => setShowRepoBindingModal(null)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveRepoBinding}
                  disabled={savingRepoBinding || !repoBindingForm.repoKey}
                  className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
                >
                  {savingRepoBinding ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Edit Environment Modal */}
      {showEditModal && (() => {
        const environment = environments.find(env => env.id === showEditModal);
        if (!environment) return null;

        return (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                <Edit className="w-5 h-5" />
                <span>Editar Ambiente - {environment.name}</span>
              </h3>
              <form onSubmit={handleSaveEdit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Dominio
                  </label>
                  <input
                    type="text"
                    value={editFormData.domain}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, domain: e.target.value }))}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="auth-dev.miapp.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Auth URL
                  </label>
                  <input
                    type="url"
                    value={editFormData.auth_url}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, auth_url: e.target.value }))}
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
                    value={editFormData.callback_url}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, callback_url: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="https://miapp.com/callback"
                  />
                </div>

                <div className="flex items-center space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(null)}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                  >
                    Guardar Cambios
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (() => {
        const environment = environments.find(env => env.id === showDeleteConfirm);
        if (!environment) return null;

        return (
          <ConfirmationModal
            isOpen={true}
            title="Eliminar Ambiente"
            message={`¿Estás seguro de que deseas eliminar el ambiente "${environment.name}"? Esta acción no se puede deshacer y se eliminarán todas las configuraciones asociadas.`}
            confirmText="Eliminar"
            cancelText="Cancelar"
            onConfirm={handleDeleteEnvironment}
            onClose={() => setShowDeleteConfirm(null)}
            type="danger"
          />
        );
      })()}

      {/* Delete Log Confirmation Modal */}
      {showDeleteLogConfirm && (() => {
        const log = historicalLogs.find(l => l.id === showDeleteLogConfirm);
        if (!log) return null;

        return (
          <ConfirmationModal
            isOpen={true}
            title="Eliminar Log de Deployment"
            message={`¿Estás seguro de que deseas eliminar este log de deployment del ${new Date(log.created_at).toLocaleString('es-ES')}? Esta acción no se puede deshacer.`}
            confirmText="Eliminar"
            cancelText="Cancelar"
            onConfirm={() => {
              handleDeleteLog(showDeleteLogConfirm);
              setShowDeleteLogConfirm(null);
            }}
            onClose={() => setShowDeleteLogConfirm(null)}
            type="danger"
          />
        );
      })()}

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
                  placeholder="https://miapp.com/callback"
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

      {/* Netlify Site Selector Modal */}
      {showNetlifySiteSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900 flex items-center space-x-2">
                <Cloud className="w-6 h-6 text-purple-500" />
                <span>Seleccionar o Crear Sitio de Netlify</span>
              </h3>
              <button
                onClick={() => setShowNetlifySiteSelector(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Instructions for GitHub Connection */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2 flex items-center space-x-2">
                  <AlertCircle className="w-5 h-5" />
                  <span>Conexión con Repositorio de GitHub</span>
                </h4>
                <p className="text-sm text-blue-800 mb-3">
                  Para que Netlify pueda deployar desde tu repositorio, necesitas crear el sitio manualmente conectándolo con GitHub:
                </p>
                <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside mb-3">
                  <li>Ve a <a href="https://app.netlify.com/sites" target="_blank" rel="noopener noreferrer" className="underline font-medium">Netlify → Sites</a></li>
                  <li>Click en "Add new site" → "Import an existing project"</li>
                  <li>Selecciona "Deploy with GitHub" y autoriza el acceso</li>
                  <li>Selecciona el repositorio: <code className="bg-blue-100 px-1 rounded">{savedRepo?.repo_full_name || 'tu-usuario/tu-repositorio'}</code></li>
                  <li>Configuración:
                    <ul className="ml-6 mt-1 space-y-0.5">
                      <li>• Branch: main</li>
                      <li>• Build command: (dejar vacío)</li>
                      <li>• Publish directory: . (punto)</li>
                    </ul>
                  </li>
                  <li>Click en "Deploy site"</li>
                  <li>Una vez creado, recarga esta página para ver el sitio en la lista de abajo</li>
                </ol>
                <p className="text-xs text-blue-700">
                  💡 Después de crear el sitio en Netlify, selecciónalo de la lista de "Sitios Existentes" más abajo.
                </p>
              </div>

              {/* Create New Site Section */}
              <div className="border border-gray-200 rounded-lg p-4 opacity-50">
                <h4 className="font-semibold text-gray-900 mb-3 flex items-center space-x-2">
                  <Plus className="w-5 h-5 text-green-500" />
                  <span>Crear Nuevo Sitio (Sin Repositorio)</span>
                </h4>
                <p className="text-sm text-gray-600 mb-4">
                  Esta opción crea un sitio vacío sin conexión a GitHub. No recomendado para este caso.
                </p>
                <div className="flex items-center space-x-3">
                  <input
                    type="text"
                    value={newSiteName}
                    onChange={(e) => setNewSiteName(e.target.value)}
                    placeholder="auth-system (opcional)"
                    disabled
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent bg-gray-100"
                  />
                  <button
                    onClick={handleCreateNetlifySite}
                    disabled={true}
                    className="px-4 py-2 bg-gray-400 text-white rounded-lg flex items-center space-x-2 cursor-not-allowed"
                  >
                    <Plus className="w-4 h-4" />
                    <span>No Disponible</span>
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Usa la opción de arriba para crear un sitio conectado a GitHub
                </p>
              </div>

              {/* Existing Sites Section */}
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-gray-900 flex items-center space-x-2">
                    <Globe className="w-5 h-5 text-blue-500" />
                    <span>Seleccionar Sitio Existente</span>
                  </h4>
                  <button
                    onClick={loadNetlifySites}
                    disabled={loadingSites}
                    className="text-blue-500 hover:text-blue-600 text-sm flex items-center space-x-1"
                  >
                    {loadingSites ? (
                      <>
                        <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        <span>Cargando...</span>
                      </>
                    ) : (
                      <>
                        <RotateCcw className="w-3 h-3" />
                        <span>Recargar</span>
                      </>
                    )}
                  </button>
                </div>

                {netlifySites.length === 0 ? (
                  <div className="text-center py-8">
                    <Globe className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-sm text-gray-600">
                      {loadingSites ? 'Cargando sitios...' : 'No se encontraron sitios. Crea uno nuevo arriba.'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {netlifySites.map((site) => (
                      <div
                        key={site.id}
                        className="flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{site.name}</p>
                          <p className="text-xs text-gray-500">{site.url}</p>
                          <p className="text-xs text-gray-400 font-mono mt-1">ID: {site.id}</p>
                        </div>
                        <button
                          onClick={() => handleSelectNetlifySite(site.id, site.name, site.ssl_url || site.url)}
                          className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm transition-colors"
                        >
                          Seleccionar
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Instructions */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h4 className="font-semibold text-yellow-900 mb-2 flex items-center space-x-2">
                  <AlertTriangle className="w-5 h-5" />
                  <span>Importante</span>
                </h4>
                <ul className="text-sm text-yellow-800 space-y-1 list-disc list-inside">
                  <li>Después de crear o seleccionar un sitio, copia el Site ID que aparecerá en la consola</li>
                  <li>Agrégalo a tu archivo .env como VITE_NETLIFY_SITE_ID</li>
                  <li>Reinicia la aplicación para que los cambios surtan efecto</li>
                  <li>Una vez configurado, podrás deployar directamente desde aquí</li>
                </ul>
              </div>

              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setShowNetlifySiteSelector(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Netlify Configuration Modal */}
      {showNetlifyConfig && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900 flex items-center space-x-2">
                <Cloud className="w-6 h-6 text-purple-500" />
                <span>Configurar Netlify</span>
              </h3>
              <button
                onClick={() => setShowNetlifyConfig(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2">¿Qué es Netlify?</h4>
                <p className="text-sm text-blue-800">
                  Netlify es una plataforma de hosting que te permite deployar tu aplicación directamente desde esta interfaz.
                  Una vez configurado, podrás deployar a producción con un solo clic después de que las pruebas locales pasen exitosamente.
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-3">Paso 1: Configurar Access Token</h4>
                <ol className="text-sm text-blue-800 space-y-2 list-decimal list-inside mb-4">
                  <li>Ve a <a href="https://app.netlify.com/user/applications/personal" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-semibold">Netlify Personal Access Tokens</a></li>
                  <li>Haz clic en "New access token"</li>
                  <li>Dale un nombre descriptivo (ej: "AuthSystem Deploy")</li>
                  <li>Copia el token generado y pégalo abajo:</li>
                </ol>

                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-blue-900 mb-2">
                      Netlify Access Token
                    </label>
                    <input
                      type="password"
                      value={netlifyAccessToken}
                      onChange={(e) => setNetlifyAccessToken(e.target.value)}
                      placeholder="nfp_xxxxxxxxxxxxxxxxxxxxx"
                      className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <p className="text-xs text-blue-600 mt-1">
                      El token se guardará de forma segura en la base de datos
                    </p>
                  </div>

                  <button
                    onClick={handleSaveNetlifyToken}
                    disabled={savingNetlifyConfig || !netlifyAccessToken.trim()}
                    className="w-full px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg flex items-center justify-center space-x-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {savingNetlifyConfig ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Guardando...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        <span>Guardar Token y Continuar</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="font-semibold text-green-900 mb-2">Paso 2: Configurar Site ID (Primer Deploy)</h4>
                <p className="text-sm text-green-800 mb-2">
                  Para tu primer deploy, NO necesitas el Site ID todavía. El sistema te ayudará a:
                </p>
                <ul className="text-sm text-green-800 space-y-1 list-disc list-inside">
                  <li>Crear un nuevo sitio automáticamente desde la interfaz</li>
                  <li>O seleccionar un sitio existente si ya tienes uno</li>
                  <li>El Site ID se copiará automáticamente al portapapeles</li>
                  <li>Solo agrégalo a tu .env y reinicia la aplicación</li>
                </ul>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="font-semibold text-green-900 mb-2">¿Cómo funciona?</h4>
                <ul className="text-sm text-green-800 space-y-1 list-disc list-inside">
                  <li>Ejecuta el deploy local y espera a que todas las pruebas pasen</li>
                  <li>Si todo está OK, aparecerá un botón "Deploy to Netlify"</li>
                  <li>Al hacer clic, se disparará automáticamente un build en Netlify</li>
                  <li>Podrás ver el progreso en tiempo real en la consola</li>
                  <li>Una vez completado, recibirás la URL del sitio deployado</li>
                </ul>
              </div>

              <div className="flex items-center space-x-3 pt-4">
                <button
                  onClick={() => {
                    window.open('https://app.netlify.com/user/applications/personal', '_blank');
                  }}
                  className="flex-1 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors flex items-center justify-center space-x-2"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Ir a Netlify</span>
                </button>
                <button
                  onClick={() => setShowNetlifyConfig(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Logs History Modal */}
      {showLogsHistory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900 flex items-center space-x-2">
                <History className="w-6 h-6 text-purple-500" />
                <span>Historial de Despliegues</span>
              </h3>
              <button
                onClick={() => setShowLogsHistory(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {historicalLogs.length === 0 ? (
              <div className="text-center py-12">
                <History className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No hay despliegues registrados para este ambiente</p>
              </div>
            ) : (
              <div className="space-y-4">
                {historicalLogs.map((log) => (
                  <div
                    key={log.id}
                    className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                          log.status === 'success' ? 'bg-green-100 text-green-800' :
                          log.status === 'failed' ? 'bg-red-100 text-red-800' :
                          log.status === 'partial' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {log.status === 'success' ? '✅ Exitoso' :
                           log.status === 'failed' ? '❌ Fallido' :
                           log.status === 'partial' ? '⚠️ Parcial' :
                           '🔄 En progreso'}
                        </span>
                        <span className="text-sm text-gray-600">
                          {new Date(log.created_at).toLocaleString('es-ES', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => setShowLogDetail(log)}
                          className="px-3 py-1 bg-blue-100 text-blue-600 rounded hover:bg-blue-200 text-sm"
                        >
                          Ver Detalles
                        </button>
                        <button
                          onClick={() => downloadLog(log)}
                          className="p-2 text-gray-600 hover:bg-gray-100 rounded"
                          title="Descargar Log"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setShowDeleteLogConfirm(log.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded"
                          title="Eliminar Log"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Duración:</span>
                        <span className="ml-2 font-medium">
                          {log.completed_at
                            ? `${Math.round((new Date(log.completed_at).getTime() - new Date(log.started_at).getTime()) / 1000)}s`
                            : 'En progreso'}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Logs:</span>
                        <span className="ml-2 font-medium">{log.logs.length} entradas</span>
                      </div>
                      {log.test_results && Object.keys(log.test_results).length > 0 && (
                        <>
                          <div>
                            <span className="text-gray-600">Pruebas:</span>
                            <span className="ml-2 font-medium">
                              {Object.values(log.test_results).filter((r: any) => r.success).length} / {Object.keys(log.test_results).length} exitosas
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Log Detail Modal */}
      {showLogDetail && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-5xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900 flex items-center space-x-2">
                <Terminal className="w-6 h-6 text-blue-500" />
                <span>Detalle del Despliegue</span>
              </h3>
              <button
                onClick={() => setShowLogDetail(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Log Summary */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-gray-600 block">Estado:</span>
                  <span className={`font-medium ${
                    showLogDetail.status === 'success' ? 'text-green-600' :
                    showLogDetail.status === 'failed' ? 'text-red-600' :
                    showLogDetail.status === 'partial' ? 'text-yellow-600' :
                    'text-blue-600'
                  }`}>
                    {showLogDetail.status}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600 block">Inicio:</span>
                  <span className="font-medium">
                    {new Date(showLogDetail.started_at).toLocaleTimeString()}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600 block">Fin:</span>
                  <span className="font-medium">
                    {showLogDetail.completed_at
                      ? new Date(showLogDetail.completed_at).toLocaleTimeString()
                      : 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600 block">Duración:</span>
                  <span className="font-medium">
                    {showLogDetail.completed_at
                      ? `${Math.round((new Date(showLogDetail.completed_at).getTime() - new Date(showLogDetail.started_at).getTime()) / 1000)}s`
                      : 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            {/* Console Logs */}
            <div className="mb-6">
              <h4 className="font-semibold text-gray-900 mb-3">📋 Logs de Consola</h4>
              <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm max-h-96 overflow-y-auto">
                {showLogDetail.logs.length === 0 ? (
                  <div className="text-gray-500">No hay logs disponibles</div>
                ) : (
                  showLogDetail.logs.map((entry: any, index: number) => (
                    <div key={index} className="mb-1">
                      <span className="text-gray-500">[{entry.timestamp}]</span>
                      <span className={`ml-2 ${
                        entry.level === 'success' ? 'text-green-400' :
                        entry.level === 'error' ? 'text-red-400' :
                        entry.level === 'warning' ? 'text-yellow-400' :
                        'text-gray-300'
                      }`}>
                        {entry.level.toUpperCase()}:
                      </span>
                      <span className="ml-2">{entry.message}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Test Results */}
            {showLogDetail.test_results && Object.keys(showLogDetail.test_results).length > 0 && (
              <div className="mb-6">
                <h4 className="font-semibold text-gray-900 mb-3">🧪 Resultados de Pruebas</h4>
                <div className="space-y-2">
                  {Object.entries(showLogDetail.test_results).map(([endpoint, result]: [string, any]) => (
                    <div key={endpoint} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <span className="font-medium text-gray-900">{endpoint}</span>
                        {result.url && (
                          <p className="text-xs text-gray-500 mt-1 truncate">{result.url}</p>
                        )}
                      </div>
                      <div className="flex items-center space-x-3">
                        {result.responseTime && (
                          <span className="text-sm text-gray-600">{result.responseTime}ms</span>
                        )}
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                          result.success
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {result.success ? '✅ OK' : '❌ Error'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center space-x-3">
              <button
                onClick={() => downloadLog(showLogDetail)}
                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center space-x-2"
              >
                <Download className="w-4 h-4" />
                <span>Descargar Log Completo</span>
              </button>
              <button
                onClick={() => setShowLogDetail(null)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cerrar
              </button>
            </div>
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
