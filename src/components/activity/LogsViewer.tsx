import React, { useState, useEffect } from 'react';
import { Activity, CheckCircle, XCircle, Users, Globe, Search, RefreshCw, Download, Shield, ShieldOff, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';

interface AuthLog {
  id: string;
  event_type: string;
  ip_address: string;
  user_agent: string;
  success: boolean;
  error_message: string | null;
  metadata: any;
  created_at: string;
  application_id: string | null;
  app_user_id: string | null;
  application?: {
    name: string;
    application_id: string;
    domain: string;
  };
  app_user?: {
    name: string;
    email: string;
  };
  failed_attempts?: number;
  grouped_logs?: AuthLog[];
}

interface BlockedIP {
  id: string;
  ip_address: string;
  reason: string;
  blocked_at: string;
  expires_at: string | null;
  is_active: boolean;
  application?: {
    name: string;
  };
}

export default function LogsViewer() {
  const { user } = useAuth();
  const { showSuccess, showError } = useNotification();
  const [logs, setLogs] = useState<AuthLog[]>([]);
  const [blockedIPs, setBlockedIPs] = useState<BlockedIP[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AuthLog | null>(null);
  const [showBlockedIPs, setShowBlockedIPs] = useState(false);
  const [showBlockIPModal, setShowBlockIPModal] = useState(false);
  const [blockIPReason, setBlockIPReason] = useState('');
  const [ipToBlock, setIpToBlock] = useState<{ ip: string; logId?: string } | null>(null);
  const [isBlocking, setIsBlocking] = useState(false);

  const [appFilter, setAppFilter] = useState<string>('all');
  const [eventFilter, setEventFilter] = useState<string>('all');
  const [timeFilter, setTimeFilter] = useState<string>('24h');
  const [searchQuery, setSearchQuery] = useState('');
  const [applications, setApplications] = useState<any[]>([]);

  const [stats, setStats] = useState({
    total: 0,
    successful: 0,
    failed: 0,
    uniqueUsers: 0,
    uniqueIPs: 0
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const logsPerPage = 100;

  useEffect(() => {
    loadApplications();
    loadLogs();
    loadBlockedIPs();
    setCurrentPage(1);
    
    // Debug: Check if we have any logs at all
    const debugLogs = async () => {
      const { data: allLogs, error } = await supabase
        .from('auth_logs')
        .select('id, event_type, success, created_at')
        .order('created_at', { ascending: false })
        .limit(10);
        
      console.log('🔍 Debug - Recent logs in database:', {
        count: allLogs?.length || 0,
        logs: allLogs?.map(log => ({
          id: log.id,
          event_type: log.event_type,
          success: log.success,
          created_at: log.created_at
        })) || [],
        error: error?.message
      });
    };
    
    debugLogs();
  }, [appFilter, eventFilter, timeFilter]);

  useEffect(() => {
    loadLogs();
  }, [currentPage]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(() => {
        console.log('🔄 Auto-refreshing logs...');
        loadLogs();
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [autoRefresh, appFilter, eventFilter, timeFilter]);

  const loadApplications = async () => {
    const { data } = await supabase
      .from('applications')
      .select('id, name, application_id')
      .order('name');

    if (data) setApplications(data);
  };

  const groupFailedAttempts = (logs: AuthLog[]): AuthLog[] => {
    console.log('🔄 Grouping failed attempts for', logs.length, 'logs');
    
    const groupedMap = new Map<string, AuthLog>();
    const processedIds = new Set<string>();

    logs.forEach(log => {
      if (processedIds.has(log.id)) return;

      // Solo agrupar intentos fallidos de login y registro
      if (!log.success && (log.event_type === 'login' || log.event_type === 'register' || log.event_type === 'failed_login')) {
        console.log('🔍 Processing failed attempt:', {
          id: log.id,
          event_type: log.event_type,
          success: log.success,
          email: log.app_user?.email || log.metadata?.email,
          ip: log.ip_address
        });
        
        const email = log.app_user?.email || log.metadata?.email || 'anonymous';
        const groupKey = `${log.ip_address}_${email}_${log.application_id || 'no-app'}`;

        if (!groupedMap.has(groupKey)) {
          // Primer intento fallido con esta combinación
          const relatedLogs = logs.filter(l =>
            !l.success &&
            (l.event_type === 'login' || l.event_type === 'register' || l.event_type === 'failed_login') &&
            l.ip_address === log.ip_address &&
            (l.app_user?.email || l.metadata?.email || 'anonymous') === email &&
            (l.application_id || 'no-app') === (log.application_id || 'no-app')
          );

          // Marcar todos los logs relacionados como procesados
          relatedLogs.forEach(l => processedIds.add(l.id));

          const grouped = {
            ...log,
            failed_attempts: relatedLogs.length,
            grouped_logs: relatedLogs.sort((a, b) =>
              new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            )
          };

          console.log('📦 Grouped failed attempts:', {
            groupKey,
            attempts: relatedLogs.length,
            logs: relatedLogs.map(l => l.id)
          });
          groupedMap.set(groupKey, grouped);
        }
      } else {
        // Los logs exitosos y otros eventos no se agrupan
        groupedMap.set(log.id, log);
        processedIds.add(log.id);
      }
    });

    const result = Array.from(groupedMap.values()).sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    
    console.log('✅ Grouping complete:', {
      original: logs.length,
      grouped: result.length,
      failed: result.filter(log => !log.success).length,
      successful: result.filter(log => log.success).length
    });
    
    return result;
  };

  const loadLogs = async () => {
    try {
      console.log('🔄 Loading logs with filters:', {
        appFilter,
        eventFilter,
        timeFilter,
        currentPage
      });
      
      // First, get total count for pagination
      let countQuery = supabase
        .from('auth_logs')
        .select('*', { count: 'exact', head: true });

      if (appFilter !== 'all') {
        countQuery = countQuery.eq('application_id', appFilter);
      }

      if (eventFilter !== 'all') {
        countQuery = countQuery.eq('event_type', eventFilter);
      }

      if (timeFilter !== 'all') {
        const now = new Date();
        let startDate = new Date();

        switch (timeFilter) {
          case '1h':
            startDate.setHours(now.getHours() - 1);
            break;
          case '24h':
            startDate.setHours(now.getHours() - 24);
            break;
          case '7d':
            startDate.setDate(now.getDate() - 7);
            break;
          case '30d':
            startDate.setDate(now.getDate() - 30);
            break;
        }

        countQuery = countQuery.gte('created_at', startDate.toISOString());
      }

      const { count } = await countQuery;
      const totalCount = count || 0;
      console.log('📊 Total logs count:', totalCount);
      setTotalPages(Math.ceil(totalCount / logsPerPage));

      // Now get the actual data with pagination
      const from = (currentPage - 1) * logsPerPage;
      const to = from + logsPerPage - 1;

      let query = supabase
        .from('auth_logs')
        .select(`
          *,
          application:applications(name, application_id, domain),
          app_user:app_users(name, email)
        `)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (appFilter !== 'all') {
        query = query.eq('application_id', appFilter);
      }

      if (eventFilter !== 'all') {
        query = query.eq('event_type', eventFilter);
      }

      if (timeFilter !== 'all') {
        const now = new Date();
        let startDate = new Date();

        switch (timeFilter) {
          case '1h':
            startDate.setHours(now.getHours() - 1);
            break;
          case '24h':
            startDate.setHours(now.getHours() - 24);
            break;
          case '7d':
            startDate.setDate(now.getDate() - 7);
            break;
          case '30d':
            startDate.setDate(now.getDate() - 30);
            break;
        }

        query = query.gte('created_at', startDate.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;
      
      console.log('📥 Raw logs data:', {
        count: data?.length || 0,
        sample: data?.slice(0, 3).map(log => ({
          id: log.id,
          event_type: log.event_type,
          success: log.success,
          error_message: log.error_message,
          created_at: log.created_at
        }))
      });

      const filteredData = searchQuery
        ? data?.filter(log =>
            log.ip_address?.includes(searchQuery) ||
            log.app_user?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            log.metadata?.email?.toLowerCase().includes(searchQuery.toLowerCase())
          )
        : data;

      // Agrupar intentos fallidos por IP, email, aplicación y usuario
      const groupedData = groupFailedAttempts(filteredData || []);
      
      console.log('📊 Processed logs:', {
        original: data?.length || 0,
        filtered: filteredData?.length || 0,
        grouped: groupedData.length,
        failed_logs: groupedData.filter(log => !log.success).length
      });

      setLogs(groupedData);

      // Get stats for ALL data (not just current page)
      let statsQuery = supabase
        .from('auth_logs')
        .select('success, app_user_id, ip_address, event_type, error_message');

      if (appFilter !== 'all') {
        statsQuery = statsQuery.eq('application_id', appFilter);
      }

      if (eventFilter !== 'all') {
        statsQuery = statsQuery.eq('event_type', eventFilter);
      }

      if (timeFilter !== 'all') {
        const now = new Date();
        let startDate = new Date();

        switch (timeFilter) {
          case '1h':
            startDate.setHours(now.getHours() - 1);
            break;
          case '24h':
            startDate.setHours(now.getHours() - 24);
            break;
          case '7d':
            startDate.setDate(now.getDate() - 7);
            break;
          case '30d':
            startDate.setDate(now.getDate() - 30);
            break;
        }

        statsQuery = statsQuery.gte('created_at', startDate.toISOString());
      }

      const { data: statsData } = await statsQuery;

      if (statsData) {
        const uniqueUsers = new Set(statsData.map(l => l.app_user_id).filter(Boolean));
        const uniqueIPs = new Set(statsData.map(l => l.ip_address));
        const successfulLogs = statsData.filter(l => l.success);
        const failedLogs = statsData.filter(l => !l.success);

        console.log('📊 Stats calculated:', {
          total: totalCount,
          successful: successfulLogs.length,
          failed: failedLogs.length,
          uniqueUsers: uniqueUsers.size,
          uniqueIPs: uniqueIPs.size,
          failedEvents: failedLogs.map(log => ({
            event_type: log.event_type,
            error_message: log.error_message
          }))
        });
        
        setStats({
          total: totalCount,
          successful: successfulLogs.length,
          failed: failedLogs.length,
          uniqueUsers: uniqueUsers.size,
          uniqueIPs: uniqueIPs.size
        });
      }
    } catch (error: any) {
      console.error('Error loading logs:', error);
      showError('Error', 'Error al cargar los logs');
    } finally {
      setLoading(false);
    }
  };

  const loadBlockedIPs = async () => {
    try {
      const { data, error } = await supabase
        .from('blocked_ips')
        .select(`
          *,
          application:applications(name)
        `)
        .eq('is_active', true)
        .order('blocked_at', { ascending: false });

      if (error) throw error;
      setBlockedIPs(data || []);
    } catch (error: any) {
      console.error('Error loading blocked IPs:', error);
    }
  };

  const openBlockIPModal = (ipAddress: string, logId?: string) => {
    setIpToBlock({ ip: ipAddress, logId });
    setBlockIPReason('');
    setShowBlockIPModal(true);
  };

  const handleBlockIP = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!ipToBlock || !blockIPReason.trim()) {
      showError('Error', 'Por favor ingresa una razón para el bloqueo');
      return;
    }

    if (!user?.id) {
      showError('Error', 'Usuario no autenticado');
      return;
    }

    setIsBlocking(true);

    try {
      console.log('🚫 Blocking IP:', ipToBlock.ip, 'Reason:', blockIPReason);

      // Primero verificar si la IP ya está bloqueada y activa
      const { data: existingBlock, error: checkError } = await supabase
        .from('blocked_ips')
        .select('id, is_active')
        .eq('ip_address', ipToBlock.ip)
        .eq('is_active', true)
        .maybeSingle();

      if (checkError) {
        console.error('Error verificando IP:', checkError);
        throw checkError;
      }

      if (existingBlock) {
        // La IP ya está bloqueada, actualizar la razón
        console.log('IP ya bloqueada, actualizando razón...');
        const { error: updateError } = await supabase
          .from('blocked_ips')
          .update({
            reason: blockIPReason.trim(),
            blocked_by: user.id,
            blocked_at: new Date().toISOString()
          })
          .eq('id', existingBlock.id);

        if (updateError) {
          console.error('Error actualizando bloqueo:', updateError);
          throw updateError;
        }

        showSuccess('Éxito', `IP ${ipToBlock.ip} ya estaba bloqueada. Razón actualizada.`);
      } else {
        // La IP no está bloqueada, crear nuevo bloqueo
        const insertData: any = {
          ip_address: ipToBlock.ip,
          reason: blockIPReason.trim(),
          blocked_by: user.id,
          is_active: true
        };

        console.log('Bloqueando IP con datos:', insertData);

        const { data, error } = await supabase
          .from('blocked_ips')
          .insert(insertData)
          .select();

        if (error) {
          console.error('Error de Supabase:', error);
          throw error;
        }

        console.log('IP bloqueada exitosamente:', data);
        showSuccess('Éxito', `IP ${ipToBlock.ip} bloqueada exitosamente`);
      }

      await loadBlockedIPs();
      setShowBlockIPModal(false);
      setIpToBlock(null);
      setBlockIPReason('');
      setSelectedLog(null);
    } catch (error: any) {
      console.error('Error blocking IP:', error);

      // Manejar error de IP duplicada de manera amigable
      if (error.code === '23505') {
        showError('Error', 'Esta IP ya está bloqueada. Por favor refresca la página.');
      } else {
        showError('Error', 'Error al bloquear IP: ' + error.message);
      }
    } finally {
      setIsBlocking(false);
    }
  };

  const unblockIP = async (id: string, ipAddress: string) => {
    try {
      const { error } = await supabase
        .from('blocked_ips')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;

      showSuccess('Éxito', `IP ${ipAddress} desbloqueada exitosamente`);
      loadBlockedIPs();
    } catch (error: any) {
      console.error('Error unblocking IP:', error);
      showError('Error', 'Error al desbloquear IP: ' + error.message);
    }
  };

  const exportLogs = () => {
    const csv = [
      ['Fecha', 'Evento', 'Usuario', 'Email', 'IP', 'Estado', 'Error', 'Aplicación'].join(','),
      ...logs.map(log => [
        new Date(log.created_at).toLocaleString(),
        log.event_type,
        log.app_user?.name || 'Anónimo',
        log.app_user?.email || log.metadata?.email || '-',
        log.ip_address,
        log.success ? 'Exitoso' : 'Fallido',
        log.error_message || '-',
        log.application?.name || '-'
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs_${new Date().toISOString()}.csv`;
    a.click();
  };

  const getEventIcon = (eventType: string, success: boolean) => {
    if (success) {
      return <CheckCircle className="w-5 h-5 text-green-600" />;
    }
    return <XCircle className="w-5 h-5 text-red-600" />;
  };

  const getEventLabel = (eventType: string) => {
    const labels: Record<string, string> = {
      login: 'Login',
      register: 'Registro',
      password_reset: 'Reset Contraseña',
      failed_login: 'Error de Autenticación'
    };
    return labels[eventType] || eventType;
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Hace menos de 1 min';
    if (minutes < 60) return `Hace ${minutes} min`;
    if (hours < 24) return `Hace ${hours} h`;
    return `Hace ${days} días`;
  };

  const isIPBlocked = (ipAddress: string) => {
    return blockedIPs.some(blocked => blocked.ip_address === ipAddress);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Activity className="w-5 h-5 sm:w-6 sm:h-6" />
            Logs de Actividad
          </h1>
          <p className="text-xs sm:text-sm text-gray-600 mt-1">Monitorea eventos de autenticación en tiempo real</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <label className="flex items-center gap-2 text-xs sm:text-sm text-gray-600">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-gray-300"
            />
            Auto-refresh
          </label>
          <button
            onClick={loadLogs}
            className="px-3 py-2 sm:px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="hidden sm:inline">Actualizar</span>
          </button>
          <button
            onClick={exportLogs}
            className="px-3 py-2 sm:px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 text-sm"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Exportar</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        <div className="bg-white p-3 sm:p-4 rounded-lg border border-gray-200">
          <div className="flex items-center gap-2 sm:gap-3">
            <Activity className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600" />
            <div>
              <p className="text-xs sm:text-sm text-gray-600">Total Eventos</p>
              <p className="text-lg sm:text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-8 h-8 text-green-600" />
            <div>
              <p className="text-sm text-gray-600">Exitosos</p>
              <p className="text-2xl font-bold text-gray-900">{stats.successful}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center gap-3">
            <XCircle className="w-8 h-8 text-red-600" />
            <div>
              <p className="text-sm text-gray-600">Fallidos</p>
              <p className="text-2xl font-bold text-gray-900">{stats.failed}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center gap-3">
            <Users className="w-8 h-8 text-purple-600" />
            <div>
              <p className="text-sm text-gray-600">Usuarios</p>
              <p className="text-2xl font-bold text-gray-900">{stats.uniqueUsers}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center gap-3">
            <Globe className="w-8 h-8 text-cyan-600" />
            <div>
              <p className="text-sm text-gray-600">IPs Únicas</p>
              <p className="text-2xl font-bold text-gray-900">{stats.uniqueIPs}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-3 sm:p-4 rounded-lg border border-gray-200 space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4">
          <select
            value={appFilter}
            onChange={(e) => setAppFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="all">Todas las aplicaciones</option>
            {applications.map(app => (
              <option key={app.id} value={app.id}>{app.name}</option>
            ))}
          </select>

          <select
            value={eventFilter}
            onChange={(e) => setEventFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="all">Todos los eventos</option>
            <option value="login">Login</option>
            <option value="failed_login">Errores de Autenticación</option>
            <option value="register">Registro</option>
            <option value="password_reset">Reset Contraseña</option>
          </select>

          <select
            value={timeFilter}
            onChange={(e) => setTimeFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="1h">Última hora</option>
            <option value="24h">Últimas 24 horas</option>
            <option value="7d">Últimos 7 días</option>
            <option value="30d">Últimos 30 días</option>
            <option value="all">Todo</option>
          </select>

          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 sm:pl-10 pr-3 sm:pr-4 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>

          <button
            onClick={() => setShowBlockedIPs(!showBlockedIPs)}
            className={`px-3 py-2 sm:px-4 rounded-lg flex items-center gap-2 text-sm whitespace-nowrap ${
              showBlockedIPs
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span className="hidden sm:inline">IPs Bloqueadas ({blockedIPs.length})</span>
            <span className="sm:hidden">({blockedIPs.length})</span>
          </button>
        </div>
      </div>

      {showBlockedIPs && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-red-900 mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5" />
            IPs Bloqueadas
          </h3>
          {blockedIPs.length === 0 ? (
            <p className="text-gray-600">No hay IPs bloqueadas actualmente</p>
          ) : (
            <div className="space-y-2">
              {blockedIPs.map(blocked => (
                <div key={blocked.id} className="bg-white p-3 rounded-lg border border-red-200 flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-mono text-sm font-semibold text-gray-900">{blocked.ip_address}</p>
                    <p className="text-xs text-gray-600">{blocked.reason}</p>
                    <p className="text-xs text-gray-500">
                      Bloqueada: {new Date(blocked.blocked_at).toLocaleString()}
                      {blocked.application && ` • App: ${blocked.application.name}`}
                    </p>
                  </div>
                  <button
                    onClick={() => unblockIP(blocked.id, blocked.ip_address)}
                    className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm flex items-center gap-1"
                  >
                    <ShieldOff className="w-4 h-4" />
                    Desbloquear
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Evento</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Usuario</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">IP Address</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Aplicación</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Timestamp</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {logs.map(log => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {getEventIcon(log.event_type, log.success)}
                      <span className="text-sm font-medium text-gray-900">
                        {getEventLabel(log.event_type)}
                      </span>
                      {log.failed_attempts && log.failed_attempts > 1 && (
                        <span className="px-2 py-0.5 bg-red-100 text-red-800 text-xs font-semibold rounded-full">
                          {log.failed_attempts} intentos
                        </span>
                      )}
                    </div>
                    {log.error_message && (
                      <p className="text-xs text-red-600 mt-1">{log.error_message}</p>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {log.app_user?.name || 'Anónimo'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {log.app_user?.email || log.metadata?.email || '-'}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono text-gray-900">{log.ip_address}</span>
                      {isIPBlocked(log.ip_address) && (
                        <Shield className="w-4 h-4 text-red-600" title="IP Bloqueada" />
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {log.application?.name || '-'}
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">
                      {new Date(log.created_at).toLocaleDateString()} {new Date(log.created_at).toLocaleTimeString()}
                    </div>
                    <div className="text-xs text-gray-500">{formatTimestamp(log.created_at)}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      log.success
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {log.success ? 'Exitoso' : 'Fallido'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => setSelectedLog(log)}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      Ver detalles
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between bg-gray-50">
            <div className="text-sm text-gray-600">
              Mostrando página {currentPage} de {totalPages}
              <span className="ml-2 text-gray-500">
                ({(currentPage - 1) * logsPerPage + 1} - {Math.min(currentPage * logsPerPage, stats.total)} de {stats.total} registros)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                Primera
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                Anterior
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }

                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`px-3 py-2 border rounded-lg text-sm ${
                        currentPage === pageNum
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'border-gray-300 hover:bg-gray-100'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                Siguiente
              </button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                Última
              </button>
            </div>
          </div>
        )}
      </div>

      {showBlockIPModal && ipToBlock && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg max-w-md w-full shadow-2xl">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Bloquear Dirección IP</h3>
                <button
                  onClick={() => {
                    setShowBlockIPModal(false);
                    setIpToBlock(null);
                    setBlockIPReason('');
                  }}
                  className="text-gray-400 hover:text-gray-600"
                  type="button"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <form onSubmit={handleBlockIP}>
              <div className="p-6 space-y-4">
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-gray-700">
                    Estás a punto de bloquear la siguiente dirección IP:
                  </p>
                  <p className="text-lg font-mono font-bold text-red-900 mt-2">{ipToBlock.ip}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Razón del bloqueo: <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={blockIPReason}
                    onChange={(e) => setBlockIPReason(e.target.value)}
                    placeholder="Ej: Múltiples intentos fallidos de login"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    autoFocus
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Esta razón será visible en el panel de IPs bloqueadas
                  </p>
                </div>

                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-xs text-yellow-800">
                    <strong>Advertencia:</strong> Esta IP no podrá realizar login, registro o reset de contraseña hasta que sea desbloqueada.
                  </p>
                </div>
              </div>

              <div className="p-6 border-t border-gray-200 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowBlockIPModal(false);
                    setIpToBlock(null);
                    setBlockIPReason('');
                  }}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
                  disabled={isBlocking}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!blockIPReason.trim() || isBlocking}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isBlocking ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Bloqueando...
                    </>
                  ) : (
                    <>
                      <Shield className="w-4 h-4" />
                      Bloquear IP
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedLog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Detalles del Evento</h3>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm text-gray-600">Tipo de Evento</p>
                  <p className="text-lg font-semibold text-gray-900">{getEventLabel(selectedLog.event_type)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Estado</p>
                  <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${
                    selectedLog.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {selectedLog.success ? 'Exitoso' : 'Fallido'}
                  </span>
                </div>
              </div>

              {selectedLog.failed_attempts && selectedLog.failed_attempts > 1 && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-red-900">Múltiples Intentos Fallidos</p>
                    <span className="px-3 py-1 bg-red-600 text-white rounded-full text-sm font-bold">
                      {selectedLog.failed_attempts} intentos
                    </span>
                  </div>
                  <p className="text-xs text-red-700 mb-3">
                    Se detectaron {selectedLog.failed_attempts} intentos fallidos desde la misma IP y email en esta aplicación.
                  </p>

                  {selectedLog.grouped_logs && selectedLog.grouped_logs.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-red-900 mb-2">Historial de intentos:</p>
                      <div className="max-h-40 overflow-y-auto space-y-1">
                        {selectedLog.grouped_logs.map((attempt, index) => (
                          <div key={attempt.id} className="text-xs bg-white p-2 rounded border border-red-200">
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-gray-600">
                                #{selectedLog.grouped_logs!.length - index}
                              </span>
                              <span className="text-gray-700">
                                {new Date(attempt.created_at).toLocaleString()}
                              </span>
                            </div>
                            {attempt.error_message && (
                              <p className="text-red-600 mt-1 text-xs">{attempt.error_message}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {selectedLog.error_message && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm font-semibold text-red-900">Error</p>
                  <p className="text-sm text-red-700 mt-1">{selectedLog.error_message}</p>
                </div>
              )}

              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-3">Información del Usuario</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Nombre:</p>
                    <p className="text-sm font-medium text-gray-900">{selectedLog.app_user?.name || 'No disponible'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Email:</p>
                    <p className="text-sm font-medium text-gray-900">
                      {selectedLog.app_user?.email || selectedLog.metadata?.email || '-'}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-3">Información de la Aplicación</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Aplicación:</p>
                    <p className="text-sm font-medium text-gray-900">{selectedLog.application?.name || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Dominio:</p>
                    <p className="text-sm font-medium text-gray-900">{selectedLog.application?.domain || '-'}</p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-3">Información Técnica</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                    <div>
                      <p className="text-sm text-gray-600">IP Address:</p>
                      <p className="text-sm font-mono font-medium text-gray-900">{selectedLog.ip_address}</p>
                    </div>
                    {!selectedLog.success && !isIPBlocked(selectedLog.ip_address) && (
                      <button
                        onClick={() => openBlockIPModal(selectedLog.ip_address, selectedLog.id)}
                        className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm flex items-center gap-2"
                        type="button"
                      >
                        <Shield className="w-4 h-4" />
                        Bloquear IP
                      </button>
                    )}
                    {isIPBlocked(selectedLog.ip_address) && (
                      <span className="px-3 py-1 bg-red-100 text-red-800 rounded text-sm flex items-center gap-2">
                        <Shield className="w-4 h-4" />
                        IP Bloqueada
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Timestamp:</p>
                    <p className="text-sm font-medium text-gray-900">
                      {new Date(selectedLog.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">User Agent:</p>
                    <p className="text-sm font-mono text-gray-900">{selectedLog.user_agent}</p>
                  </div>
                </div>
              </div>

              {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">Metadata</h4>
                  <pre className="p-4 bg-gray-900 text-green-400 rounded-lg text-xs overflow-x-auto">
                    {JSON.stringify(selectedLog.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}