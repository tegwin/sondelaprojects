import { haloFetchAll } from '../../../lib/halo';
import { getBulkLinkData } from '../../../lib/redis';
import { signProject } from '../../../lib/token';

export default async function handler(req, res) {
  try {
    const all = await haloFetchAll('/api/Projects?tickettype_id=5');
    const projects = all.filter(p => !p.parent_id && p.tickettype_id === 5);
    const ids = projects.map(p => p.id);
    const linkData = await getBulkLinkData(ids);
    const linkMap = {};
    linkData.forEach(l => { linkMap[l.projectId] = l; });

    const result = projects.map(p => {
      const link = linkMap[p.id] || { revoked: false, expiresAt: null, views: 0, firstView: null };
      const expired = link.expiresAt && new Date(link.expiresAt) < new Date();
      return {
        id:          p.id,
        token:       signProject(p.id),
        summary:     p.summary,
        client_name: p.client_name,
        revoked:     link.revoked || false,
        expiresAt:   link.expiresAt || null,
        expired,
        views:       link.views || 0,
        firstView:   link.firstView || null,
        status:      link.revoked ? 'revoked' : expired ? 'expired' : 'active',
      };
    });

    res.status(200).json({ links: result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
