// Email notification via Resend when a client views a project link
// Set RESEND_API_KEY and ADMIN_EMAIL in Vercel env vars

export async function notifyFirstView({ projectName, clientName, projectId, token }) {
  const apiKey = process.env.RESEND_API_KEY;
  const to     = process.env.ADMIN_EMAIL;
  if (!apiKey || !to) return; // graceful fallback

  const viewUrl    = `${process.env.NEXT_PUBLIC_BASE_URL || 'https://projects.sondelaconsulting.com'}/p/${token}`;
  const adminUrl   = `${process.env.NEXT_PUBLIC_BASE_URL || 'https://projects.sondelaconsulting.com'}/`;

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from:    'Sondela Project Portal <noreply@sondelaconsulting.com>',
      to:      [to],
      subject: `👁 ${clientName} just viewed their project portal`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;background:#1e1e2e;color:#cdd6f4;padding:24px;border-radius:12px">
          <h2 style="color:#89b4fa;margin-top:0">Project Link Viewed</h2>
          <p><strong>${clientName}</strong> has just viewed their project portal for the first time.</p>
          <p style="color:#a6adc8">Project: <strong style="color:#cdd6f4">${projectName}</strong></p>
          <p style="color:#a6adc8">Time: <strong style="color:#cdd6f4">${new Date().toLocaleString('en-GB')}</strong></p>
          <div style="margin-top:20px;display:flex;gap:10px">
            <a href="${viewUrl}" style="background:#89b4fa;color:#1e1e2e;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:bold">View Project →</a>
            <a href="${adminUrl}" style="background:#313244;color:#cdd6f4;padding:10px 18px;border-radius:6px;text-decoration:none">Admin Dashboard</a>
          </div>
          <p style="color:#45475a;font-size:0.8em;margin-top:20px">Subsequent views will not trigger additional notifications.</p>
        </div>
      `,
    }),
  }).catch(() => {}); // never crash the page load
}
