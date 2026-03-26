import { haloFetch } from '../../lib/halo';

export default async function handler(req, res) {
  try {
    const data = await haloFetch('/api/Projects?pagesize=100');
    const projects = (data.tickets || data.projects || []).map(p => ({
      id: p.id,
      summary: p.summary,
      client_name: p.client_name,
      status_id: p.status_id,
    }));
    res.status(200).json({ projects });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
