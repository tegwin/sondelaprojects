import { useState, useEffect } from 'react';
import Head from 'next/head';

function RAGDot({ status }) {
  const c = { green:'#a6e3a1', amber:'#f9e2af', red:'#f38ba8' }[status] || '#45475a';
  return <span style={{display:'inline-block',width:'10px',height:'10px',borderRadius:'50%',background:c,marginRight:'6px',flexShrink:0}}></span>;
}

export default function HealthDashboard() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    fetch('/api/projects')
      .then(r => r.json())
      .then(d => setProjects(d.projects || []))
      .finally(() => setLoading(false));
  }, []);

  const active   = projects.filter(p => p.status_id !== 9);
  const complete = projects.filter(p => p.status_id === 9);

  function burnColour(p) {
    if (!p.done_tasks || !p.hours_logged || !p.budget_hours) return null;
    const projected = (p.hours_logged / p.done_tasks) * p.total_tasks;
    return projected > p.budget_hours ? '#f38ba8' : '#a6e3a1';
  }

  function burnLabel(p) {
    if (!p.done_tasks || !p.hours_logged) return '—';
    const hpt = p.hours_logged / p.done_tasks;
    const proj = hpt * p.total_tasks;
    return `~${hpt.toFixed(1)}h/task · ${proj.toFixed(0)}h projected`;
  }

  return (
    <>
      <Head><title>Project Health | Sondela</title></Head>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={s.page}>
        <header style={s.header}>
          <div style={s.hInner}>
            <div style={{display:'flex',alignItems:'center',gap:'14px'}}>
              <a href="/" style={s.back}>← Dashboard</a>
              <h1 style={s.title}>📊 Project Health</h1>
            </div>
            <a href="/api/auth/logout" style={s.signout}>Sign out</a>
          </div>
        </header>

        <main style={s.main}>
          {loading && <div style={s.spin}></div>}

          {/* Summary stats */}
          {!loading && (
            <div style={s.summaryRow}>
              {[
                { v: active.length,    l: 'Active Projects' },
                { v: active.filter(p=>p.pct_complete===100).length, l: 'Ready to Close', c:'#a6e3a1' },
                { v: active.filter(p=>p.done_tasks===0).length, l: 'Not Started', c:'#f9e2af' },
                { v: complete.length,  l: 'Completed', c:'#6c7086' },
              ].map((st,i) => (
                <div key={i} style={s.summStat}>
                  <div style={{...s.summV, ...(st.c?{color:st.c}:{})}}>{st.v}</div>
                  <div style={s.summL}>{st.l}</div>
                </div>
              ))}
            </div>
          )}

          {/* Active projects table */}
          {!loading && active.length > 0 && (
            <div style={s.tableWrap}>
              <div style={s.tableTitle}>Active Projects</div>
              <div style={s.thead}>
                <div style={{...s.th, flex:1}}>Project</div>
                <div style={{...s.th, width:'120px'}}>Client</div>
                <div style={{...s.th, width:'80px'}}>Progress</div>
                <div style={{...s.th, width:'100px'}}>Tasks</div>
                <div style={{...s.th, width:'80px'}}>Hours</div>
                <div style={{...s.th, width:'200px'}}>Burn Rate</div>
                <div style={{...s.th, width:'80px'}}>Actions</div>
              </div>
              {active.map((p,i) => {
                const bc = burnColour(p);
                return (
                  <div key={p.id} style={{...s.trow, background:i%2===0?'#252535':'#1e1e2e'}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:'0.85em',color:'#cdd6f4',fontWeight:500}}>{p.summary}</div>
                    </div>
                    <div style={{width:'120px',fontSize:'0.78em',color:'#6c7086',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.client_name}</div>
                    <div style={{width:'80px'}}>
                      <div style={{height:'4px',background:'#313244',borderRadius:'2px',marginBottom:'3px'}}>
                        <div style={{height:'4px',borderRadius:'2px',width:`${p.pct_complete}%`,background:p.client_colour||'#89b4fa'}}></div>
                      </div>
                      <div style={{fontSize:'0.72em',color:'#a6adc8'}}>{p.pct_complete}%</div>
                    </div>
                    <div style={{width:'100px',fontSize:'0.78em',color:'#6c7086'}}>{p.done_tasks}/{p.total_tasks}</div>
                    <div style={{width:'80px',fontSize:'0.78em',color:'#fab387'}}>{p.hours_logged>0?`${p.hours_logged.toFixed(1)}h`:'—'}</div>
                    <div style={{width:'200px',fontSize:'0.75em',color:bc||'#6c7086'}}>{burnLabel(p)}</div>
                    <div style={{width:'80px'}}>
                      <a href={`/p/${p.token}`} target="_blank" rel="noreferrer"
                        style={{background:'#89b4fa',color:'#1e1e2e',borderRadius:'5px',padding:'4px 10px',fontSize:'0.75em',fontWeight:700,textDecoration:'none'}}>
                        View
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!loading && active.length === 0 && (
            <div style={{textAlign:'center',padding:'60px',color:'#6c7086'}}>No active projects found.</div>
          )}
        </main>
      </div>
    </>
  );
}

const s = {
  page:      {minHeight:'100vh',background:'#1e1e2e',color:'#cdd6f4',fontFamily:'Segoe UI,Arial,sans-serif'},
  header:    {background:'#181825',borderBottom:'1px solid #313244',padding:'16px 30px'},
  hInner:    {maxWidth:'1400px',margin:'0 auto',display:'flex',justifyContent:'space-between',alignItems:'center'},
  back:      {color:'#a6adc8',textDecoration:'none',fontSize:'0.85em'},
  title:     {color:'#cdd6f4',fontSize:'1.1em',fontWeight:700,margin:0},
  signout:   {background:'#313244',border:'1px solid #45475a',color:'#a6adc8',borderRadius:'6px',padding:'7px 14px',fontSize:'0.8em',textDecoration:'none'},
  main:      {maxWidth:'1400px',margin:'0 auto',padding:'28px'},
  spin:      {width:'36px',height:'36px',border:'3px solid #313244',borderTopColor:'#89b4fa',borderRadius:'50%',animation:'spin 0.8s linear infinite',margin:'80px auto'},
  summaryRow:{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'12px',marginBottom:'24px'},
  summStat:  {background:'#313244',border:'1px solid #45475a',borderRadius:'10px',padding:'16px'},
  summV:     {fontSize:'2em',fontWeight:700,color:'#cdd6f4'},
  summL:     {fontSize:'0.75em',color:'#6c7086',marginTop:'4px'},
  tableWrap: {background:'#313244',border:'1px solid #45475a',borderRadius:'12px',overflow:'hidden',marginBottom:'20px'},
  tableTitle:{padding:'14px 16px',fontSize:'0.85em',color:'#a6adc8',fontWeight:600,borderBottom:'1px solid #45475a',background:'#181825'},
  thead:     {display:'flex',padding:'8px 16px',background:'#181825',borderBottom:'1px solid #313244',gap:'8px'},
  th:        {fontSize:'0.7em',color:'#6c7086',textTransform:'uppercase',letterSpacing:'0.06em',flexShrink:0},
  trow:      {display:'flex',padding:'12px 16px',gap:'8px',alignItems:'center',borderBottom:'1px solid #313244'},
};
