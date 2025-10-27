import React, { useEffect, useState } from 'react';
import PublicAuthForms from './PublicAuthForms';
import { applicationService } from '../../services/applicationService';
import { supabase } from '../../lib/supabase';
import { useSearchParams } from 'react-router-dom';

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

  useEffect(() => {
    const loadApplicationData = async () => {
    try {
      setLoading(true);
      console.log('Loading application data for:', appId);
      
      // Check if Supabase is properly configured
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
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
                callback_url: 'http://localhost:5173/auth/callback'
              }
            }
          }
        };
        
        // Mock API key
        setApiKey('ak_development_cd9bac61b17b0a09f307afe54e93d40f');
        
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
                  callback_url: 'http://localhost:5173/auth/callback'
                }
              }
            }
          };
          
          setApiKey('ak_development_cd9bac61b17b0a09f307afe54e93d40f');
          
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

        // Get environment from URL parameters or default to development
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
          setApiKey('ak_development_cd9bac61b17b0a09f307afe54e93d40f');
        } else if (!apiKeys || apiKeys.length === 0) {
          console.warn('No active API keys found for application, using mock key');
          setApiKey('ak_development_cd9bac61b17b0a09f307afe54e93d40f');
        } else {
          setApiKey(apiKeys[0].key_hash);
        }

        try {
          const branding = await applicationService.getBranding(app.id);
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
  }, [appId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Error</h1>
          <p className="text-gray-600">{error}</p>
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