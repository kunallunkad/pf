import { useState, useEffect } from 'react';
import { CalendarDays, Bell, Package, Users, AlertTriangle, ArrowRight, MapPin, Clock, TrendingUp, Star, Truck, FileText, ShoppingCart, BarChart2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatCurrency, formatDate } from '../lib/utils';
import { useDateRange } from '../contexts/DateRangeContext';
import { useAuth } from '../contexts/AuthContext';
import type { ActivePage, Customer, Appointment } from '../types';

interface DashboardProps {
  onNavigate: (page: ActivePage) => void;
}

interface ServiceRevenue {
  label: string;
  amount: number;
  color: string;
}

interface CityCount {
  city: string;
  count: number;
}

interface Alert {
  type: 'warning' | 'error' | 'info';
  message: string;
}

const APPT_COLORS: Record<string, string> = {
  'Astro Reading': 'bg-primary-100 text-primary-700 border-primary-200',
  'Vastu Audit': 'bg-accent-100 text-accent-700 border-accent-200',
  'Consultation': 'bg-blue-100 text-blue-700 border-blue-200',
  'Follow Up': 'bg-green-100 text-green-700 border-green-200',
  'Site Visit': 'bg-orange-100 text-orange-700 border-orange-200',
  'Video Call': 'bg-teal-100 text-teal-700 border-teal-200',
  'Phone Call': 'bg-neutral-100 text-neutral-600 border-neutral-200',
};

