import { useState, useEffect } from 'react';
import { Plus, Search, Truck, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatCurrency, formatDate, generateId } from '../lib/utils';
import Modal from '../components/ui/Modal';
import EmptyState from '../components/ui/EmptyState';
import ActionMenu, { actionEdit } from '../components/ui/ActionMenu';
import type { CourierEntry, Customer } from '../types';

const TRANSPORT_OPTIONS = [
  'DTDC', 'BlueDart', 'FedEx', 'Delhivery', 'India Post', 'Ekart', 'XpressBees',
  'Bus', 'Tempo', 'Hand Delivery', 'Train', 'Air', 'Other',
];

interface SOOption { id: string; so_number: string; customer_name: string; }

const emptyForm = {
  courier_date: new Date().toISOString().split('T')[0],
  customer_id: '',
  customer_name: '',
  courier_company: 'DTDC',
  tracking_id: '',
  weight_kg: '',
  charges: '',
  status: 'booked',
  notes: '',
  sales_order_id: '',
};

export default function Courier() {
  const [entries, setEntries] = useState<CourierEntry[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [soOptions, setSoOptions] = useState<SOOption[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<CourierEntry | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const [entriesRes, customersRes, soRes] = await Promise.all([
      supabase.from('courier_entries').select('*').order('courier_date', { ascending: false }),
      supabase.from('customers').select('id, name').eq('is_active', true).order('name'),
      supabase.from('sales_orders').select('id, so_number, customer_name').in('status', ['confirmed', 'dispatched']).order('created_at', { ascending: false }).limit(50),
    ]);
    setEntries(entriesRes.data || []);
    setCustomers(customersRes.data || []);
    setSoOptions(soRes.data || []);
  };

  const openAdd = () => {
    setEditing(null);
    setForm({ ...emptyForm, courier_date: new Date().toISOString().split('T')[0] });
    setShowModal(true);
  };

  const openEdit = (e: CourierEntry) => {
    setEditing(e);
    setForm({
      courier_date: e.courier_date,
      customer_id: e.customer_id || '',
      customer_name: e.customer_name,
      courier_company: e.courier_company,
      tracking_id: e.tracking_id || '',
      weight_kg: e.weight_kg ? String(e.weight_kg) : '',
      charges: String(e.charges),
      status: e.status,
      notes: e.notes || '',
      sales_order_id: (e as CourierEntry & { sales_order_id?: string }).sales_order_id || '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    const payload = {
      courier_date: form.courier_date,
      customer_id: form.customer_id || null,
      customer_name: form.customer_name.trim(),
      courier_company: form.courier_company,
      tracking_id: form.tracking_id.trim() || null,
      weight_kg: parseFloat(form.weight_kg) || 0,
      charges: parseFloat(form.charges) || 0,
      status: form.status,
      notes: form.notes.trim() || null,
      sales_order_id: form.sales_order_id || null,
      updated_at: new Date().toISOString(),
    };

    if (editing) {
      await supabase.from('courier_entries').update(payload).eq('id', editing.id);
    } else {
      const dispatch_number = generateId('DSP');
      await supabase.from('courier_entries').insert({ ...payload, dispatch_number });
      if (form.sales_order_id) {
        await supabase.from('sales_orders').update({ status: 'dispatched' }).eq('id', form.sales_order_id);
      }
    }

    setSaving(false);
    setShowModal(false);
    loadData();
  };

  const updateStatus = async (id: string, status: string) => {
    await supabase.from('courier_entries').update({ status }).eq('id', id);
    loadData();
  };

  const filtered = entries.filter(e => {
    const q = search.toLowerCase();
    const matchSearch = !search ||
      e.customer_name.toLowerCase().includes(q) ||
      (e.tracking_id || '').toLowerCase().includes(q) ||
      e.courier_company.toLowerCase().includes(q);
    const matchStatus = statusFilter === 'All' || e.status === statusFilter.toLowerCase().replace(' ', '_');
    return matchSearch && matchStatus;
  });

  const now = new Date();
  const startOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const monthlyEntries = entries.filter(e => e.courier_date >= startOfMonth);
  const monthlyCost = monthlyEntries.reduce((s, e) => s + e.charges, 0);
  const inTransit = entries.filter(e => ['booked', 'in_transit'].includes(e.status)).length;

  return (
    <div className="flex-1 overflow-y-auto bg-neutral-50">
      <div className="bg-white border-b border-neutral-100 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">Shipment Tracker</h1>
          <p className="text-xs text-neutral-500 mt-0.5">Courier, Bus, Tempo, Hand Delivery — all in one place</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search customer, tracking..." className="input pl-8 w-52 text-xs" />
          </div>
          <button onClick={openAdd} className="btn-primary">
            <Plus className="w-4 h-4" /> Add Shipment
          </button>
        </div>
      </div>

      <div className="p-6 space-y-4">
        <div className="grid grid-cols-4 gap-4">
          <div className="card">
            <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">This Month</p>
            <p className="text-2xl font-bold text-neutral-900 mt-1">{monthlyEntries.length}</p>
            <p className="text-xs text-neutral-400 mt-0.5">shipments</p>
          </div>
          <div className="card">
            <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">Monthly Cost</p>
            <p className="text-2xl font-bold text-primary-700 mt-1">{formatCurrency(monthlyCost)}</p>
          </div>
          <div className="card">
            <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">In Transit</p>
            <p className={`text-2xl font-bold mt-1 ${inTransit > 0 ? 'text-warning-600' : 'text-success-600'}`}>{inTransit}</p>
          </div>
          <div className="card">
            <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">Delivered</p>
            <p className="text-2xl font-bold text-success-600 mt-1">{entries.filter(e => e.status === 'delivered').length}</p>
          </div>
        </div>

        <div className="flex gap-2">
          {['All', 'Booked', 'In Transit', 'Delivered', 'Returned'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${statusFilter === s ? 'bg-primary-600 text-white' : 'bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50'}`}>
              {s}
            </button>
          ))}
        </div>

        <div className="card p-0 overflow-hidden">
          <table className="w-full">
            <thead className="bg-neutral-50 border-b border-neutral-100">
              <tr>
                <th className="table-header text-left">Date</th>
                <th className="table-header text-left">Customer</th>
                <th className="table-header text-left">Via</th>
                <th className="table-header text-left">Tracking / LR</th>
                <th className="table-header text-left">Linked To</th>
                <th className="table-header text-right">Wt (kg)</th>
                <th className="table-header text-right">Charges</th>
                <th className="table-header text-left">Status</th>
                <th className="table-header text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(e => {
                const soLinked = (e as CourierEntry & { sales_order_id?: string }).sales_order_id;
                return (
                  <tr key={e.id} className="border-b border-neutral-50 hover:bg-neutral-50 transition-colors">
                    <td className="table-cell text-neutral-500 text-xs">{formatDate(e.courier_date)}</td>
                    <td className="table-cell font-medium text-neutral-800">{e.customer_name}</td>
                    <td className="table-cell text-sm text-neutral-700">{e.courier_company}</td>
                    <td className="table-cell">
                      {e.tracking_id
                        ? <span className="text-xs font-mono bg-neutral-100 px-2 py-0.5 rounded">{e.tracking_id}</span>
                        : <span className="text-neutral-300 text-xs">—</span>}
                    </td>
                    <td className="table-cell">
                      {soLinked
                        ? <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-medium">Sales Order</span>
                        : e.invoice_id
                        ? <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded font-medium">Invoice</span>
                        : <span className="text-neutral-300 text-xs">—</span>}
                    </td>
                    <td className="table-cell text-right text-neutral-600 text-sm">{e.weight_kg || '—'}</td>
                    <td className="table-cell text-right font-semibold text-primary-700">{formatCurrency(e.charges)}</td>
                    <td className="table-cell">
                      <span className={`badge capitalize ${
                        e.status === 'delivered' ? 'bg-success-50 text-success-700' :
                        e.status === 'in_transit' ? 'bg-blue-50 text-blue-700' :
                        e.status === 'returned' ? 'bg-error-50 text-error-700' :
                        'bg-warning-50 text-warning-700'
                      }`}>{e.status.replace('_', ' ')}</span>
                    </td>
                    <td className="table-cell text-right">
                      <ActionMenu items={[
                        actionEdit(() => openEdit(e)),
                        ...(e.status === 'booked' ? [{
                          label: 'Mark In Transit',
                          icon: <Truck className="w-3.5 h-3.5" />,
                          onClick: () => updateStatus(e.id, 'in_transit'),
                        }] : []),
                        ...(e.status === 'in_transit' ? [{
                          label: 'Mark Delivered',
                          icon: <CheckCircle className="w-3.5 h-3.5" />,
                          onClick: () => updateStatus(e.id, 'delivered'),
                        }] : []),
                      ]} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && <EmptyState icon={Truck} title="No shipments found" description="Add your first shipment entry." />}
        </div>
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)}
        title={editing ? 'Edit Shipment' : 'Add Shipment'}
        size="md"
        footer={
          <>
            <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary">
              {saving ? 'Saving...' : editing ? 'Update' : 'Add Shipment'}
            </button>
          </>
        }>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Date</label>
            <input type="date" value={form.courier_date} onChange={e => setForm(f => ({ ...f, courier_date: e.target.value }))} className="input" />
          </div>
          <div>
            <label className="label">Customer</label>
            <select value={form.customer_id} onChange={e => {
              const c = customers.find(c => c.id === e.target.value);
              setForm(f => ({ ...f, customer_id: e.target.value, customer_name: c?.name || f.customer_name }));
            }} className="input">
              <option value="">— Select —</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="label">Customer Name *</label>
            <input value={form.customer_name} onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))} className="input" placeholder="Name" />
          </div>
          <div>
            <label className="label">Via (Transport / Company) *</label>
            <select value={form.courier_company} onChange={e => setForm(f => ({ ...f, courier_company: e.target.value }))} className="input">
              {TRANSPORT_OPTIONS.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Tracking / LR Number</label>
            <input value={form.tracking_id} onChange={e => setForm(f => ({ ...f, tracking_id: e.target.value }))} className="input" placeholder="AWB / LR / tracking no." />
          </div>
          <div>
            <label className="label">Weight (kg)</label>
            <input type="number" step="0.1" value={form.weight_kg} onChange={e => setForm(f => ({ ...f, weight_kg: e.target.value }))} className="input" placeholder="0.5" />
          </div>
          <div>
            <label className="label">Charges (₹)</label>
            <input type="number" value={form.charges} onChange={e => setForm(f => ({ ...f, charges: e.target.value }))} className="input" placeholder="0" />
          </div>
          <div>
            <label className="label">Link to Sales Order (optional)</label>
            <select value={form.sales_order_id} onChange={e => setForm(f => ({ ...f, sales_order_id: e.target.value }))} className="input">
              <option value="">— None —</option>
              {soOptions.map(so => <option key={so.id} value={so.id}>{so.so_number} — {so.customer_name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Status</label>
            <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className="input">
              {['booked', 'in_transit', 'delivered', 'returned'].map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="label">Notes</label>
            <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="input" placeholder="Optional" />
          </div>
        </div>
      </Modal>
    </div>
  );
}
