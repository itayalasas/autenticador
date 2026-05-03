import { useEffect, useState } from 'react';
import {
  X,
  Search,
  Building2,
  Users as UsersIcon,
  CreditCard as Edit,
  Trash2,
  Power,
  PowerOff,
  Globe,
  Calendar,
  Check,
} from 'lucide-react';
import { tenantService, Tenant } from '../../services/tenantService';

interface TenantsModalProps {
  isOpen: boolean;
  onClose: () => void;
  applicationId: string;
  applicationName: string;
  onShowSuccess: (title: string, message: string) => void;
  onShowError: (title: string, message: string) => void;
  onShowConfirmation: (
    title: string,
    message: string,
    onConfirm: () => void | Promise<void>,
    options?: { type?: 'danger' | 'warning' | 'info'; confirmText?: string }
  ) => void;
  onCloseConfirmation: () => void;
  setConfirmationLoading: (loading: boolean) => void;
}

type EditForm = {
  name: string;
  slug: string;
  domain: string;
};

export default function TenantsModal({
  isOpen,
  onClose,
  applicationId,
  applicationName,
  onShowSuccess,
  onShowError,
  onShowConfirmation,
  onCloseConfirmation,
  setConfirmationLoading,
}: TenantsModalProps) {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'suspended'>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ name: '', slug: '', domain: '' });
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && applicationId) loadTenants();
    if (!isOpen) {
      setEditingId(null);
      setSearchTerm('');
      setStatusFilter('all');
    }
  }, [isOpen, applicationId]);

  const loadTenants = async () => {
    try {
      setLoading(true);
      const list = await tenantService.getTenantsByApplication(applicationId);
      setTenants(list);
    } catch (error) {
      console.error('Error loading tenants:', error);
      onShowError('Error al cargar empresas', 'No se pudieron obtener los tenants registrados.');
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (tenant: Tenant) => {
    setEditingId(tenant.id);
    setEditForm({ name: tenant.name, slug: tenant.slug, domain: tenant.domain || '' });
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveEdit = async (tenant: Tenant) => {
    if (!editForm.name.trim() || !editForm.slug.trim()) {
      onShowError('Datos incompletos', 'Nombre e identificador son obligatorios.');
      return;
    }
    if (!/^[a-z0-9-]+$/.test(editForm.slug)) {
      onShowError('Identificador inválido', 'Solo letras minúsculas, números y guiones.');
      return;
    }
    try {
      setSavingId(tenant.id);
      await tenantService.updateTenant(tenant.id, {
        name: editForm.name.trim(),
        slug: editForm.slug.trim(),
        domain: editForm.domain.trim() || null,
      });
      onShowSuccess('Empresa actualizada', `La empresa "${editForm.name}" fue actualizada.`);
      setEditingId(null);
      await loadTenants();
    } catch (error: any) {
      console.error('Error updating tenant:', error);
      const msg = error?.message || 'Ha ocurrido un error al actualizar la empresa.';
      onShowError('Error al actualizar', msg);
    } finally {
      setSavingId(null);
    }
  };

  const toggleStatus = async (tenant: Tenant) => {
    const nextStatus: Tenant['status'] = tenant.status === 'active' ? 'inactive' : 'active';
    const actionLabel = nextStatus === 'active' ? 'reactivar' : 'desactivar';
    onShowConfirmation(
      `${nextStatus === 'active' ? 'Reactivar' : 'Desactivar'} empresa`,
      `¿Deseas ${actionLabel} la empresa "${tenant.name}"? ${
        nextStatus === 'inactive' ? 'Los usuarios asociados no podrán iniciar sesión.' : ''
      }`,
      async () => {
        try {
          setConfirmationLoading(true);
          await tenantService.updateTenant(tenant.id, { status: nextStatus });
          onCloseConfirmation();
          onShowSuccess(
            'Estado actualizado',
            `La empresa "${tenant.name}" fue ${nextStatus === 'active' ? 'reactivada' : 'desactivada'}.`
          );
          await loadTenants();
        } catch (error: any) {
          onCloseConfirmation();
          onShowError('Error al cambiar estado', error?.message || 'No se pudo cambiar el estado.');
        }
      },
      { type: nextStatus === 'inactive' ? 'warning' : 'info', confirmText: nextStatus === 'active' ? 'Reactivar' : 'Desactivar' }
    );
  };

  const handleDelete = (tenant: Tenant) => {
    onShowConfirmation(
      'Eliminar empresa',
      `¿Eliminar definitivamente "${tenant.name}"? Esta acción no se puede deshacer y afectará a ${
        tenant.user_count || 0
      } usuario(s) asociado(s).`,
      async () => {
        try {
          setConfirmationLoading(true);
          await tenantService.deleteTenant(tenant.id);
          onCloseConfirmation();
          onShowSuccess('Empresa eliminada', `La empresa "${tenant.name}" fue eliminada.`);
          await loadTenants();
        } catch (error: any) {
          onCloseConfirmation();
          onShowError(
            'Error al eliminar',
            error?.message ||
              'No se pudo eliminar. Verifica que no queden usuarios u otros datos asociados.'
          );
        }
      },
      { type: 'danger', confirmText: 'Eliminar' }
    );
  };

  const filtered = tenants.filter((t) => {
    const matchesSearch =
      !searchTerm ||
      t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.slug.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.domain || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusPill = (status: Tenant['status']) => {
    const map: Record<Tenant['status'], string> = {
      active: 'bg-green-100 text-green-800 border-green-200',
      inactive: 'bg-gray-100 text-gray-700 border-gray-200',
      suspended: 'bg-amber-100 text-amber-800 border-amber-200',
    };
    const label: Record<Tenant['status'], string> = {
      active: 'Activo',
      inactive: 'Inactivo',
      suspended: 'Suspendido',
    };
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${map[status]}`}>
        {label[status]}
      </span>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-start justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Building2 className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Empresas registradas</h3>
              <p className="text-sm text-gray-500">{applicationName}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por nombre, identificador o dominio..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-3 py-2 w-full border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Todos los estados</option>
              <option value="active">Activas</option>
              <option value="inactive">Inactivas</option>
              <option value="suspended">Suspendidas</option>
            </select>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h4 className="text-base font-medium text-gray-900 mb-1">
                {tenants.length === 0 ? 'No hay empresas registradas' : 'Sin resultados'}
              </h4>
              <p className="text-sm text-gray-500">
                {tenants.length === 0
                  ? 'Cuando los usuarios se registren desde el formulario tenant, aparecerán aquí.'
                  : 'Intenta ajustar los filtros o el término de búsqueda.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((tenant) => {
                const isEditing = editingId === tenant.id;
                return (
                  <div
                    key={tenant.id}
                    className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
                  >
                    {isEditing ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Nombre</label>
                            <input
                              type="text"
                              value={editForm.name}
                              onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Identificador (slug)</label>
                            <input
                              type="text"
                              value={editForm.slug}
                              onChange={(e) =>
                                setEditForm((f) => ({
                                  ...f,
                                  slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''),
                                }))
                              }
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Dominio (opcional)</label>
                          <input
                            type="text"
                            value={editForm.domain}
                            onChange={(e) => setEditForm((f) => ({ ...f, domain: e.target.value }))}
                            placeholder="empresa.com"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={() => saveEdit(tenant)}
                            disabled={savingId === tenant.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
                          >
                            {savingId === tenant.id ? (
                              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <Check className="w-3.5 h-3.5" />
                            )}
                            <span>Guardar</span>
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center text-white font-bold flex-shrink-0">
                            {tenant.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-semibold text-gray-900 truncate">{tenant.name}</h4>
                              {statusPill(tenant.status)}
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                              <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded">{tenant.slug}</span>
                              {tenant.domain && (
                                <span className="flex items-center gap-1">
                                  <Globe className="w-3 h-3" />
                                  {tenant.domain}
                                </span>
                              )}
                              <span className="flex items-center gap-1">
                                <UsersIcon className="w-3 h-3" />
                                {tenant.user_count || 0} usuario(s)
                              </span>
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {new Date(tenant.created_at).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => startEdit(tenant)}
                            className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => toggleStatus(tenant)}
                            className={`p-2 rounded-lg transition-colors ${
                              tenant.status === 'active'
                                ? 'text-gray-500 hover:text-amber-600 hover:bg-amber-50'
                                : 'text-gray-500 hover:text-green-600 hover:bg-green-50'
                            }`}
                            title={tenant.status === 'active' ? 'Desactivar' : 'Reactivar'}
                          >
                            {tenant.status === 'active' ? (
                              <PowerOff className="w-4 h-4" />
                            ) : (
                              <Power className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={() => handleDelete(tenant)}
                            className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Eliminar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
          <span className="text-xs text-gray-500">
            {filtered.length} empresa(s)
            {filtered.length !== tenants.length ? ` de ${tenants.length}` : ''}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-white transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
