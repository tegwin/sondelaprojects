import { useState, useEffect } from 'react';
import Head from 'next/head';

export default function Home() {
  const [projects, setProjects]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [search, setSearch]         = useState('');
  const [copied, setCopied]         = useState(null);
  const [groupBy, setGroupBy]       = useState('client'); // 'client' | 'all'
  const [emailModal, setEmailModal] = useState(null);
  const [linkMgr, setLinkMgr]     = useState(null);
  const [page, setPage]           = useState('projects');
  const [linkData, setLinkData]   = useState([]);
  const [linksLoading, setLinksLoading] = useState(false); // 'projects' | 'links'

  useEffect(() => {
    fetch('/api/projects')
      .then(r => r.json())
      .then(d => { if (d.error) throw new Error(d.error); setProjects(d.projects || []); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = projects.filter(p => {
    const q = search.toLowerCase();
    return p.summary?.toLowerCase().includes(q) || p.client_name?.toLowerCase().includes(q) || String(p.id).includes(q);
  });

  // Group by client
  const grouped = filtered.reduce((acc, p) => {
    const key = p.client_id;
    if (!acc[key]) acc[key] = { name: p.client_name, colour: p.client_colour, projects: [] };
    acc[key].projects.push(p);
    return acc;
  }, {});

  function getShareUrl(p) {
    const base = typeof window !== 'undefined' ? window.location.origin : '';
    return `${base}/p/${p.token}`;
  }

  function copyLink(p) {
    navigator.clipboard.writeText(getShareUrl(p));
    setCopied(p.id);
    setTimeout(() => setCopied(null), 2000);
  }

  function openEmail(p) {
    setEmailModal(p);
  }

  function sendEmail(p, toEmail) {
    const url  = getShareUrl(p);
    const subj = encodeURIComponent(`Project Update: ${p.summary}`);
    const body = encodeURIComponent(
      `Hi,\n\nHere is a link to view the live project status for "${p.summary}":\n\n${url}\n\nYou can see the timeline, task progress, and notes in real time — no login required.\n\nKind regards,\nSondela Consulting`
    );
    window.location.href = `mailto:${toEmail}?subject=${subj}&body=${body}`;
    setEmailModal(null);
  }

  async function fetchLinks() {
    setLinksLoading(true);
    const res = await fetch('/api/admin/links');
    const d = await res.json();
    setLinkData(d.links || []);
    setLinksLoading(false);
  }

  async function openLinkMgr(p) {
    const res  = await fetch(`/api/admin/link/${p.token}`);
    const meta = await res.json();
    setLinkMgr({ project: p, meta });
  }

  const statusColour = (s) => s === 9 ? '#a6e3a1' : s === 2 ? '#89b4fa' : '#f9e2af';
  const statusLabel  = (s) => s === 9 ? 'Closed' : s === 2 ? 'Active' : 'Open';

  return (
    <>
      <Head><title>Sondela Project Portal</title></Head>
      <style>{`
        @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        .proj-card:hover { border-color: #6272a4 !important; transform: translateY(-1px); }
        .proj-card { transition: all 0.15s ease; }
      `}</style>

      <div style={s.page}>
        {/* Header */}
        <header style={s.header}>
          <div style={s.hInner}>
            <div style={{display:'flex',alignItems:'center',gap:'14px'}}>
              {/* Sondela Logo */}
              <div style={s.logoMark}>
                <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                  <rect width="36" height="36" rx="8" fill="#89b4fa"/>
                  <text x="18" y="25" textAnchor="middle" fill="#1e1e2e" fontSize="18" fontWeight="bold" fontFamily="Segoe UI,Arial">S</text>
                </svg>
              </div>
              <div>
                <div style={s.logoText}>Sondela Project Portal</div>
                <div style={s.logoSub}>Powered by HaloPSA</div>
              </div>
            </div>
            <div style={{display:'flex',gap:'4px',background:'#313244',borderRadius:'8px',padding:'3px'}}>
              <button onClick={()=>setPage('projects')} style={{background:page==='projects'?'#45475a':'transparent',border:'none',color:page==='projects'?'#cdd6f4':'#6c7086',padding:'6px 14px',borderRadius:'6px',cursor:'pointer',fontSize:'0.82em',fontWeight:page==='projects'?700:400}}>
                📋 Projects
              </button>
              <button onClick={()=>{setPage('links');if(!linkData.length)fetchLinks();}} style={{background:page==='links'?'#45475a':'transparent',border:'none',color:page==='links'?'#cdd6f4':'#6c7086',padding:'6px 14px',borderRadius:'6px',cursor:'pointer',fontSize:'0.82em',fontWeight:page==='links'?700:400}}>
                🔐 Link Manager
              </button>
            </div>
            <a href="/api/auth/logout" style={s.signout}>Sign out</a>
          </div>
        </header>

        <main style={s.main}>
          {/* Controls row */}
          <div style={s.controls}>
            <input
              style={s.search}
              type="text"
              placeholder="Search projects or clients..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <div style={s.tabs}>
              <button style={{...s.tab,...(groupBy==='client'?s.tabActive:{})}} onClick={()=>setGroupBy('client')}>By Client</button>
              <button style={{...s.tab,...(groupBy==='all'?s.tabActive:{})}} onClick={()=>setGroupBy('all')}>All Projects</button>
            </div>
            <span style={s.count}>{loading ? '...' : `${filtered.length} projects`}</span>
          </div>

          {error && <div style={s.errBox}>⚠️ {error}</div>}

          {loading && (
            <div style={s.grid}>
              {[1,2,3,4,5,6].map(i=><div key={i} style={s.skeleton}/>)}
            </div>
          )}

          {/* Grouped by client */}
          {!loading && groupBy === 'client' && (
            Object.values(grouped).map((group, gi) => (
              <div key={gi} style={s.clientGroup}>
                <div style={s.clientHeader}>
                  <div style={{...s.clientDot, background: group.colour}}/>
                  <a href={`/client/${Object.keys(grouped)[gi]}`} style={s.clientName}>
                    {group.name}
                  </a>
                  <span style={s.clientCount}>{group.projects.length} project{group.projects.length!==1?'s':''}</span>
                </div>
                <div style={s.grid}>
                  {group.projects.map(p => <ProjectCard key={p.id} p={p} copied={copied} onCopy={copyLink} onEmail={openEmail} onLinkMgr={openLinkMgr} shareUrl={getShareUrl(p)} statusColour={statusColour} statusLabel={statusLabel}/>)}
                </div>
              </div>
            ))
          )}

          {/* Flat list */}
          {!loading && groupBy === 'all' && (
            <div style={s.grid}>
              {filtered.map(p => <ProjectCard key={p.id} p={p} copied={copied} onCopy={copyLink} onEmail={openEmail} onLinkMgr={openLinkMgr} shareUrl={getShareUrl(p)} statusColour={statusColour} statusLabel={statusLabel}/>)}
              {filtered.length === 0 && <p style={s.empty}>No projects match your search.</p>}
            </div>
          )}
        </main>
      </div>

      {/* Link Manager Page */}
      {page === 'links' && (
        <div style={{maxWidth:'1300px',margin:'0 auto',padding:'28px'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'20px'}}>
            <h2 style={{color:'#cdd6f4',margin:0,fontSize:'1.1em'}}>🔐 Link Manager</h2>
            <button onClick={fetchLinks} style={{background:'#313244',border:'1px solid #45475a',color:'#cdd6f4',borderRadius:'6px',padding:'7px 14px',fontSize:'0.82em',cursor:'pointer'}}>
              {linksLoading?'Loading...':'⟳ Refresh'}
            </button>
          </div>
          <div style={{background:'#313244',border:'1px solid #45475a',borderRadius:'12px',overflow:'hidden'}}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 160px 80px 100px 120px 100px',gap:'0',background:'#181825',padding:'10px 16px',borderBottom:'1px solid #45475a',fontSize:'0.72em',color:'#6c7086',textTransform:'uppercase',letterSpacing:'0.05em'}}>
              <div>Project</div><div>Status</div><div>Views</div><div>First Viewed</div><div>Expires</div><div>Actions</div>
            </div>
            {linksLoading&&<div style={{padding:'30px',textAlign:'center',color:'#6c7086'}}>Loading link data...</div>}
            {!linksLoading&&linkData.map((l,i)=>(
              <div key={l.id} style={{display:'grid',gridTemplateColumns:'1fr 160px 80px 100px 120px 100px',gap:'0',padding:'12px 16px',borderBottom:'1px solid #313244',background:i%2===0?'#252535':'#1e1e2e',alignItems:'center'}}>
                <div>
                  <div style={{fontSize:'0.85em',color:'#cdd6f4',fontWeight:500}}>{l.summary}</div>
                  <div style={{fontSize:'0.72em',color:'#6c7086'}}>{l.client_name}</div>
                </div>
                <div>
                  <span style={{
                    fontSize:'0.75em',padding:'3px 10px',borderRadius:'10px',fontWeight:600,
                    background:l.status==='active'?'#1e3a2e':l.status==='revoked'?'#2e1e1e':'#2e2e1e',
                    color:l.status==='active'?'#a6e3a1':l.status==='revoked'?'#f38ba8':'#f9e2af',
                  }}>
                    {l.status==='active'?'✅ Active':l.status==='revoked'?'🔒 Revoked':'⏰ Expired'}
                  </span>
                </div>
                <div style={{fontSize:'0.82em',color:l.views>0?'#89b4fa':'#45475a',fontWeight:l.views>0?700:400}}>
                  {l.views>0?`${l.views} view${l.views>1?'s':''}`:'—'}
                </div>
                <div style={{fontSize:'0.75em',color:'#6c7086'}}>{l.firstView?l.firstView.substring(0,10):'—'}</div>
                <div style={{fontSize:'0.75em',color:l.expired?'#f38ba8':'#6c7086'}}>{l.expiresAt?l.expiresAt.substring(0,10):'No expiry'}</div>
                <div>
                  <button onClick={()=>openLinkMgr({...l,token:l.token,client_colour:'#89b4fa'})}
                    style={{background:'#45475a',border:'none',color:'#cdd6f4',borderRadius:'6px',padding:'5px 10px',fontSize:'0.75em',cursor:'pointer'}}>
                    Manage
                  </button>
                </div>
              </div>
            ))}
            {!linksLoading&&linkData.length===0&&<div style={{padding:'30px',textAlign:'center',color:'#6c7086'}}>No link data yet. Links are tracked once created.</div>}
          </div>
        </div>
      )}

      {/* Email modal */}
      {emailModal && (
        <EmailModal project={emailModal} onSend={sendEmail} onClose={()=>setEmailModal(null)}/>
      )}

      {/* Link manager modal */}
      {linkMgr && (
        <LinkMgrModal
          project={linkMgr.project}
          initialMeta={linkMgr.meta}
          onClose={()=>setLinkMgr(null)}
        />
      )}
    </>
  );
}

function ProjectCard({ p, copied, onCopy, onEmail, onLinkMgr, shareUrl, statusColour, statusLabel }) {
  const viewUrl = `/p/${p.token}`;
  return (
    <div className="proj-card" style={{...s.card, borderColor: p.client_colour + '40'}}>
      {/* Progress bar */}
      <div style={s.progressTrack}>
        <div style={{...s.progressBar, width:`${p.pct_complete}%`, background: p.client_colour}}/>
      </div>

      <div style={s.cardTop}>
        <span style={{...s.clientTag, color: p.client_colour, borderColor: p.client_colour + '60'}}>{p.client_name}</span>
        <span style={{...s.statusPill, background: statusColour(p.status_id) + '22', color: statusColour(p.status_id)}}>
          {statusLabel(p.status_id)}
        </span>
      </div>

      <h2 style={s.cardTitle}>{p.summary}</h2>

      {/* Progress info */}
      <div style={s.progressInfo}>
        <span style={s.pctLabel}>{p.pct_complete}% complete</span>
        <span style={s.taskLabel}>{p.done_tasks}/{p.total_tasks} tasks</span>
        {p.hours_logged > 0 && <span style={s.hoursLabel}>⏱ {p.hours_logged.toFixed(1)}h</span>}
      </div>

      <div style={s.cardActions}>
        <a href={viewUrl} target="_blank" rel="noreferrer" style={s.btnView}>
          View Gantt →
        </a>
        <button style={s.btnIcon} onClick={()=>onCopy(p.id)} title="Copy link">
          {copied === p.id ? '✅' : '🔗'}
        </button>
        <button style={s.btnIcon} onClick={()=>onEmail(p)} title="Share via email">
          📧
        </button>
        <button style={s.btnIcon} onClick={()=>onLinkMgr(p)} title="Manage link access">
          🔐
        </button>
        <a href={`/client/${p.client_id}`} style={s.btnIcon} title='All client projects for this client'>
          👤
        </a>
      </div>

      <div style={s.shareUrl}>{shareUrl}</div>
    </div>
  );
}

function EmailModal({ project, onSend, onClose }) {
  const [email, setEmail] = useState('');
  return (
    <div style={s.modalOverlay} onClick={onClose}>
      <div style={s.modal} onClick={e=>e.stopPropagation()}>
        <h3 style={s.modalTitle}>📧 Share Project via Email</h3>
        <p style={s.modalSub}>{project.summary}</p>
        <label style={s.modalLabel}>Recipient email address</label>
        <input
          style={s.modalInput}
          type="email"
          placeholder="victoria@client.com"
          value={email}
          onChange={e=>setEmail(e.target.value)}
          autoFocus
        />
        <p style={s.modalHint}>
          This will open your email client with a pre-written message containing the shareable project link.
        </p>
        <div style={s.modalActions}>
          <button style={s.btnView} onClick={()=>email&&onSend(project,email)} disabled={!email}>
            Open in Email Client →
          </button>
          <button style={s.btnCancel} onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

const s = {
  page:         {minHeight:'100vh',background:'#1e1e2e',color:'#cdd6f4',fontFamily:'Segoe UI,Arial,sans-serif'},
  header:       {background:'#181825',borderBottom:'1px solid #313244',padding:'16px 30px'},
  hInner:       {maxWidth:'1300px',margin:'0 auto',display:'flex',justifyContent:'space-between',alignItems:'center'},
  logoMark:     {flexShrink:0},
  logoText:     {color:'#89b4fa',fontWeight:700,fontSize:'1.05em'},
  logoSub:      {color:'#6c7086',fontSize:'0.75em'},
  signout:      {background:'#313244',border:'1px solid #45475a',color:'#a6adc8',borderRadius:'6px',padding:'7px 14px',fontSize:'0.8em',textDecoration:'none'},
  main:         {maxWidth:'1300px',margin:'0 auto',padding:'28px'},
  controls:     {display:'flex',alignItems:'center',gap:'12px',marginBottom:'24px',flexWrap:'wrap'},
  search:       {flex:1,minWidth:'200px',background:'#313244',border:'1px solid #45475a',borderRadius:'8px',padding:'10px 14px',color:'#cdd6f4',fontSize:'0.9em'},
  tabs:         {display:'flex',background:'#313244',borderRadius:'8px',padding:'3px',gap:'2px'},
  tab:          {background:'transparent',border:'none',color:'#6c7086',padding:'6px 14px',borderRadius:'6px',cursor:'pointer',fontSize:'0.82em'},
  tabActive:    {background:'#45475a',color:'#cdd6f4'},
  count:        {color:'#6c7086',fontSize:'0.82em',whiteSpace:'nowrap'},
  errBox:       {background:'#302030',border:'1px solid #f38ba8',borderRadius:'8px',padding:'14px',color:'#f38ba8',marginBottom:'20px'},
  clientGroup:  {marginBottom:'28px'},
  clientHeader: {display:'flex',alignItems:'center',gap:'10px',marginBottom:'12px'},
  clientDot:    {width:'10px',height:'10px',borderRadius:'50%',flexShrink:0},
  clientName:   {color:'#cdd6f4',fontWeight:700,fontSize:'1em',textDecoration:'none'},
  clientCount:  {color:'#6c7086',fontSize:'0.8em'},
  grid:         {display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:'14px'},
  card:         {background:'#252535',border:'1px solid #45475a',borderRadius:'12px',overflow:'hidden',display:'flex',flexDirection:'column',gap:'10px'},
  progressTrack:{height:'3px',background:'#313244',width:'100%'},
  progressBar:  {height:'3px',borderRadius:'0',transition:'width 0.3s ease'},
  cardTop:      {display:'flex',justifyContent:'space-between',alignItems:'center',padding:'14px 16px 0'},
  clientTag:    {fontSize:'0.72em',padding:'3px 10px',borderRadius:'12px',border:'1px solid',fontWeight:600},
  statusPill:   {fontSize:'0.7em',padding:'2px 8px',borderRadius:'8px',fontWeight:600},
  cardTitle:    {fontSize:'0.88em',color:'#cdd6f4',fontWeight:600,lineHeight:1.4,padding:'0 16px'},
  progressInfo: {display:'flex',gap:'10px',padding:'0 16px',flexWrap:'wrap'},
  pctLabel:     {fontSize:'0.75em',color:'#cdd6f4',fontWeight:600},
  taskLabel:    {fontSize:'0.75em',color:'#6c7086'},
  hoursLabel:   {fontSize:'0.75em',color:'#fab387'},
  cardActions:  {display:'flex',gap:'6px',padding:'0 16px 14px'},
  btnView:      {flex:1,background:'#89b4fa',color:'#1e1e2e',borderRadius:'6px',padding:'8px 12px',fontSize:'0.8em',fontWeight:700,textDecoration:'none',textAlign:'center',border:'none',cursor:'pointer'},
  btnIcon:      {background:'#313244',border:'1px solid #45475a',color:'#cdd6f4',borderRadius:'6px',padding:'8px 10px',fontSize:'0.85em',cursor:'pointer',textDecoration:'none',display:'flex',alignItems:'center',justifyContent:'center'},
  shareUrl:     {fontSize:'0.68em',color:'#45475a',fontFamily:'monospace',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',padding:'0 16px 12px'},
  skeleton:     {background:'#313244',borderRadius:'12px',height:'180px',opacity:0.5},
  empty:        {color:'#6c7086',gridColumn:'1/-1',textAlign:'center',padding:'40px'},
  // Modal
  modalOverlay: {position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:'20px'},
  modal:        {background:'#313244',border:'1px solid #45475a',borderRadius:'16px',padding:'28px',width:'100%',maxWidth:'440px'},
  modalTitle:   {color:'#89b4fa',fontSize:'1.1em',margin:'0 0 6px'},
  modalSub:     {color:'#6c7086',fontSize:'0.82em',margin:'0 0 20px'},
  modalLabel:   {fontSize:'0.8em',color:'#a6adc8',display:'block',marginBottom:'6px'},
  modalInput:   {width:'100%',background:'#1e1e2e',border:'1px solid #45475a',borderRadius:'8px',padding:'10px 14px',color:'#cdd6f4',fontSize:'0.9em',boxSizing:'border-box',marginBottom:'12px'},
  modalHint:    {fontSize:'0.76em',color:'#6c7086',marginBottom:'16px'},
  modalActions: {display:'flex',gap:'10px'},
  btnCancel:    {background:'#45475a',border:'none',color:'#cdd6f4',borderRadius:'6px',padding:'8px 16px',fontSize:'0.85em',cursor:'pointer'},
};

function LinkMgrModal({ project, initialMeta, onClose }) {
  const [revoked,   setRevoked]   = useState(initialMeta.revoked || false);
  const [expiresAt, setExpiresAt] = useState(initialMeta.expiresAt ? initialMeta.expiresAt.substring(0,10) : '');
  const [saving,    setSaving]    = useState(false);
  const [saved,     setSaved]     = useState(false);

  async function save() {
    setSaving(true);
    await fetch(`/api/admin/link/${project.token}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        revoked,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/p/${project.token}` : '';
  const isExpired = expiresAt && new Date(expiresAt) < new Date();

  return (
    <div style={s.modalOverlay} onClick={onClose}>
      <div style={{...s.modal, maxWidth:'500px'}} onClick={e=>e.stopPropagation()}>
        <h3 style={s.modalTitle}>🔐 Manage Link Access</h3>
        <p style={s.modalSub}>{project.client_name} · {project.summary}</p>

        {/* Status indicator */}
        <div style={{
          background: revoked || isExpired ? '#2a1520' : '#1e3a2e',
          border: `1px solid ${revoked || isExpired ? '#f38ba8' : '#a6e3a1'}`,
          borderRadius: '8px',
          padding: '10px 14px',
          marginBottom: '20px',
          fontSize: '0.82em',
          color: revoked || isExpired ? '#f38ba8' : '#a6e3a1',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          {revoked ? '🔒 Link is revoked — clients cannot access this project' :
           isExpired ? '⏰ Link has expired — clients cannot access this project' :
           '✅ Link is active — clients can access this project'}
        </div>

        {/* Revoke / Re-enable */}
        <div style={{background:'#1e1e2e',borderRadius:'10px',padding:'16px',marginBottom:'14px'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:'12px'}}>
            <div>
              <div style={{fontSize:'0.88em',color:'#cdd6f4',fontWeight:600,marginBottom:'3px'}}>
                {revoked ? '🔒 Link is Revoked' : 'Revoke Access'}
              </div>
              <div style={{fontSize:'0.76em',color:'#6c7086'}}>
                {revoked
                  ? 'The client cannot currently access this project. Re-enable to restore access.'
                  : 'Immediately block all access to this project link.'}
              </div>
            </div>
            <div style={{display:'flex',gap:'8px',flexShrink:0}}>
              {revoked ? (
                <button
                  onClick={() => { setRevoked(false); setExpiresAt(''); }}
                  style={{
                    background:'#a6e3a1',color:'#1e1e2e',border:'none',
                    borderRadius:'8px',padding:'8px 16px',cursor:'pointer',
                    fontWeight:700,fontSize:'0.82em',minWidth:'120px',
                  }}>
                  ✅ Re-enable Link
                </button>
              ) : (
                <button
                  onClick={() => setRevoked(true)}
                  style={{
                    background:'#313244',color:'#f38ba8',border:'1px solid #f38ba850',
                    borderRadius:'8px',padding:'8px 16px',cursor:'pointer',
                    fontWeight:700,fontSize:'0.82em',minWidth:'100px',
                  }}>
                  🔒 Revoke
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Expiry date */}
        <div style={{background:'#1e1e2e',borderRadius:'10px',padding:'16px',marginBottom:'20px'}}>
          <div style={{fontSize:'0.88em',color:'#cdd6f4',fontWeight:600,marginBottom:'3px'}}>Link Expiry Date</div>
          <div style={{fontSize:'0.76em',color:'#6c7086',marginBottom:'10px'}}>
            After this date the link will automatically stop working. Leave blank for no expiry.
          </div>
          <div style={{display:'flex',gap:'8px',alignItems:'center'}}>
            <input
              type="date"
              value={expiresAt}
              onChange={e => setExpiresAt(e.target.value)}
              min={new Date().toISOString().substring(0,10)}
              style={{
                flex:1,
                background:'#313244',
                border: isExpired ? '1px solid #f38ba8' : '1px solid #45475a',
                borderRadius:'6px',
                padding:'8px 12px',
                color:'#cdd6f4',
                fontSize:'0.88em',
              }}
            />
            {expiresAt && (
              <button onClick={()=>setExpiresAt('')}
                style={{background:'#45475a',border:'none',color:'#cdd6f4',borderRadius:'6px',padding:'8px 12px',cursor:'pointer',fontSize:'0.82em'}}>
                Clear
              </button>
            )}
          </div>
          {isExpired && (
            <div style={{fontSize:'0.75em',color:'#f38ba8',marginTop:'6px'}}>⚠️ This date is in the past — link is already expired</div>
          )}
        </div>

        {/* Share URL preview */}
        <div style={{background:'#1e1e2e',borderRadius:'8px',padding:'10px 14px',marginBottom:'20px'}}>
          <div style={{fontSize:'0.7em',color:'#6c7086',marginBottom:'4px',textTransform:'uppercase',letterSpacing:'0.05em'}}>Shareable URL</div>
          <div style={{fontSize:'0.75em',color:revoked||isExpired?'#45475a':'#89b4fa',fontFamily:'monospace',wordBreak:'break-all'}}>
            {shareUrl}
          </div>
        </div>

        <div style={s.modalActions}>
          <button
            style={{...s.btnView, background: saved?'#a6e3a1':undefined, color: saved?'#1e1e2e':undefined}}
            onClick={save}
            disabled={saving}>
            {saving ? 'Saving...' : saved ? '✅ Saved!' : 'Save Changes'}
          </button>
          <button style={s.btnCancel} onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
