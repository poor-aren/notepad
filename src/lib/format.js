const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

export function timeAgo(ts) {
  if (!ts) return 'never';
  const diff = ts - Date.now();
  const abs = Math.abs(diff);
  if (abs < 45e3) return 'just now';
  if (abs < 36e5) return rtf.format(Math.round(diff / 6e4), 'minute');
  if (abs < 864e5) return rtf.format(Math.round(diff / 36e5), 'hour');
  if (abs < 6048e5) return rtf.format(Math.round(diff / 864e5), 'day');
  return new Date(ts).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' });
}

export const fileSafe = (name) =>
  (name || 'Untitled').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '').trim().slice(0, 80) || 'Untitled';
