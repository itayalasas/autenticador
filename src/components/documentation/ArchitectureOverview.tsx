function GeneralArchitectureDiagram() {
  return (
    <div className="overflow-x-auto">
      <svg viewBox="0 0 1220 500" className="w-full h-auto min-w-[1100px]">
        <defs>
          <marker
            id="arrow-general"
            markerWidth="10"
            markerHeight="10"
            refX="8"
            refY="3"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="M0,0 L0,6 L9,3 z" fill="#64748b" />
          </marker>
        </defs>

        <rect x="18" y="18" width="1184" height="464" rx="24" fill="#f8fafc" stroke="#e2e8f0" />

        <rect x="70" y="70" width="200" height="84" rx="16" fill="#eff6ff" stroke="#60a5fa" />
        <text x="170" y="102" textAnchor="middle" fontSize="18" fontWeight="700" fill="#0f172a">Aplicaciones</text>
        <text x="170" y="122" textAnchor="middle" fontSize="13" fill="#475569">cliente</text>
        <text x="170" y="140" textAnchor="middle" fontSize="12" fill="#64748b">web / mobile / backend</text>

        <rect x="330" y="70" width="190" height="84" rx="16" fill="#ecfccb" stroke="#84cc16" />
        <text x="425" y="102" textAnchor="middle" fontSize="18" fontWeight="700" fill="#0f172a">Web publica</text>
        <text x="425" y="122" textAnchor="middle" fontSize="13" fill="#475569">login / register / reset</text>
        <text x="425" y="140" textAnchor="middle" fontSize="12" fill="#64748b">redirect_uri (callback_url alias)</text>

        <rect x="610" y="70" width="180" height="84" rx="16" fill="#fef3c7" stroke="#f59e0b" />
        <text x="700" y="102" textAnchor="middle" fontSize="18" fontWeight="700" fill="#0f172a">Integraciones</text>
        <text x="700" y="122" textAnchor="middle" fontSize="13" fill="#475569">GitHub / Email / DLocal</text>
        <text x="700" y="140" textAnchor="middle" fontSize="12" fill="#64748b">Netlify / deploy / webhooks</text>

        <rect x="870" y="70" width="240" height="84" rx="16" fill="#fce7f3" stroke="#db2777" />
        <text x="990" y="102" textAnchor="middle" fontSize="18" fontWeight="700" fill="#0f172a">App movil</text>
        <text x="990" y="122" textAnchor="middle" fontSize="13" fill="#475569">Authenticator / MFA</text>
        <text x="990" y="140" textAnchor="middle" fontSize="12" fill="#64748b">pairing / approve / biometrics</text>

        <rect x="70" y="240" width="220" height="84" rx="16" fill="#fff7ed" stroke="#fb923c" />
        <text x="180" y="272" textAnchor="middle" fontSize="18" fontWeight="700" fill="#0f172a">Panel interno</text>
        <text x="180" y="292" textAnchor="middle" fontSize="13" fill="#475569">apps / users / roles</text>
        <text x="180" y="310" textAnchor="middle" fontSize="12" fill="#64748b">branding / environments</text>

        <rect x="430" y="208" width="360" height="100" rx="20" fill="#dbeafe" stroke="#3b82f6" />
        <text x="610" y="246" textAnchor="middle" fontSize="20" fontWeight="800" fill="#0f172a">Supabase + Edge Functions</text>
        <text x="610" y="270" textAnchor="middle" fontSize="13" fill="#475569">auth / mfa / tenants / invitations</text>
        <text x="610" y="288" textAnchor="middle" fontSize="12" fill="#64748b">API keys / logs / deployments / policies</text>

        <rect x="470" y="368" width="280" height="84" rx="16" fill="#cffafe" stroke="#06b6d4" />
        <text x="610" y="400" textAnchor="middle" fontSize="18" fontWeight="700" fill="#0f172a">DB / roles / logs</text>
        <text x="610" y="420" textAnchor="middle" fontSize="13" fill="#475569">users / permissions / tenants</text>
        <text x="610" y="438" textAnchor="middle" fontSize="12" fill="#64748b">auth_logs / mfa / branding</text>

        <line x1="270" y1="112" x2="330" y2="112" stroke="#64748b" strokeWidth="3" markerEnd="url(#arrow-general)" />
        <line x1="425" y1="154" x2="540" y2="208" stroke="#64748b" strokeWidth="3" markerEnd="url(#arrow-general)" />
        <line x1="610" y1="154" x2="610" y2="208" stroke="#64748b" strokeWidth="3" markerEnd="url(#arrow-general)" />
        <line x1="790" y1="112" x2="870" y2="112" stroke="#64748b" strokeWidth="3" markerEnd="url(#arrow-general)" />
        <line x1="990" y1="154" x2="790" y2="252" stroke="#64748b" strokeWidth="3" markerEnd="url(#arrow-general)" />
        <line x1="290" y1="282" x2="430" y2="256" stroke="#64748b" strokeWidth="3" markerEnd="url(#arrow-general)" />
        <line x1="610" y1="308" x2="610" y2="368" stroke="#64748b" strokeWidth="3" markerEnd="url(#arrow-general)" />

        <path d="M 80 175 C 140 205, 210 205, 260 175" fill="none" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="6 6" />
        <text x="170" y="196" textAnchor="middle" fontSize="11" fill="#94a3b8">entrada del usuario</text>
      </svg>
    </div>
  );
}

