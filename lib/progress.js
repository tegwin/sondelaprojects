// Closed is the only status that counts as finished. Everything else — New,
// In Progress, On Hold, Awaiting Approval, anything added later — is outstanding.
export const CLOSED_STATUS_ID = 9;

// Halo's project list returns child_count but NOT child_count_open, so the old
// `child_count - child_count_open` sum treated every project as fully done and
// every card read 100%. The child rows come back in the same paged response,
// so their statuses can be counted directly at no extra API cost.
export function indexChildren(rows) {
  const byParent = new Map();
  rows.forEach(row => {
    if (!row.parent_id) return;
    const kids = byParent.get(row.parent_id);
    if (kids) kids.push(row);
    else byParent.set(row.parent_id, [row]);
  });
  return byParent;
}

export function progressFor(project, childrenByParent) {
  const kids = childrenByParent.get(project.id) || [];
  // Fall back to child_count only for the total: reporting 0 done against a
  // known task count is honest, where the old code inferred 100%.
  const total = kids.length || project.child_count || 0;
  const done = kids.filter(k => k.status_id === CLOSED_STATUS_ID).length;
  return { total, done, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
}
