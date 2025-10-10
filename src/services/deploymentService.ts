/**
 * Deployment Service
 *
 * Handles collection and deployment of React source files
 */

import { supabase } from '../lib/supabase';

interface CollectFilesResponse {
  success: boolean;
  files?: Record<string, string>;
  summary?: {
    totalFiles: number;
    sourceFiles: number;
    configFiles: number;
    applicationId: string;
  };
  error?: string;
  message?: string;
}

/**
 * Collect all React source files for deployment
 * This calls the Edge Function that has access to the file system
 */
export async function collectReactSourceFiles(
  applicationId: string,
  apiKey: string,
  supabaseUrl: string,
  supabaseAnonKey: string,
  branding?: any
): Promise<Record<string, string>> {
  try {
    console.log('📦 Calling collect-source-files Edge Function...');

    const response = await fetch(
      `${supabaseUrl}/functions/v1/collect-source-files`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'apikey': supabaseAnonKey,
        },
        body: JSON.stringify({
          applicationId,
          apiKey,
          supabaseUrl,
          supabaseAnonKey,
          branding,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Edge Function failed: ${response.status} - ${errorText}`);
    }

    const result: CollectFilesResponse = await response.json();

    if (!result.success || !result.files) {
      throw new Error(result.error || 'Failed to collect source files');
    }

    console.log('✅ Source files collected successfully!');
    console.log('📊 Summary:', result.summary);
    console.log(`📁 Total files: ${Object.keys(result.files).length}`);

    return result.files;

  } catch (error) {
    console.error('❌ Error collecting source files:', error);
    throw error;
  }
}

/**
 * Deploy the complete React application to GitHub
 */
export async function deployReactApplication(
  applicationId: string,
  apiKey: string,
  supabaseUrl: string,
  supabaseAnonKey: string,
  repoFullName: string,
  branding?: any
): Promise<{
  success: boolean;
  files: Record<string, string>;
  summary: any;
}> {
  try {
    // Collect all source files
    const files = await collectReactSourceFiles(
      applicationId,
      apiKey,
      supabaseUrl,
      supabaseAnonKey,
      branding
    );

    return {
      success: true,
      files,
      summary: {
        totalFiles: Object.keys(files).length,
        applicationId,
        repository: repoFullName,
      },
    };

  } catch (error) {
    console.error('❌ Deployment failed:', error);
    throw error;
  }
}

export const deploymentService = {
  collectReactSourceFiles,
  deployReactApplication,
};
