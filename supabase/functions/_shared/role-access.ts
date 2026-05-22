export interface PermissionNode {
  actions: string[];
  submenus?: { [submenuSlug: string]: string[] };
}

interface RoleRecord {
  id: string;
  name?: string | null;
  application_id?: string | null;
  permissions?: unknown;
}

interface MenuRecord {
  id: string;
  slug: string;
  parent_menu_id?: string | null;
}

interface MenuActionRecord {
  id: string;
  menu_id: string;
  slug: string;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function normalizeFlatPermissions(input: unknown): Record<string, string[]> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {};
  }

  const result: Record<string, string[]> = {};

  for (const [menuSlug, rawValue] of Object.entries(input as Record<string, unknown>)) {
    if (Array.isArray(rawValue)) {
      result[menuSlug] = unique(rawValue.map((value) => String(value)));
      continue;
    }

    if (rawValue && typeof rawValue === 'object') {
      const nested = rawValue as Record<string, unknown>;

      if (Array.isArray(nested.actions)) {
        result[menuSlug] = unique(nested.actions.map((value) => String(value)));
      }

      if (nested.submenus && typeof nested.submenus === 'object' && !Array.isArray(nested.submenus)) {
        for (const [submenuSlug, submenuActions] of Object.entries(nested.submenus as Record<string, unknown>)) {
          if (Array.isArray(submenuActions)) {
            result[submenuSlug] = unique(submenuActions.map((value) => String(value)));
          }
        }
      }
    }
  }

  return result;
}

function buildPermissionsHierarchy(
  flatPermissions: Record<string, string[]>,
  menus: MenuRecord[]
): Record<string, PermissionNode> {
  const hierarchy: Record<string, PermissionNode> = {};
  const menuById = new Map<string, MenuRecord>();
  const menuBySlug = new Map<string, MenuRecord>();

  menus.forEach((menu) => {
    menuById.set(menu.id, menu);
    menuBySlug.set(menu.slug, menu);
  });

  Object.entries(flatPermissions).forEach(([menuSlug, actions]) => {
    const menu = menuBySlug.get(menuSlug);
    const uniqueActions = unique(actions);

    if (!menu) {
      hierarchy[menuSlug] = { actions: uniqueActions };
      return;
    }

    const parentMenu = menu.parent_menu_id ? menuById.get(menu.parent_menu_id) : null;
    if (parentMenu) {
      if (!hierarchy[parentMenu.slug]) {
        hierarchy[parentMenu.slug] = { actions: [], submenus: {} };
      }

      if (!hierarchy[parentMenu.slug].submenus) {
        hierarchy[parentMenu.slug].submenus = {};
      }

      hierarchy[parentMenu.slug].submenus![menuSlug] = uniqueActions;
      return;
    }

    if (!hierarchy[menuSlug]) {
      hierarchy[menuSlug] = { actions: [] };
    }

    hierarchy[menuSlug].actions = uniqueActions;
  });

  Object.values(hierarchy).forEach((node) => {
    node.actions = unique(node.actions);
    if (node.submenus) {
      Object.keys(node.submenus).forEach((submenuSlug) => {
        node.submenus![submenuSlug] = unique(node.submenus![submenuSlug]);
      });
    }
  });

  return hierarchy;
}

async function getApplicationMenusAndActions(
  supabase: any,
  applicationId: string
): Promise<{ menus: MenuRecord[]; actions: MenuActionRecord[] }> {
  const [{ data: menus, error: menusError }, { data: actions, error: actionsError }] = await Promise.all([
    supabase
      .from('application_menus')
      .select('id, slug, parent_menu_id')
      .eq('application_id', applicationId),
    supabase
      .from('menu_actions')
      .select('id, menu_id, slug')
  ]);

  if (menusError) {
    throw menusError;
  }

  if (actionsError) {
    throw actionsError;
  }

  const allowedMenuIds = new Set((menus || []).map((menu: MenuRecord) => menu.id));
  const filteredActions = (actions || []).filter((action: MenuActionRecord) => allowedMenuIds.has(action.menu_id));

  return {
    menus: (menus || []) as MenuRecord[],
    actions: filteredActions as MenuActionRecord[]
  };
}

