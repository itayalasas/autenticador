import React, { useState, useEffect } from 'react';
import { Check, X, Plus, Trash2, Save, Settings } from 'lucide-react';
import { permissionsService, MenuWithActions } from '../../services/permissionsService';
import { useNotification } from '../../hooks/useNotification';

interface PermissionsMatrixProps {
  roleId: string;
  roleName: string;
  applicationId: string;
  onClose: () => void;
  onSaved?: () => void;
}

export default function PermissionsMatrix({
  roleId,
  roleName,
  applicationId,
  onClose,
  onSaved
}: PermissionsMatrixProps) {
  const [menus, setMenus] = useState<MenuWithActions[]>([]);
  const [permissions, setPermissions] = useState<{
    [menuId: string]: { [actionId: string]: boolean };
  }>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { showNotification } = useNotification();

  const flattenMenus = (items: MenuWithActions[]): MenuWithActions[] => {
    const result: MenuWithActions[] = [];
    const walk = (menusToWalk: MenuWithActions[]) => {
      menusToWalk.forEach(menu => {
        result.push(menu);
        if (menu.submenus.length > 0) {
          walk(menu.submenus);
        }
      });
    };

    walk(items);
    return result;
  };

  const collectBranchMenuIds = (menu: MenuWithActions): string[] => {
    const ids: string[] = [menu.id];
    menu.submenus.forEach(submenu => {
      ids.push(...collectBranchMenuIds(submenu));
    });
    return ids;
  };

  useEffect(() => {
    loadData();
  }, [roleId, applicationId]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load menus and actions
      const menusData = await permissionsService.getApplicationMenus(applicationId);
      setMenus(menusData);

      // Load current permissions
      const rolePerms = await permissionsService.getRolePermissions(roleId);

      // Build permissions map
      const permsMap: { [menuId: string]: { [actionId: string]: boolean } } = {};
      const flatMenus = flattenMenus(menusData);

      flatMenus.forEach(menu => {
        permsMap[menu.id] = {};
        menu.actions.forEach(action => {
          const hasPermission = rolePerms.some(
            p => p.menu_id === menu.id && p.action_id === action.id && p.granted
          );
          permsMap[menu.id][action.id] = hasPermission;
        });
      });

      setPermissions(permsMap);
    } catch (error: any) {
      console.error('Error loading permissions:', error);
      showNotification('error', error.message || 'Error al cargar permisos');
    } finally {
      setLoading(false);
    }
  };

  const togglePermission = (menuId: string, actionId: string) => {
    setPermissions(prev => ({
      ...prev,
      [menuId]: {
        ...prev[menuId],
        [actionId]: !prev[menuId]?.[actionId]
      }
    }));
  };

  const toggleAllMenuActions = (menuId: string, granted: boolean) => {
    const menu = flattenMenus(menus).find(m => m.id === menuId);
    if (!menu) return;

    setPermissions(prev => {
      const newMenuPerms: { [actionId: string]: boolean } = {};
      menu.actions.forEach(action => {
        newMenuPerms[action.id] = granted;
      });

      return {
        ...prev,
        [menuId]: newMenuPerms
      };
    });
  };

  const toggleAllBranchActions = (menu: MenuWithActions, granted: boolean) => {
    const branchMenuIds = collectBranchMenuIds(menu);
    const flatMenus = flattenMenus(menus);

    setPermissions(prev => {
      const updated = { ...prev };

      branchMenuIds.forEach(menuId => {
        const currentMenu = flatMenus.find(m => m.id === menuId);
        if (!currentMenu) return;

        const newMenuPerms: { [actionId: string]: boolean } = {};
        currentMenu.actions.forEach(action => {
          newMenuPerms[action.id] = granted;
        });

        updated[menuId] = newMenuPerms;
      });

      return updated;
    });
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      // Build permissions array
      const permsArray: Array<{
        menu_id: string;
        action_id: string;
        granted: boolean;
      }> = [];

      Object.entries(permissions).forEach(([menuId, actions]) => {
        Object.entries(actions).forEach(([actionId, granted]) => {
          permsArray.push({
            menu_id: menuId,
            action_id: actionId,
            granted
          });
        });
      });

      await permissionsService.bulkSetRolePermissions(roleId, permsArray);

      showNotification('success', 'Permisos guardados exitosamente');
      onSaved?.();
      onClose();
    } catch (error: any) {
      console.error('Error saving permissions:', error);
      showNotification('error', error.message || 'Error al guardar permisos');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-8 max-w-6xl w-full max-h-[90vh] overflow-auto">
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gradient-to-r from-blue-50 to-white">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Permisos del Rol</h2>
            <p className="text-sm text-gray-600 mt-1">
              Configura los permisos para: <span className="font-semibold text-blue-600">{roleName}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {menus.length === 0 ? (
            <div className="text-center py-12">
              <Settings className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-lg mb-2">No hay menús configurados</p>
              <p className="text-gray-400 text-sm">
                Primero debes crear menús para esta aplicación
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {menus.map(menu => {
                const menuPerms = permissions[menu.id] || {};
                const allGranted = menu.actions.every(a => menuPerms[a.id]);
                const branchMenuIds = collectBranchMenuIds(menu);
                const flatMenus = flattenMenus(menus);
                const branchActions = branchMenuIds.flatMap(id => flatMenus.find(m => m.id === id)?.actions || []);
                const branchAllGranted = branchActions.length > 0
                  ? branchActions.every(action => permissions[action.menu_id]?.[action.id])
                  : false;

                const renderMenuPermissions = (currentMenu: MenuWithActions, depth = 0) => {
                  const currentPerms = permissions[currentMenu.id] || {};
                  const currentAllGranted = currentMenu.actions.length > 0
                    ? currentMenu.actions.every(a => currentPerms[a.id])
                    : false;

                  return (
                    <div key={currentMenu.id} className={depth > 0 ? 'border border-gray-200 rounded-lg overflow-hidden' : ''}>
                      {depth > 0 && (
                        <div
                          className="bg-gray-50 px-4 py-3 flex items-center justify-between border-b border-gray-200"
                          style={{ paddingLeft: `${16 + (depth - 1) * 20}px` }}
                        >
                          <div className="flex items-center space-x-3">
                            {currentMenu.icon && <span className="text-xl">{currentMenu.icon}</span>}
                            <div>
                              <h4 className="font-medium text-gray-900">{currentMenu.name}</h4>
                              {currentMenu.description && (
                                <p className="text-xs text-gray-500">{currentMenu.description}</p>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => toggleAllMenuActions(currentMenu.id, !currentAllGranted)}
                            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                              currentAllGranted
                                ? 'bg-red-100 text-red-700 hover:bg-red-200'
                                : 'bg-green-100 text-green-700 hover:bg-green-200'
                            }`}
                          >
                            {currentAllGranted ? 'Desmarcar submenú' : 'Marcar submenú'}
                          </button>
                        </div>
                      )}

                      {currentMenu.actions.length > 0 && (
                        <div
                          className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3"
                          style={depth > 0 ? { paddingLeft: `${16 + (depth - 1) * 20}px` } : undefined}
                        >
                          {currentMenu.actions.map(action => {
                            const isGranted = currentPerms[action.id];

                            return (
                              <button
                                key={action.id}
                                onClick={() => togglePermission(currentMenu.id, action.id)}
                                className={`p-4 rounded-lg border-2 transition-all text-left ${
                                  isGranted
                                    ? 'border-green-500 bg-green-50 hover:bg-green-100'
                                    : 'border-gray-200 bg-white hover:bg-gray-50'
                                }`}
                              >
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center space-x-2">
                                      <div className={`p-1 rounded ${
                                        isGranted ? 'bg-green-500' : 'bg-gray-300'
                                      }`}>
                                        <Check className={`w-3 h-3 ${
                                          isGranted ? 'text-white' : 'text-gray-500'
                                        }`} />
                                      </div>
                                      <span className={`font-medium ${
                                        isGranted ? 'text-green-900' : 'text-gray-700'
                                      }`}>
                                        {action.name}
                                      </span>
                                    </div>
                                    {action.description && (
                                      <p className={`text-xs mt-2 ${
                                        isGranted ? 'text-green-700' : 'text-gray-500'
                                      }`}>
                                        {action.description}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {currentMenu.submenus.length > 0 && (
                        <div className="space-y-3 p-4 border-t border-gray-100 bg-gray-50/40">
                          {currentMenu.submenus.map(submenu => renderMenuPermissions(submenu, depth + 1))}
                        </div>
                      )}
                    </div>
                  );
                };

                return (
                  <div key={menu.id} className="border border-gray-200 rounded-lg overflow-hidden">
                    {/* Menu Header */}
                    <div className="bg-gray-50 px-4 py-3 flex items-center justify-between border-b border-gray-200">
                      <div className="flex items-center space-x-3">
                        {menu.icon && <span className="text-2xl">{menu.icon}</span>}
                        <div>
                          <h3 className="font-semibold text-gray-900">{menu.name}</h3>
                          {menu.description && (
                            <p className="text-sm text-gray-500">{menu.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => toggleAllMenuActions(menu.id, !allGranted)}
                          className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                            allGranted
                              ? 'bg-red-100 text-red-700 hover:bg-red-200'
                              : 'bg-green-100 text-green-700 hover:bg-green-200'
                          }`}
                        >
                          {allGranted ? 'Desmarcar todas' : 'Marcar todas'}
                        </button>
                        {menu.submenus.length > 0 && (
                          <button
                            onClick={() => toggleAllBranchActions(menu, !branchAllGranted)}
                            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                              branchAllGranted
                                ? 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                                : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                            }`}
                          >
                            {branchAllGranted ? 'Desmarcar menú + submenús' : 'Marcar menú + submenús'}
                          </button>
                        )}
                      </div>
                    </div>

                    {renderMenuPermissions(menu)}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-6 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || menus.length === 0}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 transition-colors"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Guardando...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Guardar Permisos</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
