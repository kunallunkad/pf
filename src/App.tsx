import { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { DateRangeProvider } from './contexts/DateRangeContext';
import DateRangeBar from './components/layout/DateRangeBar';
import Sidebar from './components/layout/Sidebar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import Godowns from './pages/Godowns';
import Purchase from './pages/Purchase';
import SalesOrders from './pages/sales/SalesOrders';
import Invoices from './pages/sales/Invoices';
import DeliveryChallan from './pages/sales/DeliveryChallan';
import CRM from './pages/CRM';
import CalendarPage from './pages/Calendar';
import SalesReturns from './pages/sales/SalesReturns';
import Ledger from './pages/finance/Ledger';
import Expenses from './pages/finance/Expenses';
import Journal from './pages/finance/Journal';
import Courier from './pages/Courier';
import Reports from './pages/Reports';
import Automation from './pages/Automation';
import CompanySettings from './pages/CompanySettings';
import type { ActivePage } from './types';

function AppShell() {
  const { user, loading, isAdmin, canAccessFinance, canAccessSales, canAccessInventory } = useAuth();
  const [activePage, setActivePage] = useState<ActivePage>('dashboard');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-primary-600 border-t-transparent animate-spin" />
          <p className="text-xs text-neutral-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Login />;

  const navigate = (page: ActivePage) => setActivePage(page);

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard': return <Dashboard onNavigate={navigate} />;

      case 'crm': return <CRM />;
      case 'calendar': return <CalendarPage />;

      case 'sales-orders': return canAccessSales ? <SalesOrders onNavigate={navigate} /> : <Dashboard onNavigate={navigate} />;
      case 'invoices': return canAccessSales ? <Invoices /> : <Dashboard onNavigate={navigate} />;
      case 'challans': return canAccessSales ? <DeliveryChallan /> : <Dashboard onNavigate={navigate} />;
      case 'dispatch': return <Courier />;
      case 'sales-returns': return canAccessSales ? <SalesReturns /> : <Dashboard onNavigate={navigate} />;

      case 'inventory': return canAccessInventory ? <Inventory /> : <Dashboard onNavigate={navigate} />;
      case 'godowns': return canAccessInventory ? <Godowns /> : <Dashboard onNavigate={navigate} />;
      case 'purchase': return isAdmin ? <Purchase /> : <Dashboard onNavigate={navigate} />;

      case 'finance':
      case 'ledger': return canAccessFinance ? <Ledger /> : <Dashboard onNavigate={navigate} />;
      case 'expenses': return canAccessFinance ? <Expenses /> : <Dashboard onNavigate={navigate} />;
      case 'journal': return canAccessFinance ? <Journal /> : <Dashboard onNavigate={navigate} />;

      case 'courier': return <Courier />;
      case 'reports': return <Reports />;
      case 'automation': return isAdmin ? <Automation /> : <Dashboard onNavigate={navigate} />;
      case 'company-settings': return isAdmin ? <CompanySettings /> : <Dashboard onNavigate={navigate} />;

      default: return <Dashboard onNavigate={navigate} />;
    }
  };

  return (
    <div className="flex h-screen bg-neutral-50 overflow-hidden">
      <div className="no-print">
        <Sidebar activePage={activePage} onNavigate={navigate} />
      </div>
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="bg-white border-b border-neutral-100 px-4 py-2 flex items-center justify-end no-print">
          <DateRangeBar />
        </div>
        <main className="flex-1 flex flex-col overflow-hidden">
          {renderPage()}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <DateRangeProvider>
        <AppShell />
      </DateRangeProvider>
    </AuthProvider>
  );
}
