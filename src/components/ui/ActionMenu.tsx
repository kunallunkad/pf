import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { MoreVertical, Eye, Pencil, Trash2, Printer, Download } from 'lucide-react';

interface ActionItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  className?: string;
}

interface ActionMenuProps {
  items: ActionItem[];
}

export default function ActionMenu({ items }: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, right: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleOpen = () => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    setPosition({
      top: rect.bottom + window.scrollY + 4,
      right: window.innerWidth - rect.right - window.scrollX,
    });
    setOpen(v => !v);
  };

  return (
    <>
      <button ref={btnRef} onClick={handleOpen}
        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-neutral-100 transition-colors">
        <MoreVertical className="w-3.5 h-3.5 text-neutral-500" />
      </button>
      {open && createPortal(
        <div ref={menuRef}
          style={{ position: 'fixed', top: position.top, right: position.right, zIndex: 9999 }}
          className="bg-white border border-neutral-200 rounded-xl shadow-lg py-1 min-w-[140px]">
          {items.map((item, i) => (
            <button key={i} onClick={() => { item.onClick(); setOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-neutral-50 transition-colors ${item.className || 'text-neutral-700'}`}>
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  );
}

export const actionView = (onClick: () => void) => ({
  label: 'View', icon: <Eye className="w-3.5 h-3.5" />, onClick,
});
export const actionEdit = (onClick: () => void) => ({
  label: 'Edit', icon: <Pencil className="w-3.5 h-3.5" />, onClick,
});
export const actionDelete = (onClick: () => void) => ({
  label: 'Delete', icon: <Trash2 className="w-3.5 h-3.5" />, onClick, className: 'text-error-600 hover:bg-error-50',
});
export const actionPrint = (onClick: () => void) => ({
  label: 'Print', icon: <Printer className="w-3.5 h-3.5" />, onClick,
});
export const actionExport = (onClick: () => void) => ({
  label: 'Export CSV', icon: <Download className="w-3.5 h-3.5" />, onClick,
});
