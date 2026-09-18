// Ticket notes and summaries come back from Halo as plain text typed by agents
// and end users. They are interpolated into HTML email bodies, so anything that
// looks like markup has to be neutralised first.
export function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
