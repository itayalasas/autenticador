import { useState, useEffect } from 'react';
import {
  Bell,
  Fingerprint,
  Mail,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Save,
  UserCheck,
  KeyRound,
  UserPlus,
  Users,
  ShieldCheck,
  Link as LinkIcon,
  Info,
} from 'lucide-react';

export type NotificationKey =
  | 'email_confirmation'
  | 'password_reset'
  | 'welcome'
  | 'admin_new_user'
  | 'passkey_setup'
  | 'tenant_invitation';

export interface NotificationEntry {
  enabled: boolean;
  template_name: string;
  api_key?: string;
  api_url?: string;
  token_expiration_minutes?: number;
  admin_email?: string;
}

export type NotificationsMap = Record<NotificationKey, NotificationEntry>;

const DEFAULT_API_URL = 'https://tu-servicio-email/functions/v1/send-email';

const NOTIFICATION_DEFINITIONS: Array<{
  key: NotificationKey;
  title: string;
  description: string;
  defaultTemplate: string;
  icon: React.ComponentType<{ className?: string }>;
  extra?: 'expiration' | 'admin_email';
  variables: { name: string; description: string }[];
}> = [
  {
    key: 'email_confirmation',
    title: 'Confirmación de cuenta',
    description: 'Email enviado al usuario tras registrarse para verificar su correo.',
    defaultTemplate: 'confirmacion_registro',
    icon: UserCheck,
    variables: [
      { name: 'user_name', description: 'Nombre del usuario' },
      { name: 'aplication_name', description: 'Nombre de la aplicación' },
      { name: 'confirm_url', description: 'Enlace para confirmar la cuenta' },
      { name: 'request_date', description: 'Fecha de solicitud' },
      { name: 'expires_in_hour', description: 'Horas hasta la expiración' },
      { name: 'request_ip', description: 'IP del solicitante' },
    ],
  },
  {
    key: 'password_reset',
    title: 'Recuperación de contraseña',
    description: 'Email enviado cuando el usuario solicita restablecer su contraseña.',
    defaultTemplate: 'reset-password-authsystem',
    icon: KeyRound,
    extra: 'expiration',
    variables: [
      { name: 'client_name', description: 'Nombre del usuario' },
      { name: 'application_name', description: 'Nombre de la aplicación' },
      { name: 'reset_url', description: 'Enlace al formulario de reseteo' },
      { name: 'expiration_minutes', description: 'Minutos hasta la expiración' },
      { name: 'expires_at_formatted', description: 'Fecha de expiración legible' },
    ],
  },
  {
    key: 'welcome',
    title: 'Bienvenida',
    description: 'Email enviado al usuario luego de confirmar su cuenta exitosamente.',
    defaultTemplate: 'welcome-authsystem',
    icon: UserPlus,
    variables: [
      { name: 'user_name', description: 'Nombre del usuario' },
      { name: 'application_name', description: 'Nombre de la aplicación' },
      { name: 'login_url', description: 'Enlace al login' },
    ],
  },
  {
    key: 'admin_new_user',
    title: 'Aviso al administrador',
    description: 'Notifica al administrador cuando se registra un nuevo usuario.',
    defaultTemplate: 'admin-new-user-authsystem',
    icon: ShieldCheck,
    extra: 'admin_email',
    variables: [
      { name: 'user_name', description: 'Nombre del nuevo usuario' },
      { name: 'user_email', description: 'Email del nuevo usuario' },
      { name: 'application_name', description: 'Nombre de la aplicación' },
      { name: 'registration_date', description: 'Fecha de registro' },
    ],
  },
  {
    key: 'passkey_setup',
    title: 'Invitación de passkey',
    description:
      'Activa el correo que invita al usuario a crear una clave de paso desde el flujo público. Este envío usa la URL y la API key configuradas arriba.',
    defaultTemplate: 'confirmation_passkey',
    icon: Fingerprint,
    variables: [
      { name: 'client_name', description: 'Nombre del usuario' },
      { name: 'passkey', description: 'Token o código de activación de la invitación' },
      { name: 'setup_url', description: 'Enlace para completar la configuración' },
      { name: 'application_name', description: 'Nombre de la aplicacion' },
      { name: 'expires_at', description: 'Fecha de expiracion del enlace' },
    ],
  },
  {
    key: 'tenant_invitation',
    title: 'Invitación al tenant',
    description: 'Email que se envía cuando se invita a un usuario a una empresa.',
    defaultTemplate: 'tenant-invitation-authsystem',
    icon: Users,
    variables: [
      { name: 'user_name', description: 'Nombre del invitado' },
      { name: 'inviter_name', description: 'Quien envía la invitación' },
      { name: 'tenant_name', description: 'Nombre de la empresa' },
      { name: 'accept_url', description: 'Enlace para aceptar la invitación' },
      { name: 'expires_at_formatted', description: 'Fecha de expiración' },
    ],
  },
];

