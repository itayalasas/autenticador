import { useEffect, useState } from 'react';
import { Activity, BarChart3, CheckCircle, CreditCard, Database, FileText, Layers3, RefreshCw, Server, Shield, UserPlus, Users, XCircle, Zap } from 'lucide-react';
import { supabase } from '../../lib/supabase';

type Period = 'day' | 'week' | 'month';
type EnvironmentKey = 'development' | 'testing' | 'production' | 'legacy';

type EnvironmentMetric = {
  key: EnvironmentKey;
  label: string;
  users: number;
  activeEnvironments: number;
  subscriptions: number;
  activeSubscriptions: number;
  trialingSubscriptions: number;
  attentionSubscriptions: number;
};

type ActivityMetric = { label: string; logins: number; registrations: number; errors: number };
type DashboardApplication = { id: string; created_at: string };
type DashboardUser = { id: string; status: string; created_at: string; metadata: Record<string, any> | null };
type DashboardLog = { created_at: string; event_type: string; success: boolean };
type DashboardSubscription = {
  id: string;
  status: string;
  created_at: string;
  metadata: Record<string, any> | null;
  application_billing_plans: { price: number | string | null; currency?: string | null } | Array<{ price: number | string | null; currency?: string | null }> | null;
};
type DashboardEnvironment = { name: string; is_active: boolean | null };

type DashboardData = {
  applications: number;
  activeUsers: number;
  successfulLogins: number;
  activeSubscriptions: number;
  trialingSubscriptions: number;
  attentionSubscriptions: number;
  monthlyRevenue: number;
  applicationsChange: number;
  usersChange: number;
  loginsChange: number;
  subscriptionsChange: number;
  environments: EnvironmentMetric[];
  activity: ActivityMetric[];
};

type SystemStatus = {
  api: 'online' | 'offline' | 'checking';
  database: 'connected' | 'disconnected' | 'checking';
  authentication: 'operational' | 'degraded' | 'checking';
  apiResponseTime?: number;
  databaseResponseTime?: number;
  successRate?: number;
};

const PERIOD_OPTIONS: Array<{ value: Period; label: string; hours: number }> = [
  { value: 'day', label: 'Hoy', hours: 24 },
  { value: 'week', label: 'Últimos 7 días', hours: 24 * 7 },
  { value: 'month', label: 'Últimos 30 días', hours: 24 * 30 },
];

const ENVIRONMENTS: Array<{ key: EnvironmentKey; label: string; color: string; barColor: string }> = [
  { key: 'development', label: 'Desarrollo', color: 'border-sky-200 bg-sky-50 text-sky-700', barColor: 'bg-sky-500' },
  { key: 'testing', label: 'Testing', color: 'border-amber-200 bg-amber-50 text-amber-700', barColor: 'bg-amber-500' },
  { key: 'production', label: 'Producción', color: 'border-emerald-200 bg-emerald-50 text-emerald-700', barColor: 'bg-emerald-500' },
  { key: 'legacy', label: 'Sin restricción', color: 'border-slate-200 bg-slate-50 text-slate-700', barColor: 'bg-slate-400' },
];

const createEmptyEnvironmentMetrics = (): EnvironmentMetric[] => ENVIRONMENTS.map((environment) => ({
  key: environment.key,
  label: environment.label,
  users: 0,
  activeEnvironments: 0,
  subscriptions: 0,
  activeSubscriptions: 0,
  trialingSubscriptions: 0,
  attentionSubscriptions: 0,
}));

const EMPTY_DATA: DashboardData = {
  applications: 0,
  activeUsers: 0,
  successfulLogins: 0,
  activeSubscriptions: 0,
  trialingSubscriptions: 0,
  attentionSubscriptions: 0,
  monthlyRevenue: 0,
  applicationsChange: 0,
  usersChange: 0,
  loginsChange: 0,
  subscriptionsChange: 0,
  environments: createEmptyEnvironmentMetrics(),
  activity: [],
};

