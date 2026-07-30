import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { envConfigService } from './services/envConfigService';

const rootElement = document.getElementById('root')!;
const root = createRoot(rootElement);

function renderLoadingState() {
  root.render(
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      backgroundColor: '#0f172a',
      color: '#e2e8f0'
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: '48px',
          height: '48px',
          border: '4px solid #334155',
          borderTop: '4px solid #3b82f6',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          margin: '0 auto 16px'
        }} />
        <p style={{ fontSize: '18px', fontWeight: '500' }}>Cargando configuración...</p>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
}

function renderErrorState(error: Error) {
  root.render(
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      backgroundColor: '#0f172a',
      color: '#e2e8f0',
      padding: '20px'
    }}>
      <div style={{
        maxWidth: '500px',
        textAlign: 'center',
        backgroundColor: '#1e293b',
        padding: '32px',
        borderRadius: '8px',
        border: '1px solid #ef4444'
      }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '16px', color: '#ef4444' }}>
          Error de Configuración
        </h1>
        <p style={{ marginBottom: '16px', color: '#cbd5e1' }}>
          No se pudo cargar la configuración de la aplicación.
        </p>
        <p style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '24px' }}>
          {error.message}
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{
            backgroundColor: '#3b82f6',
            color: 'white',
            padding: '10px 20px',
            borderRadius: '6px',
            border: 'none',
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: '500'
          }}
        >
          Reintentar
        </button>
      </div>
    </div>
  );
}

async function initializeApp() {
  try {
    renderLoadingState();

    await envConfigService.loadConfig();

    root.render(
      <StrictMode>
        <App />
      </StrictMode>
    );
  } catch (error) {
    renderErrorState(error as Error);
  }
}

initializeApp();
