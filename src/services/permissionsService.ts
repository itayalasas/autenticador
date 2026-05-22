import { supabase } from '../lib/supabase';

export interface ApplicationMenu {
  id: string;
  application_id: string;
  parent_menu_id?: string | null;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  order_index: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MenuAction {
  id: string;
  menu_id: string;
  name: string;
  slug: string;
  description?: string;
  created_at: string;
}

export interface RolePermission {
  id: string;
  role_id: string;
  menu_id: string;
  action_id: string;
  granted: boolean;
  created_at: string;
  updated_at: string;
}

export interface MenuWithActions extends ApplicationMenu {
  actions: MenuAction[];
  submenus: MenuWithActions[];
}

export interface RolePermissionDetail extends RolePermission {
  menu_name: string;
  menu_slug: string;
  action_name: string;
  action_slug: string;
}

class PermissionsService {
  private flattenMenus(items: MenuWithActions[]): MenuWithActions[] {
    const result: MenuWithActions[] = [];
    const walk = (menusToWalk: MenuWithActions[]) => {
      menusToWalk.forEach((menu) => {
        result.push(menu);
        if (menu.submenus.length > 0) {
          walk(menu.submenus);
        }
      });
    };

    walk(items);
    return result;
  }

  private normalizeLegacyPermissions(legacyPermissions: unknown): Record<string, string[]> {
    if (!legacyPermissions || typeof legacyPermissions !== 'object' || Array.isArray(legacyPermissions)) {
      return {};
    }

    const result: Record<string, string[]> = {};

    Object.entries(legacyPermissions as Record<string, unknown>).forEach(([menuSlug, rawValue]) => {
      if (Array.isArray(rawValue)) {
        result[menuSlug] = Array.from(new Set(rawValue.map((value) => String(value))));
        return;
      }

      if (rawValue && typeof rawValue === 'object') {
        const nested = rawValue as Record<string, unknown>;

        if (Array.isArray(nested.actions)) {
          result[menuSlug] = Array.from(new Set(nested.actions.map((value) => String(value))));
        }

        if (nested.submenus && typeof nested.submenus === 'object' && !Array.isArray(nested.submenus)) {
          Object.entries(nested.submenus as Record<string, unknown>).forEach(([submenuSlug, submenuValue]) => {
            if (Array.isArray(submenuValue)) {
              result[submenuSlug] = Array.from(new Set(submenuValue.map((value) => String(value))));
            }
          });
        }
      }
    });

    return result;
  }

  // ============ MENUS ============
  async getApplicationMenus(applicationId: string): Promise<MenuWithActions[]> {
    const { data: menus, error: menusError } = await supabase
      .from('application_menus')
      .select('*')
      .eq('application_id', applicationId)
      .order('order_index', { ascending: true });

    if (menusError) throw menusError;
    if (!menus) return [];

    const menuIds = menus.map(menu => menu.id);
    const { data: allActions, error: actionsError } = await supabase
      .from('menu_actions')
      .select('*')
      .in('menu_id', menuIds)
      .order('slug', { ascending: true });

    if (actionsError) throw actionsError;

    const actionsByMenuId = new Map<string, MenuAction[]>();
    (allActions || []).forEach((action) => {
      const existing = actionsByMenuId.get(action.menu_id) || [];
      existing.push(action);
      actionsByMenuId.set(action.menu_id, existing);
    });

    const menusMap = new Map<string, MenuWithActions>();
    menus.forEach((menu) => {
      menusMap.set(menu.id, {
        ...menu,
        actions: actionsByMenuId.get(menu.id) || [],
        submenus: []
      });
    });

    const topLevelMenus: MenuWithActions[] = [];

    menusMap.forEach((menu) => {
      if (menu.parent_menu_id && menusMap.has(menu.parent_menu_id)) {
        menusMap.get(menu.parent_menu_id)!.submenus.push(menu);
      } else {
        topLevelMenus.push(menu);
      }
    });

    const sortMenuTree = (items: MenuWithActions[]) => {
      items.sort((a, b) => {
        if (a.order_index === b.order_index) {
          return a.name.localeCompare(b.name);
        }
        return a.order_index - b.order_index;
      });
      items.forEach(item => sortMenuTree(item.submenus));
    };

    sortMenuTree(topLevelMenus);

    return topLevelMenus;
  }

