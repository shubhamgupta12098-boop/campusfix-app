import type { ComplaintStatus, ComplaintPriority } from '@/lib/supabase';

export const STATUS_CONFIG: Record<ComplaintStatus, { label: string; color: string; bg: string; dot: string }> = {
  submitted: { label: 'Submitted', color: 'text-slate-700', bg: 'bg-slate-100', dot: 'bg-slate-500' },
  verified: { label: 'Verified', color: 'text-blue-700', bg: 'bg-blue-50', dot: 'bg-blue-500' },
  assigned: { label: 'Assigned', color: 'text-indigo-700', bg: 'bg-indigo-50', dot: 'bg-indigo-500' },
  in_progress: { label: 'In Progress', color: 'text-amber-700', bg: 'bg-amber-50', dot: 'bg-amber-500' },
  resolved: { label: 'Resolved', color: 'text-emerald-700', bg: 'bg-emerald-50', dot: 'bg-emerald-500' },
  closed: { label: 'Closed', color: 'text-slate-600', bg: 'bg-slate-100', dot: 'bg-slate-400' },
  rejected: { label: 'Rejected', color: 'text-red-700', bg: 'bg-red-50', dot: 'bg-red-500' },
};

export const PRIORITY_CONFIG: Record<ComplaintPriority, { label: string; color: string; bg: string; border: string }> = {
  low: { label: 'Low', color: 'text-slate-700', bg: 'bg-slate-100', border: 'border-slate-200' },
  medium: { label: 'Medium', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
  high: { label: 'High', color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200' },
  emergency: { label: 'Emergency', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' },
};

export const STATUS_FLOW: ComplaintStatus[] = [
  'submitted', 'verified', 'assigned', 'in_progress', 'resolved', 'closed'
];

export function formatDate(dateStr?: string) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}
