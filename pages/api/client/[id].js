import { haloFetch, haloFetchAll } from '../../../lib/halo';
import { indexChildren, progressFor } from '../../../lib/progress';
import { signProject } from '../../../lib/token';

export default async function handler(req, res) {
  const { id } = req.query;
  try {
    const [clientData, all] = await Promise.all([
      haloFetch(`/api/Client/${id}`),
      haloFetchAll(`/api/Projects?client_id=${id}`),
    ]);

    const childrenByParent = indexChildren(all);

    const projects = all
      .filter(p => !p.parent_id && p.tickettype_id === 5 && p.client_id == id)
      .map(p => {
        const { total, done } = progressFor(p, childrenByParent);
        return {
          id:           p.id,
          token:        signProject(p.id),
          summary:      p.summary,
          status_id:    p.status_id,
          agent_name:   p.takenby || '',
          dateoccurred: p.dateoccurred,
          total_tasks:  total,
          done_tasks:   done,
          pct_complete: total > 0 ? Math.round((done / total) * 100) : 0,
          hours_logged: p.projecttimeactual || 0,
        };
      })
      .sort((a, b) => new Date(b.dateoccurred) - new Date(a.dateoccurred));

    res.status(200).json({
      client: {
        id:     clientData.id,
        name:   clientData.name,
        colour: clientData.colour || '#89b4fa',
      },
      projects,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
