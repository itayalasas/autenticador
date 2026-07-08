import { Camera, Bell, LockKeyhole, ShieldCheck, Smartphone, ChevronLeft } from 'lucide-react';

const lastUpdated = '7 de julio de 2026';

const dataCategories = [
  {
    title: 'Datos de cuenta y vinculación',
    icon: Smartphone,
    items: [
      'Correo electrónico, identificador de aplicación y nombre de la cuenta vinculada.',
      'Tokens de emparejamiento, identificadores de dispositivo y datos mínimos necesarios para asociar el teléfono con AuthSystem.',
    ],
  },
  {
    title: 'Datos técnicos y de seguridad',
    icon: ShieldCheck,
    items: [
      'Estado del dispositivo, versión de la aplicación y metadatos operativos necesarios para aprobar accesos de forma segura.',
      'Información relacionada con retos de autenticación, sesiones aprobadas o rechazadas y uso de passkeys cuando la función esté habilitada.',
    ],
  },
  {
    title: 'Permisos del dispositivo',
    icon: Camera,
    items: [
      'Cámara, únicamente para escanear códigos QR de vinculación o configuración.',
      'Biometría o bloqueo local del dispositivo, cuando eliges proteger acciones sensibles con autenticación local.',
    ],
  },
  {
    title: 'Notificaciones',
    icon: Bell,
    items: [
      'Token de notificaciones push para enviarte solicitudes de aprobación, alertas de seguridad y eventos de acceso.',
    ],
  },
];

