import { useState, useEffect } from 'react';
import Head from 'next/head';

export default function Home() {
  const [projects, setProjects]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [search, setSearch]         = useState('');
  const [copied, setCopied]         = useState(null);
  const [groupBy, setGroupBy]       = useState('client'); // 'client' | 'all'
  const [emailModal, setEmailModal] = useState(null); // { project }

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

  function getShareUrl(id) {
    return typeof window !== 'undefined' ? `${window.location.origin}/project/${id}` : `/project/${id}`;
  }

  function copyLink(id) {
    navigator.clipboard.writeText(getShareUrl(id));
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }

  function openEmail(p) {
    setEmailModal(p);
  }

  function sendEmail(p, toEmail) {
    const url  = getShareUrl(p.id);
    const subj = encodeURIComponent(`Project Update: ${p.summary}`);
    const body = encodeURIComponent(
      `Hi,\n\nHere is a link to view the live project status for "${p.summary}":\n\n${url}\n\nYou can see the timeline, task progress, and notes in real time — no login required.\n\nKind regards,\nSondela Consulting`
    );
    window.location.href = `mailto:${toEmail}?subject=${subj}&body=${body}`;
    setEmailModal(null);
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
                  {group.projects.map(p => <ProjectCard key={p.id} p={p} copied={copied} onCopy={copyLink} onEmail={openEmail} shareUrl={getShareUrl(p.id)} statusColour={statusColour} statusLabel={statusLabel}/>)}
                </div>
              </div>
            ))
          )}

          {/* Flat list */}
          {!loading && groupBy === 'all' && (
            <div style={s.grid}>
              {filtered.map(p => <ProjectCard key={p.id} p={p} copied={copied} onCopy={copyLink} onEmail={openEmail} shareUrl={getShareUrl(p.id)} statusColour={statusColour} statusLabel={statusLabel}/>)}
              {filtered.length === 0 && <p style={s.empty}>No projects match your search.</p>}
            </div>
          )}
        </main>
      </div>

      {/* Email modal */}
      {emailModal && (
        <EmailModal project={emailModal} onSend={sendEmail} onClose={()=>setEmailModal(null)}/>
      )}
    </>
  );
}

function ProjectCard({ p, copied, onCopy, onEmail, shareUrl, statusColour, statusLabel }) {
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
        <a href={`/project/${p.id}`} target="_blank" rel="noreferrer" style={s.btnView}>
          View Gantt →
        </a>
        <button style={s.btnIcon} onClick={()=>onCopy(p.id)} title="Copy link">
          {copied === p.id ? '✅' : '🔗'}
        </button>
        <button style={s.btnIcon} onClick={()=>onEmail(p)} title="Share via email">
          📧
        </button>
        <a href={`/client/${p.client_id}`} style={s.btnIcon} title="All client projects">
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
