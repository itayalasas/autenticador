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
  LogOut,
  X,
  Link as LinkIcon,
  Rocket
} from 'lucide-react';

interface SidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

const sidebarItems = [
  { id: 'dashboard', label: 'Dashboard', icon: Home },
  { id: 'applications', label: 'Aplicaciones', icon: Zap },
  { id: 'users', label: 'Usuarios', icon: Users },
  { id: 'roles', label: 'Roles y Permisos', icon: Shield },
  { id: 'authentication', label: 'Autenticación', icon: Shield },
  { id: 'branding', label: 'Branding', icon: Palette },
  { id: 'environments', label: 'Ambientes', icon: Database },
  { id: 'connectors', label: 'Conectores', icon: LinkIcon },
  { id: 'deployments', label: 'Deployments', icon: Rocket },
  { id: 'api-keys', label: 'API Keys', icon: Key },
  { id: 'logs', label: 'Logs de Actividad', icon: Activity },
  { id: 'documentation', label: 'Documentación', icon: FileText },
  { id: 'settings', label: 'Configuración', icon: Settings },
];

export default function Sidebar({ activeSection, onSectionChange, isOpen, onClose }: SidebarProps) {
  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed lg:static inset-y-0 left-0 z-50
        w-64 bg-gray-900 text-white flex flex-col
        transform transition-transform duration-300 ease-in-out
        lg:translate-x-0
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
      {/* Header */}
      <div className="p-6 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <img
              src="/images/icon.svg"
              alt="AuthSystem"
              className="w-10 h-10"
            />
            <div>
              <h1 className="text-xl font-bold">AuthSystem</h1>
              <p className="text-xs text-gray-400">Development</p>
            </div>
          </div>
          {/* Close button for mobile */}
          <button
            onClick={onClose}
            className="lg:hidden p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
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
                onClick={() => {
                  onSectionChange(item.id);
                  // Close sidebar on mobile when item is clicked
                  if (window.innerWidth < 1024) {
                    onClose();
                  }
                }}
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
    </>
  );
}