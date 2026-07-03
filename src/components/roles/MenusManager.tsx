import React, { useState, useEffect } from 'react';
import { Menu, Plus, CreditCard as Edit, Trash2, Save, X, Grid2x2 as Grid, ChevronDown, ChevronUp } from 'lucide-react';
import { permissionsService, MenuWithActions } from '../../services/permissionsService';
import { useNotification } from '../../hooks/useNotification';
import ConfirmationModal from '../ui/ConfirmationModal';
import NotificationModal from '../ui/NotificationModal';

interface MenusManagerProps {
  applicationId: string;
  onClose: () => void;
}

export default function MenusManager({ applicationId, onClose }: MenusManagerProps) {
  const [menus, setMenus] = useState<MenuWithActions[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [editingMenu, setEditingMenu] = useState<MenuWithActions | null>(null);
  const [expandedMenus, setExpandedMenus] = useState<Set<string>>(new Set());
  const [deleteModal, setDeleteModal] = useState<{ show: boolean; menuId: string | null }>({
    show: false,
    menuId: null
  });

  const [menuForm, setMenuForm] = useState({
    parent_menu_id: '',
    name: '',
    slug: '',
    description: '',
    icon: '',
    order_index: 0
  });

  const { showNotification, notification, closeNotification } = useNotification();

  useEffect(() => {
    loadMenus();
  }, [applicationId]);

  const loadMenus = async () => {
    try {
      setLoading(true);
      const data = await permissionsService.getApplicationMenus(applicationId);
      setMenus(data);
    } catch (error: any) {
      console.error('Error loading menus:', error);
      showNotification('error', 'Error', error.message || 'Error al cargar menús');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMenu = async () => {
    try {
      if (!menuForm.name || !menuForm.slug) {
        showNotification('error', 'Error', 'Nombre y slug son requeridos');
        return;
      }

      const newMenu = await permissionsService.createMenu({
        application_id: applicationId,
        parent_menu_id: menuForm.parent_menu_id || null,
        name: menuForm.name,
        slug: menuForm.slug,
        description: menuForm.description,
        icon: menuForm.icon,
        order_index: menuForm.order_index
      });

      // Create default actions for this menu
      await permissionsService.createDefaultActions(newMenu.id);

      showNotification('success', 'Éxito', 'Menú creado exitosamente');
      setShowCreateMenu(false);
      setMenuForm({ parent_menu_id: '', name: '', slug: '', description: '', icon: '', order_index: 0 });
      loadMenus();
    } catch (error: any) {
      console.error('Error creating menu:', error);
      showNotification('error', 'Error', error.message || 'Error al crear menú');
    }
  };

  const handleUpdateMenu = async () => {
    try {
      if (!editingMenu) return;

      await permissionsService.updateMenu(editingMenu.id, {
        ...menuForm,
        parent_menu_id: menuForm.parent_menu_id || null,
      });

      showNotification('success', 'Éxito', 'Menú actualizado exitosamente');
      setEditingMenu(null);
      setMenuForm({ parent_menu_id: '', name: '', slug: '', description: '', icon: '', order_index: 0 });
      loadMenus();
    } catch (error: any) {
      console.error('Error updating menu:', error);
      showNotification('error', 'Error', error.message || 'Error al actualizar menú');
    }
  };

  const handleDeleteMenu = async () => {
    try {
      if (!deleteModal.menuId) return;

      await permissionsService.deleteMenu(deleteModal.menuId);

      showNotification('success', 'Éxito', 'Menú eliminado exitosamente');
      setDeleteModal({ show: false, menuId: null });
      loadMenus();
    } catch (error: any) {
      console.error('Error deleting menu:', error);
      showNotification('error', 'Error', error.message || 'Error al eliminar menú');
    }
  };

  const toggleMenuExpanded = (menuId: string) => {
    setExpandedMenus(prev => {
      const newSet = new Set(prev);
      if (newSet.has(menuId)) {
        newSet.delete(menuId);
      } else {
        newSet.add(menuId);
      }
      return newSet;
    });
  };

  const startEditMenu = (menu: MenuWithActions) => {
    setEditingMenu(menu);
    setMenuForm({
      parent_menu_id: menu.parent_menu_id || '',
      name: menu.name,
      slug: menu.slug,
      description: menu.description || '',
      icon: menu.icon || '',
      order_index: menu.order_index
    });
  };

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

  const flattenMenusWithDepth = (
    items: MenuWithActions[],
    depth = 0
  ): Array<{ menu: MenuWithActions; depth: number }> => {
    const result: Array<{ menu: MenuWithActions; depth: number }> = [];
    items.forEach(menu => {
      result.push({ menu, depth });
      if (menu.submenus.length > 0) {
        result.push(...flattenMenusWithDepth(menu.submenus, depth + 1));
      }
    });
    return result;
  };

  const getMenuById = (id: string): MenuWithActions | null => {
    return flattenMenus(menus).find(m => m.id === id) || null;
  };

  const getParentSlugChain = (parentId: string | null | undefined): string => {
    if (!parentId) return '';
    const parent = getMenuById(parentId);
    if (!parent) return '';
    return parent.slug;
  };

  const getLeafFromSlug = (fullSlug: string): string => {
    const parts = fullSlug.split('.');
    return parts[parts.length - 1] || '';
  };

  const composeSlug = (parentId: string | null | undefined, leaf: string): string => {
    const cleanLeaf = generateSlug(leaf);
    const parentChain = getParentSlugChain(parentId);
    if (!parentChain) return cleanLeaf;
    if (!cleanLeaf) return parentChain;
    return `${parentChain}.${cleanLeaf}`;
  };

  const getDescendantMenuIds = (menuId: string): Set<string> => {
    const descendants = new Set<string>();
    const allMenus = flattenMenus(menus);
    const byParent = new Map<string, string[]>();

    allMenus.forEach(menu => {
      if (!menu.parent_menu_id) return;
      const existing = byParent.get(menu.parent_menu_id) || [];
      existing.push(menu.id);
      byParent.set(menu.parent_menu_id, existing);
    });

    const walk = (currentId: string) => {
      const children = byParent.get(currentId) || [];
      children.forEach(childId => {
        if (descendants.has(childId)) return;
        descendants.add(childId);
        walk(childId);
      });
    };

    walk(menuId);
    return descendants;
  };

  const renderMenuItem = (menu: MenuWithActions, depth = 0) => {
    const totalChildren = menu.submenus.length;
    const isRoot = depth === 0;
    const headerBg = isRoot ? 'bg-blue-50' : 'bg-gray-50';
    const levelBadge = isRoot
      ? { label: 'Menú principal', cls: 'bg-blue-100 text-blue-700' }
      : depth === 1
        ? { label: 'Submenú', cls: 'bg-green-100 text-green-700' }
        : { label: `Nivel ${depth + 1}`, cls: 'bg-amber-100 text-amber-700' };

    return (
      <div
        key={menu.id}
        className={`border ${isRoot ? 'border-blue-200' : 'border-gray-200'} rounded-lg overflow-hidden`}
      >
        <div className={`${headerBg} p-4 flex items-center justify-between`} style={{ paddingLeft: `${16 + depth * 24}px` }}>
          <div className="flex items-center space-x-3 flex-1">
            {depth > 0 && <span className="text-gray-400 font-mono text-sm">└─</span>}
            <button
              onClick={() => toggleMenuExpanded(menu.id)}
              className="p-1 hover:bg-gray-200 rounded transition-colors"
            >
              {expandedMenus.has(menu.id) ? (
                <ChevronUp className="w-5 h-5 text-gray-600" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-600" />
              )}
            </button>
            {menu.icon && <span className="text-2xl">{menu.icon}</span>}
            <div className="flex-1">
              <div className="flex items-center space-x-2">
                <h3 className="font-semibold text-gray-900">{menu.name}</h3>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${levelBadge.cls}`}>
                  {levelBadge.label}
                </span>
              </div>
              <p className="text-sm text-gray-500">
                {menu.slug} • {menu.actions.length} acciones{totalChildren > 0 ? ` • ${totalChildren} submenús` : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => startEditMenu(menu)}
              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            >
              <Edit className="w-4 h-4" />
            </button>
            <button
              onClick={() => setDeleteModal({ show: true, menuId: menu.id })}
              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {expandedMenus.has(menu.id) && (
          <div className="p-4 bg-white border-t border-gray-200" style={{ paddingLeft: `${16 + depth * 20}px` }}>
            {menu.description && (
              <p className="text-sm text-gray-600 mb-3">{menu.description}</p>
            )}
            {menu.actions.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
                {menu.actions.map(action => (
                  <div
                    key={action.id}
                    className="px-3 py-2 bg-gray-50 rounded-lg border border-gray-200"
                  >
                    <div className="font-medium text-sm text-gray-900">{action.name}</div>
                    <div className="text-xs text-gray-500">{action.slug}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 mb-4">Sin acciones configuradas.</p>
            )}

            {menu.submenus.length > 0 && (
              <div className="space-y-3">
                {menu.submenus.map(submenu => renderMenuItem(submenu, depth + 1))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      </div>
    );
  }

  return (
    <>
      {(() => {
        const allMenus = flattenMenus(menus);
        const blockedParentIds = editingMenu ? getDescendantMenuIds(editingMenu.id) : new Set<string>();
        return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gradient-to-r from-blue-50 to-white">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Gestión de Menús</h2>
              <p className="text-sm text-gray-600 mt-1">
                Configura los menús y recursos de tu aplicación
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
            {/* Create/Edit Form */}
            {(showCreateMenu || editingMenu) && (
              <div className="mb-6 p-4 border-2 border-blue-200 rounded-lg bg-blue-50">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  {editingMenu ? 'Editar Menú' : 'Crear Nuevo Menú'}
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Menú padre
                    </label>
                    <select
                      value={menuForm.parent_menu_id}
                      onChange={(e) => {
                        const newParent = e.target.value;
                        setMenuForm(prev => {
                          const leaf = getLeafFromSlug(prev.slug) || generateSlug(prev.name);
                          return {
                            ...prev,
                            parent_menu_id: newParent,
                            slug: composeSlug(newParent, leaf)
                          };
                        });
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">(Menú principal)</option>
                      {flattenMenusWithDepth(menus).map(({ menu, depth }) => {
                        const isSelf = editingMenu?.id === menu.id;
                        const isDescendant = blockedParentIds.has(menu.id);
                        const prefix = depth > 0 ? `${'\u00A0\u00A0\u00A0\u00A0'.repeat(depth)}└ ` : '';

                        return (
                          <option key={menu.id} value={menu.id} disabled={isSelf || isDescendant}>
                            {prefix}{menu.name}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nombre *
                    </label>
                    <input
                      type="text"
                      value={menuForm.name}
                      onChange={(e) => {
                        const newName = e.target.value;
                        setMenuForm(prev => ({
                          ...prev,
                          name: newName,
                          slug: editingMenu
                            ? prev.slug
                            : composeSlug(prev.parent_menu_id, newName)
                        }));
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Ej: Dashboard, Usuarios, Reportes"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Slug (Identificador) *
                    </label>
                    <input
                      type="text"
                      value={menuForm.slug}
                      onChange={(e) => setMenuForm(prev => ({ ...prev, slug: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="ej: dashboard, usuarios"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Descripción
                    </label>
                    <textarea
                      value={menuForm.description}
                      onChange={(e) => setMenuForm(prev => ({ ...prev, description: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      rows={2}
                      placeholder="Descripción del menú"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Icono (emoji)
                    </label>
                    <input
                      type="text"
                      value={menuForm.icon}
                      onChange={(e) => setMenuForm(prev => ({ ...prev, icon: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="📊 o 👥"
                      maxLength={2}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Orden
                    </label>
                    <input
                      type="number"
                      value={menuForm.order_index}
                      onChange={(e) => setMenuForm(prev => ({ ...prev, order_index: parseInt(e.target.value) || 0 }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="flex justify-end space-x-2 mt-4">
                  <button
                    onClick={() => {
                      setShowCreateMenu(false);
                      setEditingMenu(null);
                      setMenuForm({ parent_menu_id: '', name: '', slug: '', description: '', icon: '', order_index: 0 });
                    }}
                    className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={editingMenu ? handleUpdateMenu : handleCreateMenu}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
                  >
                    <Save className="w-4 h-4" />
                    <span>{editingMenu ? 'Actualizar' : 'Crear'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Add Menu Button */}
            {!showCreateMenu && !editingMenu && (
              <button
                onClick={() => setShowCreateMenu(true)}
                className="w-full mb-4 p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors flex items-center justify-center space-x-2 text-gray-600 hover:text-blue-600"
              >
                <Plus className="w-5 h-5" />
                <span className="font-medium">Agregar Nuevo Menú</span>
              </button>
            )}

            {/* Menus List */}
            {menus.length === 0 ? (
              <div className="text-center py-12">
                <Grid className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 text-lg">No hay menús configurados</p>
                <p className="text-gray-400 text-sm mt-2">
                  Crea tu primer menú para comenzar
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {menus.map(menu => (
                  renderMenuItem(menu)
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
        );
      })()}

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={deleteModal.show}
        title="Eliminar Menú"
        message="¿Estás seguro de que deseas eliminar este menú? Esta acción eliminará también todas las acciones y permisos asociados."
        confirmText="Eliminar"
        type="danger"
        onConfirm={handleDeleteMenu}
        onClose={() => setDeleteModal({ show: false, menuId: null })}
      />

      {/* Notification Modal */}
      <NotificationModal
        notification={notification}
        onClose={closeNotification}
      />
    </>
  );
}
