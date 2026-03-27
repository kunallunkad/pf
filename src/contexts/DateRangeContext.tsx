import { createContext, useContext, useState } from 'react';

interface DateRange {
  from: string;
  to: string;
}

interface DateRangeContextType {
  dateRange: DateRange;
  setDateRange: (range: DateRange) => void;
  resetToThisMonth: () => void;
  resetToThisYear: () => void;
  label: string;
}

const getThisMonthRange = (): DateRange => {
  const now = new Date();
  return {
    from: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`,
    to: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0],
  };
};

const DateRangeContext = createContext<DateRangeContextType | null>(null);

export function DateRangeProvider({ children }: { children: React.ReactNode }) {
  const [dateRange, setDateRangeState] = useState<DateRange>(getThisMonthRange());

  const setDateRange = (range: DateRange) => setDateRangeState(range);

  const resetToThisMonth = () => setDateRangeState(getThisMonthRange());

  const resetToThisYear = () => {
    const now = new Date();
    setDateRangeState({
      from: `${now.getFullYear()}-01-01`,
      to: `${now.getFullYear()}-12-31`,
    });
  };

  const formatLabel = () => {
    const from = new Date(dateRange.from);
    const to = new Date(dateRange.to);
    const fromStr = from.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' });
    const toStr = to.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' });
    return `${fromStr} – ${toStr}`;
  };

  return (
    <DateRangeContext.Provider value={{ dateRange, setDateRange, resetToThisMonth, resetToThisYear, label: formatLabel() }}>
      {children}
    </DateRangeContext.Provider>
  );
}

export function useDateRange() {
  const ctx = useContext(DateRangeContext);
  if (!ctx) throw new Error('useDateRange must be used within DateRangeProvider');
  return ctx;
}
