import { supabase } from '../lib/supabase';
import { permissionsService } from './permissionsService';

export interface ApplicationRole {
  id: string;
  application_id: string;
  name: string;
  display_name: string;
  description: string;
  permissions: string[];
  is_default: boolean;
  is_active: boolean;
  available_for_registration?: boolean;
  created_at: string;
}

export const rolesService = {
  isMissingIsActiveColumnError(error: any): boolean {
    return error?.code === 'PGRST204' && String(error?.message || '').includes('is_active');
  },

  // Get all roles for an application
  async getApplicationRoles(applicationId: string): Promise<ApplicationRole[]> {
    const { data, error } = await supabase
      .from('application_roles')
      .select('*')
      .eq('application_id', applicationId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map((role: any) => ({
      ...role,
      is_active: role?.is_active ?? true,
    }));
  },

  // Create new application role
  async createApplicationRole(roleData: {
    application_id: string;
    name: string;
    display_name: string;
    description: string;
    permissions: string[];
    is_default: boolean;
  }) {
    // If this is set as default, unset other default roles first
    if (roleData.is_default) {
      await supabase
        .from('application_roles')
        .update({ is_default: false })
        .eq('application_id', roleData.application_id);
    }

    const { data, error } = await supabase
      .from('application_roles')
      .insert({
        application_id: roleData.application_id,
        name: roleData.name,
        display_name: roleData.display_name,
        description: roleData.description,
        permissions: roleData.permissions,
        is_default: roleData.is_default,
        is_active: true
      })
      .select()
      .single();

    if (error) throw error;
    await permissionsService.syncRolePermissionsFromLegacyRole(
      data.id,
      data.application_id,
      data.permissions
    );
    return data;
  },

  // Update application role
  async updateApplicationRole(roleId: string, updates: Partial<ApplicationRole>) {
    // If setting as default, unset other default roles first
    if (updates.is_default) {
      const { data: currentRole } = await supabase
        .from('application_roles')
        .select('application_id')
        .eq('id', roleId)
        .single();

      if (currentRole) {
        await supabase
          .from('application_roles')
          .update({ is_default: false })
          .eq('application_id', currentRole.application_id)
          .neq('id', roleId);
      }
    }

    const { data, error } = await supabase
      .from('application_roles')
      .update(updates)
      .eq('id', roleId)
      .select()
      .single();

    if (error) throw error;
    if (typeof updates.permissions !== 'undefined') {
      await permissionsService.syncRolePermissionsFromLegacyRole(
        data.id,
        data.application_id,
        data.permissions
      );
    }
    return data;
  },

  // Delete application role
  async deleteApplicationRole(roleId: string) {
    // First, remove this role from all users
    await supabase
      .from('user_roles')
      .delete()
      .in('app_user_id', 
        supabase
          .from('app_users')
          .select('id')
          .in('id', 
            supabase
              .from('user_roles')
              .select('app_user_id')
              .eq('role_name', 
                supabase
                  .from('application_roles')
                  .select('name')
                  .eq('id', roleId)
              )
          )
      );

    // Then delete the role
    const { error } = await supabase
      .from('application_roles')
      .delete()
      .eq('id', roleId);

    if (error) throw error;
  },

  // Set default role for application
  async setDefaultRole(applicationId: string, roleId: string) {
    // Unset all default roles for this application
    await supabase
      .from('application_roles')
      .update({ is_default: false })
      .eq('application_id', applicationId);

    // Set the new default role
    const { error } = await supabase
      .from('application_roles')
      .update({ is_default: true })
      .eq('id', roleId);

    if (error) throw error;
  },

  // Get available roles for registration form
  async getAvailableRolesForRegistration(applicationId: string): Promise<ApplicationRole[]> {
    const queryWithActive = await supabase
      .from('application_roles')
      .select('*')
      .eq('application_id', applicationId)
      .eq('is_active', true)
      .eq('available_for_registration', true)
      .order('display_name', { ascending: true });

    if (!queryWithActive.error) {
      return queryWithActive.data || [];
    }

    if (this.isMissingIsActiveColumnError(queryWithActive.error)) {
      const fallbackQuery = await supabase
        .from('application_roles')
        .select('*')
        .eq('application_id', applicationId)
        .eq('available_for_registration', true)
        .order('display_name', { ascending: true });

      if (fallbackQuery.error) throw fallbackQuery.error;
      return fallbackQuery.data || [];
    }

    throw queryWithActive.error;
  },

  // Get default role for application
  async getDefaultRole(applicationId: string): Promise<ApplicationRole | null> {
    const queryWithActive = await supabase
      .from('application_roles')
      .select('*')
      .eq('application_id', applicationId)
      .eq('is_default', true)
      .eq('is_active', true)
      .single();

    if (!queryWithActive.error) {
      return queryWithActive.data;
    }

    if (this.isMissingIsActiveColumnError(queryWithActive.error)) {
      const fallbackQuery = await supabase
        .from('application_roles')
        .select('*')
        .eq('application_id', applicationId)
        .eq('is_default', true)
        .single();

      if (fallbackQuery.error && fallbackQuery.error.code !== 'PGRST116') throw fallbackQuery.error;
      return fallbackQuery.data;
    }

    if (queryWithActive.error.code !== 'PGRST116') throw queryWithActive.error;
    return null;
  },

  async setRoleActiveStatus(roleId: string, isActive: boolean) {
    const { data, error } = await supabase
      .from('application_roles')
      .update({
        is_active: isActive,
        ...(isActive ? {} : { is_default: false, available_for_registration: false })
      })
      .eq('id', roleId)
      .select()
      .single();

    if (!error) return data;

    if (this.isMissingIsActiveColumnError(error)) {
      const fallback = await supabase
        .from('application_roles')
        .update({
          ...(isActive
            ? { available_for_registration: true }
            : { is_default: false, available_for_registration: false })
        })
        .eq('id', roleId)
        .select()
        .single();

      if (fallback.error) throw fallback.error;
      return {
        ...fallback.data,
        is_active: isActive,
      };
    }

    throw error;
  }
};
