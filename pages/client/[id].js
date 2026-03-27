import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';

export default function ClientPage() {
  const { query } = useRouter();
  const [data, setData]       = useState(null);
  const [error, setError]     = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!query.id) return;
    fetch(`/api/client/${query.id}`)
      .then(r => r.json())
      .then(d => { if (d.error) throw new Error(d.error); setData(d); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [query.id]);

  const colour = data?.client?.colour || '#89b4fa';

  return (
    <>
      <Head><title>{data?.client?.name || 'Client'} | Sondela Project Portal</title></Head>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .proj-row:hover { background: #252538 !important; }
      `}</style>

      <div style={s.page}>
        <header style={s.header}>
          <div style={s.hInner}>
            <a href="/" style={s.back}>← All Projects</a>
            <span style={s.brand}>📊 Sondela Consulting</span>
          </div>
        </header>

        {error && <div style={s.errBox}>⚠️ {error}</div>}

        {loading && (
          <div style={s.spinWrap}>
            <div style={s.spinDot}/>
            <p style={{color:'#a6adc8'}}>Loading...</p>
          </div>
        )}

        {data && (
          <main style={s.main}>
            {/* Client header */}
            <div style={s.clientHeader}>
              <div style={{...s.clientAvatar, background: colour}}>
                {data.client.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h1 style={s.clientName}>{data.client.name}</h1>
                <p style={s.clientSub}>{data.projects.length} project{data.projects.length!==1?'s':''} · Managed by Sondela Consulting</p>
              </div>
            </div>

            {/* Overall progress */}
            {data.projects.length > 0 && (() => {
              const total = data.projects.reduce((a, p) => a + p.total_tasks, 0);
              const done  = data.projects.reduce((a, p) => a + p.done_tasks, 0);
              const pct   = total > 0 ? Math.round((done / total) * 100) : 0;
              const hours = data.projects.reduce((a, p) => a + p.hours_logged, 0);
              return (
                <div style={s.overallCard}>
                  <div style={s.overallStats}>
                    <div style={s.oStat}>
                      <div style={{...s.oVal, color: colour}}>{pct}%</div>
                      <div style={s.oLbl}>Overall Complete</div>
                    </div>
                    <div style={s.oStat}>
                      <div style={s.oVal}>{done}</div>
                      <div style={s.oLbl}>Tasks Done</div>
                    </div>
                    <div style={s.oStat}>
                      <div style={s.oVal}>{total}</div>
                      <div style={s.oLbl}>Total Tasks</div>
                    </div>
                    <div style={s.oStat}>
                      <div style={{...s.oVal, color:'#fab387'}}>{hours.toFixed(1)}h</div>
                      <div style={s.oLbl}>Hours Logged</div>
                    </div>
                  </div>
                  <div style={s.bigTrack}>
                    <div style={{...s.bigBar, width:`${pct}%`, background: colour}}/>
                  </div>
                </div>
              );
            })()}

            {/* Project list */}
            <div style={s.projectList}>
              {data.projects.map(p => (
                <div key={p.id} className="proj-row" style={s.projRow}>
                  <div style={s.projLeft}>
                    <div style={s.projName}>{p.summary}</div>
                    <div style={s.projMeta}>
                      {p.agent_name && <span>{p.agent_name}</span>}
                      {p.hours_logged > 0 && <span style={{color:'#fab387'}}>⏱ {p.hours_logged.toFixed(1)}h</span>}
                    </div>
                    <div style={s.projTrack}>
                      <div style={{...s.projBar, width:`${p.pct_complete}%`, background: colour}}/>
                    </div>
                    <div style={s.projPct}>{p.pct_complete}% · {p.done_tasks}/{p.total_tasks} tasks</div>
                  </div>
                  <div style={s.projRight}>
                    <span style={{...s.statusPill, ...statusStyle(p.status_id)}}>
                      {statusLabel(p.status_id)}
                    </span>
                    <a href={`/project/${p.id}`} target="_blank" rel="noreferrer" style={s.viewBtn}>
                      View →
                    </a>
                  </div>
                </div>
              ))}
            </div>

            <footer style={s.footer}>
              <span>Powered by <strong>Sondela Consulting</strong></span>
              <a href="https://sondelaconsulting.com" target="_blank" rel="noreferrer" style={{color:'#89b4fa'}}>sondelaconsulting.com</a>
            </footer>
          </main>
        )}
      </div>
    </>
  );
}

function statusStyle(sid) {
  if (sid === 9) return {background:'#1e3a2e',color:'#a6e3a1'};
  if (sid === 2) return {background:'#1e2e4a',color:'#89b4fa'};
  return {background:'#2e2e1e',color:'#f9e2af'};
}

function statusLabel(sid) {
  if (sid === 9) return 'Closed';
  if (sid === 2) return 'Active';
  return 'Open';
}

const s = {
  page:         {minHeight:'100vh',background:'#1e1e2e',color:'#cdd6f4',fontFamily:'Segoe UI,Arial,sans-serif'},
  header:       {background:'#181825',borderBottom:'1px solid #313244',padding:'14px 30px'},
  hInner:       {maxWidth:'1100px',margin:'0 auto',display:'flex',justifyContent:'space-between',alignItems:'center'},
  back:         {color:'#a6adc8',textDecoration:'none',fontSize:'0.85em'},
  brand:        {color:'#89b4fa',fontWeight:700,fontSize:'0.9em'},
  errBox:       {background:'#302030',border:'1px solid #f38ba8',padding:'14px 30px',color:'#f38ba8'},
  spinWrap:     {display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',minHeight:'50vh',gap:'20px'},
  spinDot:      {width:'32px',height:'32px',border:'3px solid #313244',borderTopColor:'#89b4fa',borderRadius:'50%',animation:'spin 0.8s linear infinite'},
  main:         {maxWidth:'1100px',margin:'0 auto',padding:'28px'},
  clientHeader: {display:'flex',alignItems:'center',gap:'18px',marginBottom:'24px'},
  clientAvatar: {width:'56px',height:'56px',borderRadius:'14px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1.6em',fontWeight:700,color:'#fff',flexShrink:0},
  clientName:   {fontSize:'1.6em',color:'#cdd6f4',fontWeight:700,margin:'0 0 4px'},
  clientSub:    {color:'#6c7086',fontSize:'0.85em',margin:0},
  overallCard:  {background:'#313244',border:'1px solid #45475a',borderRadius:'12px',padding:'20px',marginBottom:'24px'},
  overallStats: {display:'flex',gap:'24px',marginBottom:'16px',flexWrap:'wrap'},
  oStat:        {flex:1,minWidth:'80px'},
  oVal:         {fontSize:'1.8em',fontWeight:700,color:'#cdd6f4'},
  oLbl:         {fontSize:'0.72em',color:'#6c7086',marginTop:'2px'},
  bigTrack:     {height:'6px',background:'#1e1e2e',borderRadius:'3px'},
  bigBar:       {height:'6px',borderRadius:'3px',transition:'width 0.4s ease'},
  projectList:  {display:'flex',flexDirection:'column',gap:'10px',marginBottom:'24px'},
  projRow:      {background:'#313244',border:'1px solid #45475a',borderRadius:'10px',padding:'16px 20px',display:'flex',alignItems:'flex-start',gap:'16px',cursor:'default'},
  projLeft:     {flex:1,minWidth:0},
  projName:     {fontSize:'0.95em',color:'#cdd6f4',fontWeight:600,marginBottom:'4px'},
  projMeta:     {display:'flex',gap:'12px',fontSize:'0.75em',color:'#6c7086',marginBottom:'8px'},
  projTrack:    {height:'4px',background:'#1e1e2e',borderRadius:'2px',marginBottom:'4px'},
  projBar:      {height:'4px',borderRadius:'2px',transition:'width 0.3s ease'},
  projPct:      {fontSize:'0.72em',color:'#6c7086'},
  projRight:    {display:'flex',flexDirection:'column',alignItems:'flex-end',gap:'8px',flexShrink:0},
  statusPill:   {fontSize:'0.7em',padding:'3px 10px',borderRadius:'8px',fontWeight:600},
  viewBtn:      {background:'#89b4fa',color:'#1e1e2e',borderRadius:'6px',padding:'7px 14px',fontSize:'0.8em',fontWeight:700,textDecoration:'none',whiteSpace:'nowrap'},
  footer:       {display:'flex',justifyContent:'space-between',fontSize:'0.8em',color:'#6c7086',flexWrap:'wrap',gap:'8px'},
};