  async createMenu(menuData: {
    application_id: string;
    parent_menu_id?: string | null;
    name: string;
    slug: string;
    description?: string;
    icon?: string;
    order_index?: number;
  }): Promise<ApplicationMenu> {
    const { data, error } = await supabase
      .from('application_menus')
      .insert([menuData])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateMenu(menuId: string, menuData: Partial<ApplicationMenu>): Promise<ApplicationMenu> {
    const { data, error } = await supabase
      .from('application_menus')
      .update(menuData)
      .eq('id', menuId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteMenu(menuId: string): Promise<void> {
    const { error } = await supabase
      .from('application_menus')
      .delete()
      .eq('id', menuId);

    if (error) throw error;
  }

  // ============ ACTIONS ============
  async createMenuAction(actionData: {
    menu_id: string;
    name: string;
    slug: string;
    description?: string;
  }): Promise<MenuAction> {
    const { data, error } = await supabase
      .from('menu_actions')
      .insert([actionData])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async createDefaultActions(menuId: string): Promise<MenuAction[]> {
    const defaultActions = [
      { menu_id: menuId, name: 'Ver', slug: 'read', description: 'Ver contenido y datos' },
      { menu_id: menuId, name: 'Crear', slug: 'create', description: 'Crear nuevo contenido' },
      { menu_id: menuId, name: 'Actualizar', slug: 'update', description: 'Modificar contenido existente' },
      { menu_id: menuId, name: 'Eliminar', slug: 'delete', description: 'Eliminar contenido' }
    ];

    const { data, error } = await supabase
      .from('menu_actions')
      .insert(defaultActions)
      .select();

    if (error) throw error;
    return data || [];
  }

  async deleteMenuAction(actionId: string): Promise<void> {
    const { error } = await supabase
      .from('menu_actions')
      .delete()
      .eq('id', actionId);

    if (error) throw error;
  }

  // ============ ROLE PERMISSIONS ============
  async getRolePermissions(roleId: string): Promise<RolePermissionDetail[]> {
    const { data, error } = await supabase
      .from('role_permissions')
      .select(`
        *,
        menu:application_menus(name, slug),
        action:menu_actions(name, slug)
      `)
      .eq('role_id', roleId);

    if (error) throw error;
    if (!data) return [];

    return data.map(item => ({
      id: item.id,
      role_id: item.role_id,
      menu_id: item.menu_id,
      action_id: item.action_id,
      granted: item.granted,
      created_at: item.created_at,
      updated_at: item.updated_at,
      menu_name: (item.menu as any)?.name || '',
      menu_slug: (item.menu as any)?.slug || '',
      action_name: (item.action as any)?.name || '',
      action_slug: (item.action as any)?.slug || ''
    }));
  }

  async setRolePermission(permissionData: {
    role_id: string;
    menu_id: string;
    action_id: string;
    granted: boolean;
  }): Promise<RolePermission> {
    // Try to update first
    const { data: existing } = await supabase
      .from('role_permissions')
      .select('id')
      .eq('role_id', permissionData.role_id)
      .eq('menu_id', permissionData.menu_id)
      .eq('action_id', permissionData.action_id)
      .maybeSingle();

    if (existing) {
      // Update existing
      const { data, error } = await supabase
        .from('role_permissions')
        .update({ granted: permissionData.granted })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } else {
      // Insert new
      const { data, error } = await supabase
        .from('role_permissions')
        .insert([permissionData])
        .select()
        .single();

      if (error) throw error;
      return data;
    }
  }

  async bulkSetRolePermissions(
    roleId: string,
    permissions: Array<{
      menu_id: string;
      action_id: string;
      granted: boolean;
    }>
  ): Promise<void> {
    // Delete all existing permissions for this role
    await supabase
      .from('role_permissions')
      .delete()
      .eq('role_id', roleId);

    // Insert new permissions (only granted ones)
    const permissionsToInsert = permissions
      .filter(p => p.granted)
      .map(p => ({
        role_id: roleId,
        menu_id: p.menu_id,
        action_id: p.action_id,
        granted: true
      }));

    if (permissionsToInsert.length > 0) {
      const { error } = await supabase
        .from('role_permissions')
        .insert(permissionsToInsert);

      if (error) throw error;
    }
  }

  async syncRolePermissionsFromLegacyRole(
    roleId: string,
    applicationId: string,
    legacyPermissions: unknown
  ): Promise<void> {
    const menus = await this.getApplicationMenus(applicationId);
    const flatMenus = this.flattenMenus(menus);

    const permissionsToInsert: Array<{
      menu_id: string;
      action_id: string;
      granted: boolean;
    }> = [];

    const explicitPermissions = this.normalizeLegacyPermissions(legacyPermissions);

    if (Object.keys(explicitPermissions).length > 0) {
      const menuBySlug = new Map(flatMenus.map((menu) => [menu.slug, menu] as const));

      Object.entries(explicitPermissions).forEach(([menuSlug, actionSlugs]) => {
        const menu = menuBySlug.get(menuSlug);
        if (!menu) return;

        const actionBySlug = new Map(menu.actions.map((action) => [action.slug, action.id] as const));

        Array.from(new Set(actionSlugs)).forEach((actionSlug) => {
          const actionId = actionBySlug.get(actionSlug);
          if (!actionId) return;

          permissionsToInsert.push({
            menu_id: menu.id,
            action_id: actionId,
            granted: true
          });
        });
      });

      await this.bulkSetRolePermissions(roleId, permissionsToInsert);
      return;
    }

    const genericPermissions = Array.isArray(legacyPermissions)
      ? Array.from(new Set(legacyPermissions.map((value) => String(value))))
      : [];
    const grantAll = genericPermissions.includes('admin');

    flatMenus.forEach((menu) => {
      menu.actions.forEach((action) => {
        if (grantAll || genericPermissions.includes(action.slug)) {
          permissionsToInsert.push({
            menu_id: menu.id,
            action_id: action.id,
            granted: true
          });
        }
      });
    });

    await this.bulkSetRolePermissions(roleId, permissionsToInsert);
  }

  async deleteRolePermission(permissionId: string): Promise<void> {
    const { error } = await supabase
      .from('role_permissions')
      .delete()
      .eq('id', permissionId);

    if (error) throw error;
  }

  // ============ PERMISSION CHECKS ============
  async checkPermission(
    roleId: string,
    menuSlug: string,
    actionSlug: string
  ): Promise<boolean> {
    const { data, error } = await supabase
      .from('role_permissions')
      .select(`
        granted,
        menu:application_menus!inner(slug),
        action:menu_actions!inner(slug)
      `)
      .eq('role_id', roleId)
      .eq('granted', true)
      .maybeSingle();

    if (error) return false;
    if (!data) return false;

    return (
      (data.menu as any)?.slug === menuSlug &&
      (data.action as any)?.slug === actionSlug
    );
  }

  async getUserPermissions(userId: string, applicationId: string): Promise<{
    [menuSlug: string]: string[]; // menuSlug -> [actionSlugs]
  }> {
    // Get user's role in this application
    const { data: appUser } = await supabase
      .from('app_users')
      .select('role_id')
      .eq('user_id', userId)
      .eq('application_id', applicationId)
      .maybeSingle();

    if (!appUser || !appUser.role_id) return {};

    // Get all permissions for this role
    const permissions = await this.getRolePermissions(appUser.role_id);

    // Group by menu slug
    const permissionsMap: { [menuSlug: string]: string[] } = {};

    permissions
      .filter(p => p.granted)
      .forEach(p => {
        if (!permissionsMap[p.menu_slug]) {
          permissionsMap[p.menu_slug] = [];
        }
        permissionsMap[p.menu_slug].push(p.action_slug);
      });

    return permissionsMap;
  }
}

export const permissionsService = new PermissionsService();