function AuthFlowDiagram() {
  return (
    <div className="overflow-x-auto">
      <svg viewBox="0 0 1220 310" className="w-full h-auto min-w-[1100px]">
        <defs>
          <marker
            id="arrow-flow"
            markerWidth="10"
            markerHeight="10"
            refX="8"
            refY="3"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="M0,0 L0,6 L9,3 z" fill="#64748b" />
          </marker>
        </defs>

        <rect x="18" y="18" width="1184" height="274" rx="24" fill="#fafafa" stroke="#e5e7eb" />

        <rect x="40" y="92" width="150" height="84" rx="16" fill="#eff6ff" stroke="#60a5fa" />
        <text x="115" y="124" textAnchor="middle" fontSize="18" fontWeight="700" fill="#0f172a">Cliente</text>
        <text x="115" y="144" textAnchor="middle" fontSize="12" fill="#64748b">redirige al sistema</text>

        <rect x="240" y="92" width="170" height="84" rx="16" fill="#ecfccb" stroke="#84cc16" />
        <text x="325" y="124" textAnchor="middle" fontSize="18" fontWeight="700" fill="#0f172a">Web publica</text>
        <text x="325" y="144" textAnchor="middle" fontSize="12" fill="#64748b">/:action?app_id=...</text>

        <rect x="450" y="92" width="170" height="84" rx="16" fill="#fef3c7" stroke="#f59e0b" />
        <text x="535" y="124" textAnchor="middle" fontSize="18" fontWeight="700" fill="#0f172a">auth-login</text>
        <text x="535" y="144" textAnchor="middle" fontSize="12" fill="#64748b">validate / issue tokens</text>

        <rect x="660" y="84" width="180" height="100" rx="18" fill="#fce7f3" stroke="#db2777" />
        <text x="750" y="120" textAnchor="middle" fontSize="18" fontWeight="700" fill="#0f172a">MFA / tokens</text>
        <text x="750" y="140" textAnchor="middle" fontSize="12" fill="#64748b">MFA_REQUIRED / setup</text>
        <text x="750" y="158" textAnchor="middle" fontSize="11" fill="#94a3b8">code o redirect_uri</text>

        <rect x="920" y="92" width="190" height="84" rx="16" fill="#dbeafe" stroke="#3b82f6" />
        <text x="1015" y="124" textAnchor="middle" fontSize="18" fontWeight="700" fill="#0f172a">redirect_uri</text>
        <text x="1015" y="144" textAnchor="middle" fontSize="12" fill="#64748b">session / success</text>

        <rect x="650" y="218" width="200" height="56" rx="14" fill="#cffafe" stroke="#06b6d4" />
        <text x="750" y="243" textAnchor="middle" fontSize="16" fontWeight="700" fill="#0f172a">App movil</text>
        <text x="750" y="260" textAnchor="middle" fontSize="11" fill="#64748b">pairing / approve / reject</text>

        <line x1="190" y1="134" x2="240" y2="134" stroke="#64748b" strokeWidth="3" markerEnd="url(#arrow-flow)" />
        <line x1="410" y1="134" x2="450" y2="134" stroke="#64748b" strokeWidth="3" markerEnd="url(#arrow-flow)" />
        <line x1="620" y1="134" x2="660" y2="134" stroke="#64748b" strokeWidth="3" markerEnd="url(#arrow-flow)" />
        <line x1="840" y1="134" x2="920" y2="134" stroke="#64748b" strokeWidth="3" markerEnd="url(#arrow-flow)" />
        <line x1="750" y1="184" x2="750" y2="218" stroke="#64748b" strokeWidth="3" markerEnd="url(#arrow-flow)" />
        <path d="M 750 218 C 780 196, 840 190, 920 166" fill="none" stroke="#94a3b8" strokeWidth="2" strokeDasharray="6 6" markerEnd="url(#arrow-flow)" />
        <text x="825" y="210" textAnchor="middle" fontSize="11" fill="#94a3b8">approve challenge</text>
      </svg>
    </div>
  );
}

