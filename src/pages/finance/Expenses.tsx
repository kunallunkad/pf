import { useState, useEffect } from 'react';
import { Plus, Search, Receipt, Download } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatCurrency, formatDate, generateId, exportToCSV } from '../../lib/utils';
import { useDateRange } from '../../contexts/DateRangeContext';
import Modal from '../../components/ui/Modal';
import EmptyState from '../../components/ui/EmptyState';
import ActionMenu, { actionView, actionEdit, actionDelete } from '../../components/ui/ActionMenu';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import type { Expense } from '../../types';

const CATEGORIES = ['Rent', 'Travel', 'Marketing', 'Courier', 'Utilities', 'Supplies', 'Salary', 'Miscellaneous'] as const;

export default function Expenses() {
  const { dateRange } = useDateRange();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [viewingExpense, setViewingExpense] = useState<Expense | null>(null);
  const [confirmExpense, setConfirmExpense] = useState<Expense | null>(null);
  const [form, setForm] = useState({
    expense_date: new Date().toISOString().split('T')[0],
    category: 'Miscellaneous' as Expense['category'],
    description: '', amount: '', payment_mode: 'Cash', reference_number: '', notes: '',
  });

  useEffect(() => { loadExpenses(); }, [dateRange]);

  const loadExpenses = async () => {
    const { data } = await supabase.from('expenses').select('*')
      .gte('expense_date', dateRange.from)
      .lte('expense_date', dateRange.to)
      .order('expense_date', { ascending: false });
    setExpenses(data || []);
  };

  const openAdd = () => {
    setEditingExpense(null);
    setForm({
      expense_date: new Date().toISOString().split('T')[0],
      category: 'Miscellaneous',
      description: '', amount: '', payment_mode: 'Cash', reference_number: '', notes: '',
    });
    setShowModal(true);
  };

  const openEdit = (e: Expense) => {
    setEditingExpense(e);
    setForm({
      expense_date: e.expense_date,
      category: e.category,
      description: e.description,
      amount: String(e.amount),
      payment_mode: e.payment_mode,
      reference_number: e.reference_number || '',
      notes: e.notes || '',
    });
    setShowModal(true);
  };

  const openView = (e: Expense) => {
    setViewingExpense(e);
    setShowViewModal(true);
  };

  const handleSave = async () => {
    const payload = {
      expense_date: form.expense_date,
      category: form.category,
      description: form.description,
      amount: parseFloat(form.amount) || 0,
      payment_mode: form.payment_mode,
      reference_number: form.reference_number,
      notes: form.notes,
    };
    if (editingExpense) {
      await supabase.from('expenses').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editingExpense.id);
    } else {
      await supabase.from('expenses').insert({ expense_number: generateId('EXP'), ...payload });
    }
    setShowModal(false);
    loadExpenses();
  };

  const handleDelete = async (e: Expense) => {
    await supabase.from('expenses').delete().eq('id', e.id);
    loadExpenses();
  };

  const handleExport = () => {
    exportToCSV(filtered.map(e => ({
      expense_number: e.expense_number,
      expense_date: e.expense_date,
      category: e.category,
      description: e.description,
      amount: e.amount,
      payment_mode: e.payment_mode,
      reference_number: e.reference_number || '',
      notes: e.notes || '',
    })), 'expenses');
  };

  const filtered = expenses.filter(e => {
    const matchSearch = e.description.toLowerCase().includes(search.toLowerCase());
    const matchCat = catFilter === 'All' || e.category === catFilter;
    return matchSearch && matchCat;
  });

  const totalExpenses = filtered.reduce((s, e) => s + e.amount, 0);
  const catTotals = CATEGORIES.map(cat => ({
    cat, total: expenses.filter(e => e.category === cat).reduce((s, e) => s + e.amount, 0),
  })).sort((a, b) => b.total - a.total);

  const getCatColor = (cat: string) => {
    const map: Record<string, string> = {
      'Rent': 'bg-primary-100 text-primary-700',
      'Travel': 'bg-blue-100 text-blue-700',
      'Marketing': 'bg-green-100 text-green-700',
      'Courier': 'bg-orange-100 text-orange-700',
      'Utilities': 'bg-yellow-100 text-yellow-700',
      'Supplies': 'bg-accent-100 text-accent-700',
      'Salary': 'bg-neutral-200 text-neutral-700',
      'Miscellaneous': 'bg-neutral-100 text-neutral-500',
    };
    return map[cat] || 'bg-neutral-100 text-neutral-600';
  };

  return (
    <div className="flex-1 overflow-y-auto bg-neutral-50">
      <div className="bg-white border-b border-neutral-100 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">Expenses</h1>
          <p className="text-xs text-neutral-500 mt-0.5">Track all business expenses</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search expenses..." className="input pl-8 w-48 text-xs" />
          </div>
          <button onClick={handleExport} className="btn-secondary">
            <Download className="w-4 h-4" /> Export
          </button>
          <button onClick={openAdd} className="btn-primary">
            <Plus className="w-4 h-4" /> Add Expense
          </button>
        </div>
      </div>

      <div className="p-6 space-y-4">
        <div className="grid grid-cols-4 gap-4">
          <div className="card col-span-2">
            <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">Total Expenses</p>
            <p className="text-3xl font-bold text-error-600 mt-1">{formatCurrency(totalExpenses)}</p>
            <p className="text-xs text-neutral-400 mt-1">{filtered.length} entries</p>
          </div>
          <div className="card col-span-2">
            <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">By Category</p>
            <div className="space-y-1.5">
              {catTotals.slice(0, 3).map(({ cat, total }) => {
                const max = catTotals[0]?.total || 1;
                return (
                  <div key={cat} className="flex items-center gap-2">
                    <span className="text-xs text-neutral-600 w-20">{cat}</span>
                    <div className="flex-1 h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                      <div className="h-full bg-primary-500 rounded-full" style={{ width: `${(total / max) * 100}%` }} />
                    </div>
                    <span className="text-xs font-semibold text-neutral-700 w-20 text-right">{formatCurrency(total)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {['All', ...CATEGORIES].map(c => (
            <button key={c} onClick={() => setCatFilter(c)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${catFilter === c ? 'bg-primary-600 text-white' : 'bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50'}`}>
              {c}
            </button>
          ))}
        </div>

        <div className="card p-0 overflow-hidden">
          <table className="w-full">
            <thead className="bg-neutral-50 border-b border-neutral-100">
              <tr>
                <th className="table-header text-left">Date</th>
                <th className="table-header text-left">Category</th>
                <th className="table-header text-left">Description</th>
                <th className="table-header text-left">Payment Mode</th>
                <th className="table-header text-right">Amount</th>
                <th className="table-header text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(e => (
                <tr key={e.id} className="border-b border-neutral-50 hover:bg-neutral-50 transition-colors">
                  <td className="table-cell text-neutral-500">{formatDate(e.expense_date)}</td>
                  <td className="table-cell">
                    <span className={`badge text-[10px] ${getCatColor(e.category)}`}>{e.category}</span>
                  </td>
                  <td className="table-cell font-medium">{e.description}</td>
                  <td className="table-cell text-neutral-500">{e.payment_mode}</td>
                  <td className="table-cell text-right font-semibold text-error-600">{formatCurrency(e.amount)}</td>
                  <td className="table-cell text-right">
                    <ActionMenu items={[
                      actionView(() => openView(e)),
                      actionEdit(() => openEdit(e)),
                      actionDelete(() => setConfirmExpense(e)),
                    ]} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <EmptyState icon={Receipt} title="No expenses" description="Add your first expense entry." />}
        </div>
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editingExpense ? 'Edit Expense' : 'Add Expense'} size="md"
        footer={
          <>
            <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleSave} className="btn-primary">{editingExpense ? 'Update Expense' : 'Save Expense'}</button>
          </>
        }>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Date</label>
            <input type="date" value={form.expense_date} onChange={e => setForm(f => ({ ...f, expense_date: e.target.value }))} className="input" />
          </div>
          <div>
            <label className="label">Category</label>
            <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value as Expense['category'] }))} className="input">
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="label">Description *</label>
            <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="input" placeholder="Brief description" />
          </div>
          <div>
            <label className="label">Amount (₹) *</label>
            <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className="input" placeholder="0" />
          </div>
          <div>
            <label className="label">Payment Mode</label>
            <select value={form.payment_mode} onChange={e => setForm(f => ({ ...f, payment_mode: e.target.value }))} className="input">
              {['Cash', 'Bank Transfer', 'UPI', 'Card', 'Cheque'].map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Reference #</label>
            <input value={form.reference_number} onChange={e => setForm(f => ({ ...f, reference_number: e.target.value }))} className="input" placeholder="Optional" />
          </div>
          <div>
            <label className="label">Notes</label>
            <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="input" placeholder="Optional" />
          </div>
        </div>
      </Modal>

      <Modal isOpen={showViewModal} onClose={() => setShowViewModal(false)} title="Expense Details" size="sm"
        footer={
          <button onClick={() => setShowViewModal(false)} className="btn-secondary">Close</button>
        }>
        {viewingExpense && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">Expense #</p>
                <p className="text-sm font-medium text-neutral-900 mt-0.5">{viewingExpense.expense_number}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">Date</p>
                <p className="text-sm font-medium text-neutral-900 mt-0.5">{formatDate(viewingExpense.expense_date)}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">Category</p>
                <span className={`badge text-[10px] mt-0.5 inline-block ${getCatColor(viewingExpense.category)}`}>{viewingExpense.category}</span>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">Amount</p>
                <p className="text-lg font-bold text-error-600 mt-0.5">{formatCurrency(viewingExpense.amount)}</p>
              </div>
              <div className="col-span-2">
                <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">Description</p>
                <p className="text-sm text-neutral-900 mt-0.5">{viewingExpense.description}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">Payment Mode</p>
                <p className="text-sm text-neutral-700 mt-0.5">{viewingExpense.payment_mode}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">Reference #</p>
                <p className="text-sm text-neutral-700 mt-0.5">{viewingExpense.reference_number || '-'}</p>
              </div>
              {viewingExpense.notes && (
                <div className="col-span-2">
                  <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">Notes</p>
                  <p className="text-sm text-neutral-700 mt-0.5">{viewingExpense.notes}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={!!confirmExpense}
        onClose={() => setConfirmExpense(null)}
        onConfirm={() => confirmExpense && handleDelete(confirmExpense)}
        title="Delete Expense"
        message={`Delete expense "${confirmExpense?.description}"? This action cannot be undone.`}
        confirmLabel="Delete"
        isDanger
      />
    </div>
  );
}
