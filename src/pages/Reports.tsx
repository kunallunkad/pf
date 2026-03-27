import { useState, useEffect } from 'react';
import { BarChart2, TrendingUp, Users, Package, Download } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatCurrency, exportToCSV } from '../lib/utils';
import { useDateRange } from '../contexts/DateRangeContext';

export default function Reports() {
  const { dateRange } = useDateRange();
  const [salesByMonth, setSalesByMonth] = useState<{ month: string; revenue: number; invoiceCount: number }[]>([]);
  const [topCustomers, setTopCustomers] = useState<{ name: string; revenue: number; invoiceCount: number }[]>([]);
  const [topProducts, setTopProducts] = useState<{ name: string; revenue: number; quantity: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadReports(); }, [dateRange]);

  const loadReports = async () => {
    setLoading(true);

    const [invoicesRes, itemsRes] = await Promise.all([
      supabase.from('invoices').select('invoice_date, total_amount, customer_name, customer_id')
        .gte('invoice_date', dateRange.from)
        .lte('invoice_date', dateRange.to)
        .neq('status', 'cancelled'),
      supabase.from('invoice_items').select('product_name, total_price, quantity, created_at')
        .gte('created_at', dateRange.from + 'T00:00:00')
        .lte('created_at', dateRange.to + 'T23:59:59'),
    ]);

    const invoices = invoicesRes.data || [];
    const items = itemsRes.data || [];

    const from = new Date(dateRange.from);
    const to = new Date(dateRange.to);
    const monthMap = new Map<string, { revenue: number; count: number; label: string }>();
    const cur = new Date(from.getFullYear(), from.getMonth(), 1);
    while (cur <= to) {
      const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`;
      const label = cur.toLocaleString('en-IN', { month: 'short', year: '2-digit' });
      monthMap.set(key, { revenue: 0, count: 0, label });
      cur.setMonth(cur.getMonth() + 1);
    }

    invoices.forEach(inv => {
      const key = inv.invoice_date.slice(0, 7);
      const entry = monthMap.get(key);
      if (entry) { entry.revenue += inv.total_amount; entry.count++; }
    });
    setSalesByMonth(Array.from(monthMap.entries()).map(([, val]) => ({
      month: val.label,
      revenue: val.revenue,
      invoiceCount: val.count,
    })));

    const custMap = new Map<string, { revenue: number; count: number }>();
    invoices.forEach(inv => {
      const entry = custMap.get(inv.customer_name) || { revenue: 0, count: 0 };
      entry.revenue += inv.total_amount;
      entry.count++;
      custMap.set(inv.customer_name, entry);
    });
    setTopCustomers(
      Array.from(custMap.entries())
        .map(([name, val]) => ({ name, revenue: val.revenue, invoiceCount: val.count }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10)
    );

    const prodMap = new Map<string, { revenue: number; qty: number }>();
    items.forEach((item: any) => {
      const entry = prodMap.get(item.product_name) || { revenue: 0, qty: 0 };
      entry.revenue += item.total_price;
      entry.qty += item.quantity;
      prodMap.set(item.product_name, entry);
    });
    setTopProducts(
      Array.from(prodMap.entries())
        .map(([name, val]) => ({ name, revenue: val.revenue, quantity: val.qty }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10)
    );

    setLoading(false);
  };

  const maxRevenue = Math.max(...salesByMonth.map(m => m.revenue), 1);
  const maxCustRevenue = topCustomers[0]?.revenue || 1;
  const maxProdRevenue = topProducts[0]?.revenue || 1;

  const handleExportSales = () => {
    exportToCSV(
      salesByMonth.map(m => ({ Month: m.month, Revenue: m.revenue, Invoices: m.invoiceCount })),
      'sales-by-month'
    );
  };

  const handleExportCustomers = () => {
    exportToCSV(
      topCustomers.map((c, i) => ({ Rank: i + 1, Customer: c.name, Revenue: c.revenue, Invoices: c.invoiceCount })),
      'top-customers'
    );
  };

  const handleExportProducts = () => {
    exportToCSV(
      topProducts.map((p, i) => ({ Rank: i + 1, Product: p.name, Revenue: p.revenue, Quantity: p.quantity })),
      'top-products'
    );
  };

  return (
    <div className="flex-1 overflow-y-auto bg-neutral-50">
      <div className="bg-white border-b border-neutral-100 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">Reports & Analytics</h1>
          <p className="text-xs text-neutral-500 mt-0.5">Business insights for the selected date range</p>
        </div>
        <button onClick={handleExportSales} className="btn-secondary text-xs">
          <Download className="w-3.5 h-3.5" /> Export Sales
        </button>
      </div>

      <div className="p-6 space-y-5">
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-neutral-800">Sales Trend</p>
            <div className="flex items-center gap-1 text-xs text-neutral-500">
              <TrendingUp className="w-3.5 h-3.5 text-primary-600" />
              Revenue by Month
            </div>
          </div>
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <p className="text-xs text-neutral-400">Loading...</p>
            </div>
          ) : (
            <div className="flex items-end gap-4" style={{ height: '160px' }}>
              {salesByMonth.map(m => (
                <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                  <p className="text-xs font-semibold text-neutral-700">{m.revenue > 0 ? formatCurrency(m.revenue) : ''}</p>
                  <div className="w-full flex flex-col justify-end" style={{ height: '120px' }}>
                    <div
                      className="w-full bg-primary-500 hover:bg-primary-600 rounded-t-lg transition-colors cursor-default"
                      style={{ height: `${(m.revenue / maxRevenue) * 100}%`, minHeight: m.revenue > 0 ? '8px' : '2px' }}
                      title={`${m.month}: ${formatCurrency(m.revenue)} (${m.invoiceCount} invoices)`}
                    />
                  </div>
                  <p className="text-[10px] text-neutral-500 font-medium">{m.month}</p>
                  <p className="text-[9px] text-neutral-400">{m.invoiceCount} inv</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-5">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-primary-600" />
                <p className="text-sm font-semibold text-neutral-800">Top Customers</p>
              </div>
              <button onClick={handleExportCustomers} className="btn-ghost text-xs py-1 px-2">
                <Download className="w-3 h-3" /> CSV
              </button>
            </div>
            {topCustomers.length === 0 ? (
              <p className="text-xs text-neutral-400 text-center py-4">No data available</p>
            ) : (
              <div className="space-y-2.5">
                {topCustomers.map((c, i) => (
                  <div key={c.name}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-neutral-400 w-4">#{i + 1}</span>
                        <span className="text-xs font-medium text-neutral-800 truncate max-w-[140px]">{c.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold text-neutral-900">{formatCurrency(c.revenue)}</span>
                        <span className="text-[9px] text-neutral-400 ml-1">({c.invoiceCount} inv)</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                      <div className="h-full bg-primary-400 rounded-full" style={{ width: `${(c.revenue / maxCustRevenue) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-accent-600" />
                <p className="text-sm font-semibold text-neutral-800">Top Products by Value</p>
              </div>
              <button onClick={handleExportProducts} className="btn-ghost text-xs py-1 px-2">
                <Download className="w-3 h-3" /> CSV
              </button>
            </div>
            {topProducts.length === 0 ? (
              <p className="text-xs text-neutral-400 text-center py-4">No data available</p>
            ) : (
              <div className="space-y-2.5">
                {topProducts.map((p, i) => (
                  <div key={p.name}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-neutral-400 w-4">#{i + 1}</span>
                        <span className="text-xs font-medium text-neutral-800 truncate max-w-[140px]">{p.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold text-neutral-900">{formatCurrency(p.revenue)}</span>
                        <span className="text-[9px] text-neutral-400 ml-1">(qty: {p.quantity})</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                      <div className="h-full bg-accent-400 rounded-full" style={{ width: `${(p.revenue / maxProdRevenue) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
