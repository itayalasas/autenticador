import { supabase } from '../lib/supabase';

export interface ApplicationMenu {
  id: string;
  application_id: string;
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
}

export interface RolePermissionDetail extends RolePermission {
  menu_name: string;
  menu_slug: string;
  action_name: string;
  action_slug: string;
}

class PermissionsService {
  // ============ MENUS ============
  async getApplicationMenus(applicationId: string): Promise<MenuWithActions[]> {
    const { data: menus, error: menusError } = await supabase
      .from('application_menus')
      .select('*')
      .eq('application_id', applicationId)
      .order('order_index', { ascending: true });

    if (menusError) throw menusError;
    if (!menus) return [];

    // Get actions for each menu
    const menusWithActions = await Promise.all(
      menus.map(async (menu) => {
        const { data: actions } = await supabase
          .from('menu_actions')
          .select('*')
          .eq('menu_id', menu.id)
          .order('slug', { ascending: true });

        return {
          ...menu,
          actions: actions || []
        };
      })
    );

    return menusWithActions;
  }

  async createMenu(menuData: {
    application_id: string;
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