export default function Dashboard({ onNavigate }: DashboardProps) {
  const { dateRange } = useDateRange();
  const { isAdmin } = useAuth();

  const [followupsToday, setFollowupsToday] = useState<Customer[]>([]);
  const [todayAppts, setTodayAppts] = useState<Appointment[]>([]);
  const [pendingDeliveries, setPendingDeliveries] = useState(0);
  const [pendingPayments, setPendingPayments] = useState(0);
  const [totalReceivable, setTotalReceivable] = useState(0);
  const [topCities, setTopCities] = useState<CityCount[]>([]);
  const [serviceRevenue, setServiceRevenue] = useState<ServiceRevenue[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [recentInvoices, setRecentInvoices] = useState<{ id: string; invoice_number: string; customer_name: string; total_amount: number; status: string; invoice_date: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, [dateRange]);

  const toLocalDateStr = (d: Date) => {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };

  const loadDashboardData = async () => {
    setLoading(true);
    const today = toLocalDateStr(new Date());
    const fromDate = dateRange.from;
    const toDate = dateRange.to;

    const [
      followupRes,
      todayApptRes,
      challansRes,
      invoicesRes,
      recentRes,
      customersRes,
      lowStockRes,
      invoiceItemsRes,
    ] = await Promise.all([
      supabase.from('customers').select('id, name, phone, next_followup_date, city').eq('next_followup_date', today).eq('is_active', true),
      supabase.from('appointments').select('*').gte('start_time', today).lte('start_time', today + 'T23:59:59').order('start_time'),
      supabase.from('delivery_challans').select('id, status').in('status', ['draft', 'dispatched']),
      supabase.from('invoices').select('id, total_amount, outstanding_amount, status').gte('invoice_date', fromDate).lte('invoice_date', toDate).neq('status', 'cancelled'),
      supabase.from('invoices').select('id, invoice_number, customer_name, total_amount, status, invoice_date').order('created_at', { ascending: false }).limit(6),
      supabase.from('customers').select('city').eq('is_active', true),
      supabase.from('products').select('name, stock_quantity, low_stock_alert').eq('is_active', true),
      supabase.from('invoice_items').select('product_name, total_price, created_at').gte('created_at', fromDate).lte('created_at', toDate),
    ]);

    setFollowupsToday((followupRes.data || []) as Customer[]);
    setTodayAppts((todayApptRes.data || []) as Appointment[]);
    setPendingDeliveries((challansRes.data || []).length);

    const receivable = (invoicesRes.data || []).reduce((s, i) => s + (i.outstanding_amount || 0), 0);
    setTotalReceivable(receivable);

    const pendingCount = (invoicesRes.data || []).filter(i => i.status !== 'paid' && i.status !== 'cancelled').length;
    setPendingPayments(pendingCount);

    setRecentInvoices(recentRes.data || []);

    const cityMap: Record<string, number> = {};
    (customersRes.data || []).forEach((c: { city?: string }) => {
      if (c.city) {
        const key = c.city.trim();
        cityMap[key] = (cityMap[key] || 0) + 1;
      }
    });
    const sortedCities = Object.entries(cityMap).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([city, count]) => ({ city, count }));
    setTopCities(sortedCities);

    const vastuRevenue = (invoiceItemsRes.data || [])
      .filter((i: { product_name: string }) => /vastu|direction|north|south|east|west|pyramid|yantra/i.test(i.product_name))
      .reduce((s: number, i: { total_price: number }) => s + i.total_price, 0);

    const productRevenue = (invoiceItemsRes.data || [])
      .filter((i: { product_name: string }) => /gemstone|crystal|rudraksha|bracelet|ring|pendant/i.test(i.product_name))
      .reduce((s: number, i: { total_price: number }) => s + i.total_price, 0);

    const consultRevenue = (invoiceItemsRes.data || [])
      .filter((i: { product_name: string }) => /consult|astro|reading|session|report|chart|kundali|horoscope/i.test(i.product_name))
      .reduce((s: number, i: { total_price: number }) => s + i.total_price, 0);

    const totalRevenue = (invoicesRes.data || []).reduce((s, i) => s + i.total_amount, 0);
    const otherRevenue = Math.max(0, totalRevenue - vastuRevenue - productRevenue - consultRevenue);

    setServiceRevenue([
      { label: 'Vastu Services', amount: vastuRevenue, color: 'bg-accent-500' },
      { label: 'Products', amount: productRevenue, color: 'bg-primary-500' },
      { label: 'Consultation', amount: consultRevenue, color: 'bg-blue-500' },
      { label: 'Other', amount: otherRevenue, color: 'bg-neutral-300' },
    ].filter(s => s.amount > 0));

    const alertList: Alert[] = [];
    (lowStockRes.data || []).forEach((p: { name: string; stock_quantity: number; low_stock_alert: number }) => {
      if (p.stock_quantity <= p.low_stock_alert) {
        alertList.push({ type: 'warning', message: `Low Stock: ${p.name} (${p.stock_quantity} left)` });
      }
    });
    const overdueCount = (invoicesRes.data || []).filter(i => i.status === 'overdue').length;
    if (overdueCount > 0) alertList.push({ type: 'error', message: `${overdueCount} overdue invoice(s) need attention` });
    setAlerts(alertList.slice(0, 4));

    setLoading(false);
  };

  const formatTime = (iso: string) => new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

  const getStatusColor = (status: string) => {
    const map: Record<string, string> = {
      paid: 'text-success-600 bg-success-50',
      partial: 'text-warning-600 bg-warning-50',
      overdue: 'text-error-600 bg-error-50',
      sent: 'text-blue-700 bg-blue-50',
      draft: 'text-neutral-600 bg-neutral-100',
    };
    return map[status] || 'text-neutral-600 bg-neutral-100';
  };

  const totalServiceRevenue = serviceRevenue.reduce((s, r) => s + r.amount, 0);

  const kpis = [
    {
      label: "Today's Appointments",
      value: todayAppts.length,
      sub: todayAppts.length > 0 ? todayAppts[0]?.appointment_type : 'No appointments today',
      icon: CalendarDays,
      color: 'bg-primary-50 text-primary-600',
      onClick: () => onNavigate('calendar'),
    },
    {
      label: 'Follow-ups Due',
      value: followupsToday.length,
      sub: followupsToday.length > 0 ? followupsToday.map(f => f.name).join(', ').slice(0, 30) + (followupsToday.length > 2 ? '...' : '') : 'All clear',
      icon: Bell,
      color: followupsToday.length > 0 ? 'bg-warning-50 text-warning-600' : 'bg-success-50 text-success-600',
      onClick: () => onNavigate('crm'),
    },
    {
      label: 'Pending Deliveries',
      value: pendingDeliveries,
      sub: 'Challans in progress',
      icon: Truck,
      color: 'bg-blue-50 text-blue-600',
      onClick: () => onNavigate('challans'),
    },
    {
      label: 'Pending Payments',
      value: pendingDeliveries > 0 ? `${formatCurrency(totalReceivable)}` : formatCurrency(0),
      sub: `${pendingPayments} invoice(s) unpaid`,
      icon: TrendingUp,
      color: totalReceivable > 0 ? 'bg-error-50 text-error-600' : 'bg-success-50 text-success-600',
      onClick: () => onNavigate('ledger'),
    },
  ];

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-neutral-50">
        <div className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-neutral-50">
      <div className="p-6 space-y-5">
        {followupsToday.length > 0 && (
          <div className="flex items-center gap-3 p-3 bg-warning-50 border border-warning-200 rounded-xl">
            <Bell className="w-4 h-4 text-warning-600 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-warning-800">
                {followupsToday.length} follow-up{followupsToday.length > 1 ? 's' : ''} due today
              </p>
              <p className="text-xs text-warning-600 mt-0.5">
                {followupsToday.map(c => c.name).join(' · ')}
              </p>
            </div>
            <button onClick={() => onNavigate('crm')} className="flex items-center gap-1 text-xs font-semibold text-warning-700 hover:text-warning-900">
              View <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        )}

        <div className="grid grid-cols-4 gap-4">
          {kpis.map((kpi) => (
            <button key={kpi.label} onClick={kpi.onClick}
              className="card text-left hover:shadow-md transition-all group cursor-pointer">
              <div className="flex items-start justify-between mb-3">
                <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider leading-tight">{kpi.label}</p>
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${kpi.color}`}>
                  <kpi.icon className="w-3.5 h-3.5" />
                </div>
              </div>
              <p className="text-2xl font-bold text-neutral-900">{kpi.value}</p>
              <p className="text-xs mt-1 text-neutral-400 truncate">{kpi.sub}</p>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-5">
          <div className="col-span-2 space-y-5">
            {todayAppts.length > 0 && (
              <div className="card">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-neutral-800">Today's Schedule</p>
                  <button onClick={() => onNavigate('calendar')} className="text-xs text-primary-600 hover:underline flex items-center gap-1">
                    Full Calendar <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
                <div className="space-y-2">
                  {todayAppts.map(a => (
                    <div key={a.id} className={`flex items-center gap-3 p-3 rounded-xl border ${APPT_COLORS[a.appointment_type] || 'bg-blue-50 border-blue-200'}`}>
                      <div className="shrink-0">
                        <Clock className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{a.title}</p>
                        {a.customer_name && <p className="text-xs opacity-75 truncate">{a.customer_name}</p>}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-medium">{formatTime(a.start_time)}</p>
                        <p className="text-[10px] opacity-60">{a.appointment_type}</p>
                      </div>
                      {a.location && (
                        <div className="flex items-center gap-1 text-xs opacity-70">
                          <MapPin className="w-3 h-3" />{a.city || a.location}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-semibold text-neutral-800">Recent Invoices</p>
                <button onClick={() => onNavigate('invoices')} className="text-xs text-primary-600 hover:underline flex items-center gap-1">
                  View All <ArrowRight className="w-3 h-3" />
                </button>
              </div>
              {recentInvoices.length === 0 ? (
                <p className="text-xs text-neutral-400 text-center py-6">No invoices yet</p>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-neutral-100">
                      <th className="table-header text-left">Invoice #</th>
                      <th className="table-header text-left">Customer</th>
                      <th className="table-header text-left">Date</th>
                      <th className="table-header text-right">Amount</th>
                      <th className="table-header text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentInvoices.map((inv) => (
                      <tr key={inv.id} className="border-b border-neutral-50 hover:bg-neutral-50 transition-colors">
                        <td className="table-cell font-medium text-primary-700">{inv.invoice_number}</td>
                        <td className="table-cell">{inv.customer_name}</td>
                        <td className="table-cell text-neutral-500">{formatDate(inv.invoice_date)}</td>
                        <td className="table-cell text-right font-semibold">{formatCurrency(inv.total_amount)}</td>
                        <td className="table-cell">
                          <span className={`badge capitalize ${getStatusColor(inv.status)}`}>{inv.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="space-y-5">
            {isAdmin && (
              <div className="card">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Revenue by Service</p>
                  <button onClick={() => onNavigate('reports')} className="text-xs text-primary-600 hover:underline">Reports</button>
                </div>
                {serviceRevenue.length === 0 ? (
                  <p className="text-xs text-neutral-400 text-center py-4">No data for selected period</p>
                ) : (
                  <div className="space-y-3">
                    {serviceRevenue.map(s => (
                      <div key={s.label}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-neutral-700">{s.label}</span>
                          <span className="text-xs font-semibold text-neutral-900">{formatCurrency(s.amount)}</span>
                        </div>
                        <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                          <div className={`h-full ${s.color} rounded-full transition-all`}
                            style={{ width: totalServiceRevenue > 0 ? `${(s.amount / totalServiceRevenue) * 100}%` : '0%' }} />
                        </div>
                        <p className="text-[10px] text-neutral-400 mt-0.5">
                          {totalServiceRevenue > 0 ? `${((s.amount / totalServiceRevenue) * 100).toFixed(0)}%` : '0%'}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Top Cities</p>
                <MapPin className="w-3.5 h-3.5 text-neutral-400" />
              </div>
              {topCities.length === 0 ? (
                <p className="text-xs text-neutral-400 text-center py-4">No city data available</p>
              ) : (
                <div className="space-y-2.5">
                  {topCities.map((c, i) => (
                    <div key={c.city} className="flex items-center gap-2">
                      <span className="text-xs font-bold text-neutral-400 w-4">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-neutral-800 truncate">{c.city}</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="h-1.5 rounded-full bg-primary-500" style={{ width: `${Math.max(20, (c.count / topCities[0].count) * 60)}px` }} />
                        <span className="text-xs font-semibold text-neutral-600 w-5 text-right">{c.count}</span>
                        <Users className="w-3 h-3 text-neutral-400" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Business Alerts</p>
                <AlertTriangle className="w-3.5 h-3.5 text-neutral-400" />
              </div>
              {alerts.length === 0 ? (
                <div className="flex flex-col items-center py-4">
                  <div className="w-10 h-10 bg-success-50 rounded-full flex items-center justify-center mb-2">
                    <Star className="w-5 h-5 text-success-600" />
                  </div>
                  <p className="text-xs text-neutral-500 text-center">All systems normal</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {alerts.map((alert, i) => (
                    <div key={i} className={`flex items-start gap-2 p-2.5 rounded-lg ${alert.type === 'error' ? 'bg-error-50' : alert.type === 'warning' ? 'bg-warning-50' : 'bg-blue-50'}`}>
                      <AlertTriangle className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${alert.type === 'error' ? 'text-error-600' : alert.type === 'warning' ? 'text-warning-600' : 'text-blue-600'}`} />
                      <p className="text-xs text-neutral-700">{alert.message}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card">
              <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">Quick Actions</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'New Invoice', page: 'invoices' as ActivePage, icon: FileText, color: 'text-primary-600 bg-primary-50' },
                  { label: 'Sales Order', page: 'sales-orders' as ActivePage, icon: ShoppingCart, color: 'text-blue-600 bg-blue-50' },
                  { label: 'Add Client', page: 'crm' as ActivePage, icon: Users, color: 'text-green-600 bg-green-50' },
                  { label: 'Schedule', page: 'calendar' as ActivePage, icon: CalendarDays, color: 'text-teal-600 bg-teal-50' },
                  { label: 'Add Product', page: 'inventory' as ActivePage, icon: Package, color: 'text-orange-600 bg-orange-50' },
                  { label: 'Reports', page: 'reports' as ActivePage, icon: BarChart2, color: 'text-neutral-600 bg-neutral-100' },
                ].map((action) => (
                  <button key={action.label} onClick={() => onNavigate(action.page)}
                    className="flex items-center gap-2 p-2.5 rounded-xl border border-neutral-100 hover:bg-neutral-50 hover:border-neutral-200 transition-all text-left group">
                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${action.color}`}>
                      <action.icon className="w-3 h-3" />
                    </div>
                    <span className="text-[11px] font-medium text-neutral-700 group-hover:text-neutral-900 leading-tight">{action.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Upcoming</p>
                <button onClick={() => onNavigate('calendar')} className="text-xs text-primary-600 hover:underline flex items-center gap-1">
                  Calendar <ArrowRight className="w-3 h-3" />
                </button>
              </div>
              {(() => {
                const upcoming = (() => {
                  const now = new Date();
                  const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
                  return todayAppts.filter(a => {
                    const d = new Date(a.start_time);
                    return d >= now && d <= sevenDays;
                  }).slice(0, 4);
                })();
                if (upcoming.length === 0) {
                  return <p className="text-xs text-neutral-400 text-center py-3">No upcoming appointments today</p>;
                }
                return (
                  <div className="space-y-2">
                    {upcoming.map(a => (
                      <div key={a.id} className={`flex items-start gap-2 p-2 rounded-lg border text-xs ${APPT_COLORS[a.appointment_type] || 'bg-blue-50 border-blue-200 text-blue-700'}`}>
                        <Clock className="w-3 h-3 mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <p className="font-medium truncate">{a.title}</p>
                          <p className="opacity-70">{new Date(a.start_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
