import { useState } from 'react';
import { Calendar, ChevronDown, RefreshCw } from 'lucide-react';
import { useDateRange } from '../../contexts/DateRangeContext';

export default function DateRangeBar() {
  const { dateRange, setDateRange, resetToThisMonth, resetToThisYear, label } = useDateRange();
  const [open, setOpen] = useState(false);
  const [tempFrom, setTempFrom] = useState(dateRange.from);
  const [tempTo, setTempTo] = useState(dateRange.to);

  const handleApply = () => {
    setDateRange({ from: tempFrom, to: tempTo });
    setOpen(false);
  };

  const presets = [
    {
      label: 'This Month', action: () => {
        resetToThisMonth(); setOpen(false);
      }
    },
    {
      label: 'This Year', action: () => {
        resetToThisYear(); setOpen(false);
      }
    },
    {
      label: 'Last Month', action: () => {
        const now = new Date();
        const from = `${now.getFullYear()}-${String(now.getMonth()).padStart(2, '0')}-01`;
        const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
        setDateRange({ from, to: lastDay.toISOString().split('T')[0] });
        setOpen(false);
      }
    },
    {
      label: 'Last 3 Months', action: () => {
        const now = new Date();
        const from = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        setDateRange({ from: from.toISOString().split('T')[0], to: now.toISOString().split('T')[0] });
        setOpen(false);
      }
    },
    {
      label: 'Last 6 Months', action: () => {
        const now = new Date();
        const from = new Date(now.getFullYear(), now.getMonth() - 5, 1);
        setDateRange({ from: from.toISOString().split('T')[0], to: now.toISOString().split('T')[0] });
        setOpen(false);
      }
    },
  ];

  return (
    <div className="relative no-print">
      <button
        onClick={() => { setTempFrom(dateRange.from); setTempTo(dateRange.to); setOpen(!open); }}
        className="flex items-center gap-2 bg-white border border-neutral-200 rounded-lg px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 transition-colors shadow-card"
      >
        <Calendar className="w-3.5 h-3.5 text-primary-600" />
        <span>{label}</span>
        <ChevronDown className={`w-3 h-3 text-neutral-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-9 bg-white border border-neutral-200 rounded-xl shadow-card-lg z-40 w-80 p-4">
            <p className="text-xs font-semibold text-neutral-600 mb-3">Select Date Range</p>

            <div className="grid grid-cols-2 gap-2 mb-3">
              {presets.map(p => (
                <button key={p.label} onClick={p.action}
                  className="text-xs py-1.5 px-2 rounded-lg bg-neutral-50 hover:bg-primary-50 hover:text-primary-700 text-neutral-600 transition-colors font-medium border border-neutral-100 text-left">
                  {p.label}
                </button>
              ))}
            </div>

            <div className="border-t border-neutral-100 pt-3">
              <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">Custom Range</p>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div>
                  <label className="label">From</label>
                  <input type="date" value={tempFrom} onChange={e => setTempFrom(e.target.value)} className="input text-xs" />
                </div>
                <div>
                  <label className="label">To</label>
                  <input type="date" value={tempTo} onChange={e => setTempTo(e.target.value)} className="input text-xs" />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { resetToThisMonth(); setOpen(false); }} className="btn-ghost text-xs flex-1 justify-center gap-1">
                  <RefreshCw className="w-3 h-3" /> Reset
                </button>
                <button onClick={handleApply} className="btn-primary text-xs flex-1 justify-center">Apply</button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
