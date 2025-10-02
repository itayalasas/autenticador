import { supabase } from '../lib/supabase';
import { AppUser } from '../types';
import bcrypt from 'bcryptjs';

export const userService = {
  // Get users for an application
  async getAppUsers(applicationId: string): Promise<AppUser[]> {
    const { data, error } = await supabase
      .from('app_users')
      .select(`
        *,
        user_roles(
          role_name,
          permissions
        )
      `)
      .eq('application_id', applicationId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    // Transform the data to include roles array for easier access
    const transformedData = (data || []).map(user => ({
      ...user,
      roles: user.user_roles?.map(ur => ur.role_name) || []
    }));
    
    return transformedData;
  },

  // Create app user
  async createAppUser(userData: {
    application_id: string;
    email: string;
    name: string;
    password: string;
    roles?: string[];
    metadata?: Record<string, any>;
  }) {
    // Hash password using bcrypt (consistent with backend)
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(userData.password, saltRounds);

    const { data: user, error: userError } = await supabase
      .from('app_users')
      .insert({
        application_id: userData.application_id,
        email: userData.email,
        name: userData.name,
        password_hash: passwordHash,
        metadata: userData.metadata || {}
      })
      .select()
      .single();

    if (userError) throw userError;

    // Add roles if provided
    if (userData.roles && userData.roles.length > 0) {
      const roleInserts = userData.roles.map(role => ({
        app_user_id: user.id,
        role_name: role,
        permissions: []
      }));

      const { error: roleError } = await supabase
        .from('user_roles')
        .insert(roleInserts);

      if (roleError) throw roleError;
    }

    return user;
  },

  // Update app user
  async updateAppUser(userId: string, updates: Partial<AppUser>) {
    const { data, error } = await supabase
      .from('app_users')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Delete app user
  async deleteAppUser(userId: string) {
    const { error } = await supabase
      .from('app_users')
      .delete()
      .eq('id', userId);

    if (error) throw error;
  },

  // Update user roles
  async updateUserRoles(userId: string, roles: string[]) {
    console.log('Updating user roles:', { userId, roles });
    
    // Delete existing roles
    const { error: deleteError } = await supabase
      .from('user_roles')
      .delete()
      .eq('app_user_id', userId);

    if (deleteError) {
      console.error('Error deleting existing roles:', deleteError);
      throw deleteError;
    }

    // Insert new roles
    if (roles.length > 0) {
      // Get role permissions from application_roles
      const { data: applicationRoles, error: rolesError } = await supabase
        .from('application_roles')
        .select('name, permissions')
        .in('name', roles);

      if (rolesError) {
        console.error('Error getting role permissions:', rolesError);
        throw rolesError;
      }

      // Create role inserts with proper permissions
      const roleInserts = roles.map(role => {
        const roleData = applicationRoles?.find(r => r.name === role);
        return {
          app_user_id: userId,
          role_name: role,
          permissions: roleData?.permissions || []
        };
      });

      console.log('Inserting roles:', roleInserts);

      const { error } = await supabase
        .from('user_roles')
        .insert(roleInserts);

      if (error) {
        console.error('Error inserting new roles:', error);
        throw error;
      }
    }
    
    console.log('User roles updated successfully');
  }
};