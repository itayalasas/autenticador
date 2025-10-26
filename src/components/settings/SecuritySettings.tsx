import React, { useState, useEffect } from 'react';
import { Lock, Key, Smartphone, Mail, Clock, Eye, EyeOff, Shield, AlertTriangle, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import SecurityAlertsViewer from '../security/SecurityAlertsViewer';

interface SecuritySettingsProps {
  currentUser: any;
  userEmail: string;
  onSuccess: (title: string, message: string) => void;
  onError: (title: string, message: string) => void;
}

export default function SecuritySettings({ currentUser, userEmail, onSuccess, onError }: SecuritySettingsProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({ new: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const [sessionHistory, setSessionHistory] = useState<any[]>([]);

  useEffect(() => {
    loadSecuritySettings();
  }, []);

  const loadSecuritySettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Cargar historial de sesiones recientes
        const { data: logs } = await supabase
          .from('auth_logs')
          .select('*')
          .eq('email', user.email)
          .eq('event_type', 'login')
          .order('created_at', { ascending: false })
          .limit(10);

        setSessionHistory(logs || []);
      }
    } catch (error) {
      console.error('Error loading security settings:', error);
    }
  };

  const handleChangePassword = async () => {
    if (!passwordData.new || passwordData.new !== passwordData.confirm) {
      onError(
        'Error de validación',
        'Las contraseñas no coinciden o están vacías.'
      );
      return;
    }

    if (passwordData.new.length < 8) {
      onError(
        'Contraseña débil',
        'La contraseña debe tener al menos 8 caracteres.'
      );
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase.auth.updateUser({
        password: passwordData.new
      });

      if (error) throw error;

      onSuccess(
        'Contraseña actualizada',
        'Tu contraseña ha sido actualizada exitosamente.'
      );
      setPasswordData({ new: '', confirm: '' });
    } catch (error: any) {
      console.error('Error changing password:', error);
      onError(
        'Error al cambiar contraseña',
        error?.message || 'Ha ocurrido un error al cambiar tu contraseña.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Cambiar Contraseña */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <Lock className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Cambiar Contraseña</h3>
            <p className="text-sm text-gray-600">Actualiza tu contraseña regularmente para mantener tu cuenta segura</p>
          </div>
        </div>

        <div className="space-y-4 max-w-xl">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nueva Contraseña
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={passwordData.new}
                onChange={(e) => setPasswordData(prev => ({ ...prev, new: e.target.value }))}
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Mínimo 8 caracteres"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Confirmar Nueva Contraseña
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={passwordData.confirm}
              onChange={(e) => setPasswordData(prev => ({ ...prev, confirm: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Repite la contraseña"
            />
          </div>

          {passwordData.new && passwordData.new.length < 8 && (
            <div className="flex items-center space-x-2 text-sm text-yellow-600">
              <AlertTriangle className="w-4 h-4" />
              <span>La contraseña debe tener al menos 8 caracteres</span>
            </div>
          )}

          {passwordData.new && passwordData.confirm && passwordData.new !== passwordData.confirm && (
            <div className="flex items-center space-x-2 text-sm text-red-600">
              <AlertCircle className="w-4 h-4" />
              <span>Las contraseñas no coinciden</span>
            </div>
          )}

          <button
            onClick={handleChangePassword}
            disabled={loading || !passwordData.new || passwordData.new !== passwordData.confirm}
            className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg flex items-center space-x-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Key className="w-5 h-5" />
            )}
            <span>{loading ? 'Actualizando...' : 'Actualizar Contraseña'}</span>
          </button>
        </div>
      </div>

      {/* Autenticación de Dos Factores */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
            <Smartphone className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Autenticación de Dos Factores (2FA)</h3>
            <p className="text-sm text-gray-600">Agrega una capa extra de seguridad a tu cuenta</p>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Shield className="w-5 h-5 text-blue-600" />
              <div>
                <h4 className="font-medium text-blue-900">2FA no configurado</h4>
                <p className="text-sm text-blue-800">
                  La autenticación de dos factores estará disponible próximamente
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Historial de Sesiones */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
            <Clock className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Actividad de Inicio de Sesión</h3>
            <p className="text-sm text-gray-600">Revisa las sesiones recientes en tu cuenta</p>
          </div>
        </div>

        {sessionHistory.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Clock className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-sm">No hay historial de sesiones disponible</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sessionHistory.map((session, index) => (
              <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className={`w-2 h-2 rounded-full ${
                    session.success ? 'bg-green-500' : 'bg-red-500'
                  }`}></div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {session.success ? 'Inicio de sesión exitoso' : 'Intento fallido'}
                    </p>
                    <p className="text-xs text-gray-500">
                      IP: {session.ip_address || 'N/A'}
                    </p>
                  </div>
                </div>
                <span className="text-xs text-gray-500">
                  {new Date(session.created_at).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Security Alerts Viewer */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
            <Shield className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Alertas de Seguridad</h3>
            <p className="text-sm text-gray-600">Monitorea intentos sospechosos y amenazas de seguridad</p>
          </div>
        </div>

        <SecurityAlertsViewer />
      </div>

      {/* Configuración de Email */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
            <Mail className="w-5 h-5 text-yellow-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Email de Seguridad</h3>
            <p className="text-sm text-gray-600">Dirección de correo para alertas de seguridad</p>
          </div>
        </div>

        <div className="max-w-xl">
          <input
            type="email"
            value={userEmail}
            disabled
            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
          />
          <p className="text-xs text-gray-500 mt-2">
            Las alertas de seguridad se enviarán a esta dirección
          </p>
        </div>
      </div>
    </div>
  );
}
