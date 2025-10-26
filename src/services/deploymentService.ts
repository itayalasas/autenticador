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
 * This uses the netlifyReactProjectHelper which generates all files
 * with current code and proper branding/configuration
 */
export async function collectReactSourceFiles(
  applicationId: string,
  apiKey: string,
  supabaseUrl: string,
  supabaseAnonKey: string,
  branding?: any
): Promise<Record<string, string>> {
  try {
    console.log('📦 Generating React project files...');

    // Import the React project helper
    const { getReactProjectFiles } = await import('../utils/netlifyReactProjectHelper');

    // Generate all files with current code
    const files = await getReactProjectFiles(
      applicationId,
      apiKey,
      branding
    );

    console.log('✅ React project files generated successfully!');
    console.log(`📁 Total files: ${Object.keys(files).length}`);

    return files;

  } catch (error) {
    console.error('❌ Error generating React project files:', error);
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
