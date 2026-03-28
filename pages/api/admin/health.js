import { haloFetch } from '../../../lib/halo';
import { signProject } from '../../../lib/token';
import { getNextSessionOverride, getBulkLinkData } from '../../../lib/redis';

const CLOSED = [9, 16, 21];
const ACTIVE  = [2, 22];

function fmtDate(d) {
  if (!d || d.startsWith('1900') || d.startsWith('0001')) return null;
  return d.substring(0, 10);
}

function calcRAG(tasks) {
  const today = new Date(); today.setHours(0,0,0,0);
  let overdue = 0, atRisk = 0;
  for (const t of tasks) {
    if (CLOSED.includes(t.status_id)) continue;
    const target = fmtDate(t.targetdate);
    if (!target) continue;
    const diff = (new Date(target) - today) / 86400000;
    if (diff < 0) overdue++;
    else if (diff <= 7) atRisk++;
  }
  if (overdue > 0) return { status: 'red',   label: `${overdue} overdue` };
  if (atRisk  > 0) return { status: 'amber', label: `${atRisk} due soon` };
  return { status: 'green', label: 'On track' };
}

export default async function handler(req, res) {
  try {
    const [projectData, clientData] = await Promise.all([
      haloFetch('/api/Projects?pagesize=200&tickettype_id=5'),
      haloFetch('/api/Client?pagesize=200'),
    ]);

    const clientMap = {};
    (clientData.clients || clientData || []).forEach(c => { clientMap[c.id] = c; });

    const all = (projectData.tickets || projectData.projects || [])
      .filter(p => !p.parent_id && p.tickettype_id === 5 && p.status_id !== 9);

    const ids = all.map(p => p.id);
    const [linkDataArr, nextSessions] = await Promise.all([
      getBulkLinkData(ids),
      Promise.all(ids.map(id => getNextSessionOverride(id))),
    ]);

    const linkMap = {};
    linkDataArr.forEach(l => { linkMap[l.projectId] = l; });

    const projects = all.map((p, i) => {
      const total   = p.child_count || 0;
      const open    = p.child_count_open || 0;
      const done    = Math.max(0, total - open);
      const pct     = total > 0 ? Math.round((done / total) * 100) : 0;
      const hours   = p.projecttimeactual || 0;
      const budget  = p.budgets?.[0]?.hours || null;
      const client  = clientMap[p.client_id] || {};
      const link    = linkMap[p.id] || {};
      const ns      = nextSessions[i];

      // Simple burn rate from project-level data
      const hpt       = done > 0 ? hours / done : null;
      const projected = hpt ? Math.round((hours + hpt * (total - done)) * 10) / 10 : null;

      return {
        id:            p.id,
        token:         signProject(p.id),
        summary:       p.summary,
        client_id:     p.client_id,
        client_name:   p.client_name,
        client_colour: client.colour || '#89b4fa',
        pct,
        total,
        done,
        hours,
        budget,
        projected,
        rag:           { status: total===done&&total>0?'green':'amber', label: `${done}/${total} tasks` },
        nextSession:   ns || null,
        views:         link.views || 0,
        linkStatus:    link.revoked?'revoked':link.expiresAt&&new Date(link.expiresAt)<new Date()?'expired':'active',
      };
    });

    res.status(200).json({ projects });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
