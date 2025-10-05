import React, { useState, useEffect } from 'react';
import { Activity, Search, RefreshCw, Download, Eye, CheckCircle, XCircle, User, Globe, Shield } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { applicationService } from '../../services/applicationService';

interface AuthLog {
  id: string;
  application_id: string;
  app_user_id: string | null;
  event_type: 'login' | 'register' | 'logout' | 'password_reset' | 'failed_login';
  ip_address: string;
  user_agent: string;
  success: boolean;
  error_message: string | null;
  metadata: Record<string, any>;
  created_at: string;
  app_users?: {
    name: string;
    email: string;
  } | null;
  applications?: {
    name: string;
    domain: string;
  };
}

export default function LogsViewer() {
  const [applications, setApplications] = useState<any[]>([]);
  const [selectedApp, setSelectedApp] = useState('all');
  const [logs, setLogs] = useState<AuthLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [eventFilter, setEventFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [timeRange, setTimeRange] = useState('24h');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AuthLog | null>(null);
  const [showLogModal, setShowLogModal] = useState(false);

  useEffect(() => {
    loadApplications();
    loadLogs();
  }, []);

  useEffect(() => {
    loadLogs();
  }, [selectedApp, eventFilter, statusFilter, timeRange]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(() => {
        loadLogs();
      }, 30000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh, selectedApp, eventFilter, statusFilter, timeRange]);

  const loadApplications = async () => {
    try {
      const apps = await applicationService.getApplications();
      setApplications(apps);
    } catch (error) {
      console.error('Error loading applications:', error);
    }
  };

  const loadLogs = async () => {
    try {
      setLoading(true);

      const now = new Date();
      let startDate = new Date();

      switch (timeRange) {
        case '1h':
          startDate = new Date(now.getTime() - 60 * 60 * 1000);
          break;
        case '24h':
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case '7d':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      }

      let query = supabase
        .from('auth_logs')
        .select(`
          *,
          app_users!left(name, email),
          applications(name, domain)
        `)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false })
        .limit(500);

      if (selectedApp !== 'all') {
        query = query.eq('application_id', selectedApp);
      }

      if (eventFilter !== 'all') {
        query = query.eq('event_type', eventFilter);
      }

      if (statusFilter !== 'all') {
        const isSuccess = statusFilter === 'success';
        query = query.eq('success', isSuccess);
      }

      const { data: logsData, error } = await query;

      if (error) {
        console.error('Error loading logs:', error);
        setLogs([]);
        return;
      }

      let filteredLogs = logsData || [];
      if (searchTerm) {
        filteredLogs = filteredLogs.filter(log => {
          const email = log.metadata?.email || log.app_users?.email || '';
          const name = log.app_users?.name || '';
          const appName = log.applications?.name || '';

          return email.toLowerCase().includes(searchTerm.toLowerCase()) ||
            name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            log.ip_address?.includes(searchTerm) ||
            log.error_message?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            appName.toLowerCase().includes(searchTerm.toLowerCase());
        });
      }

      setLogs(filteredLogs);
    } catch (error) {
      console.error('Error loading logs:', error);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    loadLogs();
  };

  const handleExportLogs = () => {
    const csvContent = [
      ['Timestamp', 'Application', 'Event', 'User', 'IP', 'Status', 'Error'].join(','),
      ...logs.map(log => [
        new Date(log.created_at).toISOString(),
        log.applications?.name || 'Unknown',
        log.event_type,
        log.metadata?.email || log.app_users?.email || 'Anonymous',
        log.ip_address,
        log.success ? 'Success' : 'Failed',
        log.error_message || ''
      ].map(field => `"${field}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `auth-logs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const getEventIcon = (eventType: string, success: boolean) => {
    if (!success) {
      return <XCircle className="w-5 h-5 text-red-500" />;
    }

    switch (eventType) {
      case 'login':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'register':
        return <User className="w-5 h-5 text-blue-500" />;
      case 'logout':
        return <Shield className="w-5 h-5 text-gray-500" />;
      case 'password_reset':
        return <RefreshCw className="w-5 h-5 text-yellow-500" />;
      case 'failed_login':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Activity className="w-5 h-5 text-gray-500" />;
    }
  };

  const getEventColor = (eventType: string, success: boolean) => {
    if (!success) {
      return 'bg-red-50 border-red-200';
    }

    switch (eventType) {
      case 'login':
        return 'bg-green-50 border-green-200';
      case 'register':
        return 'bg-blue-50 border-blue-200';
      case 'logout':
        return 'bg-gray-50 border-gray-200';
      case 'password_reset':
        return 'bg-yellow-50 border-yellow-200';
      case 'failed_login':
        return 'bg-red-50 border-red-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const getEventLabel = (eventType: string) => {
    switch (eventType) {
      case 'login': return 'Login';
      case 'register': return 'Registro';
      case 'logout': return 'Logout';
      case 'password_reset': return 'Reset Password';
      case 'failed_login': return 'Error de Autenticación';
      default: return eventType;
    }
  };

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffMs = now.getTime() - time.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Ahora mismo';
    if (diffMins < 60) return `Hace ${diffMins} min`;
    if (diffHours < 24) return `Hace ${diffHours}h`;
    return `Hace ${diffDays}d`;
  };

  const getStatsData = () => {
    const totalLogs = logs.length;
    const successfulLogs = logs.filter(log => log.success).length;
    const failedLogs = totalLogs - successfulLogs;
    const successRate = totalLogs > 0 ? ((successfulLogs / totalLogs) * 100).toFixed(1) : '0';

    const uniqueEmails = new Set(
      logs.map(log => log.metadata?.email || log.app_users?.email).filter(Boolean)
    ).size;
    const uniqueIPs = new Set(logs.map(log => log.ip_address)).size;

    return {
      totalLogs,
      successfulLogs,
      failedLogs,
      successRate,
      uniqueUsers: uniqueEmails,
      uniqueIPs
    };
  };

  const stats = getStatsData();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Logs de Actividad</h2>
          <p className="text-gray-600">Monitorea eventos de autenticación en tiempo real</p>
        </div>
        <div className="flex items-center space-x-3">
          <label className="flex items-center space-x-2 text-sm">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-gray-700">Auto-refresh</span>
          </label>
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Actualizar</span>
          </button>
          <button
            onClick={handleExportLogs}
            className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Exportar</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center space-x-3">
            <Activity className="w-8 h-8 text-blue-500" />
            <div>
              <p className="text-sm text-gray-600">Total Eventos</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalLogs}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center space-x-3">
            <CheckCircle className="w-8 h-8 text-green-500" />
            <div>
              <p className="text-sm text-gray-600">Exitosos</p>
              <p className="text-2xl font-bold text-green-600">{stats.successfulLogs}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center space-x-3">
            <XCircle className="w-8 h-8 text-red-500" />
            <div>
              <p className="text-sm text-gray-600">Fallidos</p>
              <p className="text-2xl font-bold text-red-600">{stats.failedLogs}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center space-x-3">
            <Shield className="w-8 h-8 text-cyan-500" />
            <div>
              <p className="text-sm text-gray-600">Tasa Éxito</p>
              <p className="text-2xl font-bold text-cyan-600">{stats.successRate}%</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center space-x-3">
            <User className="w-8 h-8 text-orange-500" />
            <div>
              <p className="text-sm text-gray-600">Usuarios</p>
              <p className="text-2xl font-bold text-orange-600">{stats.uniqueUsers}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center space-x-3">
            <Globe className="w-8 h-8 text-teal-500" />
            <div>
              <p className="text-sm text-gray-600">IPs Únicas</p>
              <p className="text-2xl font-bold text-teal-600">{stats.uniqueIPs}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Aplicación</label>
            <select
              value={selectedApp}
              onChange={(e) => setSelectedApp(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Todas las aplicaciones</option>
              {applications.map((app) => (
                <option key={app.id} value={app.id}>
                  {app.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Evento</label>
            <select
              value={eventFilter}
              onChange={(e) => setEventFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Todos los eventos</option>
              <option value="login">Login</option>
              <option value="register">Registro</option>
              <option value="logout">Logout</option>
              <option value="password_reset">Reset Password</option>
              <option value="failed_login">Errores de Autenticación</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Estado</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Todos</option>
              <option value="success">Exitosos</option>
              <option value="failed">Fallidos</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Período</label>
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="1h">Última hora</option>
              <option value="24h">Últimas 24 horas</option>
              <option value="7d">Últimos 7 días</option>
              <option value="30d">Últimos 30 días</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Buscar</label>
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
              <input
                type="text"
                placeholder="Email, IP, error..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
              <Activity className="w-5 h-5" />
              <span>Eventos de Autenticación ({logs.length})</span>
            </h3>
            {autoRefresh && (
              <div className="flex items-center space-x-2 text-sm text-green-600">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span>Auto-refresh activo</span>
              </div>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12">
            <Activity className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No hay logs</h3>
            <p className="text-gray-600">No se encontraron eventos para los filtros seleccionados</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Evento
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Usuario
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Aplicación
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    IP / Ubicación
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Timestamp
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {logs.map((log) => {
                  const userEmail = log.metadata?.email || log.app_users?.email || 'Sin email';
                  const userName = log.app_users?.name || 'Anónimo';

                  return (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-3">
                          {getEventIcon(log.event_type, log.success)}
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {getEventLabel(log.event_type)}
                            </div>
                            {log.error_message && (
                              <div className="text-xs text-red-600 truncate max-w-xs">
                                {log.error_message}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{userName}</div>
                        <div className="text-sm text-gray-500">{userEmail}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {log.applications?.name || 'Desconocida'}
                        </div>
                        <div className="text-sm text-gray-500">
                          {log.applications?.domain || 'Sin dominio'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{log.ip_address}</div>
                        <div className="text-xs text-gray-500 truncate max-w-xs">
                          {log.user_agent ? log.user_agent.split(' ')[0] : 'Unknown'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {new Date(log.created_at).toLocaleString()}
                        </div>
                        <div className="text-xs text-gray-500">
                          {formatTimeAgo(log.created_at)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          log.success
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {log.success ? 'Exitoso' : 'Fallido'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => {
                            setSelectedLog(log);
                            setShowLogModal(true);
                          }}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showLogModal && selectedLog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
                  {getEventIcon(selectedLog.event_type, selectedLog.success)}
                  <span>Detalle del Evento</span>
                </h3>
                <button
                  onClick={() => setShowLogModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-6">
                <div className={`p-4 rounded-lg border ${getEventColor(selectedLog.event_type, selectedLog.success)}`}>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-gray-700">Tipo de Evento</p>
                      <p className="text-lg font-semibold">{getEventLabel(selectedLog.event_type)}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700">Estado</p>
                      <p className={`text-lg font-semibold ${selectedLog.success ? 'text-green-600' : 'text-red-600'}`}>
                        {selectedLog.success ? 'Exitoso' : 'Fallido'}
                      </p>
                    </div>
                  </div>
                  {selectedLog.error_message && (
                    <div className="mt-3">
                      <p className="text-sm font-medium text-red-700">Error</p>
                      <p className="text-sm text-red-600">{selectedLog.error_message}</p>
                    </div>
                  )}
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-3">Información del Usuario</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">Nombre:</p>
                      <p className="font-medium">{selectedLog.app_users?.name || 'No disponible'}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Email:</p>
                      <p className="font-medium">{selectedLog.metadata?.email || selectedLog.app_users?.email || 'No disponible'}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-3">Información de la Aplicación</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">Aplicación:</p>
                      <p className="font-medium">{selectedLog.applications?.name || 'Desconocida'}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Dominio:</p>
                      <p className="font-medium">{selectedLog.applications?.domain || 'No disponible'}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-3">Información Técnica</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">IP Address:</p>
                      <p className="font-medium font-mono">{selectedLog.ip_address}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Timestamp:</p>
                      <p className="font-medium">{new Date(selectedLog.created_at).toLocaleString()}</p>
                    </div>
                    <div className="md:col-span-2">
                      <p className="text-gray-600">User Agent:</p>
                      <p className="font-medium text-xs break-all">{selectedLog.user_agent}</p>
                    </div>
                  </div>
                </div>

                {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 mb-3">Metadata</h4>
                    <pre className="text-xs bg-gray-900 text-gray-100 p-3 rounded overflow-x-auto">
                      {JSON.stringify(selectedLog.metadata, null, 2)}
                    </pre>
                  </div>
                )}
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setShowLogModal(false)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
