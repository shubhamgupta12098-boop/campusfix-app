// Neutral placeholder shown when a locally stored photo cannot be displayed.
export const BROKEN_IMAGE_FALLBACK = 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <rect width="100" height="100" fill="#f1f5f9"/>
    <path d="M30 65 L42 50 L52 60 L66 42 L74 65 Z" fill="#cbd5e1"/>
    <circle cx="38" cy="38" r="6" fill="#cbd5e1"/>
    <rect x="20" y="20" width="60" height="60" rx="6" fill="none" stroke="#cbd5e1" stroke-width="3"/>
  </svg>`);
// Attach as onError={onImageError} to any <img src=...> that points at a user-uploaded
// photo. Swaps in the placeholder once, so a dead link can't loop retry requests forever.
export function onImageError(e) {
    const img = e.currentTarget;
    if (img.dataset.fallbackApplied)
        return;
    img.dataset.fallbackApplied = 'true';
    img.src = BROKEN_IMAGE_FALLBACK;
    img.classList.add('p-4', 'opacity-60');
}
export const STATUS_CONFIG = {
    submitted: { label: 'Submitted', color: 'text-slate-700', bg: 'bg-slate-100', dot: 'bg-slate-500' },
    verified: { label: 'Verified', color: 'text-blue-700', bg: 'bg-blue-50', dot: 'bg-blue-500' },
    assigned: { label: 'Assigned', color: 'text-indigo-700', bg: 'bg-indigo-50', dot: 'bg-indigo-500' },
    in_progress: { label: 'In Progress', color: 'text-amber-700', bg: 'bg-amber-50', dot: 'bg-amber-500' },
    waiting_approval: { label: 'Waiting Approval', color: 'text-violet-700', bg: 'bg-violet-50', dot: 'bg-violet-500' },
    resolved: { label: 'Closed', color: 'text-emerald-700', bg: 'bg-emerald-50', dot: 'bg-emerald-500' },
    closed: { label: 'Closed', color: 'text-slate-600', bg: 'bg-slate-100', dot: 'bg-slate-400' },
    rejected: { label: 'Rejected', color: 'text-red-700', bg: 'bg-red-50', dot: 'bg-red-500' },
};
export const PRIORITY_CONFIG = {
    low: { label: 'Low', color: 'text-slate-700', bg: 'bg-slate-100', border: 'border-slate-200' },
    medium: { label: 'Medium', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
    high: { label: 'High', color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200' },
    emergency: { label: 'Emergency', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' },
};
export const STATUS_FLOW = [
    'submitted', 'verified', 'assigned', 'in_progress', 'waiting_approval', 'closed'
];
// Single source of truth for how a complaint's status is labeled on the staff
// (technician) screens. Home and My Work must always show the same label/tone
// for the same status — previously each screen had its own copy of this
// mapping and they had drifted apart (Home said "Assigned", My Work said
// "Pending" for the same complaint), which made the status look wrong.
export function staffStatusLabel(status) {
    if (status === 'assigned')
        return { label: 'Pending', tone: 'assigned' };
    if (status === 'in_progress')
        return { label: 'In Progress', tone: 'progress' };
    if (status === 'waiting_approval')
        return { label: 'Under Review', tone: 'review' };
    if (['resolved', 'closed'].includes(status))
        return { label: 'Closed', tone: 'closed' };
    return { label: 'Open', tone: 'open' };
}
export function formatDate(dateStr) {
    if (!dateStr)
        return '—';
    return new Date(dateStr).toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}
export function timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1)
        return 'just now';
    if (mins < 60)
        return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24)
        return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30)
        return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}
