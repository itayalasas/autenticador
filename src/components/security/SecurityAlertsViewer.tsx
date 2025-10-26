import React, { useState, useEffect } from 'react';
import { Shield, AlertTriangle, Clock, CheckCircle, XCircle, TrendingUp } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface SecurityAlert {
  id: string;
  alert_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  ip_address: string | null;
  email: string | null;
  application_id: string | null;
  description: string;
  metadata: any;
  resolved: boolean;
  resolved_at: string | null;
  created_at: string;
}

interface SecurityStats {
  total_alerts: number;
  critical_alerts: number;
  high_alerts: number;
  medium_alerts: number;
  low_alerts: number;
  resolved_alerts: number;
}

export default function SecurityAlertsViewer() {
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [stats, setStats] = useState<SecurityStats>({
    total_alerts: 0,
    critical_alerts: 0,
    high_alerts: 0,
    medium_alerts: 0,
    low_alerts: 0,
    resolved_alerts: 0
  });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unresolved' | 'resolved'>('unresolved');
  const [severityFilter, setSeverityFilter] = useState<string>('all');

  useEffect(() => {
    loadAlerts();
    loadStats();
  }, [filter, severityFilter]);

  const loadAlerts = async () => {
    try {
      setLoading(true);

      let query = supabase
        .from('security_alerts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (filter === 'unresolved') {
        query = query.eq('resolved', false);
      } else if (filter === 'resolved') {
        query = query.eq('resolved', true);
      }

      if (severityFilter !== 'all') {
        query = query.eq('severity', severityFilter);
      }

      const { data, error } = await query;

      if (error) throw error;

      setAlerts(data || []);
    } catch (error: any) {
      console.error('Error loading alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const { data, error } = await supabase
        .from('security_alerts')
        .select('severity, resolved');

      if (error) throw error;

      const stats: SecurityStats = {
        total_alerts: data?.length || 0,
        critical_alerts: data?.filter(a => a.severity === 'critical').length || 0,
        high_alerts: data?.filter(a => a.severity === 'high').length || 0,
        medium_alerts: data?.filter(a => a.severity === 'medium').length || 0,
        low_alerts: data?.filter(a => a.severity === 'low').length || 0,
        resolved_alerts: data?.filter(a => a.resolved).length || 0
      };

      setStats(stats);
    } catch (error: any) {
      console.error('Error loading stats:', error);
    }
  };

  const resolveAlert = async (alertId: string) => {
    try {
      const { error } = await supabase
        .from('security_alerts')
        .update({
          resolved: true,
          resolved_at: new Date().toISOString()
        })
        .eq('id', alertId);

      if (error) throw error;

      loadAlerts();
      loadStats();
    } catch (error: any) {
      console.error('Error resolving alert:', error);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500/10 border-red-500/30 text-red-400';
      case 'high': return 'bg-orange-500/10 border-orange-500/30 text-orange-400';
      case 'medium': return 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400';
      case 'low': return 'bg-blue-500/10 border-blue-500/30 text-blue-400';
      default: return 'bg-gray-500/10 border-gray-500/30 text-gray-400';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
      case 'high':
        return <AlertTriangle className="w-5 h-5" />;
      case 'medium':
        return <Shield className="w-5 h-5" />;
      case 'low':
        return <TrendingUp className="w-5 h-5" />;
      default:
        return <Shield className="w-5 h-5" />;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getAlertTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'rate_limit_exceeded': 'Límite de Tasa Excedido',
      'brute_force': 'Ataque de Fuerza Bruta',
      'suspicious_activity': 'Actividad Sospechosa',
      'invalid_credentials': 'Credenciales Inválidas',
      'multiple_failed_attempts': 'Múltiples Intentos Fallidos'
    };
    return labels[type] || type;
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Total</p>
              <p className="text-2xl font-bold text-white">{stats.total_alerts}</p>
            </div>
            <Shield className="w-8 h-8 text-blue-400" />
          </div>
        </div>

        <div className="bg-red-500/10 rounded-lg p-4 border border-red-500/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-red-400">Críticas</p>
              <p className="text-2xl font-bold text-red-300">{stats.critical_alerts}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-red-400" />
          </div>
        </div>

        <div className="bg-orange-500/10 rounded-lg p-4 border border-orange-500/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-orange-400">Altas</p>
              <p className="text-2xl font-bold text-orange-300">{stats.high_alerts}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-orange-400" />
          </div>
        </div>

        <div className="bg-yellow-500/10 rounded-lg p-4 border border-yellow-500/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-yellow-400">Medias</p>
              <p className="text-2xl font-bold text-yellow-300">{stats.medium_alerts}</p>
            </div>
            <Shield className="w-8 h-8 text-yellow-400" />
          </div>
        </div>

        <div className="bg-blue-500/10 rounded-lg p-4 border border-blue-500/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-400">Bajas</p>
              <p className="text-2xl font-bold text-blue-300">{stats.low_alerts}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-blue-400" />
          </div>
        </div>

        <div className="bg-green-500/10 rounded-lg p-4 border border-green-500/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-400">Resueltas</p>
              <p className="text-2xl font-bold text-green-300">{stats.resolved_alerts}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-400" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              filter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            Todas
          </button>
          <button
            onClick={() => setFilter('unresolved')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              filter === 'unresolved'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            Sin Resolver
          </button>
          <button
            onClick={() => setFilter('resolved')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              filter === 'resolved'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            Resueltas
          </button>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setSeverityFilter('all')}
            className={`px-3 py-2 rounded-lg text-sm transition-colors ${
              severityFilter === 'all'
                ? 'bg-gray-700 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            Todas
          </button>
          <button
            onClick={() => setSeverityFilter('critical')}
            className={`px-3 py-2 rounded-lg text-sm transition-colors ${
              severityFilter === 'critical'
                ? 'bg-red-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            Críticas
          </button>
          <button
            onClick={() => setSeverityFilter('high')}
            className={`px-3 py-2 rounded-lg text-sm transition-colors ${
              severityFilter === 'high'
                ? 'bg-orange-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            Altas
          </button>
          <button
            onClick={() => setSeverityFilter('medium')}
            className={`px-3 py-2 rounded-lg text-sm transition-colors ${
              severityFilter === 'medium'
                ? 'bg-yellow-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            Medias
          </button>
        </div>
      </div>

      {/* Alerts List */}
      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
            <p className="text-gray-400 mt-4">Cargando alertas...</p>
          </div>
        ) : alerts.length === 0 ? (
          <div className="text-center py-12 bg-gray-800/50 rounded-lg border border-gray-700">
            <Shield className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">No hay alertas de seguridad</p>
          </div>
        ) : (
          alerts.map(alert => (
            <div
              key={alert.id}
              className={`p-4 rounded-lg border ${getSeverityColor(alert.severity)} ${
                alert.resolved ? 'opacity-60' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1">
                  <div className="mt-0.5">
                    {getSeverityIcon(alert.severity)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-semibold text-white">
                        {getAlertTypeLabel(alert.alert_type)}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        alert.severity === 'critical' ? 'bg-red-500/20 text-red-300' :
                        alert.severity === 'high' ? 'bg-orange-500/20 text-orange-300' :
                        alert.severity === 'medium' ? 'bg-yellow-500/20 text-yellow-300' :
                        'bg-blue-500/20 text-blue-300'
                      }`}>
                        {alert.severity.toUpperCase()}
                      </span>
                      {alert.resolved && (
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-500/20 text-green-300 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          Resuelta
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-300 mb-2">
                      {alert.description}
                    </p>
                    <div className="flex flex-wrap gap-3 text-xs text-gray-400">
                      {alert.ip_address && (
                        <span className="flex items-center gap-1">
                          <span className="font-medium">IP:</span> {alert.ip_address}
                        </span>
                      )}
                      {alert.email && (
                        <span className="flex items-center gap-1">
                          <span className="font-medium">Email:</span> {alert.email}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDate(alert.created_at)}
                      </span>
                    </div>
                    {alert.metadata && Object.keys(alert.metadata).length > 0 && (
                      <details className="mt-2">
                        <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-400">
                          Ver detalles técnicos
                        </summary>
                        <pre className="mt-2 text-xs bg-black/30 p-2 rounded overflow-x-auto">
                          {JSON.stringify(alert.metadata, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>

                {!alert.resolved && (
                  <button
                    onClick={() => resolveAlert(alert.id)}
                    className="flex-shrink-0 px-3 py-1.5 bg-green-600/20 hover:bg-green-600/30 border border-green-500/30 text-green-300 rounded-lg text-sm font-medium transition-colors flex items-center gap-1"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Resolver
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
