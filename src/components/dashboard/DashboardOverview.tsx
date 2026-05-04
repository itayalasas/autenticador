import React, { useState, useEffect } from 'react';
import { Users, Zap, Shield, TrendingUp, Activity, AlertTriangle, Calendar, Clock, UserPlus, FileText, CheckCircle, XCircle, Wifi, Database, Server, ArrowRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { applicationService } from '../../services/applicationService';

interface DashboardStats {
  totalApplications: number;
  totalUsers: number;
  todayAuthentications: number;
  todayErrors: number;
  applicationsChange: string;
  usersChange: string;
  authenticationsChange: string;
  errorsChange: string;
}

interface ChartData {
  date: string;
  logins: number;
  registrations: number;
  errors: number;
}

interface SystemStatus {
  api: {
    status: 'online' | 'offline' | 'checking';
    responseTime?: number;
    lastCheck: string;
  };
  database: {
    status: 'connected' | 'disconnected' | 'checking';
    responseTime?: number;
    lastCheck: string;
  };
  authentication: {
    status: 'operational' | 'degraded' | 'checking';
    successRate?: number;
    lastCheck: string;
  };
}

export default function DashboardOverview() {
  const [stats, setStats] = useState<DashboardStats>({
    totalApplications: 0,
    totalUsers: 0,
    todayAuthentications: 0,
    todayErrors: 0,
    applicationsChange: '+0',
    usersChange: '+0%',
    authenticationsChange: '+0%',
    errorsChange: '0%'
  });

  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [systemStatus, setSystemStatus] = useState<SystemStatus>({
    api: { status: 'checking', lastCheck: '' },
    database: { status: 'checking', lastCheck: '' },
    authentication: { status: 'checking', lastCheck: '' }
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
    checkSystemStatus();
    
    // Check system status every 30 seconds
    const statusInterval = setInterval(checkSystemStatus, 30000);
    
    return () => clearInterval(statusInterval);
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      await Promise.all([
        loadApplicationStats(),
        loadUserStats(),
        loadAuthenticationStats(),
        loadChartData()
      ]);

    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadApplicationStats = async () => {
    try {
      const { data: applications, error } = await supabase
        .from('applications')
        .select('id, created_at')
        .eq('status', 'active');

      if (error) throw error;

      const total = applications?.length || 0;
      
      const now = new Date();
      const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      
      const thisMonthApps = applications?.filter(app => 
        new Date(app.created_at) >= thisMonth
      ).length || 0;
      
      const lastMonthApps = applications?.filter(app => {
        const createdAt = new Date(app.created_at);
        return createdAt >= lastMonth && createdAt < thisMonth;
      }).length || 0;
      
      const change = lastMonthApps > 0 
        ? `${thisMonthApps > lastMonthApps ? '+' : ''}${thisMonthApps - lastMonthApps}`
        : `+${thisMonthApps}`;

      setStats(prev => ({
        ...prev,
        totalApplications: total,
        applicationsChange: change
      }));
    } catch (error) {
      console.error('Error loading application stats:', error);
    }
  };

  const loadUserStats = async () => {
    try {
      const { data: users, error } = await supabase
        .from('app_users')
        .select('id, created_at, status');

      if (error) throw error;

      const activeUsers = users?.filter(user => user.status === 'active').length || 0;
      
      const now = new Date();
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      
      const recentUsers = users?.filter(user => 
        new Date(user.created_at) >= lastMonth
      ).length || 0;
      
      const totalUsers = users?.length || 0;
      const growthPercentage = totalUsers > 0 
        ? ((recentUsers / totalUsers) * 100).toFixed(1)
        : '0';

      setStats(prev => ({
        ...prev,
        totalUsers: activeUsers,
        usersChange: `+${growthPercentage}%`
      }));
    } catch (error) {
      console.error('Error loading user stats:', error);
    }
  };

  const loadAuthenticationStats = async () => {
    try {
      const { data: authLogs, error } = await supabase
        .from('auth_logs')
        .select('id, created_at, event_type, success')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      if (error) throw error;

      const todayLogins = authLogs?.filter(log => 
        log.event_type === 'login' && log.success
      ).length || 0;
      
      const todayErrors = authLogs?.filter(log => 
        !log.success
      ).length || 0;

      const yesterday = new Date(Date.now() - 48 * 60 * 60 * 1000);
      const yesterdayLogins = authLogs?.filter(log => 
        log.event_type === 'login' && 
        log.success && 
        new Date(log.created_at) < new Date(Date.now() - 24 * 60 * 60 * 1000) &&
        new Date(log.created_at) >= yesterday
      ).length || 0;

      const loginChange = yesterdayLogins > 0 
        ? `${todayLogins > yesterdayLogins ? '+' : ''}${(((todayLogins - yesterdayLogins) / yesterdayLogins) * 100).toFixed(1)}%`
        : `+${todayLogins > 0 ? '100' : '0'}%`;

      const errorChange = todayErrors > 0 ? `${todayErrors}` : '0';

      setStats(prev => ({
        ...prev,
        todayAuthentications: todayLogins,
        todayErrors: todayErrors,
        authenticationsChange: loginChange,
        errorsChange: `${errorChange > '0' ? '+' : ''}${errorChange}`
      }));
    } catch (error) {
      console.error('Error loading authentication stats:', error);
    }
  };

  const loadChartData = async () => {
    try {
      const { data: authLogs, error } = await supabase
        .from('auth_logs')
        .select('created_at, event_type, success')
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Group data by date
      const dataByDate: Record<string, ChartData> = {};
      
      // Initialize last 7 days
      for (let i = 6; i >= 0; i--) {
        const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
        const dateKey = date.toISOString().split('T')[0];
        dataByDate[dateKey] = {
          date: dateKey,
          logins: 0,
          registrations: 0,
          errors: 0
        };
      }

      // Process auth logs
      authLogs?.forEach(log => {
        const dateKey = log.created_at.split('T')[0];
        if (dataByDate[dateKey]) {
          if (log.event_type === 'login' && log.success) {
            dataByDate[dateKey].logins++;
          } else if (log.event_type === 'register' && log.success) {
            dataByDate[dateKey].registrations++;
          } else if (!log.success) {
            dataByDate[dateKey].errors++;
          }
        }
      });

      setChartData(Object.values(dataByDate));
    } catch (error) {
      console.error('Error loading chart data:', error);
    }
  };

  const checkSystemStatus = async () => {
    const now = new Date().toISOString();
    
    // Check API status
    setSystemStatus(prev => ({
      ...prev,
      api: { ...prev.api, status: 'checking' }
    }));
    
    try {
      const startTime = Date.now();
      const response = await fetch('/.netlify/functions/health', {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });
      const responseTime = Date.now() - startTime;

      setSystemStatus(prev => ({
        ...prev,
        api: {
          status: response.ok ? 'online' : 'offline',
          responseTime,
          lastCheck: now
        }
      }));
    } catch (error) {
      setSystemStatus(prev => ({
        ...prev,
        api: {
          status: 'offline',
          lastCheck: now
        }
      }));
    }

    // Check database status
    setSystemStatus(prev => ({
      ...prev,
      database: { ...prev.database, status: 'checking' }
    }));
    
    try {
      const startTime = Date.now();
      const { data, error } = await supabase
        .from('applications')
        .select('id')
        .limit(1);
      const responseTime = Date.now() - startTime;
      
      setSystemStatus(prev => ({
        ...prev,
        database: {
          status: error ? 'disconnected' : 'connected',
          responseTime,
          lastCheck: now
        }
      }));
    } catch (error) {
      setSystemStatus(prev => ({
        ...prev,
        database: {
          status: 'disconnected',
          lastCheck: now
        }
      }));
    }

    // Check authentication system status
    setSystemStatus(prev => ({
      ...prev,
      authentication: { ...prev.authentication, status: 'checking' }
    }));
    
    try {
      // Get recent auth logs to calculate success rate
      const { data: recentLogs, error } = await supabase
        .from('auth_logs')
        .select('success')
        .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString()); // Last hour

      if (error) throw error;

      const totalAttempts = recentLogs?.length || 0;
      const successfulAttempts = recentLogs?.filter(log => log.success).length || 0;
      const successRate = totalAttempts > 0 ? (successfulAttempts / totalAttempts) * 100 : 100;
      
      setSystemStatus(prev => ({
        ...prev,
        authentication: {
          status: successRate >= 95 ? 'operational' : 'degraded',
          successRate,
          lastCheck: now
        }
      }));
    } catch (error) {
      setSystemStatus(prev => ({
        ...prev,
        authentication: {
          status: 'degraded',
          lastCheck: now
        }
      }));
    }
  };

  const handleQuickAction = (action: string) => {
    const event = new CustomEvent('changeSectionWithApp', { 
      detail: { section: action } 
    });
    window.dispatchEvent(event);
  };

  const getMaxValue = () => {
    const allValues = chartData.flatMap(d => [d.logins, d.registrations, d.errors]);
    return Math.max(...allValues, 10);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', { 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online':
      case 'connected':
      case 'operational':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'offline':
      case 'disconnected':
      case 'degraded':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'checking':
        return <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />;
      default:
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
      case 'connected':
      case 'operational':
        return 'bg-green-50 border-green-200 text-green-800';
      case 'offline':
      case 'disconnected':
      case 'degraded':
        return 'bg-red-50 border-red-200 text-red-800';
      case 'checking':
        return 'bg-blue-50 border-blue-200 text-blue-800';
      default:
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
    }
  };

  const statsData = [
    {
      label: 'Total Aplicaciones',
      value: stats.totalApplications.toString(),
      change: stats.applicationsChange,
      changeType: stats.applicationsChange.startsWith('+') ? 'positive' : 'negative',
      icon: Zap
    },
    {
      label: 'Usuarios Activos',
      value: stats.totalUsers.toLocaleString(),
      change: stats.usersChange,
      changeType: 'positive',
      icon: Users
    },
    {
      label: 'Autenticaciones Hoy',
      value: stats.todayAuthentications.toLocaleString(),
      change: stats.authenticationsChange,
      changeType: stats.authenticationsChange.startsWith('+') ? 'positive' : 'negative',
      icon: Shield
    },
    {
      label: 'Errores (24h)',
      value: stats.todayErrors.toString(),
      change: stats.errorsChange,
      changeType: stats.errorsChange.startsWith('-') ? 'positive' : 'negative',
      icon: AlertTriangle
    }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg p-6 text-white">
        <h1 className="text-2xl font-bold mb-2">¡Bienvenido de vuelta!</h1>
        <p className="text-blue-100">
          Gestiona tus aplicaciones de autenticación desde un solo lugar.
          Sistema funcionando correctamente.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statsData.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div key={index} className="bg-white p-6 rounded-lg border border-gray-200 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{stat.label}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
                  <div className="flex items-center mt-2">
                    <span className={`text-sm font-medium ${
                      stat.changeType === 'positive' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {stat.change}
                    </span>
                    <span className="text-sm text-gray-500 ml-1">vs período anterior</span>
                  </div>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg">
                  <Icon className="w-6 h-6 text-blue-500" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Actions */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Acciones Rápidas</h3>
          <div className="space-y-3">
            <button 
              onClick={() => handleQuickAction('applications')}
              className="w-full flex items-center space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left"
            >
              <div className="p-2 bg-blue-50 rounded-lg">
                <Zap className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="font-medium text-gray-900">Crear Nueva Aplicación</p>
                <p className="text-sm text-gray-600">Configura una nueva app en minutos</p>
              </div>
            </button>
            
            <button 
              onClick={() => handleQuickAction('users')}
              className="w-full flex items-center space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left"
            >
              <div className="p-2 bg-green-50 rounded-lg">
                <UserPlus className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="font-medium text-gray-900">Gestionar Usuarios</p>
                <p className="text-sm text-gray-600">Administra usuarios y permisos</p>
              </div>
            </button>
            
            <button 
              onClick={() => handleQuickAction('documentation')}
              className="w-full flex items-center space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left"
            >
              <div className="p-2 bg-purple-50 rounded-lg">
                <FileText className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <p className="font-medium text-gray-900">Ver Documentación</p>
                <p className="text-sm text-gray-600">Guías y ejemplos de APIs</p>
              </div>
            </button>
          </div>
        </div>

        {/* Analytics Chart */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Actividad de los Últimos 7 Días</h3>
            <button 
              onClick={() => handleQuickAction('logs')}
              className="text-blue-500 hover:text-blue-600 text-sm font-medium"
            >
              Ver detalles
            </button>
          </div>
          
          {chartData.length === 0 ? (
            <div className="text-center py-8">
              <TrendingUp className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-600">No hay datos suficientes para mostrar gráficas</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Chart Legend */}
              <div className="flex items-center space-x-4 text-sm">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-gray-600">Logins</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <span className="text-gray-600">Registros</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <span className="text-gray-600">Errores</span>
                </div>
              </div>

              {/* Simple Bar Chart */}
              <div className="space-y-3">
                {chartData.map((data, index) => {
                  const maxValue = getMaxValue();
                  const loginWidth = (data.logins / maxValue) * 100;
                  const registrationWidth = (data.registrations / maxValue) * 100;
                  const errorWidth = (data.errors / maxValue) * 100;
                  
                  return (
                    <div key={index} className="space-y-1">
                      <div className="flex items-center justify-between text-xs text-gray-600">
                        <span>{formatDate(data.date)}</span>
                        <span>{data.logins + data.registrations + data.errors} eventos</span>
                      </div>
                      <div className="relative h-6 bg-gray-100 rounded-full overflow-hidden">
                        {/* Logins bar */}
                        <div 
                          className="absolute top-0 left-0 h-full bg-green-500 rounded-full transition-all duration-300"
                          style={{ width: `${loginWidth}%` }}
                          title={`${data.logins} logins`}
                        />
                        {/* Registrations bar */}
                        <div 
                          className="absolute top-0 h-full bg-blue-500 rounded-full transition-all duration-300"
                          style={{ 
                            left: `${loginWidth}%`,
                            width: `${registrationWidth}%` 
                          }}
                          title={`${data.registrations} registros`}
                        />
                        {/* Errors bar */}
                        <div 
                          className="absolute top-0 h-full bg-red-500 rounded-full transition-all duration-300"
                          style={{ 
                            left: `${loginWidth + registrationWidth}%`,
                            width: `${errorWidth}%` 
                          }}
                          title={`${data.errors} errores`}
                        />
                      </div>
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>L: {data.logins}</span>
                        <span>R: {data.registrations}</span>
                        <span>E: {data.errors}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* System Status */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Estado del Sistema</h3>
          <button
            onClick={checkSystemStatus}
            className="text-blue-500 hover:text-blue-600 text-sm font-medium flex items-center space-x-1"
          >
            <Activity className="w-4 h-4" />
            <span>Actualizar</span>
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* API Status */}
          <div className={`p-4 rounded-lg border ${getStatusColor(systemStatus.api.status)}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                {getStatusIcon(systemStatus.api.status)}
                <span className="font-medium">API REST</span>
              </div>
              <Server className="w-5 h-5 opacity-60" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium capitalize">
                {systemStatus.api.status === 'online' ? 'Operacional' : 
                 systemStatus.api.status === 'offline' ? 'Desconectado' : 'Verificando...'}
              </p>
              {systemStatus.api.responseTime && (
                <p className="text-xs opacity-75">
                  Tiempo de respuesta: {systemStatus.api.responseTime}ms
                </p>
              )}
              <p className="text-xs opacity-75">
                Última verificación: {systemStatus.api.lastCheck ? 
                  new Date(systemStatus.api.lastCheck).toLocaleTimeString() : 'Nunca'}
              </p>
            </div>
          </div>

          {/* Database Status */}
          <div className={`p-4 rounded-lg border ${getStatusColor(systemStatus.database.status)}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                {getStatusIcon(systemStatus.database.status)}
                <span className="font-medium">Base de Datos</span>
              </div>
              <Database className="w-5 h-5 opacity-60" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium capitalize">
                {systemStatus.database.status === 'connected' ? 'Conectada' : 
                 systemStatus.database.status === 'disconnected' ? 'Desconectada' : 'Verificando...'}
              </p>
              {systemStatus.database.responseTime && (
                <p className="text-xs opacity-75">
                  Tiempo de consulta: {systemStatus.database.responseTime}ms
                </p>
              )}
              <p className="text-xs opacity-75">
                Última verificación: {systemStatus.database.lastCheck ? 
                  new Date(systemStatus.database.lastCheck).toLocaleTimeString() : 'Nunca'}
              </p>
            </div>
          </div>

          {/* Authentication Status */}
          <div className={`p-4 rounded-lg border ${getStatusColor(systemStatus.authentication.status)}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                {getStatusIcon(systemStatus.authentication.status)}
                <span className="font-medium">Autenticación</span>
              </div>
              <Shield className="w-5 h-5 opacity-60" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium capitalize">
                {systemStatus.authentication.status === 'operational' ? 'Operacional' : 
                 systemStatus.authentication.status === 'degraded' ? 'Degradado' : 'Verificando...'}
              </p>
              {systemStatus.authentication.successRate !== undefined && (
                <p className="text-xs opacity-75">
                  Tasa de éxito: {systemStatus.authentication.successRate.toFixed(1)}%
                </p>
              )}
              <p className="text-xs opacity-75">
                Última verificación: {systemStatus.authentication.lastCheck ? 
                  new Date(systemStatus.authentication.lastCheck).toLocaleTimeString() : 'Nunca'}
              </p>
            </div>
          </div>
        </div>

        {/* System Health Summary */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${
                systemStatus.api.status === 'online' && 
                systemStatus.database.status === 'connected' && 
                systemStatus.authentication.status === 'operational'
                  ? 'bg-green-500' 
                  : 'bg-yellow-500'
              }`}></div>
              <span className="text-sm font-medium text-gray-900">
                Estado General del Sistema
              </span>
            </div>
            <span className="text-sm text-gray-600">
              {systemStatus.api.status === 'online' && 
               systemStatus.database.status === 'connected' && 
               systemStatus.authentication.status === 'operational'
                ? 'Todos los servicios operacionales' 
                : 'Algunos servicios requieren atención'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}