const sections = [
  {
    title: '1. Qué es mobile-authenticator',
    content:
      'mobile-authenticator es la aplicación móvil complementaria de AuthSystem para aprobar inicios de sesión, vincular dispositivos, gestionar autenticación reforzada y operar factores de seguridad como códigos, retos y passkeys.',
  },
  {
    title: '2. Para qué usamos la información',
    content:
      'Usamos la información únicamente para identificar tu dispositivo, proteger accesos, enviarte retos de autenticación, permitir la aprobación o rechazo de solicitudes, detectar actividad sospechosa y mantener operativa la experiencia de seguridad de la app.',
  },
  {
    title: '3. Base de funcionamiento',
    content:
      'La app puede almacenar información operativa en el dispositivo para recordar cuentas vinculadas, mantener el autenticador disponible y permitir que ciertas acciones se resuelvan de manera rápida. La comunicación con los servicios remotos debe realizarse mediante conexiones seguras configuradas por el responsable del despliegue de AuthSystem.',
  },
  {
    title: '4. Con quién compartimos los datos',
    content:
      'No vendemos datos personales. La información solo puede compartirse con la infraestructura técnica necesaria para operar AuthSystem, por ejemplo servicios de autenticación, notificaciones push, registro de eventos y componentes de seguridad configurados por tu organización o por el operador del servicio.',
  },
  {
    title: '5. Conservación y control',
    content:
      'Los datos se conservan mientras exista una cuenta vinculada o mientras sean necesarios para operar el dispositivo como factor de autenticación. Puedes desvincular la cuenta desde la app o solicitar la eliminación de los datos al administrador u organización responsable de tu implementación de AuthSystem.',
  },
  {
    title: '6. Tus derechos',
    content:
      'Puedes solicitar acceso, rectificación, actualización o eliminación de tus datos a través del canal de soporte informado por la organización que administra tu entorno de AuthSystem. Si la app fue distribuida por tu empresa, esa empresa es quien define el tratamiento principal de los datos asociados a sus usuarios.',
  },
  {
    title: '7. Cambios a esta política',
    content:
      'Podemos actualizar esta política para reflejar cambios regulatorios, mejoras de seguridad o nuevas funciones de mobile-authenticator. Cuando el cambio sea relevante, publicaremos la versión actualizada en esta misma URL pública.',
  },
];

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.18),_transparent_36%),radial-gradient(circle_at_bottom_right,_rgba(59,130,246,0.16),_transparent_28%)] pointer-events-none" />

      <main className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-10 sm:px-8 lg:px-10">
        <div className="mb-8 flex items-center justify-between gap-4">
          <a
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-sky-400/30 bg-slate-900/70 px-4 py-2 text-sm font-medium text-sky-200 transition hover:border-sky-300/50 hover:text-white"
          >
            <ChevronLeft className="h-4 w-4" />
            Volver
          </a>

          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-200">
            <LockKeyhole className="h-4 w-4" />
            Acceso público
          </div>
        </div>

        <section className="overflow-hidden rounded-[32px] border border-white/10 bg-slate-900/70 shadow-[0_30px_90px_rgba(2,6,23,0.45)] backdrop-blur">
          <div className="border-b border-white/10 px-8 py-10 sm:px-10">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-sky-400/25 bg-sky-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-sky-200">
              <ShieldCheck className="h-4 w-4" />
              Política de privacidad
            </div>

            <div className="grid gap-8 lg:grid-cols-[1.45fr_0.85fr]">
              <div>
                <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-white sm:text-5xl">
                  Política de privacidad de mobile-authenticator
                </h1>
                <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300 sm:text-lg">
                  Esta página explica qué datos puede tratar la app móvil, para qué se usan y cómo se
                  gestionan cuando utilizas <span className="font-semibold text-white">mobile-authenticator</span>{' '}
                  como factor de autenticación dentro del ecosistema AuthSystem.
                </p>
              </div>

              <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                  Última actualización
                </p>
                <p className="mt-2 text-2xl font-semibold text-white">{lastUpdated}</p>
                <p className="mt-4 text-sm leading-6 text-slate-300">
                  Esta URL está diseñada para permanecer pública y accesible sin autenticación, por
                  ejemplo desde la ficha de la app o desde un enlace de soporte.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-6 px-8 py-8 sm:px-10 lg:grid-cols-2">
            {dataCategories.map(({ title, icon: Icon, items }) => (
              <article
                key={title}
                className="rounded-3xl border border-white/10 bg-slate-950/55 p-6 shadow-[0_18px_50px_rgba(2,6,23,0.18)]"
              >
                <div className="flex items-start gap-4">
                  <div className="rounded-2xl border border-sky-400/20 bg-sky-400/10 p-3 text-sky-200">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white">{title}</h2>
                    <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
                      {items.map((item) => (
                        <li key={item} className="flex gap-3">
                          <span className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-sky-300" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[28px] border border-white/10 bg-slate-900/70 p-8 shadow-[0_25px_70px_rgba(2,6,23,0.3)]">
            <div className="space-y-7">
              {sections.map((section) => (
                <article key={section.title}>
                  <h2 className="text-xl font-semibold text-white">{section.title}</h2>
                  <p className="mt-3 text-sm leading-7 text-slate-300 sm:text-base">{section.content}</p>
                </article>
              ))}
            </div>
          </div>

          <aside className="rounded-[28px] border border-sky-400/20 bg-sky-400/10 p-8 shadow-[0_25px_70px_rgba(14,165,233,0.08)]">
            <h2 className="text-xl font-semibold text-white">Buenas prácticas recomendadas</h2>
            <ul className="mt-5 space-y-4 text-sm leading-6 text-sky-50">
              <li>Protege tu teléfono con PIN, biometría o bloqueo del sistema operativo.</li>
              <li>Revoca cuentas o dispositivos que ya no utilices.</li>
              <li>No compartas códigos, retos ni enlaces de emparejamiento.</li>
              <li>Instala actualizaciones de seguridad cuando estén disponibles.</li>
              <li>Si sospechas de un acceso no autorizado, informa de inmediato al administrador del servicio.</li>
            </ul>

            <div className="mt-8 rounded-3xl border border-white/10 bg-slate-950/45 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                Soporte y consultas
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-200">
                Si necesitas ejercer derechos sobre tus datos o pedir aclaraciones sobre esta política,
                utiliza el canal oficial de soporte de la organización que administra tu entorno de
                AuthSystem o el sitio público donde se distribuye mobile-authenticator.
              </p>
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
}
