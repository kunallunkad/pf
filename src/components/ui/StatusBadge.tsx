import { getStatusColor } from '../../lib/utils';

interface StatusBadgeProps {
  status: string;
  label?: string;
}

export default function StatusBadge({ status, label }: StatusBadgeProps) {
  return (
    <span className={`badge capitalize ${getStatusColor(status)}`}>
      {label || status.replace('_', ' ')}
    </span>
  );
}