export function buildDefaultNotifications(): NotificationsMap {
  return NOTIFICATION_DEFINITIONS.reduce((acc, def) => {
    acc[def.key] = {
      enabled: def.key === 'password_reset',
      template_name: def.defaultTemplate,
      api_key: '',
      api_url: '',
      ...(def.extra === 'expiration' ? { token_expiration_minutes: 60 } : {}),
      ...(def.extra === 'admin_email' ? { admin_email: '' } : {}),
    };
    return acc;
  }, {} as NotificationsMap);
}

export function mergeWithDefaults(
  stored: Partial<NotificationsMap> | undefined | null,
  legacy?: {
    require_email_verification?: boolean;
    send_password_reset_email?: boolean;
    send_welcome_email?: boolean;
    notify_admin_new_user?: boolean;
    admin_notification_email?: string;
    reset_password_template_name?: string;
    reset_token_expiration_minutes?: number;
  }
): NotificationsMap {
  const defaults = buildDefaultNotifications();

  if (legacy) {
    if (typeof legacy.require_email_verification === 'boolean') {
      defaults.email_confirmation.enabled = legacy.require_email_verification;
    }
    if (typeof legacy.send_password_reset_email === 'boolean') {
      defaults.password_reset.enabled = legacy.send_password_reset_email;
    }
    if (typeof legacy.send_welcome_email === 'boolean') {
      defaults.welcome.enabled = legacy.send_welcome_email;
    }
    if (typeof legacy.notify_admin_new_user === 'boolean') {
      defaults.admin_new_user.enabled = legacy.notify_admin_new_user;
    }
    if (legacy.admin_notification_email) {
      defaults.admin_new_user.admin_email = legacy.admin_notification_email;
    }
    if (legacy.reset_password_template_name) {
      defaults.password_reset.template_name = legacy.reset_password_template_name;
    }
    if (legacy.reset_token_expiration_minutes) {
      defaults.password_reset.token_expiration_minutes = legacy.reset_token_expiration_minutes;
    }
  }

  if (!stored) return defaults;

  const merged = { ...defaults };
  (Object.keys(defaults) as NotificationKey[]).forEach((key) => {
    if (stored[key]) {
      merged[key] = { ...defaults[key], ...stored[key] } as NotificationEntry;
    }
  });
  return merged;
}

interface Props {
  value: NotificationsMap;
  globalApiUrl: string;
  globalApiKey: string;
  onChange: (updates: { value?: NotificationsMap; globalApiUrl?: string; globalApiKey?: string }) => void;
  onSave: () => void | Promise<void>;
  saving?: boolean;
}

