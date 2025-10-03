import React from 'react';
import { 
  Home, 
  Zap, 
  Crown,
  Shield, 
  Users, 
  Settings, 
  FileText, 
  Palette, 
  Database,
  Key,
  Activity,
  HelpCircle,
  LogOut
} from 'lucide-react';

interface SidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
}

const sidebarItems = [
  { id: 'dashboard', label: 'Dashboard', icon: Home },
  { id: 'applications', label: 'Aplicaciones', icon: Zap },
  { id: 'users', label: 'Usuarios', icon: Users },
  { id: 'roles', label: 'Roles y Permisos', icon: Shield },
  { id: 'authentication', label: 'Autenticación', icon: Shield },
  { id: 'branding', label: 'Branding', icon: Palette },
  { id: 'environments', label: 'Ambientes', icon: Database },
  { id: 'api-keys', label: 'API Keys', icon: Key },
  { id: 'logs', label: 'Logs de Actividad', icon: Activity },
  { id: 'documentation', label: 'Documentación', icon: FileText },
  { id: 'settings', label: 'Configuración', icon: Settings },
];

export default function Sidebar({ activeSection, onSectionChange }: SidebarProps) {
  return (
    <div className="w-64 bg-gray-900 text-white h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-gray-800">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold">AuthSystem</h1>
            <p className="text-xs text-gray-400">Development</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4">
        <div className="px-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            General
          </p>
          {sidebarItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            
            return (
              <button
                key={item.id}
                onClick={() => onSectionChange(item.id)}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors ${
                  isActive 
                    ? 'bg-blue-600 text-white' 
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-sm font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

    </div>
  );
}