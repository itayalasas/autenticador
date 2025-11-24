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
    console.log('Creating user with data:', {
      application_id: userData.application_id,
      email: userData.email,
      name: userData.name,
      roles: userData.roles
    });

    // Hash password using bcrypt (consistent with backend)
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(userData.password, saltRounds);

    // Get primary role ID if roles are provided
    let primaryRoleId = null;
    if (userData.roles && userData.roles.length > 0) {
      console.log('Looking up role IDs for roles:', userData.roles);

      const { data: applicationRoles, error: rolesError } = await supabase
        .from('application_roles')
        .select('id, name')
        .eq('application_id', userData.application_id)
        .in('name', userData.roles);

      if (rolesError) {
        console.error('Error fetching application roles:', rolesError);
        throw rolesError;
      }

      console.log('Found application roles:', applicationRoles);

      if (applicationRoles && applicationRoles.length > 0) {
        const primaryRole = applicationRoles.find(r => r.name === userData.roles![0]);
        if (primaryRole) {
          primaryRoleId = primaryRole.id;
          console.log('Assigned primary role ID:', primaryRoleId);
        } else {
          console.warn('Primary role not found for:', userData.roles![0]);
        }
      } else {
        console.warn('No application roles found for the provided role names');
      }
    } else {
      console.log('No roles provided, user will be created without role_id');
    }

    console.log('Inserting user with role_id:', primaryRoleId);

    const { data: user, error: userError } = await supabase
      .from('app_users')
      .insert({
        application_id: userData.application_id,
        email: userData.email,
        name: userData.name,
        password_hash: passwordHash,
        role_id: primaryRoleId,
        metadata: userData.metadata || {}
      })
      .select()
      .single();

    if (userError) {
      console.error('Error inserting user:', userError);
      throw userError;
    }

    console.log('User created successfully:', user.id);

    // Add roles to user_roles table if provided
    if (userData.roles && userData.roles.length > 0) {
      console.log('Adding roles to user_roles table');

      const roleInserts = userData.roles.map(role => ({
        app_user_id: user.id,
        role_name: role,
        permissions: []
      }));

      console.log('Inserting role records:', roleInserts);

      const { error: roleError } = await supabase
        .from('user_roles')
        .insert(roleInserts);

      if (roleError) {
        console.error('Error inserting user roles:', roleError);
        throw roleError;
      }

      console.log('User roles added successfully');
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

    // Get role IDs and data from application_roles
    const { data: applicationRoles, error: rolesError } = await supabase
      .from('application_roles')
      .select('id, name, permissions')
      .in('name', roles);

    if (rolesError) {
      console.error('Error getting role permissions:', rolesError);
      throw rolesError;
    }

    // Update app_users.role_id with primary role (first role in array)
    let primaryRoleId = null;
    if (roles.length > 0 && applicationRoles && applicationRoles.length > 0) {
      const primaryRole = applicationRoles.find(r => r.name === roles[0]);
      if (primaryRole) {
        primaryRoleId = primaryRole.id;
      }
    }

    // Update the role_id in app_users
    const { error: updateError } = await supabase
      .from('app_users')
      .update({ role_id: primaryRoleId })
      .eq('id', userId);

    if (updateError) {
      console.error('Error updating app_users.role_id:', updateError);
      throw updateError;
    }

    // Insert new roles in user_roles table
    if (roles.length > 0 && applicationRoles && applicationRoles.length > 0) {
      // Create role inserts with proper permissions
      const roleInserts = roles.map(role => {
        const roleData = applicationRoles.find(r => r.name === role);
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