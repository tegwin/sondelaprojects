import { useEffect, useState, useRef } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';

export default function ProjectPage() {
  const { query } = useRouter();
  const [data, setData]       = useState(null);
  const [error, setError]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastFetch, setLastFetch] = useState(null);
  const [selected, setSelected]   = useState(null);
  const ganttRef     = useRef(null);
  const mermaidReady = useRef(false);

  async function load() {
    if (!query.id) return;
    setLoading(true);
    try {
      const res  = await fetch(`/api/project/${query.id}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
      setLastFetch(new Date());
    } catch (e) { setError(e.message); }
    finally     { setLoading(false); }
  }

  useEffect(() => {
    if (mermaidReady.current) return;
    mermaidReady.current = true;
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/mermaid/10.6.1/mermaid.min.js';
    s.onload = () => window.mermaid?.initialize({
      startOnLoad: false, theme: 'dark',
      gantt: { fontSize: 13, barHeight: 22, barGap: 4, topPadding: 50, sidePadding: 80 }
    });
    document.head.appendChild(s);
  }, []);

  useEffect(() => { if (query.id) load(); }, [query.id]);

  useEffect(() => {
    if (!data || !ganttRef.current) return;
    const render = async () => {
      if (!window.mermaid) { setTimeout(render, 200); return; }
      const el = ganttRef.current;
      el.removeAttribute('data-processed');
      el.textContent = data.ganttCode;
      try {
        await window.mermaid.init(undefined, el);
        // Make gantt bars clickable
        el.querySelectorAll('.task').forEach(rect => {
          rect.style.cursor = 'pointer';
          rect.addEventListener('click', () => {
            const label = rect.closest('.mermaid')?.querySelector(`text`)?.textContent || '';
            const task  = data.taskDetails.find(t =>
              t.summary.replace(/[^a-z0-9]/gi,'').toLowerCase().substring(0,15) ===
              label.replace(/[^a-z0-9]/gi,'').toLowerCase().substring(0,15)
            );
            if (task) setSelected(p => p?.id === task.id ? null : task);
          });
        });
      } catch {
        el.innerHTML = `<pre style="color:#cdd6f4;font-size:0.75em;white-space:pre-wrap">${data.ganttCode}</pre>`;
      }
    };
    setTimeout(render, 150);
  }, [data]);

  const title = data ? `${data.project.client_name} — ${data.project.summary}` : 'Loading...';

  return (
    <>
      <Head><title>{title} | Sondela</title></Head>
      <style>{`
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes fadeUp  { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        .task-row:hover    { background: #252535 !important; }
      `}</style>

      <div style={s.page}>
        <header style={s.header}>
          <div style={s.hInner}>
            <span style={s.brand}>📊 Sondela Consulting</span>
            {lastFetch && <span style={s.updated}>Live · {lastFetch.toLocaleTimeString()}</span>}
          </div>
        </header>

        {error && <div style={s.errBox}>⚠️ {error}</div>}

        {loading && !data && (
          <div style={s.spinWrap}>
            <div style={s.spinDot}/>
            <p style={{color:'#a6adc8'}}>Loading from HaloPSA...</p>
          </div>
        )}

        {data && (
          <main style={s.main}>

            {/* Title row */}
            <div style={s.titleRow}>
              <div>
                <span style={s.clientBadge}>{data.project.client_name}</span>
                <h1 style={s.h1}>{data.project.summary}</h1>
                <p style={s.meta}>Managed by {data.project.agent_name}</p>
              </div>
              <button style={s.refreshBtn} onClick={load} disabled={loading}>
                {loading ? '...' : '⟳ Refresh'}
              </button>
            </div>

            {/* Stats */}
            <div style={s.stats}>
              {[
                {v:data.stats.total,   l:'Total Tasks'},
                {v:data.stats.done,    l:'Completed ✅',   c:'#a6e3a1'},
                {v:data.stats.active,  l:'In Progress 🔄', c:'#89b4fa'},
                {v:data.stats.pending, l:'Pending ⏳'},
                ...(data.stats.budgetHours?[{v:`${data.stats.hoursLogged.toFixed(1)}h`,l:`of ${data.stats.budgetHours}h used`,c:'#fab387'}]:[]),
                ...(data.stats.remainingHours!==null?[{v:`${data.stats.remainingHours.toFixed(1)}h`,l:'Budget Remaining'}]:[]),
              ].map((st,i)=>(
                <div key={i} style={s.stat}>
                  <div style={{...s.statV,...(st.c?{color:st.c}:{})}}>{st.v}</div>
                  <div style={s.statL}>{st.l}</div>
                </div>
              ))}
            </div>

            {/* Milestones */}
            <div style={s.milestones}>
              {data.milestones.map((ms,i)=>{
                const lbl = ms.state===2?'Complete':ms.state===1?'Active':'Pending';
                const col = ms.state===2?'#a6e3a1':ms.state===1?'#89b4fa':'#f9e2af';
                const bg  = ms.state===2?'#1e3a2e':ms.state===1?'#1e2e4a':'#2e2e1e';
                return(
                  <div key={i} style={s.ms}>
                    <span style={s.msN}>{ms.name}</span>
                    <span style={s.msM}>{ms.taskCount} tasks</span>
                    <span style={{...s.msS,color:col,background:bg}}>{lbl}</span>
                  </div>
                );
              })}
            </div>

            {/* Gantt */}
            <div style={s.ganttWrap}>
              <div style={s.ganttHdr}>
                <h2 style={s.ganttTitle}>Project Timeline</h2>
                <span style={{fontSize:'0.76em',color:'#6c7086'}}>Click a task in the list below for details</span>
                {loading && <span style={{fontSize:'0.8em',color:'#fab387'}}>Refreshing...</span>}
              </div>
              <div style={{overflowX:'auto'}}>
                <div className="mermaid" ref={ganttRef} style={{minWidth:'820px'}}>{data.ganttCode}</div>
              </div>
            </div>

            {/* Task list */}
            <div style={s.taskSection}>
              <h3 style={s.taskSectionTitle}>Tasks  <span style={{fontWeight:400,color:'#6c7086',fontSize:'0.85em'}}>— click any row for details &amp; notes</span></h3>
              <div style={s.taskGrid}>
                {data.taskDetails.map(t=>(
                  <div
                    key={t.id}
                    className="task-row"
                    style={{
                      ...s.taskCard,
                      ...(selected?.id===t.id ? s.taskCardActive : {}),
                    }}
                    onClick={()=>setSelected(p=>p?.id===t.id?null:t)}
                  >
                    <div style={s.taskCardTop}>
                      <span style={{...s.pill,...statusStyle(t.status_id)}}>{t.status}</span>
                      <span style={s.taskMs}>{t.milestone}</span>
                    </div>
                    <div style={s.taskCardName}>{t.summary}</div>
                    <div style={s.taskCardMeta}>
                      {t.startdate && <span>📅 {t.startdate}</span>}
                      {t.hoursLogged>0 && <span>⏱ {t.hoursLogged.toFixed(1)}h</span>}
                      {t.actions.length>0 && <span style={{color:'#89b4fa'}}>💬 {t.actions.length} note{t.actions.length>1?'s':''}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Detail / notes panel */}
            {selected && (
              <div style={s.detail}>
                <div style={s.detailHdr}>
                  <div style={{flex:1}}>
                    <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'8px'}}>
                      <span style={{...s.pill,...statusStyle(selected.status_id)}}>{selected.status}</span>
                      <span style={{fontSize:'0.78em',color:'#6c7086'}}>{selected.milestone}</span>
                    </div>
                    <h3 style={s.detailTitle}>{selected.summary}</h3>
                  </div>
                  <button style={s.closeBtn} onClick={()=>setSelected(null)}>✕ Close</button>
                </div>

                {/* Info grid */}
                <div style={s.infoGrid}>
                  {[
                    {l:'Assigned to', v:selected.agent},
                    {l:'Start date',  v:selected.startdate||'—'},
                    {l:'Target date', v:selected.targetdate||'—'},
                    {l:'Time logged', v:`${selected.hoursLogged.toFixed(1)}h`},
                    {l:'Ticket #',    v:`#${selected.id}`},
                  ].map((item,i)=>(
                    <div key={i} style={s.infoItem}>
                      <div style={s.infoLabel}>{item.l}</div>
                      <div style={s.infoVal}>{item.v}</div>
                    </div>
                  ))}
                </div>

                {/* Task description */}
                {selected.details && selected.details.trim() && (
                  <div style={s.notesBlock}>
                    <div style={s.notesLabel}>Description</div>
                    <div style={s.notesBody} dangerouslySetInnerHTML={{__html: selected.details}}/>
                  </div>
                )}

                {/* Public notes / actions */}
                {selected.actions.length > 0 ? (
                  <div>
                    <div style={s.notesLabel}>Updates &amp; Notes</div>
                    {selected.actions.map(a=>(
                      <div key={a.id} style={s.actionCard}>
                        <div style={s.actionMeta}>
                          <span style={{fontWeight:600,color:'#89b4fa'}}>{a.who}</span>
                          {a.date && <span style={{color:'#6c7086'}}>{a.date}</span>}
                          {a.timetaken>0 && <span style={{color:'#fab387'}}>⏱ {a.timetaken.toFixed(1)}h</span>}
                          {a.outcome && <span style={{color:'#a6adc8'}}>{a.outcome}</span>}
                        </div>
                        <div style={s.actionBody} dangerouslySetInnerHTML={{__html: a.note}}/>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={s.noNotes}>No public notes on this task yet.</div>
                )}
              </div>
            )}

            <footer style={s.footer}>
              <span>Powered by <strong>Sondela Consulting</strong> · Live HaloPSA Data</span>
              <a href="https://sondelaconsulting.com" target="_blank" rel="noreferrer" style={{color:'#89b4fa'}}>sondelaconsulting.com</a>
            </footer>
          </main>
        )}
      </div>
    </>
  );
}

