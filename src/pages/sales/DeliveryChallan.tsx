import { useState, useEffect } from 'react';
import { Plus, Search, Printer, Truck, Download, Eye, Pencil, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatDate, generateId, exportToCSV } from '../../lib/utils';
import Modal from '../../components/ui/Modal';
import StatusBadge from '../../components/ui/StatusBadge';
import EmptyState from '../../components/ui/EmptyState';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import ChallanPrint from './ChallanPrint';
import type { DeliveryChallan as DCType, Product, Customer } from '../../types';

interface LineItem {
  product_id: string;
  product_name: string;
  unit: string;
  quantity: string;
}

interface ChallanItem {
  id?: string;
  delivery_challan_id?: string;
  product_id: string | null;
  product_name: string;
  unit: string;
  quantity: number;
}

export default function DeliveryChallan() {
  const [challans, setChallans] = useState<DCType[]>([]);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showPrint, setShowPrint] = useState(false);
  const [selectedChallan, setSelectedChallan] = useState<DCType | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [editChallan, setEditChallan] = useState<DCType | null>(null);
  const [viewChallan, setViewChallan] = useState<DCType | null>(null);
  const [viewItems, setViewItems] = useState<ChallanItem[]>([]);
  const [showViewModal, setShowViewModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DCType | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const [form, setForm] = useState({
    customer_id: '', customer_name: '', customer_phone: '',
    customer_address: '', customer_address2: '',
    customer_city: '', customer_state: '', customer_pincode: '',
    challan_date: new Date().toISOString().split('T')[0],
    dispatch_mode: 'Courier', courier_company: '', tracking_number: '', notes: '',
  });
  const [items, setItems] = useState<LineItem[]>([{ product_id: '', product_name: '', unit: 'pcs', quantity: '1' }]);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const [challansRes, productsRes, customersRes] = await Promise.all([
      supabase.from('delivery_challans').select('*').order('created_at', { ascending: false }),
      supabase.from('products').select('id, name, unit').eq('is_active', true),
      supabase.from('customers').select('id, name, phone, address, address2, city, state, pincode').eq('is_active', true).order('name'),
    ]);
    setChallans(challansRes.data || []);
    setProducts(productsRes.data || []);
    setCustomers(customersRes.data || []);
  };

  const handleCustomerChange = (id: string) => {
    const c = customers.find(c => c.id === id);
    setForm(f => ({
      ...f,
      customer_id: id,
      customer_name: c?.name || '',
      customer_phone: c?.phone || '',
      customer_address: c?.address || '',
      customer_address2: (c as Customer & { address2?: string })?.address2 || '',
      customer_city: c?.city || '',
      customer_state: c?.state || '',
      customer_pincode: c?.pincode || '',
    }));
  };

  const updateItem = (i: number, field: string, value: string) => {
    setItems(prev => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: value };
      if (field === 'product_id') {
        const p = products.find(p => p.id === value);
        if (p) { next[i].product_name = p.name; next[i].unit = p.unit; }
      }
      return next;
    });
  };

  const handleSave = async () => {
    const challanNumber = generateId('DC');
    const { data: challan } = await supabase.from('delivery_challans').insert({
      challan_number: challanNumber,
      customer_id: form.customer_id || null,
      customer_name: form.customer_name,
      customer_phone: form.customer_phone,
      customer_address: form.customer_address,
      customer_address2: form.customer_address2,
      customer_city: form.customer_city,
      customer_state: form.customer_state,
      customer_pincode: form.customer_pincode,
      challan_date: form.challan_date,
      dispatch_mode: form.dispatch_mode,
      courier_company: form.courier_company,
      tracking_number: form.tracking_number,
      status: 'dispatched', notes: form.notes,
    }).select().single();

    if (challan) {
      await supabase.from('delivery_challan_items').insert(
        items.filter(i => i.product_name).map(i => ({
          delivery_challan_id: challan.id,
          product_id: i.product_id || null,
          product_name: i.product_name,
          unit: i.unit,
          quantity: parseFloat(i.quantity) || 0,
        }))
      );
    }
    setShowModal(false);
    loadData();
  };

  const handleEdit = async () => {
    if (!editChallan) return;
    await supabase.from('delivery_challans').update({
      customer_id: form.customer_id || null,
      customer_name: form.customer_name,
      customer_phone: form.customer_phone,
      customer_address: form.customer_address,
      customer_address2: form.customer_address2,
      customer_city: form.customer_city,
      customer_state: form.customer_state,
      customer_pincode: form.customer_pincode,
      challan_date: form.challan_date,
      dispatch_mode: form.dispatch_mode,
      courier_company: form.courier_company,
      tracking_number: form.tracking_number,
      notes: form.notes,
    }).eq('id', editChallan.id);
    await supabase.from('delivery_challan_items').delete().eq('delivery_challan_id', editChallan.id);
    await supabase.from('delivery_challan_items').insert(
      items.filter(i => i.product_name).map(i => ({
        delivery_challan_id: editChallan.id,
        product_id: i.product_id || null,
        product_name: i.product_name,
        unit: i.unit,
        quantity: parseFloat(i.quantity) || 0,
      }))
    );
    setShowModal(false);
    setEditChallan(null);
    loadData();
  };

  const openEdit = async (dc: DCType) => {
    const { data: existingItems } = await supabase.from('delivery_challan_items').select('*').eq('delivery_challan_id', dc.id);
    setEditChallan(dc);
    setForm({
      customer_id: dc.customer_id || '',
      customer_name: dc.customer_name,
      customer_phone: dc.customer_phone || '',
      customer_address: dc.customer_address || '',
      customer_address2: dc.customer_address2 || '',
      customer_city: dc.customer_city || '',
      customer_state: dc.customer_state || '',
      customer_pincode: dc.customer_pincode || '',
      challan_date: dc.challan_date,
      dispatch_mode: dc.dispatch_mode || 'Courier',
      courier_company: dc.courier_company || '',
      tracking_number: dc.tracking_number || '',
      notes: dc.notes || '',
    });
    setItems(
      existingItems && existingItems.length > 0
        ? existingItems.map(i => ({
            product_id: i.product_id || '',
            product_name: i.product_name,
            unit: i.unit,
            quantity: String(i.quantity),
          }))
        : [{ product_id: '', product_name: '', unit: 'pcs', quantity: '1' }]
    );
    setShowModal(true);
  };

  const openView = async (dc: DCType) => {
    const { data: itemsData } = await supabase.from('delivery_challan_items').select('*').eq('delivery_challan_id', dc.id);
    setViewChallan(dc);
    setViewItems(itemsData || []);
    setShowViewModal(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await supabase.from('delivery_challans').update({ status: 'cancelled' }).eq('id', deleteTarget.id);
    setDeleteTarget(null);
    loadData();
  };

  const handleExportCSV = () => {
    exportToCSV(
      filtered.map(dc => ({
        'Challan Number': dc.challan_number,
        'Customer': dc.customer_name,
        'Phone': dc.customer_phone || '',
        'Date': dc.challan_date,
        'Dispatch Mode': dc.dispatch_mode || '',
        'Courier Company': dc.courier_company || '',
        'Tracking Number': dc.tracking_number || '',
        'Status': dc.status,
        'Notes': dc.notes || '',
      })),
      'delivery-challans'
    );
  };

  const openPrint = async (dc: DCType) => {
    const { data: itemsData } = await supabase.from('delivery_challan_items').select('*').eq('delivery_challan_id', dc.id);
    setSelectedChallan({ ...dc, items: itemsData || [] });
    setShowPrint(true);
  };

  const filtered = challans.filter(c =>
    c.challan_number.toLowerCase().includes(search.toLowerCase()) ||
    c.customer_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex-1 overflow-y-auto bg-neutral-50">
      <div className="bg-white border-b border-neutral-100 px-6 py-4 flex items-center justify-between no-print">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">Delivery Challans</h1>
          <p className="text-xs text-neutral-500 mt-0.5">Track dispatches and deliveries</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search challans..." className="input pl-8 w-52 text-xs" />
          </div>
          <button onClick={handleExportCSV} className="btn-secondary flex items-center gap-1.5 text-xs">
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
          <button onClick={() => {
            setEditChallan(null);
            setForm({ customer_id: '', customer_name: '', customer_phone: '', customer_address: '', customer_address2: '', customer_city: '', customer_state: '', customer_pincode: '', challan_date: new Date().toISOString().split('T')[0], dispatch_mode: 'Courier', courier_company: '', tracking_number: '', notes: '' });
            setItems([{ product_id: '', product_name: '', unit: 'pcs', quantity: '1' }]);
            setShowModal(true);
          }} className="btn-primary">
            <Plus className="w-4 h-4" /> New Challan
          </button>
        </div>
      </div>

      <div className="p-6 no-print">
        <div className="card p-0 overflow-hidden">
          <table className="w-full">
            <thead className="bg-neutral-50 border-b border-neutral-100">
              <tr>
                <th className="table-header text-left">Challan #</th>
                <th className="table-header text-left">Customer</th>
                <th className="table-header text-left">Date</th>
                <th className="table-header text-left">Courier</th>
                <th className="table-header text-left">Tracking</th>
                <th className="table-header text-left">Status</th>
                <th className="table-header text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(dc => (
                <tr key={dc.id} className="border-b border-neutral-50 hover:bg-neutral-50 transition-colors">
                  <td className="table-cell font-medium text-primary-700">{dc.challan_number}</td>
                  <td className="table-cell">
                    <p className="font-medium">{dc.customer_name}</p>
                    <p className="text-xs text-neutral-400">{dc.customer_phone}</p>
                  </td>
                  <td className="table-cell text-neutral-500">{formatDate(dc.challan_date)}</td>
                  <td className="table-cell text-neutral-600">{dc.courier_company || dc.dispatch_mode}</td>
                  <td className="table-cell">
                    {dc.tracking_number ? (
                      <span className="text-xs font-mono bg-neutral-100 px-2 py-0.5 rounded">{dc.tracking_number}</span>
                    ) : <span className="text-neutral-400">-</span>}
                  </td>
                  <td className="table-cell"><StatusBadge status={dc.status} /></td>
                  <td className="table-cell text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openView(dc)} title="View" className="p-1.5 rounded-lg text-neutral-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"><Eye className="w-3.5 h-3.5" /></button>
                      <button onClick={() => openPrint(dc)} title="Print" className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"><Printer className="w-3.5 h-3.5" /></button>
                      {dc.status !== 'delivered' && dc.status !== 'cancelled' && (
                        <button onClick={() => openEdit(dc)} title="Edit" className="p-1.5 rounded-lg text-neutral-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                      )}
                      <button onClick={() => { setDeleteTarget(dc); setShowConfirm(true); }} title="Cancel" className="p-1.5 rounded-lg text-neutral-400 hover:text-error-600 hover:bg-error-50 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <EmptyState icon={Truck} title="No challans yet" description="Create a delivery challan." />}
        </div>
      </div>

      <Modal isOpen={showModal} onClose={() => { setShowModal(false); setEditChallan(null); }} title={editChallan ? `Edit Challan — ${editChallan.challan_number}` : 'New Delivery Challan'} size="lg"
        footer={
          <>
            <button onClick={() => { setShowModal(false); setEditChallan(null); }} className="btn-secondary">Cancel</button>
            <button onClick={editChallan ? handleEdit : handleSave} className="btn-primary">{editChallan ? 'Save Changes' : 'Create Challan'}</button>
          </>
        }>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Customer</label>
              <select value={form.customer_id} onChange={e => handleCustomerChange(e.target.value)} className="input">
                <option value="">-- Select Customer --</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Customer Name *</label>
              <input value={form.customer_name} onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))} className="input" />
            </div>
            <div>
              <label className="label">Phone</label>
              <input value={form.customer_phone} onChange={e => setForm(f => ({ ...f, customer_phone: e.target.value }))} className="input" />
            </div>
            <div>
              <label className="label">Challan Date</label>
              <input type="date" value={form.challan_date} onChange={e => setForm(f => ({ ...f, challan_date: e.target.value }))} className="input" />
            </div>
            <div className="col-span-2">
              <label className="label">Address Line 1</label>
              <input value={form.customer_address} onChange={e => setForm(f => ({ ...f, customer_address: e.target.value }))} className="input" placeholder="Street / House No." />
            </div>
            <div className="col-span-2">
              <label className="label">Address Line 2</label>
              <input value={form.customer_address2} onChange={e => setForm(f => ({ ...f, customer_address2: e.target.value }))} className="input" placeholder="Area / Landmark" />
            </div>
            <div>
              <label className="label">City</label>
              <input value={form.customer_city} onChange={e => setForm(f => ({ ...f, customer_city: e.target.value }))} className="input" placeholder="City" />
            </div>
            <div>
              <label className="label">State</label>
              <input value={form.customer_state} onChange={e => setForm(f => ({ ...f, customer_state: e.target.value }))} className="input" placeholder="State" />
            </div>
            <div>
              <label className="label">PIN Code</label>
              <input value={form.customer_pincode} onChange={e => setForm(f => ({ ...f, customer_pincode: e.target.value }))} className="input" placeholder="PIN Code" />
            </div>
            <div>
              <label className="label">Dispatch Mode</label>
              <select value={form.dispatch_mode} onChange={e => setForm(f => ({ ...f, dispatch_mode: e.target.value }))} className="input">
                {['Courier', 'Hand Delivery', 'Postal', 'Transport'].map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Courier Company</label>
              <input value={form.courier_company} onChange={e => setForm(f => ({ ...f, courier_company: e.target.value }))} className="input" placeholder="e.g., BlueDart, DTDC" />
            </div>
            <div className="col-span-2">
              <label className="label">Tracking Number</label>
              <input value={form.tracking_number} onChange={e => setForm(f => ({ ...f, tracking_number: e.target.value }))} className="input" placeholder="AWB / Tracking ID" />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-neutral-700">Items</p>
              <button onClick={() => setItems(prev => [...prev, { product_id: '', product_name: '', unit: 'pcs', quantity: '1' }])} className="btn-ghost text-xs"><Plus className="w-3.5 h-3.5" /> Add</button>
            </div>
            <div className="border border-neutral-200 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-neutral-50">
                  <tr>
                    <th className="table-header text-left">Product</th>
                    <th className="table-header text-center w-20">Unit</th>
                    <th className="table-header text-right w-20">Qty</th>
                    <th className="table-header w-8" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, i) => (
                    <tr key={i} className="border-t border-neutral-100">
                      <td className="px-3 py-2">
                        <select value={item.product_id} onChange={e => updateItem(i, 'product_id', e.target.value)} className="input text-xs">
                          <option value="">-- Select Product --</option>
                          {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                        {!item.product_id && <input value={item.product_name} onChange={e => updateItem(i, 'product_name', e.target.value)} className="input text-xs mt-1" placeholder="Or type name..." />}
                      </td>
                      <td className="px-3 py-2"><input value={item.unit} onChange={e => updateItem(i, 'unit', e.target.value)} className="input text-xs text-center" /></td>
                      <td className="px-3 py-2"><input type="number" value={item.quantity} onChange={e => updateItem(i, 'quantity', e.target.value)} className="input text-xs text-right" /></td>
                      <td className="px-3 py-2"><button onClick={() => setItems(prev => prev.filter((_, idx) => idx !== i))} className="text-neutral-400 hover:text-error-500 text-lg leading-none">&times;</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="input resize-none h-16" />
          </div>
        </div>
      </Modal>

      <Modal isOpen={showViewModal} onClose={() => { setShowViewModal(false); setViewChallan(null); }} title={viewChallan ? `Delivery Challan — ${viewChallan.challan_number}` : ''} size="lg"
        footer={
          <button onClick={() => { setShowViewModal(false); setViewChallan(null); }} className="btn-secondary">Close</button>
        }>
        {viewChallan && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <div>
                <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">Customer</p>
                <p className="font-medium text-neutral-900">{viewChallan.customer_name}</p>
                {viewChallan.customer_phone && <p className="text-xs text-neutral-500">{viewChallan.customer_phone}</p>}
              </div>
              <div>
                <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">Status</p>
                <StatusBadge status={viewChallan.status} />
              </div>
              <div>
                <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">Challan Date</p>
                <p className="text-neutral-700">{formatDate(viewChallan.challan_date)}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">Dispatch Mode</p>
                <p className="text-neutral-700">{viewChallan.dispatch_mode || '-'}</p>
              </div>
              {viewChallan.courier_company && (
                <div>
                  <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">Courier Company</p>
                  <p className="text-neutral-700">{viewChallan.courier_company}</p>
                </div>
              )}
              {viewChallan.tracking_number && (
                <div>
                  <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">Tracking Number</p>
                  <span className="text-xs font-mono bg-neutral-100 px-2 py-0.5 rounded">{viewChallan.tracking_number}</span>
                </div>
              )}
              {viewChallan.customer_address && (
                <div className="col-span-2">
                  <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">Delivery Address</p>
                  <p className="text-neutral-700">{viewChallan.customer_address}</p>
                </div>
              )}
            </div>

            <div>
              <p className="text-xs font-semibold text-neutral-700 mb-2">Items</p>
              <div className="border border-neutral-200 rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-neutral-50">
                    <tr>
                      <th className="table-header text-left">Product</th>
                      <th className="table-header text-center w-20">Unit</th>
                      <th className="table-header text-right w-20">Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewItems.map((item, idx) => (
                      <tr key={idx} className="border-t border-neutral-100">
                        <td className="table-cell font-medium">{item.product_name}</td>
                        <td className="table-cell text-center text-neutral-600">{item.unit}</td>
                        <td className="table-cell text-right font-semibold">{item.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {viewChallan.notes && (
              <div>
                <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-1">Notes</p>
                <p className="text-sm text-neutral-600 italic">{viewChallan.notes}</p>
              </div>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={showConfirm}
        onClose={() => { setShowConfirm(false); setDeleteTarget(null); }}
        onConfirm={handleDelete}
        title="Cancel Delivery Challan"
        message={`Are you sure you want to cancel challan ${deleteTarget?.challan_number}? This action cannot be undone.`}
        confirmLabel="Cancel Challan"
        isDanger
      />

      {showPrint && selectedChallan && (
        <div className="fixed inset-0 z-50 bg-neutral-100 overflow-auto">
          <div className="no-print flex items-center justify-between bg-white border-b border-neutral-200 px-6 py-3">
            <p className="text-sm font-semibold">Challan Preview - {selectedChallan.challan_number}</p>
            <div className="flex gap-2">
              <button onClick={() => window.print()} className="btn-primary"><Printer className="w-4 h-4" /> Print</button>
              <button onClick={() => setShowPrint(false)} className="btn-secondary">Close</button>
            </div>
          </div>
          <div className="py-6 print-content"><ChallanPrint challan={selectedChallan} /></div>
        </div>
      )}
    </div>
  );
}
