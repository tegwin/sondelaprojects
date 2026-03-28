import { verifyProject } from '../../../lib/token';
import { isLinkValid } from '../../../lib/redis';
import { haloFetch } from '../../../lib/halo';

export default async function handler(req, res) {
  const { token, taskId } = req.query;
  const projectId = verifyProject(token);
  if (!projectId) return res.status(404).json({ error: 'Not found' });

  const linkCheck = await isLinkValid(projectId);
  if (!linkCheck.valid) return res.status(410).json({ error: 'Link inactive' });

  try {
    const project = await haloFetch(`/api/Projects/${projectId}`);
    const milestones = project.milestones || [];
    const allIds = milestones.flatMap(ms => ms.tickets_list.map(r => r.id));

    // Fetch attachments for all tickets in parallel
    const results = await Promise.all(
      allIds.map(async id => {
        const data = await haloFetch(`/api/Attachments?ticket_id=${id}&pagesize=50`).catch(()=>null);
        if (!data) return [];
        const atts = data.attachments || data || [];
        return atts
          .filter(a => a.filename && !a.filename.startsWith('.'))
          .map(a => ({
            id:         a.id,
            filename:   a.filename,
            size:       a.filesize || 0,
            uploadedAt: a.dateuploaded ? a.dateuploaded.substring(0,10) : null,
            ticketId:   id,
            isImage:    /\.(png|jpg|jpeg|gif|webp)$/i.test(a.filename),
            url:        `${process.env.HALO_BASE_URL}/api/Attachments/${a.id}`,
          }));
      })
    );

    const attachments = results.flat();
    res.status(200).json({ attachments, count: attachments.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
