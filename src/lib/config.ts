/**
 * Application Configuration
 *
 * This file contains configuration values used throughout the application.
 * Environment variables are loaded via the envConfigService.
 */

import { envConfigService } from '../services/envConfigService';

/**
 * Get environment variable with fallback
 */
function getEnvVar(key: string, fallback: string = ''): string {
  try {
    return envConfigService.getVariable(key) || fallback;
  } catch {
    // If env service is not loaded yet, try direct import.meta.env
    return import.meta.env[key] || fallback;
  }
}

/**
 * Supabase Configuration
 */
export const supabaseConfig = {
  url: getEnvVar('VITE_SUPABASE_URL', 'https://placeholder.supabase.co'),
  anonKey: getEnvVar('VITE_SUPABASE_ANON_KEY', 'placeholder-anon-key'),
};

/**
 * Application Configuration
 */
export const appConfig = {
  name: 'AuthSystem',
  version: '1.0.0',
  environment: import.meta.env.MODE || 'development',
  isDevelopment: import.meta.env.DEV || false,
  isProduction: import.meta.env.PROD || false,
};

/**
 * API Configuration
 */
export const apiConfig = {
  baseUrl: getEnvVar('VITE_API_URL', ''),
  timeout: 30000,
};

/**
 * DLocal Configuration (Payment Provider)
 */
export const dLocalConfig = {
  apiUrl: getEnvVar('VITE_DLOCAL_API_URL', ''),
  checkoutUrl: getEnvVar('VITE_DLOCAL_CHECKOUT_URL', ''),
  apiKey: getEnvVar('VITE_DLOCAL_API_KEY', ''),
  secretKey: getEnvVar('VITE_DLOCAL_SECRET_KEY', ''),
  plansEndpoint: getEnvVar('VITE_DLOCAL_PLANS_ENDPOINT', ''),
  merchantId: getEnvVar('VITE_DLOCAL_MERCHANT_ID', ''),
};

/**
 * Netlify Configuration
 */
export const netlifyConfig = {
  accessToken: getEnvVar('VITE_NETLIFY_ACCESS_TOKEN', ''),
  siteId: getEnvVar('VITE_NETLIFY_SITE_ID', ''),
};

/**
 * Feature Flags
 */
export const features = {
  enableNotifications: true,
  enableSubscriptions: true,
  enableDeployments: true,
  enableGitHubIntegration: true,
  enableBranding: true,
  enableRoles: true,
};

/**
 * UI Configuration
 */
export const uiConfig = {
  itemsPerPage: 10,
  maxFileSize: 5 * 1024 * 1024, // 5MB
  allowedImageTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  dateFormat: 'dd/MM/yyyy',
  timeFormat: 'HH:mm:ss',
};

/**
 * Security Configuration
 */
export const securityConfig = {
  sessionTimeout: 30 * 60 * 1000, // 30 minutes in milliseconds
  maxLoginAttempts: 5,
  lockoutDuration: 15 * 60 * 1000, // 15 minutes in milliseconds
  passwordMinLength: 8,
  requireStrongPassword: true,
};

/**
 * Export all configurations
 */
export default {
  supabase: supabaseConfig,
  app: appConfig,
  api: apiConfig,
  dLocal: dLocalConfig,
  netlify: netlifyConfig,
  features,
  ui: uiConfig,
  security: securityConfig,
};
