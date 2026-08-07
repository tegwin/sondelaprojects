import { haloFetchAll } from '../../lib/halo';
import { signProject } from '../../lib/token';

// Closed is the only status that hides a project. Everything else — New,
// In Progress, On Hold, Awaiting Approval, anything added later — counts as open.
const CLOSED_STATUS_ID = 9;

export default async function handler(req, res) {
  try {
    const [all, clientList] = await Promise.all([
      haloFetchAll('/api/Projects?tickettype_id=5'),
      haloFetchAll('/api/Client'),
    ]);

    const clientMap = {};
    clientList.forEach(c => {
      clientMap[c.id] = { colour: c.colour || '#89b4fa', name: c.name };
    });

    const projects = all
      .filter(p => !p.parent_id && p.tickettype_id === 5)
      .filter(p => p.status_id !== CLOSED_STATUS_ID)
      .map(p => {
        const total  = p.child_count || 0;
        const open   = p.child_count_open || 0;
        const done   = Math.max(0, total - open);
        const pct    = total > 0 ? Math.round((done / total) * 100) : 0;
        const client = clientMap[p.client_id] || {};
        return {
          id:            p.id,
          token:         signProject(p.id),   // secure unguessable URL token
          summary:       p.summary,
          client_id:     p.client_id,
          client_name:   p.client_name,
          client_colour: client.colour || '#89b4fa',
          status_id:     p.status_id,
          agent_name:    p.takenby || '',
          dateoccurred:  p.dateoccurred,
          total_tasks:   total,
          done_tasks:    done,
          pct_complete:  pct,
          hours_logged:  p.projecttimeactual || 0,
          budget_hours:  p.budgets?.[0]?.hours || null,
        };
      });

    res.status(200).json({ projects });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
