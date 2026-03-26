import { haloFetch } from '../../lib/halo';

export default async function handler(req, res) {
  try {
    // tickettype_id=5 is the Project type in HaloPSA
    // Also filter to only parent-level items (no parent_id)
    const data = await haloFetch('/api/Projects?pagesize=100&tickettype_id=5');
    const all = data.tickets || data.projects || [];

    // Keep only top-level projects (no parent_id means it's not a sub-task)
    const projects = all
      .filter(p => !p.parent_id && p.tickettype_id === 5)
      .map(p => ({
        id: p.id,
        summary: p.summary,
        client_name: p.client_name,
        client_id: p.client_id,
        status_id: p.status_id,
        agent_name: p.takenby,
        dateoccurred: p.dateoccurred,
      }));

    res.status(200).json({ projects });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
