import { supabase } from '../lib/supabase';

export interface Tenant {
  id: string;
  application_id: string;
  name: string;
  slug: string;
  domain: string | null;
  status: 'active' | 'inactive' | 'suspended';
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
  user_count?: number;
}

export const tenantService = {
  async getTenantsByApplication(applicationId: string): Promise<Tenant[]> {
    const { data, error } = await supabase
      .from('tenants')
      .select('*')
      .eq('application_id', applicationId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const tenants = data || [];
    if (tenants.length === 0) return [];

    const tenantIds = tenants.map(t => t.id);
    const { data: users } = await supabase
      .from('app_users')
      .select('tenant_id')
      .in('tenant_id', tenantIds);

    const counts: Record<string, number> = {};
    (users || []).forEach(u => {
      if (u.tenant_id) counts[u.tenant_id] = (counts[u.tenant_id] || 0) + 1;
    });

    return tenants.map(t => ({ ...t, user_count: counts[t.id] || 0 }));
  },

  async createTenant(input: {
    application_id: string;
    name: string;
    slug: string;
    domain?: string;
  }): Promise<Tenant> {
    const { data, error } = await supabase
      .from('tenants')
      .insert({
        application_id: input.application_id,
        name: input.name,
        slug: input.slug,
        domain: input.domain || null,
        status: 'active',
        metadata: {},
      })
      .select()
      .maybeSingle();

    if (error) throw error;
    return data as Tenant;
  },

  async updateTenant(id: string, updates: Partial<Tenant>): Promise<Tenant> {
    const { data, error } = await supabase
      .from('tenants')
      .update(updates)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) throw error;
    return data as Tenant;
  },

  async deleteTenant(id: string): Promise<void> {
    const { error } = await supabase
      .from('tenants')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },
};