function normalizeEnvironment(value: unknown): EnvironmentKey | null {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'development' || normalized === 'testing' || normalized === 'production' ? normalized : null;
}

function userEnvironments(metadata: Record<string, any> | null | undefined): EnvironmentKey[] {
  const allowed = metadata?.environment_access?.allowed_environments;
  if (!Array.isArray(allowed)) return ['legacy'];
  const result = Array.from(new Set(allowed.map(normalizeEnvironment).filter(Boolean))) as EnvironmentKey[];
  return result;
}

function recordEnvironment(metadata: Record<string, any> | null | undefined): EnvironmentKey {
  return normalizeEnvironment(metadata?.billing_environment || metadata?.environment || metadata?.requested_environment || metadata?.api_key_environment) || 'legacy';
}

function change(current: number, previous: number) {
  return previous === 0 ? (current === 0 ? 0 : 100) : Math.round(((current - previous) / previous) * 100);
}

function periodStart(period: Period) {
  const hours = PERIOD_OPTIONS.find((item) => item.value === period)!.hours;
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('es-UY', { style: 'currency', currency: 'UYU', maximumFractionDigits: 0 }).format(value);
}

function buildActivity(logs: Array<{ created_at: string; event_type: string; success: boolean }>, start: Date, period: Period): ActivityMetric[] {
  const bucketCount = period === 'day' ? 6 : period === 'week' ? 7 : 6;
  const bucketMilliseconds = period === 'day' ? 4 * 60 * 60 * 1000 : period === 'week' ? 24 * 60 * 60 * 1000 : 5 * 24 * 60 * 60 * 1000;
  const buckets = Array.from({ length: bucketCount }, (_, index) => {
    const bucketStart = new Date(start.getTime() + index * bucketMilliseconds);
    return {
      bucketStart,
      bucketEnd: new Date(bucketStart.getTime() + bucketMilliseconds),
      label: period === 'day'
        ? bucketStart.toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit' })
        : bucketStart.toLocaleDateString('es-UY', { day: '2-digit', month: 'short' }),
      logins: 0,
      registrations: 0,
      errors: 0,
    };
  });

  logs.filter((log) => new Date(log.created_at) >= start).forEach((log) => {
    const date = new Date(log.created_at);
    const bucket = buckets.find((item) => date >= item.bucketStart && date < item.bucketEnd);
    if (!bucket) return;
    if (!log.success) bucket.errors += 1;
    else if (log.event_type === 'login') bucket.logins += 1;
    else if (log.event_type === 'register') bucket.registrations += 1;
  });

  return buckets.map(({ label, logins, registrations, errors }) => ({ label, logins, registrations, errors }));
}

