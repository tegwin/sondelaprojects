import { verifyProject } from '../../../lib/token';
import { isLinkValid } from '../../../lib/redis';
import { haloFetch } from '../../../lib/halo';

export default async function handler(req, res) {
  const { token } = req.query;
  const projectId = verifyProject(token);
  if (!projectId) return res.status(404).json({ error: 'Invalid token' });

  const linkCheck = await isLinkValid(projectId);
  if (!linkCheck.valid) return res.status(410).json({ error: 'Link inactive' });

  try {
    const project = await haloFetch(`/api/Projects/${projectId}`);
    const milestones = project.milestones || [];
    const ticketIds = [...new Set(milestones.flatMap(ms => ms.tickets_list.map(r => r.id)))];

    // Fetch attachments for each ticket in parallel
    const allAttachments = [];
    await Promise.all(ticketIds.map(async id => {
      try {
        const data = await haloFetch(`/api/Attachment?ticket_id=${id}&pagesize=50`);
        const atts = data.attachments || data || [];
        atts.forEach(a => {
          if (a.filename && !a.filename.startsWith('inline')) {
            allAttachments.push({
              id:       a.id,
              filename: a.filename,
              size:     a.filesize || 0,
              date:     a.date_uploaded?.substring(0, 10) || null,
              ticketId: id,
              url:      `${process.env.HALO_BASE_URL}/api/Attachment/${a.id}`,
            });
          }
        });
      } catch {}
    }));

    res.status(200).json({ attachments: allAttachments });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
