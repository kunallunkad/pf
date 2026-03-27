import { useState, useEffect } from 'react';
import { Warehouse, Plus, CreditCard as Edit2, Trash2, Package, AlertTriangle, Search, BarChart2, Phone, MapPin } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import type { Godown, GodownStock } from '../types';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';

interface GodownFormData {
  name: string;
  location: string;
  manager_name: string;
  phone: string;
  code: string;
}

const emptyForm: GodownFormData = { name: '', location: '', manager_name: '', phone: '', code: '' };

export default function Godowns() {
  const { isAdmin } = useAuth();
  const [godowns, setGodowns] = useState<Godown[]>([]);
  const [selectedGodown, setSelectedGodown] = useState<Godown | null>(null);
  const [godownStock, setGodownStock] = useState<GodownStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [stockLoading, setStockLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [editing, setEditing] = useState<Godown | null>(null);
  const [form, setForm] = useState<GodownFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [stockSearch, setStockSearch] = useState('');

  useEffect(() => { loadGodowns(); }, []);
  useEffect(() => {
    if (selectedGodown) loadGodownStock(selectedGodown.id);
  }, [selectedGodown]);

  const loadGodowns = async () => {
    setLoading(true);
    const { data } = await supabase.from('godowns').select('*').order('name');
    setGodowns(data || []);
    if (!selectedGodown && data && data.length > 0) setSelectedGodown(data[0]);
    setLoading(false);
  };

  const loadGodownStock = async (godownId: string) => {
    setStockLoading(true);
    const { data } = await supabase
      .from('godown_stock')
      .select('*, products(id, name, sku, unit, low_stock_alert, selling_price)')
      .eq('godown_id', godownId)
      .order('quantity', { ascending: true });
    setGodownStock((data || []) as GodownStock[]);
    setStockLoading(false);
  };

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (g: Godown) => {
    setEditing(g);
    setForm({ name: g.name, location: g.location || '', manager_name: g.manager_name || '', phone: g.phone || '', code: g.code || '' });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const payload = { name: form.name.trim(), location: form.location.trim(), manager_name: form.manager_name.trim(), phone: form.phone.trim(), code: form.code.trim(), updated_at: new Date().toISOString() };
    if (editing) {
      await supabase.from('godowns').update(payload).eq('id', editing.id);
    } else {
      await supabase.from('godowns').insert({ ...payload, is_active: true });
    }
    setSaving(false);
    setShowModal(false);
    await loadGodowns();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await supabase.from('godowns').update({ is_active: false }).eq('id', deleteTarget);
    setDeleteTarget(null);
    setShowDeleteDialog(false);
    if (selectedGodown?.id === deleteTarget) setSelectedGodown(null);
    await loadGodowns();
  };

  const filteredStock = godownStock.filter(s =>
    !stockSearch || s.products?.name.toLowerCase().includes(stockSearch.toLowerCase()) || s.products?.sku.toLowerCase().includes(stockSearch.toLowerCase())
  );

  const totalStockValue = godownStock.reduce((sum, s) => sum + (s.quantity * (s.products?.selling_price || 0)), 0);
  const lowStockItems = godownStock.filter(s => s.products && s.quantity <= s.products.low_stock_alert).length;
  const outOfStockItems = godownStock.filter(s => s.quantity === 0).length;

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex overflow-hidden">
      <div className="w-64 bg-white border-r border-neutral-200 flex flex-col shrink-0">
        <div className="p-4 border-b border-neutral-100">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-neutral-800 flex items-center gap-2">
              <Warehouse className="w-4 h-4 text-primary-600" />
              Godowns
            </h2>
            {isAdmin && (
              <button onClick={openAdd} className="btn-primary flex items-center gap-1 text-xs px-2 py-1">
                <Plus className="w-3 h-3" /> Add
              </button>
            )}
          </div>
          <p className="text-xs text-neutral-400">{godowns.filter(g => g.is_active).length} active locations</p>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {godowns.map(g => (
            <button
              key={g.id}
              onClick={() => setSelectedGodown(g)}
              className={`w-full text-left px-3 py-2.5 rounded-lg transition-all group ${selectedGodown?.id === g.id ? 'bg-primary-600 text-white' : 'hover:bg-neutral-50 text-neutral-700'}`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-xs font-semibold ${selectedGodown?.id === g.id ? 'text-white' : 'text-neutral-800'}`}>{g.name}</span>
                {!g.is_active && <span className="text-[9px] bg-neutral-200 text-neutral-500 px-1 rounded">Inactive</span>}
              </div>
              {g.location && <p className={`text-[10px] mt-0.5 truncate ${selectedGodown?.id === g.id ? 'text-white/70' : 'text-neutral-400'}`}>{g.location}</p>}
              {g.code && <p className={`text-[9px] mt-0.5 ${selectedGodown?.id === g.id ? 'text-white/60' : 'text-neutral-300'}`}>#{g.code}</p>}
            </button>
          ))}
          {godowns.length === 0 && (
            <p className="text-xs text-neutral-400 text-center py-8">No godowns yet</p>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-neutral-50">
        {selectedGodown ? (
          <div className="p-6 space-y-5">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-xl font-bold text-neutral-900">{selectedGodown.name}</h1>
                <div className="flex items-center gap-4 mt-1">
                  {selectedGodown.location && (
                    <span className="flex items-center gap-1 text-xs text-neutral-500">
                      <MapPin className="w-3 h-3" /> {selectedGodown.location}
                    </span>
                  )}
                  {selectedGodown.manager_name && (
                    <span className="text-xs text-neutral-500">Manager: {selectedGodown.manager_name}</span>
                  )}
                  {selectedGodown.phone && (
                    <span className="flex items-center gap-1 text-xs text-neutral-500">
                      <Phone className="w-3 h-3" /> {selectedGodown.phone}
                    </span>
                  )}
                </div>
              </div>
              {isAdmin && (
                <div className="flex items-center gap-2">
                  <button onClick={() => openEdit(selectedGodown)} className="btn-secondary flex items-center gap-1.5 text-xs">
                    <Edit2 className="w-3 h-3" /> Edit
                  </button>
                  <button onClick={() => { setDeleteTarget(selectedGodown.id); setShowDeleteDialog(true); }}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors">
                    <Trash2 className="w-3 h-3" /> Deactivate
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div className="card">
                <div className="flex items-center gap-2 mb-1">
                  <Package className="w-4 h-4 text-primary-600" />
                  <p className="text-xs text-neutral-500">Total Products</p>
                </div>
                <p className="text-2xl font-bold text-neutral-900">{godownStock.length}</p>
              </div>
              <div className="card">
                <div className="flex items-center gap-2 mb-1">
                  <BarChart2 className="w-4 h-4 text-blue-600" />
                  <p className="text-xs text-neutral-500">Stock Value</p>
                </div>
                <p className="text-xl font-bold text-neutral-900">{formatCurrency(totalStockValue)}</p>
              </div>
              <div className="card">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="w-4 h-4 text-warning-600" />
                  <p className="text-xs text-neutral-500">Low Stock</p>
                </div>
                <p className="text-2xl font-bold text-warning-600">{lowStockItems}</p>
              </div>
              <div className="card">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="w-4 h-4 text-error-600" />
                  <p className="text-xs text-neutral-500">Out of Stock</p>
                </div>
                <p className="text-2xl font-bold text-error-600">{outOfStockItems}</p>
              </div>
            </div>

            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-neutral-800">Stock Inventory</h3>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                  <input
                    type="text"
                    placeholder="Search products..."
                    value={stockSearch}
                    onChange={e => setStockSearch(e.target.value)}
                    className="input-field pl-8 py-1.5 text-xs w-48"
                  />
                </div>
              </div>
              {stockLoading ? (
                <div className="flex justify-center py-8">
                  <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : filteredStock.length === 0 ? (
                <div className="text-center py-12">
                  <Package className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
                  <p className="text-sm text-neutral-500">No stock recorded for this godown</p>
                  <p className="text-xs text-neutral-400 mt-1">Stock is auto-updated on transactions</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-neutral-100">
                        <th className="table-header text-left">Product</th>
                        <th className="table-header text-left">SKU</th>
                        <th className="table-header text-right">Qty</th>
                        <th className="table-header text-left">Unit</th>
                        <th className="table-header text-right">Value</th>
                        <th className="table-header text-left">Status</th>
                        <th className="table-header text-left">Stock Level</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStock.map(s => {
                        const product = s.products;
                        const alertQty = product?.low_stock_alert || 0;
                        const isOut = s.quantity === 0;
                        const isLow = !isOut && s.quantity <= alertQty;
                        const stockPct = alertQty > 0 ? Math.min(100, (s.quantity / (alertQty * 3)) * 100) : 100;
                        return (
                          <tr key={s.id} className="border-b border-neutral-50 hover:bg-neutral-50">
                            <td className="table-cell font-medium text-neutral-800">{product?.name || '—'}</td>
                            <td className="table-cell text-xs text-neutral-500">{product?.sku || '—'}</td>
                            <td className="table-cell text-right font-bold text-neutral-900">{s.quantity}</td>
                            <td className="table-cell text-xs text-neutral-500">{product?.unit || '—'}</td>
                            <td className="table-cell text-right text-xs text-neutral-600">{formatCurrency(s.quantity * (product?.selling_price || 0))}</td>
                            <td className="table-cell">
                              {isOut ? (
                                <span className="badge bg-error-50 text-error-700">Out of Stock</span>
                              ) : isLow ? (
                                <span className="badge bg-warning-50 text-warning-700">Low Stock</span>
                              ) : (
                                <span className="badge bg-success-50 text-success-700">In Stock</span>
                              )}
                            </td>
                            <td className="table-cell w-32">
                              <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${isOut ? 'bg-error-500' : isLow ? 'bg-warning-500' : 'bg-success-500'}`}
                                  style={{ width: `${stockPct}%` }}
                                />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center h-full">
            <div className="text-center">
              <Warehouse className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
              <p className="text-sm text-neutral-500">Select a godown to view stock</p>
              {isAdmin && (
                <button onClick={openAdd} className="btn-primary mt-4 flex items-center gap-2 mx-auto">
                  <Plus className="w-4 h-4" /> Add Godown
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Godown' : 'Add Godown'} maxWidth="max-w-lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Name *</label>
              <input className="input-field" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Main Godown" />
            </div>
            <div>
              <label className="form-label">Code</label>
              <input className="input-field" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="e.g. GDN-001" />
            </div>
          </div>
          <div>
            <label className="form-label">Location</label>
            <input className="input-field" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="Address or area" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Manager Name</label>
              <input className="input-field" value={form.manager_name} onChange={e => setForm({ ...form, manager_name: e.target.value })} placeholder="Manager name" />
            </div>
            <div>
              <label className="form-label">Phone</label>
              <input className="input-field" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="Contact number" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleSave} disabled={saving || !form.name.trim()} className="btn-primary">
              {saving ? 'Saving...' : editing ? 'Update Godown' : 'Create Godown'}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleDelete}
        title="Deactivate Godown"
        message="This will deactivate the godown. Existing stock records will be preserved."
        confirmLabel="Deactivate"
        variant="danger"
      />
    </div>
  );
}
