import { haloFetchAll } from '../../lib/halo';
import { signProject } from '../../lib/token';
import { CLOSED_STATUS_ID, indexChildren, progressFor } from '../../lib/progress';

export default async function handler(req, res) {
  try {
    // No tickettype_id filter: Halo ignores it anyway, and the child rows in the
    // full set are what the progress figures are counted from.
    const [all, clientList] = await Promise.all([
      haloFetchAll('/api/Projects'),
      haloFetchAll('/api/Client'),
    ]);

    const clientMap = {};
    clientList.forEach(c => {
      clientMap[c.id] = { colour: c.colour || '#89b4fa', name: c.name };
    });

    const childrenByParent = indexChildren(all);

    const projects = all
      .filter(p => !p.parent_id && p.tickettype_id === 5)
      .filter(p => p.status_id !== CLOSED_STATUS_ID)
      .map(p => {
        const { total, done, pct } = progressFor(p, childrenByParent);
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