function statusStyle(sid) {
  if ([9,16,21].includes(sid)) return {background:'#1e3a2e',color:'#a6e3a1'};
  if ([2,22].includes(sid))    return {background:'#1e2e4a',color:'#89b4fa'};
  return {background:'#2e2e1e',color:'#f9e2af'};
}

const s = {
  page:        {minHeight:'100vh',background:'#1e1e2e',color:'#cdd6f4',fontFamily:'Segoe UI,Arial,sans-serif'},
  header:      {background:'#181825',borderBottom:'1px solid #313244',padding:'14px 30px'},
  hInner:      {maxWidth:'1400px',margin:'0 auto',display:'flex',justifyContent:'space-between',alignItems:'center'},
  brand:       {color:'#89b4fa',fontWeight:700,fontSize:'0.95em'},
  updated:     {color:'#6c7086',fontSize:'0.78em'},
  errBox:      {background:'#302030',border:'1px solid #f38ba8',padding:'14px 30px',color:'#f38ba8'},
  spinWrap:    {display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',minHeight:'50vh',gap:'20px'},
  spinDot:     {width:'36px',height:'36px',border:'3px solid #313244',borderTopColor:'#89b4fa',borderRadius:'50%',animation:'spin 0.8s linear infinite'},
  main:        {maxWidth:'1400px',margin:'0 auto',padding:'28px'},
  titleRow:    {display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'20px',gap:'20px',flexWrap:'wrap'},
  clientBadge: {display:'inline-block',background:'#313244',color:'#89b4fa',border:'1px solid #45475a',borderRadius:'20px',fontSize:'0.78em',padding:'4px 14px',marginBottom:'8px'},
  h1:          {fontSize:'1.4em',color:'#cdd6f4',fontWeight:700,lineHeight:1.3,marginBottom:'4px'},
  meta:        {fontSize:'0.82em',color:'#6c7086',margin:0},
  refreshBtn:  {background:'#313244',color:'#cdd6f4',border:'1px solid #45475a',borderRadius:'8px',padding:'9px 18px',fontSize:'0.85em',cursor:'pointer',whiteSpace:'nowrap',flexShrink:0},
  stats:       {display:'flex',gap:'10px',marginBottom:'16px',flexWrap:'wrap'},
  stat:        {background:'#313244',border:'1px solid #45475a',borderRadius:'10px',padding:'12px 16px',flex:1,minWidth:'90px'},
  statV:       {fontSize:'1.5em',fontWeight:700,color:'#cdd6f4'},
  statL:       {fontSize:'0.7em',color:'#6c7086',marginTop:'2px'},
  milestones:  {display:'flex',flexWrap:'wrap',gap:'6px',marginBottom:'16px'},
  ms:          {display:'flex',alignItems:'center',gap:'7px',background:'#313244',border:'1px solid #45475a',borderRadius:'8px',padding:'6px 12px',fontSize:'0.78em'},
  msN:         {color:'#cdd6f4'},
  msM:         {color:'#6c7086',fontSize:'0.85em'},
  msS:         {fontSize:'0.8em',padding:'2px 8px',borderRadius:'10px',fontWeight:600},
  ganttWrap:   {background:'#313244',border:'1px solid #45475a',borderRadius:'12px',padding:'20px',marginBottom:'20px'},
  ganttHdr:    {display:'flex',alignItems:'center',gap:'12px',marginBottom:'16px',flexWrap:'wrap'},
  ganttTitle:  {fontSize:'0.95em',color:'#a6adc8',fontWeight:600,margin:0},
  // Task grid
  taskSection: {marginBottom:'20px'},
  taskSectionTitle:{fontSize:'0.95em',color:'#a6adc8',fontWeight:600,margin:'0 0 12px'},
  taskGrid:    {display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:'10px'},
  taskCard:    {background:'#313244',border:'1px solid #45475a',borderRadius:'10px',padding:'14px',cursor:'pointer',transition:'border-color 0.15s'},
  taskCardActive:{background:'#1e2535',border:'1px solid #89b4fa'},
  taskCardTop: {display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'6px'},
  pill:        {fontSize:'0.7em',padding:'2px 8px',borderRadius:'8px',fontWeight:600},
  taskMs:      {fontSize:'0.7em',color:'#6c7086',maxWidth:'130px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'},
  taskCardName:{fontSize:'0.84em',color:'#cdd6f4',lineHeight:1.4,marginBottom:'6px'},
  taskCardMeta:{display:'flex',gap:'10px',fontSize:'0.72em',color:'#6c7086',flexWrap:'wrap'},
  // Detail panel
  detail:      {background:'#252535',border:'1px solid #89b4fa',borderRadius:'14px',padding:'24px',marginBottom:'20px',animation:'fadeUp 0.2s ease'},
  detailHdr:   {display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'16px',gap:'16px'},
  detailTitle: {fontSize:'1.1em',color:'#cdd6f4',fontWeight:700,margin:0},
  closeBtn:    {background:'#45475a',border:'none',color:'#cdd6f4',borderRadius:'6px',padding:'7px 12px',cursor:'pointer',flexShrink:0,fontSize:'0.82em'},
  infoGrid:    {display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:'14px',background:'#1e1e2e',borderRadius:'10px',padding:'16px',marginBottom:'16px'},
  infoItem:    {display:'flex',flexDirection:'column',gap:'3px'},
  infoLabel:   {fontSize:'0.7em',color:'#6c7086',textTransform:'uppercase',letterSpacing:'0.06em'},
  infoVal:     {fontSize:'0.88em',color:'#cdd6f4'},
  notesLabel:  {fontSize:'0.72em',color:'#6c7086',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:'8px',marginTop:'14px'},
  notesBlock:  {background:'#1e1e2e',borderRadius:'8px',padding:'14px',marginBottom:'14px'},
  notesBody:   {fontSize:'0.84em',color:'#cdd6f4',lineHeight:1.7},
  actionCard:  {background:'#1e1e2e',borderRadius:'8px',padding:'14px',marginBottom:'10px'},
  actionMeta:  {display:'flex',gap:'12px',fontSize:'0.76em',marginBottom:'8px',flexWrap:'wrap',alignItems:'center'},
  actionBody:  {fontSize:'0.84em',color:'#cdd6f4',lineHeight:1.7},
  noNotes:     {fontSize:'0.84em',color:'#6c7086',fontStyle:'italic',marginTop:'14px'},
  footer:      {display:'flex',justifyContent:'space-between',fontSize:'0.8em',color:'#6c7086',flexWrap:'wrap',gap:'8px',marginTop:'8px'},
};
