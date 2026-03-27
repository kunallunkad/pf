import { useEffect, useState } from 'react';
import { LayoutDashboard, Package, ShoppingCart, FileText, Users, BarChart2, Truck, BookOpen, Receipt, Zap, LogOut, Moon, RotateCcw, Building2, CalendarDays, CircleUser as UserCircle2, Settings } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import type { ActivePage } from '../../types';

interface SidebarProps {
  activePage: ActivePage;
  onNavigate: (page: ActivePage) => void;
}

export default function Sidebar({ activePage, onNavigate }: SidebarProps) {
  const { profile, isAdmin, signOut } = useAuth();
  const [unpaidInvoices, setUnpaidInvoices] = useState(0);
  const [pendingCouriers, setPendingCouriers] = useState(0);

  useEffect(() => {
    const loadBadges = async () => {
      const [invoiceRes, courierRes] = await Promise.all([
        supabase.from('invoices').select('id', { count: 'exact', head: true }).in('status', ['sent', 'partial', 'overdue']),
        supabase.from('courier_entries').select('id', { count: 'exact', head: true }).in('status', ['booked', 'in_transit']),
      ]);
      setUnpaidInvoices(invoiceRes.count || 0);
      setPendingCouriers(courierRes.count || 0);
    };
    loadBadges();
  }, []);

  const masterNav = [
    { id: 'inventory' as ActivePage, label: 'Products', icon: Package },
    ...(isAdmin ? [{ id: 'purchase' as ActivePage, label: 'Suppliers', icon: Building2 }] : []),
    ...(isAdmin ? [{ id: 'company-settings' as ActivePage, label: 'Company Details', icon: Settings }] : []),
  ];

  const crmNav = [
    { id: 'crm' as ActivePage, label: 'Clients', icon: UserCircle2 },
    { id: 'calendar' as ActivePage, label: 'Schedule', icon: CalendarDays },
  ];

  const operationsNav = [
    { id: 'sales-orders' as ActivePage, label: 'Sales Orders', icon: FileText },
    { id: 'challans' as ActivePage, label: 'Delivery Challans', icon: Truck },
    { id: 'invoices' as ActivePage, label: 'Invoices', icon: Receipt, badge: unpaidInvoices },
    { id: 'sales-returns' as ActivePage, label: 'Returns', icon: RotateCcw },
    ...(isAdmin ? [{ id: 'purchase' as ActivePage, label: 'Purchase', icon: ShoppingCart }] : []),
  ];

  const financeNav = isAdmin ? [
    { id: 'ledger' as ActivePage, label: 'Ledger', icon: BookOpen },
    { id: 'expenses' as ActivePage, label: 'Expenses', icon: Receipt },
    { id: 'journal' as ActivePage, label: 'Journal', icon: FileText },
  ] : [];

  const logisticsNav = [
    { id: 'courier' as ActivePage, label: 'Courier', icon: Truck, badge: pendingCouriers },
  ];

  const analyticsNav = [
    { id: 'reports' as ActivePage, label: 'Reports', icon: BarChart2 },
    ...(isAdmin ? [{ id: 'automation' as ActivePage, label: 'Automation', icon: Zap }] : []),
  ];

  const NavItem = ({
    id,
    label,
    icon: Icon,
    badge,
  }: {
    id: ActivePage;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
  }) => {
    const isActive = activePage === id;
    return (
      <button
        onClick={() => onNavigate(id)}
        className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 text-left group ${isActive ? 'bg-primary-600 text-white' : 'text-neutral-500 hover:bg-orange-50 hover:text-primary-700'}`}
      >
        <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-white' : 'text-neutral-400 group-hover:text-primary-600'}`} />
        <span className="truncate leading-none flex-1">{label}</span>
        {badge != null && badge > 0 && (
          <span className={`inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold leading-none ${isActive ? 'bg-white/30 text-white' : 'bg-error-600 text-white'}`}>
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </button>
    );
  };

  const SectionLabel = ({ label }: { label: string }) => (
    <p className="px-2.5 pt-2 pb-0.5 text-[9px] font-bold text-neutral-400 uppercase tracking-widest">{label}</p>
  );

  return (
    <aside className="w-48 bg-white border-r border-neutral-200 flex flex-col h-screen sticky top-0 shrink-0">
      <div className="px-3 py-3 border-b border-neutral-100">
        <div className="flex items-center gap-2.5">
          <img src="/pflogo.png" alt="Prachi Fulfagar" className="h-9 w-9 object-contain shrink-0" />
          <div>
            <p className="text-xs font-bold text-neutral-800 leading-tight">Prachi Fulfagar</p>
            <div className="flex items-center gap-1 mt-0.5">
              <Moon className="w-2.5 h-2.5 text-primary-500 shrink-0" />
              <p className="text-[9px] text-neutral-400 font-medium tracking-wide">Vastu · Palmist · Astrologer</p>
            </div>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-2 py-1.5 overflow-y-auto">
        <div className="space-y-0.5">
          <NavItem id="dashboard" label="Dashboard" icon={LayoutDashboard} />
        </div>

        <SectionLabel label="CRM" />
        <div className="space-y-0.5">
          {crmNav.map(item => <NavItem key={item.id} {...item} />)}
        </div>

        <SectionLabel label="Master Data" />
        <div className="space-y-0.5">
          {masterNav.map(item => <NavItem key={item.id + item.label} {...item} />)}
        </div>

        <SectionLabel label="Operations" />
        <div className="space-y-0.5">
          {operationsNav.filter((v, i, a) => a.findIndex(t => t.id === v.id && t.label === v.label) === i).map(item => <NavItem key={item.id + item.label} {...item} />)}
        </div>

        {isAdmin && financeNav.length > 0 && (
          <>
            <SectionLabel label="Finance" />
            <div className="space-y-0.5">
              {financeNav.map(item => <NavItem key={item.id + item.label} {...item} />)}
            </div>
          </>
        )}

        <SectionLabel label="Logistics" />
        <div className="space-y-0.5">
          {logisticsNav.map(item => <NavItem key={item.id} {...item} />)}
        </div>

        <SectionLabel label="Analytics" />
        <div className="space-y-0.5">
          {analyticsNav.map(item => <NavItem key={item.id} {...item} />)}
        </div>
      </nav>

      <div className="p-2 border-t border-neutral-100">
        <div className="flex items-center gap-2 mb-1 px-1">
          <div className="w-6 h-6 bg-primary-100 rounded-full flex items-center justify-center shrink-0">
            <span className="text-[10px] font-bold text-primary-700">
              {(profile?.display_name || profile?.email || 'U')[0].toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold text-neutral-800 truncate leading-tight">{profile?.display_name || profile?.email || 'User'}</p>
            <p className={`text-[9px] capitalize leading-tight ${isAdmin ? 'text-primary-600' : 'text-neutral-400'}`}>
              {isAdmin ? 'Administrator' : 'Staff'}
            </p>
          </div>
        </div>
        <button onClick={signOut}
          className="w-full flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] text-neutral-500 hover:bg-red-50 hover:text-red-600 transition-colors">
          <LogOut className="w-3 h-3" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
