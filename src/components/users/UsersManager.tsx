import React, { useState, useEffect } from 'react';
import { Users, Plus, Search, Shield, Filter, CreditCard as Edit, Trash2, UserCheck, UserX, X, Building2 } from 'lucide-react';
import { AppUser, ApplicationRole, MfaManagedDevice } from '../../types';
import { userService } from '../../services/userService';
import { applicationService } from '../../services/applicationService';
import { subscriptionService } from '../../services/subscriptionService';
import { tenantService, Tenant } from '../../services/tenantService';
import { supabase } from '../../lib/supabase';
import { useNotification } from '../../hooks/useNotification';
import ConfirmationModal from '../ui/ConfirmationModal';
import NotificationModal from '../ui/NotificationModal';

const DEFAULT_ENVIRONMENT_OPTIONS = ['development', 'testing', 'production'] as const;

type UserCreateForm = {
  email: string;
  name: string;
  password: string;
  roles: string[];
  tenant_id: string;
  metadata: Record<string, any>;
};

type UserEditForm = {
  name: string;
  email: string;
  status: 'active' | 'inactive' | 'pending';
  roles: string[];
  tenant_id: string;
  metadata: Record<string, any>;
};

export default function UsersManager() {
  const { notification, showSuccess, showError, closeNotification } = useNotification();
  const [applications, setApplications] = useState<any[]>([]);
  const [selectedApp, setSelectedApp] = useState('');
  const [users, setUsers] = useState<AppUser[]>([]);
  const [applicationRoles, setApplicationRoles] = useState<ApplicationRole[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [availableEnvironments, setAvailableEnvironments] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [tenantFilter, setTenantFilter] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [createLoading, setCreateLoading] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; userId: string | null }>({ show: false, userId: null });
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showMfaModal, setShowMfaModal] = useState(false);
  const [mfaUser, setMfaUser] = useState<AppUser | null>(null);
  const [mfaDevices, setMfaDevices] = useState<MfaManagedDevice[]>([]);
  const [mfaLoading, setMfaLoading] = useState(false);
  const [mfaActionLoading, setMfaActionLoading] = useState(false);

  const [newUser, setNewUser] = useState<UserCreateForm>({
    email: '',
    name: '',
    password: '',
    roles: [],
    tenant_id: '',
    metadata: {}
  });

  const [editUser, setEditUser] = useState<UserEditForm>({
    name: '',
    email: '',
    status: 'active' as 'active' | 'inactive' | 'pending',
    roles: [],
    tenant_id: '',
    metadata: {}
  });

  const selectedApplication = applications.find(a => a.id === selectedApp);
  const isTenantMode = selectedApplication?.auth_mode === 'tenant';

  useEffect(() => {
    loadApplications();
  }, []);

  useEffect(() => {
    if (selectedApp) {
      loadUsers();
      loadApplicationRoles();
      loadTenants();
      loadAvailableEnvironments();
    }
  }, [selectedApp]);

  const normalizeEnvironmentName = (value: unknown): string | null => {
    if (typeof value !== 'string') return null;
    const normalized = value.trim().toLowerCase();
    return normalized || null;
  };

  const formatEnvironmentLabel = (environment: string) => {
    switch (environment) {
      case 'development':
        return 'Desarrollo';
      case 'testing':
        return 'Testing';
      case 'production':
        return 'Producción';
      default:
        return environment;
    }
  };

  const getAllowedEnvironmentsFromMetadata = (metadata?: Record<string, any>) => {
    const raw = metadata?.environment_access?.allowed_environments;
    if (!Array.isArray(raw)) return [];
    return Array.from(
      new Set(
        raw
          .map((value) => normalizeEnvironmentName(value))
          .filter((value): value is string => Boolean(value))
      )
    );
  };

  const hasExplicitEnvironmentAccess = (metadata?: Record<string, any>) =>
    Array.isArray(metadata?.environment_access?.allowed_environments);

  const updateMetadataEnvironmentAccess = (metadata: Record<string, any>, allowedEnvironments: string[]) => {
    const nextMetadata: Record<string, any> = { ...(metadata || {}) };
    const currentEnvironmentAccess =
      nextMetadata.environment_access &&
      typeof nextMetadata.environment_access === 'object' &&
      !Array.isArray(nextMetadata.environment_access)
        ? { ...(nextMetadata.environment_access as Record<string, any>) }
        : {};

    nextMetadata.environment_access = {
      ...currentEnvironmentAccess,
      allowed_environments: Array.from(new Set(allowedEnvironments.map((value) => value.toLowerCase()))),
    };

    return nextMetadata;
  };

  const getEnvironmentAccessInfo = (metadata?: Record<string, any>) => {
    const envAccess = metadata?.environment_access;
    return {
      createdFromEnvironment: normalizeEnvironmentName(envAccess?.created_from_environment),
      lastRegisteredEnvironment: normalizeEnvironmentName(envAccess?.last_registered_environment),
    };
  };

  const toggleEnvironmentForMetadata = (
    metadata: Record<string, any>,
    environment: string,
    checked: boolean
  ) => {
    const current = getAllowedEnvironmentsFromMetadata(metadata);
    const next = checked
      ? Array.from(new Set([...current, environment]))
      : current.filter((value) => value !== environment);

    return updateMetadataEnvironmentAccess(metadata, next);
  };

  const loadTenants = async () => {
    try {
      if (!isTenantMode) {
        setTenants([]);
        return;
      }
      const list = await tenantService.getTenantsByApplication(selectedApp);
      setTenants(list);
    } catch (error) {
      console.error('Error loading tenants:', error);
      setTenants([]);
    }
  };

  const loadAvailableEnvironments = async () => {
    try {
      const { data, error } = await supabase
        .from('environments')
        .select('name, is_active')
        .eq('application_id', selectedApp)
        .order('created_at', { ascending: true });

      if (error) {
        throw error;
      }

      const envsFromTable = Array.from(
        new Set(
          (data || [])
            .map((env) => normalizeEnvironmentName(env.name))
            .filter((value): value is string => Boolean(value))
        )
      );

      const envsFromMetadata = Object.keys(selectedApplication?.metadata?.environment_urls || {})
        .map((env) => normalizeEnvironmentName(env))
        .filter((value): value is string => Boolean(value));

      const merged = Array.from(new Set([...envsFromTable, ...envsFromMetadata, ...DEFAULT_ENVIRONMENT_OPTIONS]));
      setAvailableEnvironments(merged);
    } catch (error) {
      console.error('Error loading environments:', error);
      setAvailableEnvironments([...DEFAULT_ENVIRONMENT_OPTIONS]);
    }
  };

  const loadApplications = async () => {
    try {
      const apps = await applicationService.getApplications();
      setApplications(apps);
      if (apps.length > 0) {
        const stored = sessionStorage.getItem('selectedAppId');
        const preferred = stored && apps.some((a: any) => a.id === stored) ? stored : apps[0].id;
        setSelectedApp(preferred);
      }
    } catch (error) {
      console.error('Error loading applications:', error);
    }
  };

  const loadApplicationRoles = async () => {
    try {
      console.log('Loading application roles for app:', selectedApp);
      const queryWithActive = await supabase
        .from('application_roles')
        .select('*')
        .eq('application_id', selectedApp)
        .eq('is_active', true)
        .order('display_name', { ascending: true });

      if (!queryWithActive.error) {
        setApplicationRoles(queryWithActive.data || []);
        console.log('✅ Loaded application roles:', queryWithActive.data?.length || 0, 'roles:', queryWithActive.data);
        return;
      }

      const isMissingIsActiveColumn =
        queryWithActive.error?.code === 'PGRST204' &&
        String(queryWithActive.error?.message || '').includes('is_active');

      if (isMissingIsActiveColumn) {
        const fallbackQuery = await supabase
          .from('application_roles')
          .select('*')
          .eq('application_id', selectedApp)
          .order('display_name', { ascending: true });

        if (fallbackQuery.error) {
          console.error('Error loading application roles (fallback):', fallbackQuery.error);
          setApplicationRoles([]);
          return;
        }

        setApplicationRoles(fallbackQuery.data || []);
        console.warn('⚠️ application_roles.is_active is missing; using fallback query without active filter');
        return;
      }

      console.error('Error loading application roles:', queryWithActive.error);
      setApplicationRoles([]);
    } catch (error) {
      console.error('Error loading application roles:', error);
      setApplicationRoles([]);
    }
  };
  const loadUsers = async () => {
    try {
      setLoading(true);
      const appUsers = await userService.getAppUsers(selectedApp);
      console.log('Loaded users with roles:', appUsers);
      setUsers(appUsers);
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Check subscription limits before creating user
      const canCreate = await subscriptionService.canCreateUser(selectedApp);
      if (!canCreate.allowed) {
        showError(
          'Límite de usuarios alcanzado',
          canCreate.reason || 'No tienes una suscripción activa o has alcanzado el límite de usuarios de tu plan.'
        );
        return;
      }

      setCreateLoading(true);
      
      // If no roles selected, use default role
      let rolesToAssign = newUser.roles;
      if (rolesToAssign.length === 0) {
        const defaultRole = applicationRoles.find(role => role.is_default);
        if (defaultRole) {
          rolesToAssign = [defaultRole.name];
        } else if (applicationRoles.length > 0) {
          rolesToAssign = [applicationRoles[0].name];
        }
      }
      
      if (isTenantMode && !newUser.tenant_id) {
        showError('Tenant requerido', 'Selecciona una empresa (tenant) para asignar al usuario.');
        setCreateLoading(false);
        return;
      }

      await userService.createAppUser({
        ...newUser,
        roles: rolesToAssign,
        tenant_id: newUser.tenant_id || null,
        application_id: selectedApp
      });
      setShowCreateModal(false);
      setNewUser({ email: '', name: '', password: '', roles: [], tenant_id: '', metadata: {} });
      await loadUsers();
      showSuccess('Usuario creado', 'El usuario ha sido creado exitosamente.');
    } catch (error) {
      console.error('Error creating user:', error);
      showError('Error', 'No se pudo crear el usuario. Por favor, intenta nuevamente.');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setEditLoading(true);
      
      // Create user data without roles (roles are handled separately)
      const { roles, tenant_id, ...rest } = editUser;
      const userDataWithoutRoles = {
        ...rest,
        tenant_id: tenant_id || null,
      };

      // Update user basic info
      await userService.updateAppUser(editingUser!.id, userDataWithoutRoles as any);

      const currentRoles = Array.isArray(editingUser?.roles) ? [...editingUser.roles].sort() : [];
      const nextRoles = Array.isArray(roles) ? [...roles].sort() : [];
      const rolesChanged =
        currentRoles.length !== nextRoles.length ||
        currentRoles.some((roleName, index) => roleName !== nextRoles[index]);

      // Only rewrite role assignments when they actually changed.
      if (rolesChanged) {
        await userService.updateUserRoles(editingUser!.id, roles);
      }
      
      setShowEditModal(false);
      setEditingUser(null);
      await loadUsers();
      showSuccess('Usuario actualizado', 'Los datos del usuario han sido actualizados exitosamente.');
    } catch (error) {
      console.error('Error updating user:', error);
      showError('Error', 'No se pudo actualizar el usuario. Por favor, intenta nuevamente.');
    } finally {
      setEditLoading(false);
    }
  };

  const handleToggleUserStatus = async (userId: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
      await userService.updateAppUser(userId, { status: newStatus });
      await loadUsers();
      showSuccess(
        'Estado actualizado',
        `El usuario ha sido ${newStatus === 'active' ? 'activado' : 'desactivado'} exitosamente.`
      );
    } catch (error) {
      console.error('Error updating user status:', error);
      showError('Error', 'No se pudo actualizar el estado del usuario.');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    setDeleteConfirm({ show: true, userId });
  };

  const handleOpenMfaModal = async (user: AppUser) => {
    try {
      setMfaUser(user);
      setShowMfaModal(true);
      setMfaLoading(true);
      const devices = await userService.listUserMfaDevices(user.id);
      setMfaDevices(devices);
    } catch (error) {
      console.error('Error loading MFA devices:', error);
      showError('Error', error instanceof Error ? error.message : 'No se pudieron cargar los dispositivos MFA del usuario.');
      setShowMfaModal(false);
      setMfaUser(null);
    } finally {
      setMfaLoading(false);
    }
  };

  const handleRevokeMfaDevice = async (deviceId: string) => {
    if (!mfaUser) return;
    try {
      setMfaActionLoading(true);
      await userService.revokeUserMfaDevice(mfaUser.id, deviceId);
      const devices = await userService.listUserMfaDevices(mfaUser.id);
      setMfaDevices(devices);
      showSuccess('Dispositivo eliminado', 'El dispositivo MFA fue eliminado. En el próximo login se podrá registrar nuevamente si no quedan dispositivos activos.');
    } catch (error) {
      console.error('Error revoking MFA device:', error);
      showError('Error', 'No se pudo revocar el dispositivo MFA.');
    } finally {
      setMfaActionLoading(false);
    }
  };

  const handleResetMfa = async () => {
    if (!mfaUser) return;
    try {
      setMfaActionLoading(true);
      await userService.resetUserMfaDevices(mfaUser.id);
      const devices = await userService.listUserMfaDevices(mfaUser.id);
      setMfaDevices(devices);
      showSuccess('MFA reseteado', 'Se eliminaron todos los dispositivos. En el próximo login se solicitará registrar un nuevo móvil.');
    } catch (error) {
      console.error('Error resetting MFA:', error);
      showError('Error', 'No se pudo resetear MFA del usuario.');
    } finally {
      setMfaActionLoading(false);
    }
  };

  const confirmDeleteUser = async () => {
    if (!deleteConfirm.userId) return;

    try {
      setDeleteLoading(true);
      await userService.deleteAppUser(deleteConfirm.userId);
      await loadUsers();
      setDeleteConfirm({ show: false, userId: null });
      showSuccess('Usuario eliminado', 'El usuario ha sido eliminado exitosamente.');
    } catch (error) {
      console.error('Error deleting user:', error);
      showError('Error', 'No se pudo eliminar el usuario.');
    } finally {
      setDeleteLoading(false);
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || user.status === statusFilter;
    const matchesTenant = tenantFilter === 'all' || (user as any).tenant_id === tenantFilter;
    return matchesSearch && matchesStatus && matchesTenant;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'inactive': return 'bg-red-100 text-red-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-purple-100 text-purple-800';
      case 'moderator': return 'bg-blue-100 text-blue-800';
      case 'user': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const renderEnvironmentAccessEditor = (
    metadata: Record<string, any>,
    onMetadataChange: (nextMetadata: Record<string, any>) => void,
    mode: 'create' | 'edit'
  ) => {
    const allowedEnvironments = getAllowedEnvironmentsFromMetadata(metadata);
    const hasExplicitAccess = hasExplicitEnvironmentAccess(metadata);

    return (
      <div className="space-y-3 rounded-lg border border-sky-200 bg-sky-50/70 p-4">
        <div>
          <label className="block text-sm font-medium text-gray-800 mb-1">
            Acceso por ambiente
          </label>
          <p className="text-xs text-gray-600">
            Define en qué ambientes puede autenticarse este usuario. Si no configuras nada, conservará el comportamiento legacy.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {availableEnvironments.map((environment) => {
            const checked = allowedEnvironments.includes(environment);
            return (
              <label
                key={`${mode}-${environment}`}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm transition-colors ${
                  checked
                    ? 'border-blue-300 bg-blue-100 text-blue-800'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-blue-200'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) =>
                    onMetadataChange(toggleEnvironmentForMetadata(metadata, environment, e.target.checked))
                  }
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span>{formatEnvironmentLabel(environment)}</span>
              </label>
            );
          })}
        </div>

        <div className="text-xs">
          {hasExplicitAccess ? (
            allowedEnvironments.length > 0 ? (
              <p className="text-blue-700">
                Este usuario tiene control explícito. Ambientes permitidos: {allowedEnvironments.map(formatEnvironmentLabel).join(', ')}.
              </p>
            ) : (
              <p className="text-amber-700">
                Este usuario quedó con configuración explícita pero sin ambientes permitidos. Así no podrá iniciar sesión en ningún ambiente.
              </p>
            )
          ) : (
            <p className="text-gray-600">
              Sin configuración explícita. Si el tenant tiene una base por ambiente, este usuario la heredará; si no, seguirá con la compatibilidad actual.
            </p>
          )}
        </div>

        {(getEnvironmentAccessInfo(metadata).createdFromEnvironment || getEnvironmentAccessInfo(metadata).lastRegisteredEnvironment) && (
          <div className="rounded-md bg-white/80 px-3 py-2 text-xs text-gray-600 border border-sky-100">
            {getEnvironmentAccessInfo(metadata).createdFromEnvironment && (
              <p>Creado desde: <span className="font-medium text-gray-800">{formatEnvironmentLabel(getEnvironmentAccessInfo(metadata).createdFromEnvironment!)}</span></p>
            )}
            {getEnvironmentAccessInfo(metadata).lastRegisteredEnvironment && (
              <p>Último ambiente de alta: <span className="font-medium text-gray-800">{formatEnvironmentLabel(getEnvironmentAccessInfo(metadata).lastRegisteredEnvironment!)}</span></p>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Gestión de Usuarios</h2>
          <p className="text-gray-600">Administra usuarios y permisos por aplicación</p>
        </div>
        <button 
          onClick={() => setShowCreateModal(true)}
          disabled={!selectedApp}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors disabled:opacity-50"
        >
          <Plus className="w-5 h-5" />
          <span>Nuevo Usuario</span>
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
          {/* Filters and Search */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center space-x-4">
              <div className="relative flex-1 max-w-md">
                <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar usuarios..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full"
                />
              </div>
              
              <div className="flex items-center space-x-2">
                <Filter className="w-5 h-5 text-gray-400" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">Todos los estados</option>
                  <option value="active">Activos</option>
                  <option value="inactive">Inactivos</option>
                  <option value="pending">Pendientes</option>
                </select>
              </div>

              {isTenantMode && tenants.length > 0 && (
                <div className="flex items-center space-x-2">
                  <Building2 className="w-5 h-5 text-gray-400" />
                  <select
                    value={tenantFilter}
                    onChange={(e) => setTenantFilter(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="all">Todas las empresas</option>
                    {tenants.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Users Table */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
                <Users className="w-5 h-5" />
                <span>Usuarios ({filteredUsers.length})</span>
              </h3>
            </div>

            {loading ? (
              <div className="flex items-center justify-center h-32">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No hay usuarios</h3>
                <p className="text-gray-600">Comienza agregando usuarios a esta aplicación</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Usuario
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Roles
                      </th>
                      {isTenantMode && (
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Empresa
                        </th>
                      )}
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Ambientes
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Estado
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Último Login
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Creado
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-medium">
                              {user.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">{user.name}</div>
                              <div className="text-sm text-gray-500">{user.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-wrap gap-1">
                            {user.role_display_name ? (
                              <span
                                className={`px-2 py-1 text-xs font-medium rounded-full ${getRoleColor(user.roles?.[0] || '')}`}
                              >
                                {user.role_display_name}
                              </span>
                            ) : user.roles && user.roles.length > 0 ? (
                              user.roles.map((role) => (
                                <span
                                  key={role}
                                  className={`px-2 py-1 text-xs font-medium rounded-full ${getRoleColor(role)}`}
                                >
                                  {role}
                                </span>
                              ))
                            ) : null}
                          </div>
                        </td>
                        {isTenantMode && (
                          <td className="px-6 py-4 whitespace-nowrap">
                            {(user as any).tenant_name ? (
                              <span className="inline-flex items-center space-x-1 px-2 py-1 bg-emerald-50 text-emerald-700 text-xs font-medium rounded-full border border-emerald-200">
                                <Building2 className="w-3 h-3" />
                                <span>{(user as any).tenant_name}</span>
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400">Sin empresa</span>
                            )}
                          </td>
                        )}
                        <td className="px-6 py-4">
                          {hasExplicitEnvironmentAccess(user.metadata || {}) ? (
                            getAllowedEnvironmentsFromMetadata(user.metadata || {}).length > 0 ? (
                              <div className="space-y-2">
                                <div className="flex flex-wrap gap-1">
                                  {getAllowedEnvironmentsFromMetadata(user.metadata || {}).map((environment) => (
                                    <span
                                      key={`${user.id}-${environment}`}
                                      className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700"
                                    >
                                      {formatEnvironmentLabel(environment)}
                                    </span>
                                  ))}
                                </div>
                                {(getEnvironmentAccessInfo(user.metadata || {}).createdFromEnvironment || getEnvironmentAccessInfo(user.metadata || {}).lastRegisteredEnvironment) && (
                                  <div className="text-xs text-gray-500 space-y-1">
                                    {getEnvironmentAccessInfo(user.metadata || {}).createdFromEnvironment && (
                                      <div>Creado: {formatEnvironmentLabel(getEnvironmentAccessInfo(user.metadata || {}).createdFromEnvironment!)}</div>
                                    )}
                                    {getEnvironmentAccessInfo(user.metadata || {}).lastRegisteredEnvironment && (
                                      <div>Último alta: {formatEnvironmentLabel(getEnvironmentAccessInfo(user.metadata || {}).lastRegisteredEnvironment!)}</div>
                                    )}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">
                                Sin acceso
                              </span>
                            )
                          ) : (
                            <span className="inline-flex rounded-full border border-gray-200 bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600">
                              Legacy / sin restricción
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(user.status)}`}>
                            {user.status === 'active' ? 'Activo' : user.status === 'inactive' ? 'Inactivo' : 'Pendiente'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Nunca'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(user.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={() => {
                                setEditingUser(user);
                               // Extract role names from roles array (comes from application_roles join)
                               const userRoleNames = user.roles || [];
                               console.log('Setting edit user with roles:', {
                                 userId: user.id,
                                 roleId: user.role_id,
                                 roles: user.roles,
                                 extractedRoleNames: userRoleNames
                               });
                                setEditUser({
                                  name: user.name,
                                  email: user.email,
                                  status: user.status,
                                 roles: userRoleNames,
                                  tenant_id: (user as any).tenant_id || '',
                                  metadata: user.metadata || {}
                                });
                                setShowEditModal(true);
                              }}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleOpenMfaModal(user)}
                              className="text-indigo-600 hover:text-indigo-900"
                              title="Gestionar Authenticator"
                            >
                              <Shield className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleToggleUserStatus(user.id, user.status)}
                              className={user.status === 'active' ? 'text-red-600 hover:text-red-900' : 'text-green-600 hover:text-green-900'}
                            >
                              {user.status === 'active' ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                            </button>
                            <button
                              onClick={() => handleDeleteUser(user.id)}
                              className="text-red-600 hover:text-red-900"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {showMfaModal && mfaUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Authenticator de usuario</h3>
                <p className="text-sm text-gray-500">{mfaUser.name} · {mfaUser.email}</p>
              </div>
              <button
                onClick={() => {
                  setShowMfaModal(false);
                  setMfaUser(null);
                  setMfaDevices([]);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-600">Administra los dispositivos vinculados para login con aprobación móvil.</p>
              <button
                onClick={handleResetMfa}
                disabled={mfaActionLoading || mfaLoading}
                className="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                Eliminar todos
              </button>
            </div>

            {mfaLoading ? (
              <div className="flex items-center justify-center h-24">
                <div className="w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : mfaDevices.length === 0 ? (
              <div className="text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-lg p-4">
                Este usuario no tiene dispositivos activos. En el próximo login verá la pantalla de configuración con QR.
              </div>
            ) : (
              <div className="space-y-3">
                {mfaDevices.map((device) => (
                  <div key={device.id} className="border border-gray-200 rounded-lg p-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{device.device_name || 'Dispositivo móvil'}</p>
                      <p className="text-xs text-gray-500">
                        {device.device_platform || 'mobile'} · Alta: {new Date(device.created_at).toLocaleDateString()} · Última actividad: {device.last_seen_at ? new Date(device.last_seen_at).toLocaleString() : 'Sin actividad'}
                      </p>
                      <p className="text-xs mt-1">
                        <span className={device.is_active ? 'text-green-600' : 'text-gray-500'}>
                          {device.is_active ? 'Activo' : 'Revocado'}
                        </span>
                      </p>
                    </div>
                    <button
                      onClick={() => handleRevokeMfaDevice(device.id)}
                      disabled={!device.is_active || mfaActionLoading}
                      className="px-3 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                    >
                      Eliminar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Crear Nuevo Usuario</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre Completo
                </label>
                <input
                  type="text"
                  value={newUser.name}
                  onChange={(e) => setNewUser(prev => ({ ...prev, name: e.target.value }))}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Juan Pérez"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser(prev => ({ ...prev, email: e.target.value }))}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="juan@ejemplo.com"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contraseña Temporal
                </label>
                <input
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser(prev => ({ ...prev, password: e.target.value }))}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Contraseña temporal"
                />
                <p className="text-xs text-gray-500 mt-1">
                  El usuario deberá cambiar esta contraseña en su primer login
                </p>
              </div>

              {isTenantMode && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Empresa (Tenant) *
                  </label>
                  <select
                    required
                    value={newUser.tenant_id}
                    onChange={(e) => setNewUser(prev => ({ ...prev, tenant_id: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Selecciona una empresa</option>
                    {tenants.map(t => (
                      <option key={t.id} value={t.id}>{t.name} ({t.slug})</option>
                    ))}
                  </select>
                  {tenants.length === 0 && (
                    <p className="text-xs text-amber-600 mt-1">
                      No hay empresas registradas. Los usuarios se registran primero creando una empresa via /register-tenant.
                    </p>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Roles
                </label>
                <div className="space-y-2">
                  {applicationRoles.length === 0 ? (
                    <div className="text-sm text-gray-500 p-2 bg-gray-50 rounded">
                      No hay roles configurados para esta aplicación.
                      <br />
                      <a
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          const event = new CustomEvent('changeSectionWithApp', {
                            detail: { section: 'roles', appId: selectedApp }
                          });
                          window.dispatchEvent(event);
                        }}
                        className="text-blue-600 hover:underline"
                      >
                        Crear roles en la sección Roles y Permisos
                      </a>
                    </div>
                  ) : (
                    applicationRoles.map((role) => (
                      <label key={role.id} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={newUser.roles.includes(role.name)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNewUser(prev => ({ ...prev, roles: [...prev.roles, role.name] }));
                            } else {
                              setNewUser(prev => ({ ...prev, roles: prev.roles.filter(r => r !== role.name) }));
                            }
                          }}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <div className="ml-2">
                          <span className="text-sm text-gray-700">{role.display_name}</span>
                          {role.description && (
                            <p className="text-xs text-gray-500">{role.description}</p>
                          )}
                          {role.is_default && (
                            <span className="ml-2 px-1.5 py-0.5 bg-green-100 text-green-800 text-xs rounded">
                              Por defecto
                            </span>
                          )}
                        </div>
                      </label>
                    ))
                  )}
                </div>
                {applicationRoles.length > 0 && newUser.roles.length === 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    Si no seleccionas ningún rol, se asignará el rol por defecto automáticamente
                  </p>
                )}
              </div>

              <div>
                {renderEnvironmentAccessEditor(
                  newUser.metadata,
                  (nextMetadata) => setNewUser((prev) => ({ ...prev, metadata: nextMetadata })),
                  'create'
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Información Adicional (JSON)
                </label>
                <textarea
                  value={JSON.stringify(newUser.metadata, null, 2)}
                  onChange={(e) => {
                    try {
                      const parsed = JSON.parse(e.target.value);
                      setNewUser(prev => ({ ...prev, metadata: parsed }));
                    } catch (error) {
                      // Invalid JSON, don't update
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                  rows={4}
                  placeholder='{"plan": "premium", "source": "web"}'
                />
                <p className="text-xs text-gray-500 mt-1">
                  Formato JSON válido para datos adicionales del usuario
                </p>
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
                  disabled={createLoading}
                  className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                >
                  {createLoading ? 'Creando...' : 'Crear Usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && editingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Editar Usuario</h3>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingUser(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleUpdateUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre Completo
                </label>
                <input
                  type="text"
                  value={editUser.name}
                  onChange={(e) => setEditUser(prev => ({ ...prev, name: e.target.value }))}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Juan Pérez"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={editUser.email}
                  onChange={(e) => setEditUser(prev => ({ ...prev, email: e.target.value }))}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="juan@ejemplo.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Estado
                </label>
                <select
                  value={editUser.status}
                  onChange={(e) => setEditUser(prev => ({ ...prev, status: e.target.value as 'active' | 'inactive' | 'pending' }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="active">Activo</option>
                  <option value="inactive">Inactivo</option>
                  <option value="pending">Pendiente</option>
                </select>
              </div>

              {isTenantMode && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Empresa (Tenant)
                  </label>
                  <select
                    value={editUser.tenant_id}
                    onChange={(e) => setEditUser(prev => ({ ...prev, tenant_id: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Sin empresa</option>
                    {tenants.map(t => (
                      <option key={t.id} value={t.id}>{t.name} ({t.slug})</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Roles
                </label>
                <div className="space-y-2">
                  {applicationRoles.length === 0 ? (
                    <div className="text-sm text-gray-500 p-2 bg-gray-50 rounded">
                      No hay roles configurados para esta aplicación.
                      <br />
                      <a
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          const event = new CustomEvent('changeSectionWithApp', {
                            detail: { section: 'roles', appId: selectedApp }
                          });
                          window.dispatchEvent(event);
                        }}
                        className="text-blue-600 hover:underline"
                      >
                        Crear roles en la sección Roles y Permisos
                      </a>
                    </div>
                  ) : (
                    applicationRoles.map((role) => (
                      <label key={role.id} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={editUser.roles.includes(role.name)}
                          onChange={(e) => {
                            console.log('Role checkbox changed:', {
                              role: role.name,
                              checked: e.target.checked,
                              currentRoles: editUser.roles
                            });
                            if (e.target.checked) {
                              setEditUser(prev => ({ ...prev, roles: [...prev.roles, role.name] }));
                            } else {
                              setEditUser(prev => ({ ...prev, roles: prev.roles.filter(r => r !== role.name) }));
                            }
                          }}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <div className="ml-2">
                          <span className="text-sm text-gray-700">{role.display_name}</span>
                          {role.description && (
                            <p className="text-xs text-gray-500">{role.description}</p>
                          )}
                          {role.is_default && (
                            <span className="ml-2 px-1.5 py-0.5 bg-green-100 text-green-800 text-xs rounded">
                              Por defecto
                            </span>
                          )}
                        </div>
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div>
                {renderEnvironmentAccessEditor(
                  editUser.metadata,
                  (nextMetadata) => setEditUser((prev) => ({ ...prev, metadata: nextMetadata })),
                  'edit'
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Información Adicional (JSON)
                </label>
                <textarea
                  value={JSON.stringify(editUser.metadata, null, 2)}
                  onChange={(e) => {
                    try {
                      const parsed = JSON.parse(e.target.value);
                      setEditUser(prev => ({ ...prev, metadata: parsed }));
                    } catch (error) {
                      // Invalid JSON, don't update
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                  rows={4}
                  placeholder='{"plan": "premium", "source": "web"}'
                />
                <p className="text-xs text-gray-500 mt-1">
                  Formato JSON válido para datos adicionales del usuario
                </p>
              </div>
              
              <div className="flex items-center space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingUser(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
                >
                  {editLoading ? 'Actualizando...' : 'Actualizar Usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={deleteConfirm.show}
        onClose={() => setDeleteConfirm({ show: false, userId: null })}
        onConfirm={confirmDeleteUser}
        title="Eliminar Usuario"
        message="¿Estás seguro de que deseas eliminar este usuario? Esta acción no se puede deshacer y se eliminarán todos los datos asociados."
        confirmText="Eliminar"
        cancelText="Cancelar"
        type="danger"
        loading={deleteLoading}
      />

      {/* Notification Modal */}
      <NotificationModal
        notification={notification}
        onClose={closeNotification}
      />
    </div>
  );
}