export default function DashboardOverview() {
  const [period, setPeriod] = useState<Period>('week');
  const [data, setData] = useState<DashboardData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [systemStatus, setSystemStatus] = useState<SystemStatus>({ api: 'checking', database: 'checking', authentication: 'checking' });

  useEffect(() => { void loadDashboardData(); }, [period]);
  useEffect(() => {
    void checkSystemStatus();
    const interval = window.setInterval(() => void checkSystemStatus(), 30000);
    return () => window.clearInterval(interval);
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const currentStart = periodStart(period);
      const previousStart = new Date(currentStart.getTime() - (Date.now() - currentStart.getTime()));
      const [applicationsResult, usersResult, logsResult, subscriptionsResult, environmentsResult] = await Promise.all([
        supabase.from('applications').select('id, created_at').eq('status', 'active'),
        supabase.from('app_users').select('id, status, created_at, metadata'),
        supabase.from('auth_logs').select('created_at, event_type, success').gte('created_at', previousStart.toISOString()).order('created_at', { ascending: true }),
        supabase.from('application_plan_subscriptions').select('id, status, created_at, metadata, application_billing_plans(price, currency)'),
        supabase.from('environments').select('name, is_active'),
      ]);
      const error = [applicationsResult, usersResult, logsResult, subscriptionsResult, environmentsResult].map((result) => result.error).find(Boolean);
      if (error) throw error;

      const applications = (applicationsResult.data || []) as DashboardApplication[];
      const users = (usersResult.data || []) as DashboardUser[];
      const logs = (logsResult.data || []) as DashboardLog[];
      const subscriptions = (subscriptionsResult.data || []) as DashboardSubscription[];
      const configuredEnvironments = (environmentsResult.data || []) as DashboardEnvironment[];
      const environmentMap = new Map<EnvironmentKey, EnvironmentMetric>(createEmptyEnvironmentMetrics().map((metric) => [metric.key, metric]));

      users.filter((user) => user.status === 'active').forEach((user) => {
        userEnvironments(user.metadata).forEach((key) => { const metric = environmentMap.get(key); if (metric) metric.users += 1; });
      });
      configuredEnvironments.forEach((environment) => {
        const metric = environmentMap.get(normalizeEnvironment(environment.name) || 'legacy');
        if (metric && environment.is_active !== false) metric.activeEnvironments += 1;
      });
      subscriptions.forEach((subscription) => {
        const metric = environmentMap.get(recordEnvironment(subscription.metadata))!;
        metric.subscriptions += 1;
        if (['active', 'authorized'].includes(subscription.status)) metric.activeSubscriptions += 1;
        if (subscription.status === 'trialing') metric.trialingSubscriptions += 1;
        if (['pending', 'payment_failed', 'paused'].includes(subscription.status)) metric.attentionSubscriptions += 1;
      });

      const currentLogs = logs.filter((log) => new Date(log.created_at) >= currentStart);
      const previousLogs = logs.filter((log) => new Date(log.created_at) < currentStart);
      const currentLogins = currentLogs.filter((log) => log.event_type === 'login' && log.success).length;
      const previousLogins = previousLogs.filter((log) => log.event_type === 'login' && log.success).length;
      const createdInCurrentPeriod = (items: Array<{ created_at: string }>) => items.filter((item) => new Date(item.created_at) >= currentStart).length;
      const createdInPreviousPeriod = (items: Array<{ created_at: string }>) => items.filter((item) => new Date(item.created_at) >= previousStart && new Date(item.created_at) < currentStart).length;
      const activeSubscriptions = subscriptions.filter((subscription) => ['active', 'authorized'].includes(subscription.status));
      const monthlyRevenue = activeSubscriptions.reduce((total, subscription) => {
        const plan = Array.isArray(subscription.application_billing_plans) ? subscription.application_billing_plans[0] : subscription.application_billing_plans;
        return total + Number(plan?.price || 0);
      }, 0);

      setData({
        applications: applications.length,
        activeUsers: users.filter((user) => user.status === 'active').length,
        successfulLogins: currentLogins,
        activeSubscriptions: activeSubscriptions.length,
        trialingSubscriptions: subscriptions.filter((subscription) => subscription.status === 'trialing').length,
        attentionSubscriptions: subscriptions.filter((subscription) => ['pending', 'payment_failed', 'paused'].includes(subscription.status)).length,
        monthlyRevenue,
        applicationsChange: change(createdInCurrentPeriod(applications), createdInPreviousPeriod(applications)),
        usersChange: change(createdInCurrentPeriod(users), createdInPreviousPeriod(users)),
        loginsChange: change(currentLogins, previousLogins),
        subscriptionsChange: change(createdInCurrentPeriod(subscriptions), createdInPreviousPeriod(subscriptions)),
        environments: ENVIRONMENTS.map((environment) => environmentMap.get(environment.key)!),
        activity: buildActivity(logs, currentStart, period),
      });
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkSystemStatus = async () => {
    setSystemStatus((current) => ({ ...current, api: 'checking', database: 'checking', authentication: 'checking' }));
    const apiStartedAt = Date.now();
    try {
      const response = await fetch('/.netlify/functions/health', { signal: AbortSignal.timeout(5000) });
      const apiResponseTime = Date.now() - apiStartedAt;
      const databaseStartedAt = Date.now();
      const { error: databaseError } = await supabase.from('applications').select('id').limit(1);
      const { data: recentLogData, error: logsError } = await supabase.from('auth_logs').select('success').gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString());
      const logs = (recentLogData || []) as Array<{ success: boolean }>;
      const total = logs.length;
      const successRate = total ? (logs.filter((log) => log.success).length / total) * 100 : 100;
      setSystemStatus({
        api: response.ok ? 'online' : 'offline',
        database: databaseError ? 'disconnected' : 'connected',
        authentication: logsError || successRate < 95 ? 'degraded' : 'operational',
        apiResponseTime,
        databaseResponseTime: Date.now() - databaseStartedAt,
        successRate,
      });
    } catch {
      setSystemStatus((current) => ({ ...current, api: 'offline', database: 'disconnected', authentication: 'degraded' }));
    }
  };

  const navigate = (section: string) => window.dispatchEvent(new CustomEvent('changeSectionWithApp', { detail: { section } }));
  const periodLabel = PERIOD_OPTIONS.find((item) => item.value === period)!.label.toLowerCase();
  const maxUsers = Math.max(...data.environments.map((metric) => metric.users), 1);
  const maxActivity = Math.max(...data.activity.map((metric) => metric.logins + metric.registrations + metric.errors), 1);
  const cards = [
    { label: 'Aplicaciones activas', value: data.applications, delta: data.applicationsChange, icon: Zap, color: 'bg-blue-50 text-blue-600' },
    { label: 'Usuarios activos', value: data.activeUsers, delta: data.usersChange, icon: Users, color: 'bg-violet-50 text-violet-600' },
    { label: `Logins ${periodLabel}`, value: data.successfulLogins, delta: data.loginsChange, icon: Shield, color: 'bg-emerald-50 text-emerald-600' },
    { label: 'Suscripciones activas', value: data.activeSubscriptions, delta: data.subscriptionsChange, icon: CreditCard, color: 'bg-cyan-50 text-cyan-600' },
  ];

  if (loading) return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" /></div>;

  return <div className="space-y-6">
    <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-slate-950 via-blue-950 to-cyan-900 p-6 text-white shadow-sm">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><div className="mb-3 inline-flex rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-xs font-semibold tracking-[0.18em] text-cyan-100">PULSO DE AUTHSYSTEM</div><h1 className="text-3xl font-bold tracking-tight">Estado operativo y comercial</h1><p className="mt-2 max-w-2xl text-sm text-slate-300">Seguimiento de accesos, ambientes y suscripciones para todas tus aplicaciones.</p></div><div className="flex flex-wrap items-center gap-2"><div className="inline-flex rounded-lg bg-white/10 p-1">{PERIOD_OPTIONS.map((option) => <button key={option.value} onClick={() => setPeriod(option.value)} className={`rounded-md px-3 py-2 text-sm font-medium transition ${period === option.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-200 hover:bg-white/10'}`}>{option.label}</button>)}</div><button onClick={() => void loadDashboardData()} className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm font-medium hover:bg-white/20"><RefreshCw className="h-4 w-4" />Actualizar</button></div></div>
    </section>

    <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">{cards.map((card) => { const Icon = card.icon; return <div key={card.label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between"><div><p className="text-sm font-medium text-slate-500">{card.label}</p><p className="mt-2 text-3xl font-bold text-slate-900">{card.value.toLocaleString()}</p><p className={`mt-2 text-xs font-semibold ${card.delta >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{card.delta >= 0 ? '+' : ''}{card.delta}% <span className="font-normal text-slate-400">vs. período anterior</span></p></div><div className={`rounded-xl p-3 ${card.color}`}><Icon className="h-6 w-6" /></div></div></div>; })}</section>

    <section className="grid grid-cols-1 gap-6 xl:grid-cols-3"><div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm xl:col-span-2"><div className="flex items-start justify-between"><div><h2 className="text-lg font-semibold text-slate-900">Usuarios con acceso por ambiente</h2><p className="mt-1 text-sm text-slate-500">Un usuario se contabiliza en cada ambiente donde tiene acceso.</p></div><Layers3 className="h-5 w-5 text-slate-400" /></div><div className="mt-6 space-y-5">{data.environments.map((metric) => { const style = ENVIRONMENTS.find((item) => item.key === metric.key)!; return <div key={metric.key}><div className="mb-2 flex items-center justify-between"><span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${style.color}`}>{metric.label}</span><span className="text-sm font-semibold text-slate-800">{metric.users} usuarios</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${style.barColor}`} style={{ width: `${(metric.users / maxUsers) * 100}%` }} /></div><p className="mt-1 text-xs text-slate-500">{metric.activeEnvironments} ambiente{metric.activeEnvironments === 1 ? '' : 's'} activo{metric.activeEnvironments === 1 ? '' : 's'} configurado{metric.activeEnvironments === 1 ? '' : 's'}</p></div>; })}</div></div><div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-start justify-between"><div><h2 className="text-lg font-semibold text-slate-900">Planes y suscripciones</h2><p className="mt-1 text-sm text-slate-500">Estado actual del catálogo comercial.</p></div><CreditCard className="h-5 w-5 text-cyan-600" /></div><div className="mt-6 rounded-xl bg-slate-950 p-4 text-white"><p className="text-xs font-medium uppercase tracking-wider text-slate-400">Facturación mensual estimada</p><p className="mt-1 text-2xl font-bold">{formatMoney(data.monthlyRevenue)}</p><p className="mt-1 text-xs text-slate-400">Calculada sobre planes activos/autorizados.</p></div><div className="mt-4 grid grid-cols-3 gap-2 text-center"><MetricTile value={data.activeSubscriptions} label="Activas" color="emerald" /><MetricTile value={data.trialingSubscriptions} label="Trial" color="sky" /><MetricTile value={data.attentionSubscriptions} label="Atención" color="amber" /></div></div></section>

    <section className="grid grid-cols-1 gap-6 xl:grid-cols-2"><div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-center justify-between"><div><h2 className="text-lg font-semibold text-slate-900">Actividad de autenticación</h2><p className="mt-1 text-sm text-slate-500">Logins, registros y errores durante {periodLabel}.</p></div><button onClick={() => navigate('logs')} className="text-sm font-semibold text-blue-600 hover:text-blue-700">Ver logs</button></div><div className="mt-6 space-y-4">{data.activity.map((metric) => { const total = metric.logins + metric.registrations + metric.errors; return <div key={metric.label}><div className="mb-1 flex items-center justify-between text-xs text-slate-500"><span>{metric.label}</span><span>{total} eventos</span></div><div className="flex h-3 overflow-hidden rounded-full bg-slate-100"><div className="bg-emerald-500" style={{ width: `${(metric.logins / maxActivity) * 100}%` }} /><div className="bg-blue-500" style={{ width: `${(metric.registrations / maxActivity) * 100}%` }} /><div className="bg-rose-500" style={{ width: `${(metric.errors / maxActivity) * 100}%` }} /></div><div className="mt-1 flex gap-3 text-xs"><span className="text-emerald-700">{metric.logins} logins</span><span className="text-blue-700">{metric.registrations} registros</span><span className="text-rose-700">{metric.errors} errores</span></div></div>; })}</div></div><div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-start justify-between"><div><h2 className="text-lg font-semibold text-slate-900">Suscripciones por ambiente</h2><p className="mt-1 text-sm text-slate-500">Las suscripciones sin metadata de ambiente se conservan como sin restricción.</p></div><BarChart3 className="h-5 w-5 text-slate-400" /></div><div className="mt-6 space-y-3">{data.environments.map((metric) => { const style = ENVIRONMENTS.find((item) => item.key === metric.key)!; return <div key={metric.key} className="rounded-lg border border-slate-100 p-3"><div className="flex items-center justify-between"><span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${style.color}`}>{metric.label}</span><span className="text-sm font-bold text-slate-800">{metric.subscriptions} total</span></div><div className="mt-3 grid grid-cols-3 gap-2 text-xs"><span className="rounded bg-emerald-50 px-2 py-1.5 text-center text-emerald-700">{metric.activeSubscriptions} activas</span><span className="rounded bg-sky-50 px-2 py-1.5 text-center text-sky-700">{metric.trialingSubscriptions} trial</span><span className="rounded bg-amber-50 px-2 py-1.5 text-center text-amber-700">{metric.attentionSubscriptions} atención</span></div></div>; })}</div></div></section>

    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-center justify-between"><div><h2 className="text-lg font-semibold text-slate-900">Salud del sistema</h2><p className="mt-1 text-sm text-slate-500">Verificación automática cada 30 segundos.</p></div><button onClick={() => void checkSystemStatus()} className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700"><RefreshCw className="h-4 w-4" />Actualizar</button></div><div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3"><HealthCard label="API REST" icon={Server} status={systemStatus.api} detail={systemStatus.apiResponseTime ? `${systemStatus.apiResponseTime} ms` : 'Sin respuesta'} /><HealthCard label="Base de datos" icon={Database} status={systemStatus.database} detail={systemStatus.databaseResponseTime ? `${systemStatus.databaseResponseTime} ms` : 'Sin respuesta'} /><HealthCard label="Autenticación" icon={Shield} status={systemStatus.authentication} detail={systemStatus.successRate !== undefined ? `${systemStatus.successRate.toFixed(1)}% éxito (1 h)` : 'Sin datos'} /></div></section>

    <section className="grid grid-cols-1 gap-3 md:grid-cols-3"><QuickAction icon={Zap} title="Nueva aplicación" description="Configura una aplicación y sus ambientes." onClick={() => navigate('applications')} /><QuickAction icon={UserPlus} title="Gestionar usuarios" description="Revisa accesos, roles y ambientes." onClick={() => navigate('users')} /><QuickAction icon={FileText} title="Documentación" description="Consulta los flujos y APIs disponibles." onClick={() => navigate('documentation')} /></section>
  </div>;
}

