import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle, AlertCircle, Shield, ArrowRight } from 'lucide-react';
import { parseCallbackParams, storeAuthData, AuthTokenData } from '../../utils/authHelpers';

interface CallbackHandlerProps {
  onSuccess?: (authData: AuthTokenData) => void;
  onError?: (error: string) => void;
}

export default function CallbackHandler({ onSuccess, onError }: CallbackHandlerProps) {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [authData, setAuthData] = useState<AuthTokenData | null>(null);

  useEffect(() => {
    handleCallback();
  }, []);

  const handleCallback = async () => {
    try {
      const currentUrl = window.location.href;
      console.log('🔄 Processing callback URL:', currentUrl);
      
      // Parse authentication data from URL parameters
      const authData = parseCallbackParams(currentUrl);
      
      if (!authData) {
        throw new Error('No se pudieron extraer los datos de autenticación de la URL');
      }
      
      console.log('✅ Authentication data parsed:', {
        userId: authData.user.id,
        email: authData.user.email,
        roles: authData.user.roles,
        application: authData.application.name
      });
      
      // Store authentication data
      storeAuthData(authData);
      
      setAuthData(authData);
      setStatus('success');
      setMessage('Autenticación exitosa. Redirigiendo...');
      
      // Call success callback
      if (onSuccess) {
        onSuccess(authData);
      }
      
      // Redirect to application after a brief delay
      setTimeout(() => {
        // You can customize this redirect logic based on your needs
        window.location.href = '/dashboard';
      }, 2000);
      
    } catch (error: any) {
      console.error('❌ Callback processing error:', error);
      setStatus('error');
      setMessage(error.message || 'Error procesando la autenticación');
      
      if (onError) {
        onError(error.message);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8 max-w-md w-full text-center">
        {status === 'loading' && (
          <>
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Procesando autenticación...</h2>
            <p className="text-gray-600">Por favor espera mientras validamos tu sesión</p>
          </>
        )}
        
        {status === 'success' && (
          <>
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">¡Autenticación Exitosa!</h2>
            <p className="text-gray-600 mb-4">{message}</p>
            
            {authData && (
              <div className="bg-gray-50 rounded-lg p-4 text-left">
                <h3 className="font-medium text-gray-900 mb-2">Datos de la sesión:</h3>
                <div className="space-y-1 text-sm text-gray-600">
                  <p><strong>Usuario:</strong> {authData.user.name}</p>
                  <p><strong>Email:</strong> {authData.user.email}</p>
                  <p><strong>Roles:</strong> {authData.user.roles.join(', ')}</p>
                  <p><strong>Aplicación:</strong> {authData.application.name}</p>
                  <p><strong>Expira en:</strong> {Math.floor(authData.expires_in / 3600)} horas</p>
                </div>
              </div>
            )}
            
            <div className="mt-6 flex items-center justify-center space-x-2 text-sm text-gray-500">
              <Shield className="w-4 h-4" />
              <span>Sesión segura establecida</span>
            </div>
          </>
        )}
        
        {status === 'error' && (
          <>
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Error de Autenticación</h2>
            <p className="text-gray-600 mb-6">{message}</p>
            
            <button
              onClick={() => window.location.href = '/login'}
              className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg flex items-center space-x-2 mx-auto transition-colors"
            >
              <span>Intentar de nuevo</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}