import React, { useEffect, useState } from 'react';
import PublicAuthForms from './PublicAuthForms';
import { applicationService } from '../../services/applicationService';
import { supabase } from '../../lib/supabase';
import { getSupabaseAnonKey, getSupabaseUrl } from '../../lib/supabaseRuntime';
import { getEnvVariable } from '../../services/envConfigService';
import { config as publicConfig } from '../../lib/config';
import { useSearchParams } from 'react-router-dom';
import { applyFaviconToDocument } from '../../utils/favicon';

interface PublicAuthRouterProps {
  appId: string;
  formType: string;
}

export default function PublicAuthRouter({ appId, formType }: PublicAuthRouterProps) {
  const [appData, setAppData] = useState<any>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchParams] = useSearchParams();

  const validFormType = ['login', 'register', 'reset-password', 'reset-password-confirm'].includes(formType)
    ? formType as 'login' | 'register' | 'reset-password' | 'reset-password-confirm'
    : 'login';
  const fallbackApiKey = getEnvVariable('VITE_PUBLIC_API_KEY') || (publicConfig.apiKey && publicConfig.apiKey !== 'PLACEHOLDER_API_KEY'
    ? publicConfig.apiKey
    : null);
  const developmentCallbackUrl = `${window.location.origin}/callback`;

  useEffect(() => {
    applyFaviconToDocument('/images/icon.svg');

    const loadApplicationData = async () => {
    try {
      setLoading(true);
      console.log('Loading application data for:', appId);
      
      // Check if Supabase is properly configured
      const supabaseUrl = getSupabaseUrl();
      const supabaseKey = getSupabaseAnonKey();
      
      if (!supabaseUrl || !supabaseKey || 
          supabaseUrl === 'https://your-project-id.supabase.co' || 
          supabaseKey === 'your_supabase_anon_key_here') {
        
        console.warn('⚠️ Supabase not configured, using mock data');
        
        // Use mock data when Supabase is not configured
        const mockApp = {
          id: appId, // Use the actual app_id as internal ID
          application_id: appId, // This matches what's being searched for
          name: 'Demo Application',
          domain: 'demo.com',
          description: 'Demo application for testing',
          status: 'active',
          created_at: new Date().toISOString(),
          metadata: {
            environment_urls: {
              development: {
                base_url: 'http://localhost:5173',
                callback_url: developmentCallbackUrl
              }
            }
          }
        };
        
        // Mock API key
        setApiKey(fallbackApiKey);
        
        // Mock branding
        const mockBranding = {
          primary_color: '#3B82F6',
          secondary_color: '#1E40AF',
          background_color: '#FFFFFF',
          text_color: '#1F2937',
          font_family: 'Inter',
          border_radius: 8,
          button_style: 'rounded'
        };
        
        setAppData({
          ...mockApp,
          branding: mockBranding
        });
        
        console.log('✅ Mock application data loaded:', mockApp);
        return;
      }
      
      try {
        // Try to get application directly by application_id
        const { data: app, error: appError } = await supabase
          .from('applications')
          .select('*')
          .eq('application_id', appId)
          .single();
        
        if (appError || !app) {
          console.error('Application not found:', appId, appError);
          
          // If application not found, use mock data for development
          console.warn('⚠️ Application not found in database, using mock data for development');
          
          const mockApp = {
            id: appId,
            application_id: appId,
            name: 'Demo Application',
            domain: 'demo.com',
            description: 'Demo application for testing',
            status: 'active',
            created_at: new Date().toISOString(),
            metadata: {
              environment_urls: {
                development: {
                  base_url: 'http://localhost:5173',
                  callback_url: developmentCallbackUrl
                }
              }
            }
          };
          
          setApiKey(fallbackApiKey);
          
          const mockBranding = {
            primary_color: '#3B82F6',
            secondary_color: '#1E40AF',
            background_color: '#FFFFFF',
            text_color: '#1F2937',
            font_family: 'Inter',
            border_radius: 8,
            button_style: 'rounded'
          };
          
          setAppData({
            ...mockApp,
            branding: mockBranding
          });
          
          console.log('✅ Mock application data loaded for development');
          return;
        }

        const environment = searchParams.get('env') || 'development';
        
        // Load API key for the environment
        const { data: apiKeys, error: apiKeyError } = await supabase
          .from('api_keys')
          .select('*')
          .eq('application_id', app.id)
          .eq('is_active', true)
          .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
          .limit(1);
        
        if (apiKeyError) {
          console.error('Error loading API keys:', apiKeyError);
          // Use mock API key if database query fails
          setApiKey(fallbackApiKey);
        } else if (!apiKeys || apiKeys.length === 0) {
          console.warn('No active API keys found for application, using mock key');
          setApiKey(fallbackApiKey);
        } else {
          setApiKey(apiKeys[0].key_hash);
        }

        try {
          const branding = await applicationService.getPublicBranding(app.id, {
            environmentName: environment,
            host: window.location.hostname
          });
          const finalAppData = {
            ...app,
            branding: branding || {}
          };
          setAppData(finalAppData);
          console.log('✅ Application data set:', {
            id: finalAppData.id,
            application_id: finalAppData.application_id,
            name: finalAppData.name,
            hasBranding: !!branding
          });
        } catch (brandingError) {
          console.warn('Could not load branding, using defaults:', brandingError);
          const finalAppData = {
            ...app,
            branding: {}
          };
          setAppData(finalAppData);
          console.log('✅ Application data set (no branding):', {
            id: finalAppData.id,
            application_id: finalAppData.application_id,
            name: finalAppData.name
          });
        }

        console.log('Application loaded:', app);
        
      } catch (supabaseError) {
        console.error('Supabase connection error:', supabaseError);
        setError('Failed to connect to database. Please check Supabase configuration.');
      }
      
    } catch (error) {
      console.error('Error loading application:', error);
      setError('Failed to load application');
    } finally {
      setLoading(false);
    }
    };

    loadApplicationData();
  }, [appId, searchParams]);

  useEffect(() => {
    if (appData?.branding?.favicon_url) {
      applyFaviconToDocument(appData.branding.favicon_url);
    }
  }, [appData?.branding?.favicon_url]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 px-4 flex items-center justify-center">
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/95 p-8 shadow-2xl">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 via-cyan-400 to-fuchsia-500 shadow-lg shadow-blue-500/20">
            <div className="h-7 w-7 rounded-full border-2 border-white/90 border-t-transparent animate-spin" />
          </div>
          <h1 className="text-center text-2xl font-bold text-slate-900">Preparando autenticación</h1>
          <p className="mt-2 text-center text-sm text-slate-600">
            Cargando configuración de la aplicación, branding y variables de runtime desde <code>/get-env</code>.
          </p>
          <div className="mt-6 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-gradient-to-r from-blue-500 via-cyan-400 to-fuchsia-500" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-slate-100 px-4 flex items-center justify-center">
        <div className="w-full max-w-lg rounded-3xl border border-rose-200 bg-white p-8 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
          <div className="inline-flex rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-rose-700">
            Error de carga
          </div>
          <h1 className="mt-4 text-3xl font-bold text-slate-900">No pudimos cargar la aplicación</h1>
          <p className="mt-3 text-slate-600">{error}</p>
          <div className="mt-6 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
            Revisa la configuración de Supabase, las variables runtime y que la aplicación exista en el panel.
          </div>
        </div>
      </div>
    );
  }

  console.log('🎨 Rendering PublicAuthForms with:', {
    applicationId: appId,
    internalApplicationId: appData?.id,
    formType: validFormType,
    hasApiKey: !!apiKey,
    hasBranding: !!appData?.branding,
    appInfo: appData
  });

  return (
    <PublicAuthForms
      applicationId={appId!}
      internalApplicationId={appData?.id}
      formType={validFormType}
      apiKey={apiKey}
      branding={appData?.branding}
      appInfo={appData}
      onSuccess={(data) => console.log('Auth success:', data)}
      onError={(error) => console.error('Auth error:', error)}
    />
  );
}