async function resolveLegacyRolePermissions(
  supabase: any,
  role: RoleRecord
): Promise<{ permissions: Record<string, string[]>; hierarchy: Record<string, PermissionNode> }> {
  const applicationId = role.application_id || null;
  if (!applicationId) {
    return { permissions: {}, hierarchy: {} };
  }

  const normalizedFromObject = normalizeFlatPermissions(role.permissions);
  if (Object.keys(normalizedFromObject).length > 0) {
    const { menus } = await getApplicationMenusAndActions(supabase, applicationId);
    return {
      permissions: normalizedFromObject,
      hierarchy: buildPermissionsHierarchy(normalizedFromObject, menus)
    };
  }

  const genericPermissions = Array.isArray(role.permissions)
    ? unique(role.permissions.map((value) => String(value)))
    : [];

  if (genericPermissions.length === 0) {
    return { permissions: {}, hierarchy: {} };
  }

  const { menus, actions } = await getApplicationMenusAndActions(supabase, applicationId);
  const actionsByMenuId = new Map<string, string[]>();

  actions.forEach((action) => {
    const existing = actionsByMenuId.get(action.menu_id) || [];
    existing.push(action.slug);
    actionsByMenuId.set(action.menu_id, existing);
  });

  const grantAll = genericPermissions.includes('admin');
  const flatPermissions: Record<string, string[]> = {};

  menus.forEach((menu) => {
    const menuActionSlugs = unique(actionsByMenuId.get(menu.id) || []);
    const grantedActionSlugs = grantAll
      ? menuActionSlugs
      : menuActionSlugs.filter((actionSlug) => genericPermissions.includes(actionSlug));

    if (grantedActionSlugs.length > 0) {
      flatPermissions[menu.slug] = grantedActionSlugs;
    }
  });

  return {
    permissions: flatPermissions,
    hierarchy: buildPermissionsHierarchy(flatPermissions, menus)
  };
}

function buildRolePermissionRows(
  flatPermissions: Record<string, string[]>,
  menus: MenuRecord[],
  actions: MenuActionRecord[]
): Array<{ menu_id: string; action_id: string; granted: boolean }> {
  const menuBySlug = new Map<string, MenuRecord>();
  menus.forEach((menu) => menuBySlug.set(menu.slug, menu));

  const actionsByMenuId = new Map<string, Map<string, string>>();
  actions.forEach((action) => {
    const current = actionsByMenuId.get(action.menu_id) || new Map<string, string>();
    current.set(action.slug, action.id);
    actionsByMenuId.set(action.menu_id, current);
  });

  const rows: Array<{ menu_id: string; action_id: string; granted: boolean }> = [];

  Object.entries(flatPermissions).forEach(([menuSlug, actionSlugs]) => {
    const menu = menuBySlug.get(menuSlug);
    if (!menu) return;

    const menuActions = actionsByMenuId.get(menu.id);
    if (!menuActions) return;

    unique(actionSlugs).forEach((actionSlug) => {
      const actionId = menuActions.get(actionSlug);
      if (!actionId) return;

      rows.push({
        menu_id: menu.id,
        action_id: actionId,
        granted: true
      });
    });
  });

  return rows;
}

export async function syncRolePermissionsFromLegacyDefinition(
  supabase: any,
  roleId: string
): Promise<number> {
  const { data: role } = await supabase
    .from('application_roles')
    .select('id, name, application_id, permissions')
    .eq('id', roleId)
    .maybeSingle();

  const roleRecord = (role || null) as RoleRecord | null;
  if (!roleRecord?.application_id) {
    return 0;
  }

  const { menus, actions } = await getApplicationMenusAndActions(supabase, roleRecord.application_id);
  const legacyPermissions = await resolveLegacyRolePermissions(supabase, roleRecord);
  const rows = buildRolePermissionRows(legacyPermissions.permissions, menus, actions);

  await supabase
    .from('role_permissions')
    .delete()
    .eq('role_id', roleId);

  if (rows.length === 0) {
    return 0;
  }

  const { error: insertError } = await supabase
    .from('role_permissions')
    .insert(rows.map((row) => ({
      role_id: roleId,
      ...row
    })));

  if (insertError) {
    throw insertError;
  }

  return rows.length;
}

