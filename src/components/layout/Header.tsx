import { Bell, HelpCircle, Search } from 'lucide-react';

interface HeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  searchPlaceholder?: string;
  onSearch?: (query: string) => void;
}

export default function Header({ title, subtitle, actions, searchPlaceholder, onSearch }: HeaderProps) {
  return (
    <div className="bg-white border-b border-neutral-100 px-6 py-4 flex items-center justify-between sticky top-0 z-10 no-print">
      <div className="flex items-center gap-6 flex-1">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">{title}</h1>
          {subtitle && <p className="text-xs text-neutral-500 mt-0.5">{subtitle}</p>}
        </div>
        {onSearch && (
          <div className="relative max-w-sm w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type="text"
              placeholder={searchPlaceholder || 'Search...'}
              onChange={(e) => onSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-neutral-200 rounded-lg bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent focus:bg-white transition-all"
            />
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 ml-4">
        {actions}
        <button className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-neutral-100 transition-colors">
          <Bell className="w-4 h-4 text-neutral-500" />
        </button>
        <button className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-neutral-100 transition-colors">
          <HelpCircle className="w-4 h-4 text-neutral-500" />
        </button>
      </div>
    </div>
  );
}
