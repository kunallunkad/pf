import { useState, useEffect, useRef } from 'react';
import { Plus, ArrowUpDown, Search, BarChart2, AlertTriangle, ImagePlus, Download, History, Warehouse } from 'lucide-react';
import { supabase, uploadProductImage } from '../lib/supabase';
import { formatCurrency, generateId, exportToCSV, formatDate } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import Modal from '../components/ui/Modal';
import EmptyState from '../components/ui/EmptyState';
import ActionMenu, { actionEdit, actionDelete } from '../components/ui/ActionMenu';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { fetchGodownStock } from '../services/godownService';
import type { Product, StockMovement, GodownStock } from '../types';

const CATEGORIES = ['All', 'Astro Products', 'Vastu Items', 'Healing Items'] as const;
const UNITS = ['pcs', 'grams', 'kg', 'sets', 'ml', 'liters'];

export default function Inventory() {
  const { isAdmin } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [filtered, setFiltered] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<string>('All');
  const [stockStatus, setStockStatus] = useState<string>('All');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showStockModal, setShowStockModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [editing, setEditing] = useState<Product | null>(null);
  const [confirmProduct, setConfirmProduct] = useState<Product | null>(null);

  const [activeTab, setActiveTab] = useState<'products' | 'godown-stock'>('products');
  const [godownStockData, setGodownStockData] = useState<GodownStock[]>([]);
  const [godownStockSearch, setGodownStockSearch] = useState('');
  const [godownStockLoading, setGodownStockLoading] = useState(false);

  const [showLedgerModal, setShowLedgerModal] = useState(false);
  const [ledgerProduct, setLedgerProduct] = useState<Product | null>(null);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);

  const [form, setForm] = useState({
    name: '', category: 'Astro Products' as Product['category'], unit: 'pcs',
    purchase_price: '', selling_price: '', stock_quantity: '', low_stock_alert: '5',
    description: '', sku: '', image_url: '',
    direction: '', is_gemstone: false, weight_grams: '',
    total_weight: '', weight_unit: 'grams' as 'grams' | 'carats',
  });
  const [stockForm, setStockForm] = useState({ type: 'adjustment', quantity: '', notes: '', movement_label: 'adjustment' });
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');

  useEffect(() => { loadProducts(); }, []);
  useEffect(() => {
    if (activeTab === 'godown-stock') loadGodownStock();
  }, [activeTab]);

  useEffect(() => {
    let data = products;
    if (category !== 'All') data = data.filter(p => p.category === category);
    if (stockStatus === 'In Stock') data = data.filter(p => p.stock_quantity > p.low_stock_alert);
    if (stockStatus === 'Low Alert') data = data.filter(p => p.stock_quantity > 0 && p.stock_quantity <= p.low_stock_alert);
    if (stockStatus === 'Out of Stock') data = data.filter(p => p.stock_quantity <= 0);
    if (search) data = data.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase()));
    setFiltered(data);
  }, [products, category, stockStatus, search]);

  const loadProducts = async () => {
    setLoading(true);
    const { data } = await supabase.from('products').select('*').eq('is_active', true).order('created_at', { ascending: false });
    setProducts(data || []);
    setLoading(false);
  };

  const loadGodownStock = async () => {
    setGodownStockLoading(true);
    try {
      const data = await fetchGodownStock();
      setGodownStockData(data);
    } catch (_) {
      setGodownStockData([]);
    }
    setGodownStockLoading(false);
  };

  const filteredGodownStock = godownStockData.filter(gs => {
    if (!godownStockSearch) return true;
    const q = godownStockSearch.toLowerCase();
    return gs.product?.name?.toLowerCase().includes(q) || gs.godown?.name?.toLowerCase().includes(q);
  });

  const openAdd = () => {
    setEditing(null);
    setPendingImageFile(null);
    setImagePreview('');
    setForm({
      name: '', category: 'Astro Products', unit: 'pcs',
      purchase_price: '', selling_price: '', stock_quantity: '0', low_stock_alert: '5',
      description: '', sku: generateId('SKU'), image_url: '',
      direction: '', is_gemstone: false, weight_grams: '',
    });
    setShowModal(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setPendingImageFile(null);
    setImagePreview(p.image_url || '');
    setForm({
      name: p.name, category: p.category, unit: p.unit,
      purchase_price: String(p.purchase_price), selling_price: String(p.selling_price),
      stock_quantity: String(p.stock_quantity), low_stock_alert: String(p.low_stock_alert),
      description: p.description || '', sku: p.sku, image_url: p.image_url || '',
      direction: p.direction || '', is_gemstone: p.is_gemstone || false,
      weight_grams: p.weight_grams ? String(p.weight_grams) : '',
      total_weight: p.total_weight ? String(p.total_weight) : '',
      weight_unit: (p.weight_unit as 'grams' | 'carats') || 'grams',
    });
    setShowModal(true);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    let imageUrl = form.image_url;
    if (pendingImageFile) {
      setImageUploading(true);
      const tempId = editing?.id || generateId('IMG');
      const uploaded = await uploadProductImage(pendingImageFile, tempId);
      if (uploaded) imageUrl = uploaded;
      setImageUploading(false);
    }
    const totalW = form.is_gemstone && form.total_weight ? parseFloat(form.total_weight) || 0 : 0;
    const payload = {
      name: form.name, category: form.category, unit: form.unit, sku: form.sku,
      purchase_price: parseFloat(form.purchase_price) || 0,
      selling_price: parseFloat(form.selling_price) || 0,
      stock_quantity: parseFloat(form.stock_quantity) || 0,
      low_stock_alert: parseFloat(form.low_stock_alert) || 5,
      description: form.description,
      image_url: imageUrl || null,
      direction: form.direction || null,
      is_gemstone: form.is_gemstone,
      weight_grams: form.is_gemstone && form.weight_grams ? parseFloat(form.weight_grams) || null : null,
      total_weight: totalW,
      remaining_weight: editing ? undefined : totalW,
      weight_unit: form.is_gemstone ? form.weight_unit : null,
      updated_at: new Date().toISOString(),
    };
    if (editing) {
      await supabase.from('products').update(payload).eq('id', editing.id);
    } else {
      await supabase.from('products').insert(payload);
    }
    setShowModal(false);
    loadProducts();
  };

  const handleDelete = async (p: Product) => {
    await supabase.from('products').update({ is_active: false, updated_at: new Date().toISOString() }).eq('id', p.id);
    loadProducts();
  };

  const openStockModal = (p: Product) => {
    setSelectedProduct(p);
    setStockForm({ type: 'in', quantity: '', notes: '', movement_label: 'in' });
    setShowStockModal(true);
  };

  const openLedgerModal = async (p: Product) => {
    setLedgerProduct(p);
    setShowLedgerModal(true);
    const { data } = await supabase.from('stock_movements').select('*').eq('product_id', p.id).order('created_at', { ascending: false }).limit(50);
    setStockMovements(data || []);
  };

  const handleStockUpdate = async () => {
    if (!selectedProduct) return;
    const qty = parseFloat(stockForm.quantity) || 0;
    const mvType = stockForm.movement_label;
    const isIn = ['in', 'purchase', 'return'].includes(mvType);
    const newQty = isIn
      ? selectedProduct.stock_quantity + qty
      : mvType === 'adjustment' ? qty
      : Math.max(0, selectedProduct.stock_quantity - qty);

    const updates: Record<string, unknown> = { stock_quantity: newQty, updated_at: new Date().toISOString() };
    if (selectedProduct.is_gemstone && selectedProduct.total_weight) {
      const weightAmt = parseFloat(stockForm.quantity) || 0;
      if (isIn) {
        updates.remaining_weight = (selectedProduct.remaining_weight || 0) + weightAmt;
        updates.total_weight = (selectedProduct.total_weight || 0) + (mvType === 'purchase' ? weightAmt : 0);
      } else if (mvType !== 'adjustment') {
        updates.remaining_weight = Math.max(0, (selectedProduct.remaining_weight || 0) - weightAmt);
      }
    }

    await supabase.from('products').update(updates).eq('id', selectedProduct.id);
    await supabase.from('stock_movements').insert({
      product_id: selectedProduct.id,
      movement_type: mvType,
      quantity: qty,
      notes: stockForm.notes,
    });
    setShowStockModal(false);
    loadProducts();
  };

  const handleExport = () => {
    exportToCSV(filtered.map(p => ({
      sku: p.sku,
      name: p.name,
      category: p.category,
      unit: p.unit,
      purchase_price: p.purchase_price,
      selling_price: p.selling_price,
      stock_quantity: p.stock_quantity,
      low_stock_alert: p.low_stock_alert,
    })), 'products');
  };

  const totalValuation = products.reduce((s, p) => s + p.stock_quantity * p.purchase_price, 0);
  const lowStockCount = products.filter(p => p.stock_quantity > 0 && p.stock_quantity <= p.low_stock_alert).length;

  const getStockBar = (p: Product) => {
    const ratio = p.low_stock_alert > 0 ? p.stock_quantity / (p.low_stock_alert * 3) : 1;
    const pct = Math.min(100, ratio * 100);
    const color = p.stock_quantity <= 0 ? 'bg-error-500' : p.stock_quantity <= p.low_stock_alert ? 'bg-warning-500' : 'bg-success-500';
    return { pct, color };
  };

  const getCategoryColor = (cat: string) => {
    const map: Record<string, string> = {
      'Astro Products': 'bg-primary-100 text-primary-700',
      'Vastu Items': 'bg-blue-100 text-blue-700',
      'Healing Items': 'bg-green-100 text-green-700',
    };
    return map[cat] || 'bg-neutral-100 text-neutral-600';
  };

  return (
    <div className="flex-1 overflow-y-auto bg-neutral-50">
      <div className="bg-white border-b border-neutral-100 px-6 py-4 flex items-center justify-between no-print">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">Product Master</h1>
          <p className="text-xs text-neutral-500 mt-0.5">Curating divine inventory for earthly prosperity.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-neutral-100 rounded-lg p-1 gap-1">
            <button onClick={() => setActiveTab('products')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${activeTab === 'products' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'}`}>
              Products
            </button>
            <button onClick={() => setActiveTab('godown-stock')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${activeTab === 'godown-stock' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'}`}>
              <Warehouse className="w-3 h-3" /> Godown Stock
            </button>
          </div>
          {activeTab === 'products' && (
            <>
              <button onClick={handleExport} className="btn-secondary">
                <Download className="w-4 h-4" /> Export
              </button>
              <button onClick={openAdd} className="btn-primary">
                <Plus className="w-4 h-4" /> Add Product
              </button>
            </>
          )}
        </div>
      </div>

      <div className="p-6 space-y-4">
        {activeTab === 'godown-stock' && (
          <div className="space-y-4">
            <div className="card">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-neutral-800">Godown-wise Stock</h2>
                  <p className="text-xs text-neutral-400 mt-0.5">Stock levels per product per warehouse</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
                    <input value={godownStockSearch} onChange={e => setGodownStockSearch(e.target.value)} placeholder="Search product or godown..." className="input pl-8 w-56 text-xs" />
                  </div>
                  <button onClick={loadGodownStock} className="btn-secondary text-xs">Refresh</button>
                </div>
              </div>
            </div>
            <div className="card p-0 overflow-hidden">
              <table className="w-full">
                <thead className="bg-neutral-50 border-b border-neutral-100">
                  <tr>
                    <th className="table-header text-left">Product</th>
                    <th className="table-header text-left">Category</th>
                    <th className="table-header text-left">Godown</th>
                    <th className="table-header text-left">Location</th>
                    <th className="table-header text-right">Qty in Stock</th>
                    <th className="table-header text-right">Stock Value</th>
                  </tr>
                </thead>
                <tbody>
                  {godownStockLoading ? (
                    <tr><td colSpan={6} className="table-cell text-center text-neutral-400 py-8 text-sm">Loading...</td></tr>
                  ) : filteredGodownStock.length === 0 ? (
                    <tr><td colSpan={6} className="py-12">
                      <div className="flex flex-col items-center gap-2 text-neutral-400">
                        <Warehouse className="w-8 h-8" />
                        <p className="text-sm font-medium">No godown stock data found</p>
                        <p className="text-xs">Stock will appear here once products are assigned to godowns</p>
                      </div>
                    </td></tr>
                  ) : filteredGodownStock.map((gs, idx) => (
                    <tr key={idx} className="border-b border-neutral-50 hover:bg-neutral-50 transition-colors">
                      <td className="table-cell">
                        <p className="font-medium text-neutral-800 text-sm">{gs.product?.name || '—'}</p>
                        <p className="text-xs text-neutral-400">{gs.product?.sku || ''}</p>
                      </td>
                      <td className="table-cell">
                        <span className={`badge text-[10px] font-semibold uppercase tracking-wider ${getCategoryColor(gs.product?.category || '')}`}>
                          {gs.product?.category || '—'}
                        </span>
                      </td>
                      <td className="table-cell">
                        <p className="text-sm font-medium text-neutral-700">{gs.godown?.name || '—'}</p>
                        {gs.godown?.code && <p className="text-xs text-neutral-400">{gs.godown.code}</p>}
                      </td>
                      <td className="table-cell text-xs text-neutral-500">{gs.godown?.location || '—'}</td>
                      <td className="table-cell text-right">
                        <span className={`text-sm font-semibold ${gs.quantity <= 0 ? 'text-error-600' : gs.quantity <= (gs.product?.low_stock_alert || 5) ? 'text-warning-600' : 'text-neutral-800'}`}>
                          {gs.quantity} {gs.product?.unit || ''}
                        </span>
                        {gs.quantity <= 0 && <p className="text-[10px] text-error-500 text-right">Out of stock</p>}
                        {gs.quantity > 0 && gs.quantity <= (gs.product?.low_stock_alert || 5) && (
                          <p className="text-[10px] text-warning-500 text-right">Low stock</p>
                        )}
                      </td>
                      <td className="table-cell text-right">
                        {isAdmin && gs.product ? (
                          <span className="text-sm font-medium text-neutral-700">{formatCurrency(gs.quantity * gs.product.purchase_price)}</span>
                        ) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {activeTab === 'products' && <><div className="grid grid-cols-3 gap-4">
          <div className="col-span-2 card">
            <div className="flex items-center gap-6 flex-wrap">
              <div>
                <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">Category</p>
                <div className="flex gap-2 flex-wrap">
                  {CATEGORIES.map(c => (
                    <button key={c} onClick={() => setCategory(c)}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${category === c ? 'bg-primary-600 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">Stock Status</p>
                <div className="flex gap-2">
                  {['All', 'In Stock', 'Low Alert', 'Out of Stock'].map(s => (
                    <button key={s} onClick={() => setStockStatus(s)}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${stockStatus === s ? 'bg-neutral-800 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div className="ml-auto">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products..." className="input pl-8 w-52 text-xs" />
                </div>
              </div>
            </div>
          </div>
          <div className="card flex flex-col justify-center">
            <p className="text-[10px] font-semibold text-accent-600 uppercase tracking-wider">{isAdmin ? 'Inventory Valuation' : 'Total Products'}</p>
            <p className="text-3xl font-bold text-neutral-900 mt-1">{isAdmin ? formatCurrency(totalValuation) : products.length}</p>
            <div className="flex items-center gap-2 mt-2">
              {lowStockCount > 0 && (
                <span className="flex items-center gap-1 text-xs text-warning-600 bg-warning-50 px-2 py-0.5 rounded-full">
                  <AlertTriangle className="w-3 h-3" /> {lowStockCount} low stock
                </span>
              )}
              <span className="text-xs text-neutral-400">{products.length} products</span>
            </div>
          </div>
        </div>

        <div className="card p-0 overflow-hidden">
          <table className="w-full">
            <thead className="bg-neutral-50 border-b border-neutral-100">
              <tr>
                <th className="table-header text-left">Product Details</th>
                <th className="table-header text-left">Category</th>
                <th className="table-header text-left">Unit</th>
                <th className="table-header text-left">Pricing</th>
                <th className="table-header text-left">Stock Level</th>
                <th className="table-header text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => {
                const bar = getStockBar(p);
                return (
                  <tr key={p.id} className="border-b border-neutral-50 hover:bg-neutral-50 transition-colors">
                    <td className="table-cell">
                      <div className="flex items-center gap-3">
                        {p.image_url ? (
                          <img src={p.image_url} alt={p.name} className="w-9 h-9 rounded-lg object-cover flex-shrink-0 border border-neutral-100" />
                        ) : (
                          <div className="w-9 h-9 rounded-lg bg-neutral-100 flex items-center justify-center flex-shrink-0">
                            <ImagePlus className="w-4 h-4 text-neutral-300" />
                          </div>
                        )}
                        <div>
                          <p className="font-semibold text-neutral-900 text-sm">{p.name}</p>
                          <p className="text-xs text-neutral-400">SKU: {p.sku}</p>
                          <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                            {p.direction && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-medium">{p.direction}</span>
                            )}
                            {p.is_gemstone && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 font-semibold">Gemstone</span>
                            )}
                            {p.weight_grams != null && p.weight_grams > 0 && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-500">{p.weight_grams}g</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="table-cell">
                      <span className={`badge text-[10px] font-semibold uppercase tracking-wider ${getCategoryColor(p.category)}`}>{p.category}</span>
                    </td>
                    <td className="table-cell text-neutral-500">{p.unit}</td>
                    <td className="table-cell">
                      {isAdmin && <p className="text-xs text-neutral-500">P: {formatCurrency(p.purchase_price)}</p>}
                      <p className="text-sm font-semibold text-primary-700">S: {formatCurrency(p.selling_price)}</p>
                    </td>
                    <td className="table-cell">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${bar.color}`} style={{ width: `${bar.pct}%` }} />
                          </div>
                          <span className={`text-xs font-medium ${p.stock_quantity <= 0 ? 'text-error-600' : p.stock_quantity <= p.low_stock_alert ? 'text-warning-600' : 'text-neutral-700'}`}>
                            {p.stock_quantity} {p.unit}
                          </span>
                        </div>
                        {p.is_gemstone && (p.remaining_weight ?? 0) > 0 && (
                          <p className="text-[10px] text-primary-600 font-medium">
                            {p.remaining_weight}{p.weight_unit === 'carats' ? ' ct' : 'g'} available
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="table-cell text-right">
                      <ActionMenu items={[
                        actionEdit(() => openEdit(p)),
                        { label: 'Stock In/Out', icon: <ArrowUpDown className="w-3.5 h-3.5" />, onClick: () => openStockModal(p) },
                        { label: 'Movement Ledger', icon: <History className="w-3.5 h-3.5" />, onClick: () => openLedgerModal(p) },
                        actionDelete(() => setConfirmProduct(p)),
                      ]} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && !loading && (
            <EmptyState icon={BarChart2} title="No products found" description="Add your first product or adjust filters." />
          )}
        </div>

        {lowStockCount > 0 && (
          <div className="card border-l-4 border-warning-500">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-warning-600" />
              <p className="text-sm font-semibold text-warning-700">Low Stock Alerts</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {products.filter(p => p.stock_quantity > 0 && p.stock_quantity <= p.low_stock_alert).map(p => (
                <div key={p.id} className="flex items-center justify-between bg-warning-50 px-3 py-2 rounded-lg">
                  <span className="text-xs text-neutral-700">{p.name}</span>
                  <span className="text-xs font-bold text-warning-700">{p.stock_quantity} Left</span>
                </div>
              ))}
            </div>
          </div>
        )}
        </>}
      </div>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editing ? 'Edit Product' : 'Add Product'}
        size="lg"
        footer={
          <>
            <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleSave} disabled={imageUploading} className="btn-primary">
              {imageUploading ? 'Uploading...' : editing ? 'Update Product' : 'Add Product'}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="label">Product Image</label>
            <div className="flex items-center gap-3">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="w-16 h-16 rounded-xl border-2 border-dashed border-neutral-200 flex items-center justify-center cursor-pointer hover:border-primary-400 transition-colors overflow-hidden flex-shrink-0"
              >
                {imagePreview ? (
                  <img src={imagePreview} alt="preview" className="w-full h-full object-cover" />
                ) : (
                  <ImagePlus className="w-6 h-6 text-neutral-300" />
                )}
              </div>
              <div>
                <button type="button" onClick={() => fileInputRef.current?.click()} className="btn-secondary text-xs">
                  {imagePreview ? 'Change Image' : 'Upload Image'}
                </button>
                <p className="text-[10px] text-neutral-400 mt-1">JPG, PNG up to 5MB</p>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
            </div>
          </div>
          <div className="col-span-2">
            <label className="label">Product Name *</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="input" placeholder="e.g., Natural Citrine Point" />
          </div>
          <div>
            <label className="label">SKU</label>
            <input value={form.sku} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))} className="input" placeholder="AST-CIT-001" />
          </div>
          <div>
            <label className="label">Category</label>
            <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value as Product['category'] }))} className="input">
              <option>Astro Products</option>
              <option>Vastu Items</option>
              <option>Healing Items</option>
            </select>
          </div>
          <div>
            <label className="label">Unit</label>
            <select value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} className="input">
              {UNITS.map(u => <option key={u}>{u}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Low Stock Alert</label>
            <input type="number" value={form.low_stock_alert} onChange={e => setForm(f => ({ ...f, low_stock_alert: e.target.value }))} className="input" />
          </div>
          <div>
            <label className="label">Vastu Direction</label>
            <input value={form.direction} onChange={e => setForm(f => ({ ...f, direction: e.target.value }))} className="input" placeholder="e.g., North-East" />
          </div>
          <div className="flex flex-col justify-end gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_gemstone}
                onChange={e => setForm(f => ({ ...f, is_gemstone: e.target.checked, weight_grams: e.target.checked ? f.weight_grams : '', total_weight: e.target.checked ? f.total_weight : '' }))}
                className="w-4 h-4 rounded accent-primary-600"
              />
              <span className="label mb-0">Is Gemstone (Weight-based)</span>
            </label>
            {form.is_gemstone && (
              <div className="space-y-2">
                <div>
                  <label className="label">Weight Unit</label>
                  <select value={form.weight_unit} onChange={e => setForm(f => ({ ...f, weight_unit: e.target.value as 'grams' | 'carats' }))} className="input">
                    <option value="grams">Grams (g)</option>
                    <option value="carats">Carats (ct)</option>
                  </select>
                </div>
                <div>
                  <label className="label">Total Weight ({form.weight_unit})</label>
                  <input type="number" step="0.01" value={form.total_weight} onChange={e => setForm(f => ({ ...f, total_weight: e.target.value }))} className="input" placeholder="e.g., 125.50" />
                </div>
                <div>
                  <label className="label">Weight per piece ({form.weight_unit})</label>
                  <input type="number" step="0.01" value={form.weight_grams} onChange={e => setForm(f => ({ ...f, weight_grams: e.target.value }))} className="input" placeholder="0" />
                </div>
              </div>
            )}
          </div>
          {isAdmin && (
            <div>
              <label className="label">Purchase Price (₹)</label>
              <input type="number" value={form.purchase_price} onChange={e => setForm(f => ({ ...f, purchase_price: e.target.value }))} className="input" placeholder="0" />
            </div>
          )}
          <div>
            <label className="label">Selling Price (₹)</label>
            <input type="number" value={form.selling_price} onChange={e => setForm(f => ({ ...f, selling_price: e.target.value }))} className="input" placeholder="0" />
          </div>
          {!editing && (
            <div>
              <label className="label">Opening Stock</label>
              <input type="number" value={form.stock_quantity} onChange={e => setForm(f => ({ ...f, stock_quantity: e.target.value }))} className="input" placeholder="0" />
            </div>
          )}
          <div className="col-span-2">
            <label className="label">Description</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="input resize-none h-20" placeholder="Optional description..." />
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showStockModal && !!selectedProduct}
        onClose={() => setShowStockModal(false)}
        title={`Update Stock — ${selectedProduct?.name || ''}`}
        size="sm"
        footer={
          <>
            <button onClick={() => setShowStockModal(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleStockUpdate} className="btn-primary">Update Stock</button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="label">Movement Type</label>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { value: 'purchase', label: 'Purchase (In)' },
                { value: 'sale', label: 'Sale (Out)' },
                { value: 'return', label: 'Return (In)' },
                { value: 'adjustment', label: 'Adjustment' },
              ].map(t => (
                <button key={t.value} onClick={() => setStockForm(f => ({ ...f, movement_label: t.value, type: ['purchase','return'].includes(t.value) ? 'in' : t.value === 'sale' ? 'out' : 'adjustment' }))}
                  className={`py-2 px-3 rounded-lg text-xs font-medium transition-colors text-left ${stockForm.movement_label === t.value ? 'bg-primary-600 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">
              {selectedProduct?.is_gemstone ? `Quantity / Weight (${selectedProduct?.weight_unit || 'grams'})` : 'Quantity'}
            </label>
            <input type="number" step={selectedProduct?.is_gemstone ? '0.01' : '1'} min={0} value={stockForm.quantity} onChange={e => setStockForm(f => ({ ...f, quantity: e.target.value }))} className="input" placeholder="0" />
            {selectedProduct?.is_gemstone && (
              <p className="text-[10px] text-neutral-400 mt-1">Partial quantities allowed (e.g., 2.5 grams)</p>
            )}
          </div>
          <div>
            <label className="label">Notes / Reference</label>
            <input value={stockForm.notes} onChange={e => setStockForm(f => ({ ...f, notes: e.target.value }))} className="input" placeholder="Invoice #, supplier name, reason..." />
          </div>
          {selectedProduct && (
            <div className="bg-neutral-50 px-3 py-2 rounded-lg space-y-1">
              <p className="text-xs text-neutral-500">Current stock: <strong>{selectedProduct.stock_quantity} {selectedProduct.unit}</strong></p>
              {selectedProduct.is_gemstone && (selectedProduct.remaining_weight ?? 0) > 0 && (
                <p className="text-xs text-primary-600 font-medium">
                  Weight available: {selectedProduct.remaining_weight}{selectedProduct.weight_unit === 'carats' ? ' carats' : 'g'}
                </p>
              )}
            </div>
          )}
        </div>
      </Modal>

      <Modal
        isOpen={showLedgerModal}
        onClose={() => setShowLedgerModal(false)}
        title={`Stock Ledger — ${ledgerProduct?.name || ''}`}
        size="lg"
        footer={<button onClick={() => setShowLedgerModal(false)} className="btn-secondary">Close</button>}
      >
        <div>
          {ledgerProduct && (
            <div className="flex items-center gap-4 mb-4 p-3 bg-neutral-50 rounded-xl">
              <div>
                <p className="text-xs text-neutral-400">Current Stock</p>
                <p className="text-lg font-bold text-neutral-800">{ledgerProduct.stock_quantity} {ledgerProduct.unit}</p>
              </div>
              {ledgerProduct.is_gemstone && (ledgerProduct.remaining_weight ?? 0) > 0 && (
                <div>
                  <p className="text-xs text-neutral-400">Weight Available</p>
                  <p className="text-lg font-bold text-primary-700">{ledgerProduct.remaining_weight}{ledgerProduct.weight_unit === 'carats' ? ' ct' : 'g'}</p>
                </div>
              )}
            </div>
          )}
          {stockMovements.length === 0 ? (
            <EmptyState icon={History} title="No movements yet" description="Stock movements will appear here after purchases, sales, and adjustments." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-100">
                    <th className="table-header text-left">Date</th>
                    <th className="table-header text-left">Type</th>
                    <th className="table-header text-right">Qty In</th>
                    <th className="table-header text-right">Qty Out</th>
                    <th className="table-header text-left">Notes / Ref</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-50">
                  {stockMovements.map(mv => {
                    const isIn = ['in','purchase','return'].includes(mv.movement_type);
                    const typeColors: Record<string, string> = {
                      purchase: 'bg-success-50 text-success-700',
                      sale: 'bg-error-50 text-error-700',
                      return: 'bg-blue-50 text-blue-700',
                      adjustment: 'bg-neutral-100 text-neutral-600',
                      in: 'bg-success-50 text-success-700',
                      out: 'bg-error-50 text-error-700',
                    };
                    return (
                      <tr key={mv.id} className="hover:bg-neutral-50 transition-colors">
                        <td className="table-cell text-xs text-neutral-500">{formatDate(mv.created_at)}</td>
                        <td className="table-cell">
                          <span className={`badge text-[10px] capitalize ${typeColors[mv.movement_type] || 'bg-neutral-100 text-neutral-600'}`}>{mv.movement_type}</span>
                        </td>
                        <td className="table-cell text-right font-medium text-success-600">
                          {isIn ? `+${mv.quantity}` : '—'}
                        </td>
                        <td className="table-cell text-right font-medium text-error-600">
                          {!isIn && mv.movement_type !== 'adjustment' ? `-${mv.quantity}` : mv.movement_type === 'adjustment' ? `=${mv.quantity}` : '—'}
                        </td>
                        <td className="table-cell text-xs text-neutral-500 max-w-[160px] truncate">{mv.notes || mv.reference_number || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!confirmProduct}
        onClose={() => setConfirmProduct(null)}
        onConfirm={() => confirmProduct && handleDelete(confirmProduct)}
        title="Delete Product"
        message={`Delete "${confirmProduct?.name}"? This product will be removed from the inventory.`}
        confirmLabel="Delete"
        isDanger
      />
    </div>
  );
}