function MetricTile({ value, label, color }: { value: number; label: string; color: 'emerald' | 'sky' | 'amber' }) {
  const classes = color === 'emerald' ? 'bg-emerald-50 text-emerald-700' : color === 'sky' ? 'bg-sky-50 text-sky-700' : 'bg-amber-50 text-amber-700';
  return <div className={`rounded-lg p-3 ${classes}`}><p className="text-xl font-bold">{value}</p><p className="text-xs">{label}</p></div>;
}

function HealthCard({ label, icon: Icon, status, detail }: { label: string; icon: typeof Server; status: string; detail: string }) {
  const healthy = ['online', 'connected', 'operational'].includes(status);
  const checking = status === 'checking';
  const classes = healthy ? 'border-emerald-200 bg-emerald-50' : checking ? 'border-blue-200 bg-blue-50' : 'border-rose-200 bg-rose-50';
  const iconClass = healthy ? 'text-emerald-600' : checking ? 'text-blue-600' : 'text-rose-600';
  return <div className={`rounded-xl border p-4 ${classes}`}><div className="flex items-center justify-between"><div className="flex items-center gap-2"><Icon className={`h-5 w-5 ${iconClass}`} /><span className="font-semibold text-slate-900">{label}</span></div>{healthy ? <CheckCircle className="h-5 w-5 text-emerald-600" /> : checking ? <Activity className="h-5 w-5 animate-pulse text-blue-600" /> : <XCircle className="h-5 w-5 text-rose-600" />}</div><p className="mt-2 text-sm capitalize text-slate-600">{status}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></div>;
}

function QuickAction({ icon: Icon, title, description, onClick }: { icon: typeof Zap; title: string; description: string; onClick: () => void }) {
  return <button onClick={onClick} className="group flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"><span className="rounded-xl bg-blue-50 p-3 text-blue-600 transition group-hover:bg-blue-600 group-hover:text-white"><Icon className="h-5 w-5" /></span><span><span className="block font-semibold text-slate-900">{title}</span><span className="mt-0.5 block text-sm text-slate-500">{description}</span></span></button>;
}
