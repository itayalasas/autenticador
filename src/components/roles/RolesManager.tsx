import React, { useState, useEffect } from 'react';
import { Shield, Plus, CreditCard as Edit, Trash2, Users, Settings, Save, X, UserPlus } from 'lucide-react';
import { applicationService } from '../../services/applicationService';
import { rolesService } from '../../services/rolesService';
import { useNotification } from '../../hooks/useNotification';
import NotificationModal from '../ui/NotificationModal';
import ConfirmationModal from '../ui/ConfirmationModal';

interface ApplicationRole {
  id: string;
  name: string;
  display_name: string;
  description: string;
  permissions: string[];
  is_default: boolean;
  created_at: string;
}

export default function RolesManager() {
  const [applications, setApplications] = useState<any[]>([]);
  const [selectedApp, setSelectedApp] = useState('');
  const [roles, setRoles] = useState<ApplicationRole[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingRole, setEditingRole] = useState<ApplicationRole | null>(null);
  const [createLoading, setCreateLoading] = useState(false);

  const [newRole, setNewRole] = useState({
    name: '',
    display_name: '',
    description: '',
    permissions: [] as string[],
    is_default: false
  });

  const [editRole, setEditRole] = useState({
    name: '',
    display_name: '',
    description: '',
    permissions: [] as string[],
    is_default: false
  });

  const availablePermissions = [
    { id: 'read', name: 'Lectura', description: 'Ver contenido y datos' },
    { id: 'write', name: 'Escritura', description: 'Crear y modificar contenido' },
    { id: 'delete', name: 'Eliminar', description: 'Eliminar contenido y datos' },
    { id: 'admin', name: 'Administrador', description: 'Acceso completo al sistema' },
    { id: 'moderate', name: 'Moderar', description: 'Moderar contenido de usuarios' },
    { id: 'analytics', name: 'Analíticas', description: 'Ver reportes y estadísticas' },
    { id: 'settings', name: 'Configuración', description: 'Modificar configuraciones' },
    { id: 'users', name: 'Gestión de Usuarios', description: 'Administrar otros usuarios' }
  ];

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

  useEffect(() => {
    if (selectedApp) {
      loadRoles();
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

  const loadRoles = async () => {
    try {
      setLoading(true);
      const appRoles = await rolesService.getApplicationRoles(selectedApp);
      setRoles(appRoles);
    } catch (error) {
      console.error('Error loading roles:', error);
      setRoles([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setCreateLoading(true);
      await rolesService.createApplicationRole({
        ...newRole,
        application_id: selectedApp
      });
      setShowCreateModal(false);
      setNewRole({
        name: '',
        display_name: '',
        description: '',
        permissions: [],
        is_default: false
      });
      await loadRoles();
      showSuccess(
        'Rol creado',
        `El rol "${newRole.display_name}" ha sido creado exitosamente.`
      );
    } catch (error) {
      console.error('Error creating role:', error);
      showError(
        'Error al crear rol',
        'Ha ocurrido un error al crear el rol. Por favor, inténtalo de nuevo.'
      );
    } finally {
      setCreateLoading(false);
    }
  };

  const handleEditRole = (role: ApplicationRole) => {
    setEditingRole(role);
    setEditRole({
      name: role.name,
      display_name: role.display_name,
      description: role.description,
      permissions: role.permissions,
      is_default: role.is_default
    });
    setShowEditModal(true);
  };

  const handleUpdateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRole) return;

    try {
      setCreateLoading(true);
      await rolesService.updateApplicationRole(editingRole.id, editRole);
      setShowEditModal(false);
      setEditingRole(null);
      await loadRoles();
      showSuccess(
        'Rol actualizado',
        `El rol "${editRole.display_name}" ha sido actualizado exitosamente.`
      );
    } catch (error) {
      console.error('Error updating role:', error);
      showError(
        'Error al actualizar rol',
        'Ha ocurrido un error al actualizar el rol. Por favor, inténtalo de nuevo.'
      );
    } finally {
      setCreateLoading(false);
    }
  };

  const handleDeleteRole = (role: ApplicationRole) => {
    showConfirmation(
      'Eliminar rol',
      `¿Estás seguro de que deseas eliminar el rol "${role.display_name}"? Los usuarios con este rol perderán sus permisos.`,
      async () => {
        try {
          setConfirmationLoading(true);
          await rolesService.deleteApplicationRole(role.id);
          await loadRoles();
          closeConfirmation();
          showSuccess(
            'Rol eliminado',
            `El rol "${role.display_name}" ha sido eliminado exitosamente.`
          );
        } catch (error) {
          console.error('Error deleting role:', error);
          closeConfirmation();
          showError(
            'Error al eliminar',
            'Ha ocurrido un error al eliminar el rol. Por favor, inténtalo de nuevo.'
          );
        }
      },
      { type: 'danger', confirmText: 'Eliminar' }
    );
  };

  const handleSetDefaultRole = async (roleId: string) => {
    try {
      await rolesService.setDefaultRole(selectedApp, roleId);
      await loadRoles();
      showSuccess(
        'Rol por defecto actualizado',
        'El rol por defecto ha sido actualizado exitosamente.'
      );
    } catch (error) {
      console.error('Error setting default role:', error);
      showError(
        'Error al actualizar',
        'Ha ocurrido un error al actualizar el rol por defecto.'
      );
    }
  };

  const getPermissionColor = (permission: string) => {
    switch (permission) {
      case 'read': return 'bg-blue-100 text-blue-800';
      case 'write': return 'bg-green-100 text-green-800';
      case 'delete': return 'bg-red-100 text-red-800';
      case 'admin': return 'bg-purple-100 text-purple-800';
      case 'moderate': return 'bg-yellow-100 text-yellow-800';
      case 'analytics': return 'bg-indigo-100 text-indigo-800';
      case 'settings': return 'bg-gray-100 text-gray-800';
      case 'users': return 'bg-pink-100 text-pink-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const generateRoleName = (displayName: string) => {
    return displayName.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .trim();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Gestión de Roles</h2>
          <p className="text-gray-600">Administra roles y permisos por aplicación</p>
        </div>
        <button 
          onClick={() => setShowCreateModal(true)}
          disabled={!selectedApp}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors disabled:opacity-50"
        >
          <Plus className="w-5 h-5" />
          <span>Nuevo Rol</span>
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
          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <h3 className="font-medium text-blue-900">Información sobre Roles</h3>
                <p className="text-sm text-blue-800 mt-1">
                  Los roles definen qué pueden hacer los usuarios en tu aplicación. Cada rol puede tener múltiples permisos.
                  El rol marcado como "por defecto" se asignará automáticamente a nuevos usuarios.
                </p>
              </div>
            </div>
          </div>

          {/* Roles List */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
                <Shield className="w-5 h-5" />
                <span>Roles de la Aplicación ({roles.length})</span>
              </h3>
            </div>

            {loading ? (
              <div className="flex items-center justify-center h-32">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : roles.length === 0 ? (
              <div className="text-center py-12">
                <Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No hay roles configurados</h3>
                <p className="text-gray-600">Comienza creando roles para organizar los permisos de usuarios</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {roles.map((role) => (
                  <div key={role.id} className="p-6 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h4 className="text-lg font-medium text-gray-900">{role.display_name}</h4>
                          <code className="text-sm bg-gray-100 px-2 py-1 rounded font-mono text-gray-600">
                            {role.name}
                          </code>
                          {role.is_default && (
                            <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">
                              Por defecto
                            </span>
                          )}
                        </div>

                        {role.description && (
                          <p className="text-gray-600 mb-3">{role.description}</p>
                        )}

                        {/* Permissions */}
                        <div className="flex flex-wrap gap-2 mb-3">
                          {role.permissions.map((permission) => (
                            <span
                              key={permission}
                              className={`px-2 py-1 text-xs font-medium rounded-full ${getPermissionColor(permission)}`}
                            >
                              {availablePermissions.find(p => p.id === permission)?.name || permission}
                            </span>
                          ))}
                        </div>

                        <div className="text-sm text-gray-500">
                          Creado el {new Date(role.created_at).toLocaleDateString()}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center space-x-2 ml-4">
                        {!role.is_default && (
                          <button
                            onClick={() => handleSetDefaultRole(role.id)}
                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title="Establecer como rol por defecto"
                          >
                            <UserPlus className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleEditRole(role)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteRole(role)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          disabled={role.is_default}
                          title={role.is_default ? 'No se puede eliminar el rol por defecto' : 'Eliminar rol'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Create Role Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Crear Nuevo Rol</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRole} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nombre para mostrar *
                  </label>
                  <input
                    type="text"
                    value={newRole.display_name}
                    onChange={(e) => {
                      const displayName = e.target.value;
                      setNewRole(prev => ({ 
                        ...prev, 
                        display_name: displayName,
                        name: generateRoleName(displayName)
                      }));
                    }}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Editor de Contenido"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nombre técnico
                  </label>
                  <input
                    type="text"
                    value={newRole.name}
                    onChange={(e) => setNewRole(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                    placeholder="editor_contenido"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Se genera automáticamente, pero puedes personalizarlo
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Descripción
                </label>
                <textarea
                  value={newRole.description}
                  onChange={(e) => setNewRole(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Describe qué puede hacer este rol..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Permisos *
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {availablePermissions.map((permission) => (
                    <label key={permission.id} className="flex items-start space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={newRole.permissions.includes(permission.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNewRole(prev => ({ 
                              ...prev, 
                              permissions: [...prev.permissions, permission.id] 
                            }));
                          } else {
                            setNewRole(prev => ({ 
                              ...prev, 
                              permissions: prev.permissions.filter(p => p !== permission.id) 
                            }));
                          }
                        }}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mt-0.5"
                      />
                      <div>
                        <p className="font-medium text-gray-900">{permission.name}</p>
                        <p className="text-sm text-gray-600">{permission.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={newRole.is_default}
                    onChange={(e) => setNewRole(prev => ({ ...prev, is_default: e.target.checked }))}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <p className="font-medium text-gray-900">Rol por defecto</p>
                    <p className="text-sm text-gray-600">Se asignará automáticamente a nuevos usuarios</p>
                  </div>
                </label>
              </div>

              <div className="flex items-center space-x-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createLoading || newRole.permissions.length === 0}
                  className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
                >
                  {createLoading ? 'Creando...' : 'Crear Rol'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Role Modal */}
      {showEditModal && editingRole && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Editar Rol</h3>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingRole(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateRole} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nombre para mostrar *
                  </label>
                  <input
                    type="text"
                    value={editRole.display_name}
                    onChange={(e) => {
                      const displayName = e.target.value;
                      setEditRole(prev => ({ 
                        ...prev, 
                        display_name: displayName,
                        name: generateRoleName(displayName)
                      }));
                    }}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Editor de Contenido"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nombre técnico
                  </label>
                  <input
                    type="text"
                    value={editRole.name}
                    onChange={(e) => setEditRole(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                    placeholder="editor_contenido"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Descripción
                </label>
                <textarea
                  value={editRole.description}
                  onChange={(e) => setEditRole(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Describe qué puede hacer este rol..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Permisos *
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {availablePermissions.map((permission) => (
                    <label key={permission.id} className="flex items-start space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={editRole.permissions.includes(permission.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setEditRole(prev => ({ 
                              ...prev, 
                              permissions: [...prev.permissions, permission.id] 
                            }));
                          } else {
                            setEditRole(prev => ({ 
                              ...prev, 
                              permissions: prev.permissions.filter(p => p !== permission.id) 
                            }));
                          }
                        }}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mt-0.5"
                      />
                      <div>
                        <p className="font-medium text-gray-900">{permission.name}</p>
                        <p className="text-sm text-gray-600">{permission.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={editRole.is_default}
                    onChange={(e) => setEditRole(prev => ({ ...prev, is_default: e.target.checked }))}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <p className="font-medium text-gray-900">Rol por defecto</p>
                    <p className="text-sm text-gray-600">Se asignará automáticamente a nuevos usuarios</p>
                  </div>
                </label>
              </div>

              <div className="flex items-center space-x-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingRole(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createLoading || editRole.permissions.length === 0}
                  className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
                >
                  {createLoading ? 'Actualizando...' : 'Actualizar Rol'}
                </button>
              </div>
            </form>
          </div>
        </div>
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