export async function resolveRoleAccess(
  supabase: any,
  roleId: string | null | undefined
): Promise<{
  roleName: string;
  rolePermissions: Record<string, string[]>;
  rolePermissionsHierarchy: Record<string, PermissionNode>;
}> {
  if (!roleId) {
    return {
      roleName: 'user',
      rolePermissions: {},
      rolePermissionsHierarchy: {}
    };
  }

  const { data: role } = await supabase
    .from('application_roles')
    .select('id, name, application_id, permissions')
    .eq('id', roleId)
    .maybeSingle();

  const roleRecord = (role || null) as RoleRecord | null;
  const roleName = roleRecord?.name || 'user';

  const { data: permissions } = await supabase
    .from('role_permissions')
    .select(`
      granted,
      menu:application_menus!inner(id, slug, parent_menu_id),
      action:menu_actions!inner(id, slug)
    `)
    .eq('role_id', roleId)
    .eq('granted', true);

  const rolePermissions: Record<string, string[]> = {};
  const rolePermissionsHierarchy: Record<string, PermissionNode> = {};

  if (permissions && permissions.length > 0) {
    const menuById: Record<string, { slug: string; parent_menu_id: string | null }> = {};

    permissions.forEach((perm: any) => {
      const menuData = perm.menu;
      if (menuData?.id && menuData?.slug) {
        menuById[menuData.id] = {
          slug: menuData.slug,
          parent_menu_id: menuData.parent_menu_id || null
        };
      }
    });

    permissions.forEach((perm: any) => {
      const menuId = perm.menu?.id;
      const menuSlug = perm.menu?.slug;
      const actionSlug = perm.action?.slug;

      if (!menuId || !menuSlug || !actionSlug) {
        return;
      }

      if (!rolePermissions[menuSlug]) {
        rolePermissions[menuSlug] = [];
      }
      rolePermissions[menuSlug].push(actionSlug);

      const parentMenuId = menuById[menuId]?.parent_menu_id || null;
      if (parentMenuId && menuById[parentMenuId]) {
        const parentSlug = menuById[parentMenuId].slug;

        if (!rolePermissionsHierarchy[parentSlug]) {
          rolePermissionsHierarchy[parentSlug] = {
            actions: [],
            submenus: {}
          };
        }

        if (!rolePermissionsHierarchy[parentSlug].submenus) {
          rolePermissionsHierarchy[parentSlug].submenus = {};
        }

        if (!rolePermissionsHierarchy[parentSlug].submenus![menuSlug]) {
          rolePermissionsHierarchy[parentSlug].submenus![menuSlug] = [];
        }

        rolePermissionsHierarchy[parentSlug].submenus![menuSlug].push(actionSlug);
      } else {
        if (!rolePermissionsHierarchy[menuSlug]) {
          rolePermissionsHierarchy[menuSlug] = {
            actions: []
          };
        }

        rolePermissionsHierarchy[menuSlug].actions.push(actionSlug);
      }
    });

    Object.keys(rolePermissions).forEach((menuSlug) => {
      rolePermissions[menuSlug] = unique(rolePermissions[menuSlug]);
    });

    Object.keys(rolePermissionsHierarchy).forEach((menuSlug) => {
      rolePermissionsHierarchy[menuSlug].actions = unique(rolePermissionsHierarchy[menuSlug].actions);

      if (rolePermissionsHierarchy[menuSlug].submenus) {
        Object.keys(rolePermissionsHierarchy[menuSlug].submenus!).forEach((submenuSlug) => {
          rolePermissionsHierarchy[menuSlug].submenus![submenuSlug] = unique(rolePermissionsHierarchy[menuSlug].submenus![submenuSlug]);
        });
      }
    });

    return {
      roleName,
      rolePermissions,
      rolePermissionsHierarchy
    };
  }

  const legacyPermissions = roleRecord
    ? await resolveLegacyRolePermissions(supabase, roleRecord)
    : { permissions: {}, hierarchy: {} };

  if (roleRecord && Object.keys(legacyPermissions.permissions).length > 0) {
    try {
      await syncRolePermissionsFromLegacyDefinition(supabase, roleId);
    } catch (error) {
      console.warn('Unable to backfill role_permissions from legacy role definition:', {
        roleId,
        error
      });
    }
  }

  return {
    roleName,
    rolePermissions: legacyPermissions.permissions,
    rolePermissionsHierarchy: legacyPermissions.hierarchy
  };
}