export default function ArchitectureOverview() {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
      <div className="absolute inset-x-0 top-0 z-0 h-1.5 bg-gradient-to-r from-blue-500 via-cyan-400 to-fuchsia-500" />
      <div className="pointer-events-none absolute -right-24 -top-24 z-0 h-56 w-56 rounded-full bg-blue-100/70 blur-3xl" />
      <div className="pointer-events-none absolute -left-28 bottom-0 z-0 h-64 w-64 rounded-full bg-fuchsia-100/60 blur-3xl" />
      <div className="relative z-10">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3 mb-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-600">Mapa del sistema</p>
          <h3 className="text-2xl font-bold text-gray-900">Arquitectura y flujos clave</h3>
          <p className="text-gray-600 max-w-3xl">
            Esta vista resume como entra el usuario, donde vive la logica de autenticacion y que partes del sistema dependen de Supabase,
            la app movil y las integraciones externas.
          </p>
        </div>
        <div className="text-sm text-gray-500">
          Documento extendido: <code className="bg-gray-100 px-2 py-1 rounded">docs/arquitectura-y-negocio.md</code>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <div className="rounded-2xl border border-blue-100 bg-blue-50/80 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-600">Entrada canónica</p>
          <p className="mt-1 text-lg font-bold text-slate-900">redirect_uri</p>
          <p className="mt-1 text-sm text-slate-600">callback_url queda soportado como alias retrocompatible.</p>
        </div>
        <div className="rounded-2xl border border-fuchsia-100 bg-fuchsia-50/80 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-fuchsia-600">MFA móvil</p>
          <p className="mt-1 text-lg font-bold text-slate-900">Approve / reject</p>
          <p className="mt-1 text-sm text-slate-600">La app autenticadora resuelve pairing, biometría y desafios.</p>
        </div>
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/80 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-600">Bootstrap runtime</p>
          <p className="mt-1 text-lg font-bold text-slate-900">/get-env</p>
          <p className="mt-1 text-sm text-slate-600">El frontend arranca con variables remotas y fallback local.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <h4 className="font-semibold text-gray-900 mb-4">Diagrama general</h4>
          <GeneralArchitectureDiagram />
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <h4 className="font-semibold text-gray-900 mb-4">Flujo de autenticacion y MFA</h4>
          <AuthFlowDiagram />

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm text-gray-600">
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
              <strong className="block text-blue-900">Entrada</strong>
              application_id + redirect_uri
            </div>
            <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
              <strong className="block text-amber-900">Decision</strong>
              auth, roles, permissions, MFA
            </div>
            <div className="bg-cyan-50 border border-cyan-100 rounded-lg p-3">
              <strong className="block text-cyan-900">Salida</strong>
              code, tokens y redireccion final
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
