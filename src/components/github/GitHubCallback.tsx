import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle, AlertCircle, Github } from 'lucide-react';
import { githubService } from '../../services/githubService';

export default function GitHubCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    handleCallback();
  }, []);

  const handleCallback = async () => {
    try {
      const code = searchParams.get('code');
      const state = searchParams.get('state');

      if (!code) {
        throw new Error('No se recibió el código de autorización');
      }

      if (!state) {
        throw new Error('No se recibió el state parameter');
      }

      console.log('🔄 Processing GitHub OAuth callback...');
      console.log('Code:', code);
      console.log('State:', state);

      // Exchange code for access token and save connection
      const connection = await githubService.handleCallback(code, state);

      console.log('✅ GitHub connection saved:', connection);

      setStatus('success');
      setMessage('Conexión con GitHub establecida exitosamente');

      // Clear OAuth state
      sessionStorage.removeItem('github_oauth_state');

      // Redirect to connectors page after 2 seconds
      setTimeout(() => {
        navigate('/connectors');
        // Refresh the page to update the UI
        window.location.reload();
      }, 2000);

    } catch (error: any) {
      console.error('❌ GitHub callback error:', error);
      setStatus('error');
      setMessage(error.message || 'Error al procesar la conexión con GitHub');

      // Redirect to connectors page after 5 seconds
      setTimeout(() => {
        navigate('/connectors');
      }, 5000);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8 max-w-md w-full text-center">
        {status === 'loading' && (
          <>
            <div className="w-16 h-16 border-4 border-gray-900 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Conectando con GitHub...</h2>
            <p className="text-gray-600">Por favor espera mientras procesamos la autorización</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">¡Conexión Exitosa!</h2>
            <p className="text-gray-600 mb-4">{message}</p>

            <div className="bg-gray-50 rounded-lg p-4 flex items-center justify-center space-x-2">
              <Github className="w-5 h-5 text-gray-700" />
              <span className="text-sm text-gray-700">GitHub conectado correctamente</span>
            </div>

            <p className="text-sm text-gray-500 mt-4">Redirigiendo a Conectores...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Error de Conexión</h2>
            <p className="text-gray-600 mb-6">{message}</p>

            <button
              onClick={() => navigate('/connectors')}
              className="bg-gray-900 hover:bg-gray-800 text-white px-6 py-2 rounded-lg transition-colors"
            >
              Volver a Conectores
            </button>
          </>
        )}
      </div>
    </div>
  );
}
