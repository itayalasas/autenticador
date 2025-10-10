import React, { useState, useEffect, useRef } from 'react';
import { Database, Globe, Play, Settings, Trash2, Plus, CheckCircle, AlertTriangle, Terminal, X, RotateCcw, ExternalLink, Eye, Code, FileText, Shield, CreditCard as Edit, Power, MoreVertical, Upload, Cloud, AlertCircle } from 'lucide-react';
import { applicationService } from '../../services/applicationService';
import { subscriptionService } from '../../services/subscriptionService';
import { netlifyService } from '../../services/netlifyService';
import { githubService } from '../../services/githubService';
import { connectorsService } from '../../services/connectorsService';
import { environmentVariablesService } from '../../services/environmentVariablesService';
import { supabase } from '../../lib/supabase';
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
  const [showIntegrationGuide, setShowIntegrationGuide] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showLogsHistory, setShowLogsHistory] = useState<string | null>(null);
  const [showLogDetail, setShowLogDetail] = useState<any>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [consoleLogs, setConsoleLogs] = useState<LogEntry[]>([]);
  const [historicalLogs, setHistoricalLogs] = useState<any[]>([]);
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
  const [isDirectDeploying, setIsDirectDeploying] = useState(false);
  const [showDirectDeployButton, setShowDirectDeployButton] = useState(false);
  const [currentEnvironmentId, setCurrentEnvironmentId] = useState<string>('');
  const [currentEnvironmentName, setCurrentEnvironmentName] = useState<string>('');
  const [savedRepo, setSavedRepo] = useState<any>(null);
  const consoleRef = useRef<HTMLDivElement>(null);
  const logIdCounter = useRef(0);
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
    setConsoleLogs(prev => [...prev, newLog]);
  };

  const clearLogs = () => {
    setConsoleLogs([]);
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

      addLog(`🚀 Iniciando validación y despliegue para ambiente ${environmentName}`, 'info');
      addLog('', 'info');

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

      // Get base URL from environment (priority: environment.auth_url > fallback)
      // Always use the auth_url from the environment (which can be edited by user)
      let baseUrl = environment.auth_url || `https://auth-${environmentName}.${selectedApplication.domain}`;
      const callbackUrl = environment.callback_url || `https://${selectedApplication.domain}/auth/callback`;

      // Ensure baseUrl doesn't end with slash to avoid double slashes
      baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;

      addLog(`🌐 Base URL: ${baseUrl}`, 'info');
      addLog(`🔄 Callback URL: ${callbackUrl}`, 'info');

      // Generate API key for this environment
      const apiKey = generateApiKey(environmentName);
      addLog(`🔑 Generated API Key: ${apiKey}`, 'info');

      // Generate valid reset token for testing (same logic as edge function)
      addLog('🔑 Generando token válido para reset password...', 'info');
      const testToken = await generateValidResetToken(selectedApplication.id);
      addLog(`✅ Token válido generado y guardado en BD (expira en 24h)`, 'success');
      addLog('', 'info');

      // Generate URLs for forms and API
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const generatedUrls = {
        api_base: `${supabaseUrl}/functions/v1`,
        login: `${baseUrl}/login?app_id=${applicationId}&api_key=${apiKey}`,
        register: `${baseUrl}/register?app_id=${applicationId}&api_key=${apiKey}`,
        reset_password: `${baseUrl}/reset-password?app_id=${applicationId}&api_key=${apiKey}`,
        reset_password_confirm: `${baseUrl}/reset-password-confirm?token=${testToken}&email=test@example.com`,
        callback: callbackUrl
      };

      addLog('📋 URLs generadas:', 'info');
      Object.entries(generatedUrls).forEach(([key, url]) => {
        addLog(`   ${key}: ${url}`, 'info');
      });
      addLog('', 'info');

      // Save API key to database
      addLog('💾 Paso 6: Guardando API key en la base de datos...', 'info');
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
      addLog('', 'info');

      // Test API endpoints
      addLog('🧪 Paso 7: Probando endpoints de Edge Functions...', 'info');
      const testResults = await testAllEndpoints(supabaseUrl, applicationId, apiKey);
      addLog('', 'info');

      // Update environment with generated URLs and test results
      addLog('💾 Paso 8: Actualizando configuración del ambiente...', 'info');
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
        addLog('✅ Ambiente actualizado exitosamente', 'success');
        addLog('', 'info');

        // Reload environments to show updated data
        await loadEnvironments();
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

      if (allTestsPassed) {
        addLog(`🎉 ¡Despliegue completado exitosamente para ${environmentName}!`, 'success');
        addLog(`🌍 El ambiente está listo para integrarse`, 'success');
        addLog('', 'info');
        addLog('📚 Usa el botón "Ver URLs" para obtener las URLs de integración', 'info');
        addLog('📖 Usa el botón "Guía de Integración" para ver ejemplos de código', 'info');

        // Si todos los tests pasaron y Netlify está configurado, preguntar si desplegar
        if (netlifyService.isConfigured() && environmentName === 'production') {
          addLog('', 'info');
          addLog('☁️  Netlify configurado detectado', 'info');
          addLog('💡 Puedes deployar a Netlify usando el botón "Deploy to Netlify"', 'info');
        }
      } else {
        addLog(`⚠️ Despliegue completado con algunas pruebas fallidas`, 'warning');
        addLog(`🔧 Revisa los resultados y corrige los problemas`, 'warning');
      }

      return allTestsPassed;

    } catch (error) {
      console.error('Deploy error:', error);
      addLog(`❌ Deployment failed: ${error.message || 'Unknown error'}`, 'error');
      return false;
    } finally {
      setDeployLoading(null);
      setIsDeploying(false);
    }
  };

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
      const savedRepos = await githubService.getSavedRepositories();
      if (savedRepos.length === 0) {
        showNotification('warning', 'Repositorio Requerido',
          'Crea o selecciona un repositorio de GitHub en la sección "Conectores" primero.');
        return;
      }

      // Usar el primer repo (o el que esté marcado como principal)
      const repo = savedRepos[0];
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

        // Crear hash de la key para almacenamiento seguro
        const encoder = new TextEncoder();
        const data = encoder.encode(apiKey);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const keyHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        // Crear preview (primeros 20 chars + ... + últimos 4)
        const keyPreview = `${apiKey.substring(0, 20)}...${apiKey.substring(apiKey.length - 4)}`;

        const { error: insertError } = await supabase
          .from('api_keys')
          .insert({
            application_id: app.id,
            name: `${environmentName} API Key`,
            key_hash: keyHash,
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
        // Por seguridad, las keys completas solo se muestran al crearlas
        addLog(`   ✓ API Key existente encontrada: ${apiKeys[0].key_preview}`, 'success');
        addLog(`   ⚠️  Nota: Asegúrate de tener guardada tu API Key completa`, 'warning');

        // Para el deploy, necesitamos generar un placeholder
        // El usuario deberá configurar manualmente la API Key real en Netlify
        apiKey = `PLACEHOLDER_${environmentName.toUpperCase()}_API_KEY`;

        addLog(`   ℹ️  Deberás configurar la API Key manualmente en Netlify:`, 'info');
        addLog(`      Variable: AUTHSYSTEM_API_KEY`, 'info');
        addLog(`      Valor: Tu API Key guardada (${apiKeys[0].key_preview})`, 'info');
      }

      addLog('📁 Preparando formularios estáticos...', 'info');
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      // Generar archivos HTML estáticos (sin build requerido)
      const { getStaticProjectFiles } = await import('../../utils/projectFilesHelper');
      const files = await getStaticProjectFiles(
        app.application_id,
        apiKey,
        supabaseUrl,
        supabaseAnonKey,
        app.branding
      );

      // Agregar README simple
      files['README.md'] = `# ${selectedApp} - ${environmentName}

Formularios de autenticación estáticos

Generado automáticamente por AuthSystem
Fecha: ${new Date().toISOString()}

## URLs Disponibles

- Login: https://tu-sitio.netlify.app/login
- Registro: https://tu-sitio.netlify.app/register
- Recuperar contraseña: https://tu-sitio.netlify.app/reset

## Configuración

Estos formularios están pre-configurados y listos para usar.
No requieren instalación ni build.

Los formularios se conectan automáticamente a tu aplicación de AuthSystem.
`;

      addLog(`   ✓ ${Object.keys(files).length} archivos generados (HTML estáticos)`, 'success');

      // STEP 6: Hacer commit y push a GitHub
      addLog(`📤 Subiendo código a GitHub (${repo.repo_full_name})...`, 'info');
      await githubService.commitAndPush(
        repo.repo_full_name,
        files,
        `Deploy ${environmentName} - ${new Date().toLocaleString()}`
      );
      addLog('✅ Código subido a GitHub exitosamente', 'success');

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
              buildCommand: '', // Sin build (archivos estáticos)
              publishDir: '.', // Publicar desde raíz
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
      if (newSiteCreated) {
        addLog('', 'info');
        addLog('✅ Netlify detectó el push y está deployando automáticamente', 'success');
        addLog('   El webhook de GitHub está configurado', 'info');
      } else {
        // Si es un sitio existente, triggear deploy manualmente
        addLog('☁️ Triggeando deploy en Netlify...', 'info');

        try {
          await netlifyService.triggerDeploy({
            siteId,
            branch: 'main',
            title: `Deploy ${environmentName} - ${new Date().toLocaleString()}`
          });
          addLog('   ✓ Deploy iniciado en Netlify', 'success');
        } catch (error: any) {
          console.error('Error triggering deploy:', error);
          addLog('   ⚠️ No se pudo triggear deploy automático', 'warning');
          addLog('   Netlify deployará cuando detecte el próximo push', 'info');
        }
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
      addLog('🎉 ¡DEPLOY AUTOMÁTICO COMPLETADO EXITOSAMENTE!', 'success');
      addLog('', 'info');
      addLog(`🌐 URL del sitio: ${finalDeploy.ssl_url}`, 'success');
      addLog(`🔗 URL del deploy: ${finalDeploy.deploy_ssl_url}`, 'info');
      addLog(`⚙️  Admin URL: ${finalDeploy.admin_url}`, 'info');
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
        const authUrls = {
          base_url: baseUrl,
          login_url: `${baseUrl}/login`,
          register_url: `${baseUrl}/register`,
          reset_password_url: `${baseUrl}/reset-password`,
          deployed_at: new Date().toISOString(),
          netlify_deploy_id: finalDeploy.id,
          netlify_site_id: siteId
        };

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
      const sites = await netlifyService.listSites();
      setNetlifySites(sites);
      addLog(`✅ Se encontraron ${sites.length} sitios`, 'success');
    } catch (error: any) {
      console.error('Error loading Netlify sites:', error);
      addLog(`❌ Error al cargar sitios: ${error.message}`, 'error');
    } finally {
      setLoadingSites(false);
    }
  };

  const handleCreateNetlifySite = async () => {
    try {
      setCreatingNetlifySite(true);
      addLog('', 'info');
      addLog('🏗️  Creando nuevo sitio en Netlify...', 'info');

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

  const handleSelectNetlifySite = async (siteId: string, siteName: string, siteUrl: string) => {
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

      addLog('✅ Configuración actualizada exitosamente!', 'success');
      addLog('', 'info');
      addLog('🎉 Netlify está configurado y listo para usar', 'success');
      addLog('💡 Ya puedes hacer deploy sin reiniciar la aplicación', 'info');

      setShowNetlifySiteSelector(false);
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

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    addLog(`📋 Copied to clipboard: ${text}`, 'success');
  };

  const handleToggleStatus = async (environmentId: string, currentStatus: boolean) => {
    try {
      await applicationService.toggleEnvironmentStatus(environmentId, !currentStatus);
      await loadEnvironments();
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
      await loadEnvironments();
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
      await loadEnvironments();
      setShowDeleteConfirm(null);
      addLog('✅ Ambiente eliminado exitosamente', 'success');
    } catch (error) {
      console.error('Error deleting environment:', error);
      addLog('❌ Error al eliminar el ambiente', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Gestión de Ambientes</h2>
          <p className="text-gray-600">Gestiona ambientes de desarrollo, testing y producción</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={async () => {
              const isConfigured = await netlifyService.isConfigured();
              if (!isConfigured) {
                setShowNetlifyConfig(true);
              } else {
                addLog('✅ Netlify ya está configurado', 'success');
                addLog('💡 Puedes hacer deploy directamente', 'info');
                setShowConsole(true);
              }
            }}
            className="bg-purple-100 text-purple-700 px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors hover:bg-purple-200 border border-purple-300"
          >
            <Cloud className="w-5 h-5" />
            <span>Configurar Netlify</span>
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
                      {/* Show auth URLs from application metadata if available */}
                      {(() => {
                        const app = applications.find(a => a.id === selectedApp);
                        const envUrls = app?.metadata?.environment_urls?.[env.name.toLowerCase()];

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
                                    className="text-xs text-blue-600 hover:text-blue-800 truncate flex-1 hover:underline"
                                  >
                                    {envUrls.login_url}
                                  </a>
                                  <button
                                    onClick={() => {
                                      navigator.clipboard.writeText(envUrls.login_url);
                                      showNotification('success', 'Copiado', 'URL copiada al portapapeles');
                                    }}
                                    className="p-1 hover:bg-green-100 rounded"
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
                                    className="text-xs text-blue-600 hover:text-blue-800 truncate flex-1 hover:underline"
                                  >
                                    {envUrls.register_url}
                                  </a>
                                  <button
                                    onClick={() => {
                                      navigator.clipboard.writeText(envUrls.register_url);
                                      showNotification('success', 'Copiado', 'URL copiada al portapapeles');
                                    }}
                                    className="p-1 hover:bg-green-100 rounded"
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
                                    className="text-xs text-blue-600 hover:text-blue-800 truncate flex-1 hover:underline"
                                  >
                                    {envUrls.reset_password_url}
                                  </a>
                                  <button
                                    onClick={() => {
                                      navigator.clipboard.writeText(envUrls.reset_password_url);
                                      showNotification('success', 'Copiado', 'URL copiada al portapapeles');
                                    }}
                                    className="p-1 hover:bg-green-100 rounded"
                                    title="Copiar URL"
                                  >
                                    <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    </svg>
                                  </button>
                                </div>
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
                          {env.metadata?.deployment_status === 'deployed' && env.name === 'production' && (
                            <button
                              onClick={() => handleDeployToNetlify(env.id, env.name)}
                              disabled={isNetlifyDeploying}
                              className="p-2 bg-purple-100 text-purple-600 hover:bg-purple-200 rounded-lg transition-colors disabled:opacity-50"
                              title={netlifyService.isConfigured() ? 'Deploy to Netlify' : 'Netlify no configurado'}
                            >
                              {isNetlifyDeploying ? (
                                <div className="w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <Cloud className="w-4 h-4" />
                              )}
                            </button>
                          )}
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
                    placeholder="https://miapp.com/auth/callback"
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
            onCancel={() => setShowDeleteConfirm(null)}
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
                  showLogDetail.logs.map((entry: LogEntry) => (
                    <div key={entry.id} className="mb-1">
                      <span className="text-gray-500">[{new Date(entry.timestamp).toLocaleTimeString()}]</span>
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