export default function NotificationsConfig({
  value,
  globalApiUrl,
  globalApiKey,
  onChange,
  onSave,
  saving,
}: Props) {
  const [expanded, setExpanded] = useState<NotificationKey | null>(null);
  const [showSecret, setShowSecret] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!expanded) {
      const firstEnabled = NOTIFICATION_DEFINITIONS.find((d) => value[d.key]?.enabled);
      if (firstEnabled) setExpanded(firstEnabled.key);
    }
  }, [value, expanded]);

  const updateEntry = (key: NotificationKey, patch: Partial<NotificationEntry>) => {
    onChange({
      value: {
        ...value,
        [key]: { ...value[key], ...patch },
      },
    });
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-start justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <Bell className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Notificaciones por Email</h3>
            <p className="text-sm text-gray-500">
              Configura los templates y la API key para cada tipo de correo que envía esta aplicación.
            </p>
          </div>
        </div>
        <button
          onClick={onSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium disabled:opacity-60"
        >
          {saving ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          <span>Guardar cambios</span>
        </button>
      </div>

      <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 mb-5">
        <div className="flex items-center gap-2 mb-3">
          <LinkIcon className="w-4 h-4 text-gray-500" />
          <h4 className="text-sm font-semibold text-gray-800">Configuración global del proveedor</h4>
        </div>
        <p className="text-xs text-gray-500 mb-3">
          Estos valores se usan por defecto. Cada notificación puede sobrescribirlos abajo.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">URL del servicio de email</label>
            <input
              type="text"
              value={globalApiUrl}
              onChange={(e) => onChange({ globalApiUrl: e.target.value })}
              placeholder={DEFAULT_API_URL}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">API key (x-api-key)</label>
            <div className="relative">
              <input
                type={showSecret.__global ? 'text' : 'password'}
                value={globalApiKey}
                onChange={(e) => onChange({ globalApiKey: e.target.value })}
                placeholder="sk_..."
                className="w-full pr-10 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              />
              <button
                type="button"
                onClick={() => setShowSecret((s) => ({ ...s, __global: !s.__global }))}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showSecret.__global ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {NOTIFICATION_DEFINITIONS.map((def) => {
          const entry = value[def.key];
          const isOpen = expanded === def.key;
          const Icon = def.icon;
          return (
            <div
              key={def.key}
              className={`border rounded-lg transition-colors ${
                isOpen ? 'border-blue-200 bg-blue-50/40' : 'border-gray-200 bg-white'
              }`}
            >
              <div className="flex items-center justify-between p-4">
                <button
                  onClick={() => setExpanded(isOpen ? null : def.key)}
                  className="flex items-center gap-3 flex-1 min-w-0 text-left"
                >
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      entry.enabled ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-gray-900 truncate">{def.title}</h4>
                      {entry.enabled ? (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-200">
                          Activa
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
                          Inactiva
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 truncate">
                      Template: <span className="font-mono">{entry.template_name || def.defaultTemplate}</span>
                    </p>
                  </div>
                </button>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={entry.enabled}
                      onChange={(e) => updateEntry(def.key, { enabled: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : def.key)}
                    className="p-1 text-gray-400 hover:text-gray-600"
                  >
                    {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {isOpen && (
                <div className="px-4 pb-4 space-y-4 border-t border-blue-100 pt-4">
                  <p className="text-sm text-gray-600">{def.description}</p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Nombre del template
                      </label>
                      <input
                        type="text"
                        value={entry.template_name || ''}
                        onChange={(e) => updateEntry(def.key, { template_name: e.target.value })}
                        placeholder={def.defaultTemplate}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Debe coincidir con el nombre del template en tu plataforma de envío.
                      </p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        API key específica (opcional)
                      </label>
                      <div className="relative">
                        <input
                          type={showSecret[def.key] ? 'text' : 'password'}
                          value={entry.api_key || ''}
                          onChange={(e) => updateEntry(def.key, { api_key: e.target.value })}
                          placeholder="Hereda de la configuración global si se deja vacío"
                          className="w-full pr-10 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        <button
                          type="button"
                          onClick={() => setShowSecret((s) => ({ ...s, [def.key]: !s[def.key] }))}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showSecret[def.key] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        URL del servicio (opcional)
                      </label>
                      <input
                        type="text"
                        value={entry.api_url || ''}
                        onChange={(e) => updateEntry(def.key, { api_url: e.target.value })}
                        placeholder={`Hereda ${globalApiUrl || DEFAULT_API_URL}`}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    {def.extra === 'expiration' && (
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Duración del enlace (minutos)
                        </label>
                        <input
                          type="number"
                          min={5}
                          max={1440}
                          value={entry.token_expiration_minutes ?? 60}
                          onChange={(e) =>
                            updateEntry(def.key, {
                              token_expiration_minutes: parseInt(e.target.value) || 60,
                            })
                          }
                          className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Tiempo de vida del token incluido en el enlace de recuperación.
                        </p>
                      </div>
                    )}

                    {def.extra === 'admin_email' && (
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Email del administrador
                        </label>
                        <input
                          type="email"
                          value={entry.admin_email || ''}
                          onChange={(e) => updateEntry(def.key, { admin_email: e.target.value })}
                          placeholder="admin@tudominio.com"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    )}
                  </div>

                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Info className="w-3.5 h-3.5 text-gray-500" />
                      <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                        Variables disponibles en el template
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {def.variables.map((v) => (
                        <div key={v.name} className="flex items-start gap-2 text-xs">
                          <code className="font-mono text-blue-700 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded flex-shrink-0">
                            {`{{${v.name}}}`}
                          </code>
                          <span className="text-gray-600">{v.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-start gap-3 mt-5 p-3 bg-amber-50 border border-amber-200 rounded-lg">
        <Mail className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-amber-800">
          El sistema envía un header <code className="font-mono">x-api-key</code> con el valor configurado y un body
          JSON con <code className="font-mono">template_name</code>, <code className="font-mono">recipient_email</code>{' '}
          y las variables de datos. Si dejas la API key vacía a nivel de notificación, se hereda la configuración global
          de la aplicación.
        </p>
      </div>
    </div>
  );
}
