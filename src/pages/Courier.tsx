import { useState, useEffect } from 'react';
import { Plus, Search, Truck, Package } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatCurrency, formatDate, generateId } from '../lib/utils';
import Modal from '../components/ui/Modal';
import StatusBadge from '../components/ui/StatusBadge';
import EmptyState from '../components/ui/EmptyState';
import type { CourierEntry, Customer } from '../types';

const COURIER_COMPANIES = ['BlueDart', 'DTDC', 'FedEx', 'Delhivery', 'India Post', 'Ekart', 'XpressBees', 'Other'];

export default function Courier() {
  const [entries, setEntries] = useState<CourierEntry[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [form, setForm] = useState({
    courier_date: new Date().toISOString().split('T')[0],
    customer_id: '', customer_name: '', courier_company: 'BlueDart',
    tracking_id: '', weight_kg: '', charges: '', status: 'booked', notes: '',
  });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const [entriesRes, customersRes] = await Promise.all([
      supabase.from('courier_entries').select('*').order('courier_date', { ascending: false }),
      supabase.from('customers').select('id, name').eq('is_active', true).order('name'),
    ]);
    setEntries(entriesRes.data || []);
    setCustomers(customersRes.data || []);
  };

  const handleSave = async () => {
    await supabase.from('courier_entries').insert({
      courier_date: form.courier_date,
      customer_id: form.customer_id || null,
      customer_name: form.customer_name,
      courier_company: form.courier_company,
      tracking_id: form.tracking_id,
      weight_kg: parseFloat(form.weight_kg) || 0,
      charges: parseFloat(form.charges) || 0,
      status: form.status,
      notes: form.notes,
    });
    setShowModal(false);
    loadData();
  };

  const updateStatus = async (id: string, status: string) => {
    await supabase.from('courier_entries').update({ status }).eq('id', id);
    loadData();
  };

  const filtered = entries.filter(e => {
    const matchSearch = e.customer_name.toLowerCase().includes(search.toLowerCase()) ||
      (e.tracking_id || '').toLowerCase().includes(search.toLowerCase()) ||
      e.courier_company.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'All' || e.status === statusFilter.toLowerCase().replace(' ', '_');
    return matchSearch && matchStatus;
  });

  const now = new Date();
  const startOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const monthlyEntries = entries.filter(e => e.courier_date >= startOfMonth);
  const monthlyCost = monthlyEntries.reduce((s, e) => s + e.charges, 0);
  const monthlyWeight = monthlyEntries.reduce((s, e) => s + (e.weight_kg || 0), 0);

  return (
    <div className="flex-1 overflow-y-auto bg-neutral-50">
      <div className="bg-white border-b border-neutral-100 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">Courier Tracker</h1>
          <p className="text-xs text-neutral-500 mt-0.5">Track shipments and courier costs</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search courier entries..." className="input pl-8 w-52 text-xs" />
          </div>
          <button onClick={() => { setForm({ courier_date: new Date().toISOString().split('T')[0], customer_id: '', customer_name: '', courier_company: 'BlueDart', tracking_id: '', weight_kg: '', charges: '', status: 'booked', notes: '' }); setShowModal(true); }} className="btn-primary">
            <Plus className="w-4 h-4" /> Add Entry
          </button>
        </div>
      </div>

      <div className="p-6 space-y-4">
        <div className="grid grid-cols-4 gap-4">
          <div className="card">
            <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">This Month Shipments</p>
            <p className="text-2xl font-bold text-neutral-900 mt-1">{monthlyEntries.length}</p>
          </div>
          <div className="card">
            <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">Monthly Cost</p>
            <p className="text-2xl font-bold text-primary-700 mt-1">{formatCurrency(monthlyCost)}</p>
          </div>
          <div className="card">
            <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">Total Weight</p>
            <p className="text-2xl font-bold text-neutral-900 mt-1">{monthlyWeight.toFixed(2)} kg</p>
          </div>
          <div className="card">
            <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">In Transit</p>
            <p className="text-2xl font-bold text-blue-600 mt-1">{entries.filter(e => e.status === 'in_transit').length}</p>
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
                <th className="table-header text-left">Courier Co.</th>
                <th className="table-header text-left">Tracking ID</th>
                <th className="table-header text-right">Weight (kg)</th>
                <th className="table-header text-right">Charges</th>
                <th className="table-header text-left">Status</th>
                <th className="table-header text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(e => (
                <tr key={e.id} className="border-b border-neutral-50 hover:bg-neutral-50 transition-colors">
                  <td className="table-cell text-neutral-500">{formatDate(e.courier_date)}</td>
                  <td className="table-cell font-medium">{e.customer_name}</td>
                  <td className="table-cell text-neutral-600">{e.courier_company}</td>
                  <td className="table-cell">
                    {e.tracking_id ? (
                      <span className="text-xs font-mono bg-neutral-100 px-2 py-0.5 rounded">{e.tracking_id}</span>
                    ) : <span className="text-neutral-400 text-xs">-</span>}
                  </td>
                  <td className="table-cell text-right text-neutral-600">{e.weight_kg || '-'}</td>
                  <td className="table-cell text-right font-semibold text-primary-700">{formatCurrency(e.charges)}</td>
                  <td className="table-cell"><StatusBadge status={e.status} /></td>
                  <td className="table-cell text-right">
                    {e.status === 'booked' && (
                      <button onClick={() => updateStatus(e.id, 'in_transit')} className="text-xs text-blue-600 hover:underline">Mark In Transit</button>
                    )}
                    {e.status === 'in_transit' && (
                      <button onClick={() => updateStatus(e.id, 'delivered')} className="text-xs text-success-600 hover:underline">Mark Delivered</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <EmptyState icon={Truck} title="No courier entries" description="Add your first courier entry." />}
        </div>
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Add Courier Entry" size="md"
        footer={
          <>
            <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleSave} className="btn-primary">Save Entry</button>
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
              setForm(f => ({ ...f, customer_id: e.target.value, customer_name: c?.name || '' }));
            }} className="input">
              <option value="">-- Select --</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="label">Customer Name *</label>
            <input value={form.customer_name} onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))} className="input" />
          </div>
          <div>
            <label className="label">Courier Company</label>
            <select value={form.courier_company} onChange={e => setForm(f => ({ ...f, courier_company: e.target.value }))} className="input">
              {COURIER_COMPANIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Tracking ID</label>
            <input value={form.tracking_id} onChange={e => setForm(f => ({ ...f, tracking_id: e.target.value }))} className="input" placeholder="AWB / Tracking number" />
          </div>
          <div>
            <label className="label">Weight (kg)</label>
            <input type="number" value={form.weight_kg} onChange={e => setForm(f => ({ ...f, weight_kg: e.target.value }))} className="input" placeholder="0.5" />
          </div>
          <div>
            <label className="label">Charges (₹)</label>
            <input type="number" value={form.charges} onChange={e => setForm(f => ({ ...f, charges: e.target.value }))} className="input" placeholder="0" />
          </div>
          <div>
            <label className="label">Status</label>
            <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className="input">
              {['booked', 'in_transit', 'delivered', 'returned'].map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Notes</label>
            <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="input" placeholder="Optional" />
          </div>
        </div>
      </Modal>
    </div>
  );
}
