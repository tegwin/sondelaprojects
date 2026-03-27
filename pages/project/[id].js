import { useEffect, useState, useRef } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';

export default function ProjectPage() {
  const { query } = useRouter();
  const [data, setData]         = useState(null);
  const [error, setError]       = useState(null);
  const [loading, setLoading]   = useState(true);
  const [lastFetch, setLastFetch] = useState(null);
  const [selected, setSelected] = useState(null);
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
    const sc = document.createElement('script');
    sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/mermaid/10.6.1/mermaid.min.js';
    sc.onload = () => window.mermaid?.initialize({
      startOnLoad: false, theme: 'dark',
      gantt: { fontSize: 13, barHeight: 24, barGap: 5, topPadding: 55, sidePadding: 90 }
    });
    document.head.appendChild(sc);
  }, []);

  useEffect(() => { if (query.id) load(); }, [query.id]);

  useEffect(() => {
    if (!data || !ganttRef.current) return;
    const render = async () => {
      if (!window.mermaid) { setTimeout(render, 200); return; }
      const el = ganttRef.current;
      el.removeAttribute('data-processed');
      el.textContent = data.ganttCode;
      try { await window.mermaid.init(undefined, el); }
      catch { el.innerHTML = `<pre style="color:#cdd6f4;font-size:0.75em;white-space:pre-wrap;line-height:1.7">${data.ganttCode}</pre>`; }
    };
    setTimeout(render, 150);
  }, [data]);

  const title  = data ? `${data.project.client_name} — ${data.project.summary}` : 'Loading...';
  const colour = data?.project?.client_colour || '#89b4fa';
  const pct    = data?.stats?.pctComplete || 0;

  return (
    <>
      <Head><title>{title} | Sondela</title></Head>
      <style>{`
        @keyframes spin   { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        .task-row:hover   { background:#252538 !important; border-color:#6272a4 !important; }
        .gantt-scroll::-webkit-scrollbar       { height:6px; width:6px; }
        .gantt-scroll::-webkit-scrollbar-track { background:#1e1e2e; border-radius:3px; }
        .gantt-scroll::-webkit-scrollbar-thumb { background:#45475a; border-radius:3px; }
        .task-list-scroll::-webkit-scrollbar       { width:5px; }
        .task-list-scroll::-webkit-scrollbar-track { background:#1e1e2e; }
        .task-list-scroll::-webkit-scrollbar-thumb { background:#45475a; border-radius:3px; }
      `}</style>

      <div style={s.page}>
        {/* Header */}
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

            {/* Progress bar at top */}
            <div style={{height:'4px',background:'#313244',borderRadius:'0',margin:'-28px -28px 28px',overflow:'hidden'}}>
              <div style={{height:'4px',background:colour,width:`${pct}%`,transition:'width 0.5s ease'}}/>
            </div>

            {/* Title */}
            <div style={s.titleRow}>
              <div>
                <span style={{...s.clientBadge, color:colour, borderColor:colour+'50'}}>{data.project.client_name}</span>
                <h1 style={s.h1}>{data.project.summary}</h1>
                <p style={s.meta}>Managed by {data.project.agent_name} · <strong style={{color:colour}}>{pct}%</strong> complete</p>
              </div>
              <div style={{display:'flex',gap:'8px',flexShrink:0}}>
                <button style={s.emailBtn} onClick={()=>{
                  const url  = window.location.href;
                  const subj = encodeURIComponent(`Project Update: ${data.project.summary}`);
                  const body = encodeURIComponent(`Hi,\n\nHere is a link to your live project status for "${data.project.summary}":\n\n${url}\n\nYou can see the timeline, tasks, and notes in real time — no login required.\n\nKind regards,\nSondela Consulting`);
                  window.location.href = `mailto:?subject=${subj}&body=${body}`;
                }}>📧 Share</button>
                <button style={s.refreshBtn} onClick={load} disabled={loading}>
                  {loading ? '...' : '⟳ Refresh'}
                </button>
              </div>
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
                const lbl=ms.state===2?'Complete':ms.state===1?'Active':'Pending';
                const col=ms.state===2?'#a6e3a1':ms.state===1?'#89b4fa':'#f9e2af';
                const bg =ms.state===2?'#1e3a2e':ms.state===1?'#1e2e4a':'#2e2e1e';
                return(
                  <div key={i} style={s.ms}>
                    <span style={s.msN}>{ms.name}</span>
                    <span style={s.msM}>{ms.taskCount} tasks</span>
                    <span style={{...s.msS,color:col,background:bg}}>{lbl}</span>
                  </div>
                );
              })}
            </div>

            {/* ── GANTT + TASK LIST SIDE BY SIDE ── */}
            <div style={s.mainRow}>

              {/* Gantt — left, scrollable */}
              <div style={s.ganttPanel}>
                <div style={s.panelHdr}>
                  <h2 style={s.panelTitle}>Project Timeline</h2>
                  {loading && <span style={{fontSize:'0.78em',color:'#fab387'}}>Refreshing...</span>}
                </div>
                {/* Fixed-height scroll container */}
                <div
                  className="gantt-scroll"
                  style={s.ganttScroll}
                >
                  <div
                    className="mermaid"
                    ref={ganttRef}
                    style={{minWidth:'900px',minHeight:'300px'}}
                  >
                    {data.ganttCode}
                  </div>
                </div>
              </div>

              {/* Task list — right, scrollable */}
              <div style={s.taskPanel}>
                <div style={s.panelHdr}>
                  <h2 style={s.panelTitle}>Tasks</h2>
                  <span style={{fontSize:'0.72em',color:'#6c7086'}}>Click for details</span>
                </div>
                <div className="task-list-scroll" style={s.taskScroll}>
                  {data.taskDetails.map(t=>(
                    <div
                      key={t.id}
                      className="task-row"
                      onClick={()=>setSelected(p=>p?.id===t.id?null:t)}
                      style={{
                        ...s.taskRow,
                        ...(selected?.id===t.id?s.taskRowActive:{}),
                      }}
                    >
                      <div style={s.taskTop}>
                        <span style={{...s.pill,...statusStyle(t.status_id)}}>{t.status}</span>
                        {t.actions.length>0&&<span style={s.notesBadge}>💬 {t.actions.length}</span>}
                      </div>
                      <div style={s.taskName}>{t.summary}</div>
                      <div style={s.taskMeta}>
                        <span style={{color:'#6c7086',fontSize:'0.72em'}}>{t.milestone}</span>
                        {t.hoursLogged>0&&<span style={{color:'#fab387',fontSize:'0.72em'}}>⏱ {t.hoursLogged.toFixed(1)}h</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── DETAIL PANEL ── */}
            {selected && (
              <div style={s.detail}>
                <div style={s.detailHdr}>
                  <div style={{flex:1}}>
                    <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'8px',flexWrap:'wrap'}}>
                      <span style={{...s.pill,...statusStyle(selected.status_id)}}>{selected.status}</span>
                      <span style={{fontSize:'0.78em',color:'#6c7086'}}>{selected.milestone}</span>
                      <span style={{fontSize:'0.78em',color:'#6c7086'}}>#{selected.id}</span>
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
                  ].map((item,i)=>(
                    <div key={i} style={s.infoItem}>
                      <div style={s.infoLbl}>{item.l}</div>
                      <div style={s.infoVal}>{item.v}</div>
                    </div>
                  ))}
                </div>

                {/* Description */}
                {selected.details?.trim() && (
                  <div style={s.block}>
                    <div style={s.blockLbl}>Description</div>
                    <div style={s.blockBody} dangerouslySetInnerHTML={{__html:selected.details}}/>
                  </div>
                )}

                {/* Actions / notes */}
                <div style={s.blockLbl}>Updates &amp; Notes</div>
                {selected.actions.length>0 ? selected.actions.map(a=>(
                  <div key={a.id} style={s.actionCard}>
                    <div style={s.actionMeta}>
                      <span style={{fontWeight:600,color:"#89b4fa"}}>{a.label && <span style={{fontSize:"0.78em",color:"#fab387",marginRight:"6px"}}>[{a.label}]</span>}{a.who}</span>
                      {a.date&&<span style={{color:'#6c7086'}}>{a.date}</span>}
                      {a.timetaken>0&&<span style={{color:'#fab387'}}>⏱ {a.timetaken.toFixed(1)}h</span>}
                      {a.outcome&&<span style={{color:'#a6adc8',fontStyle:'italic'}}>{a.outcome}</span>}
                    </div>
                    <div style={s.actionBody}>{a.note}</div>
                  </div>
                )) : (
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
  hInner:      {maxWidth:'1500px',margin:'0 auto',display:'flex',justifyContent:'space-between',alignItems:'center'},
  brand:       {color:'#89b4fa',fontWeight:700,fontSize:'0.95em'},
  updated:     {color:'#6c7086',fontSize:'0.78em'},
  errBox:      {background:'#302030',border:'1px solid #f38ba8',padding:'14px 30px',color:'#f38ba8'},
  spinWrap:    {display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',minHeight:'50vh',gap:'20px'},
  spinDot:     {width:'36px',height:'36px',border:'3px solid #313244',borderTopColor:'#89b4fa',borderRadius:'50%',animation:'spin 0.8s linear infinite'},
  main:        {maxWidth:'1500px',margin:'0 auto',padding:'28px'},
  titleRow:    {display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'20px',gap:'20px',flexWrap:'wrap'},
  clientBadge: {display:'inline-block',background:'#313244',color:'#89b4fa',border:'1px solid #45475a',borderRadius:'20px',fontSize:'0.78em',padding:'4px 14px',marginBottom:'8px'},
  h1:          {fontSize:'1.4em',color:'#cdd6f4',fontWeight:700,lineHeight:1.3,marginBottom:'4px'},
  meta:        {fontSize:'0.82em',color:'#6c7086',margin:0},
  emailBtn:    {background:'#313244',color:'#cdd6f4',border:'1px solid #45475a',borderRadius:'8px',padding:'9px 14px',fontSize:'0.85em',cursor:'pointer',whiteSpace:'nowrap'},
  refreshBtn:  {background:'#313244',color:'#cdd6f4',border:'1px solid #45475a',borderRadius:'8px',padding:'9px 18px',fontSize:'0.85em',cursor:'pointer',whiteSpace:'nowrap',flexShrink:0},
  stats:       {display:'flex',gap:'10px',marginBottom:'16px',flexWrap:'wrap'},
  stat:        {background:'#313244',border:'1px solid #45475a',borderRadius:'10px',padding:'12px 16px',flex:1,minWidth:'90px'},
  statV:       {fontSize:'1.5em',fontWeight:700,color:'#cdd6f4'},
  statL:       {fontSize:'0.7em',color:'#6c7086',marginTop:'2px'},
  milestones:  {display:'flex',flexWrap:'wrap',gap:'6px',marginBottom:'20px'},
  ms:          {display:'flex',alignItems:'center',gap:'7px',background:'#313244',border:'1px solid #45475a',borderRadius:'8px',padding:'6px 12px',fontSize:'0.78em'},
  msN:         {color:'#cdd6f4'},
  msM:         {color:'#6c7086',fontSize:'0.85em'},
  msS:         {fontSize:'0.8em',padding:'2px 8px',borderRadius:'10px',fontWeight:600},
  // Main two-column layout
  mainRow:     {display:'flex',gap:'16px',alignItems:'flex-start',marginBottom:'20px'},
  // Gantt panel
  ganttPanel:  {flex:1,minWidth:0,background:'#313244',border:'1px solid #45475a',borderRadius:'12px',padding:'20px'},
  panelHdr:    {display:'flex',alignItems:'center',gap:'12px',marginBottom:'14px',flexWrap:'wrap'},
  panelTitle:  {fontSize:'0.9em',color:'#a6adc8',fontWeight:600,margin:0},
  ganttScroll: {overflowX:'auto',overflowY:'auto',maxHeight:'520px',paddingBottom:'8px'},
  // Task list panel
  taskPanel:   {width:'260px',flexShrink:0,background:'#313244',border:'1px solid #45475a',borderRadius:'12px',padding:'16px',display:'flex',flexDirection:'column'},
  taskScroll:  {overflowY:'auto',maxHeight:'480px',display:'flex',flexDirection:'column',gap:'6px'},
  taskRow:     {background:'#1e1e2e',border:'1px solid #313244',borderRadius:'8px',padding:'10px 12px',cursor:'pointer',transition:'all 0.15s'},
  taskRowActive:{background:'#1e2535 !important',border:'1px solid #89b4fa'},
  taskTop:     {display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'5px'},
  pill:        {fontSize:'0.68em',padding:'2px 8px',borderRadius:'8px',fontWeight:600},
  notesBadge:  {fontSize:'0.68em',color:'#89b4fa'},
  taskName:    {fontSize:'0.8em',color:'#cdd6f4',lineHeight:1.35,marginBottom:'5px'},
  taskMeta:    {display:'flex',justifyContent:'space-between',alignItems:'center'},
  // Detail panel
  detail:      {background:'#252535',border:'1px solid #89b4fa',borderRadius:'14px',padding:'24px',marginBottom:'20px',animation:'fadeUp 0.2s ease'},
  detailHdr:   {display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'16px',gap:'16px'},
  detailTitle: {fontSize:'1.1em',color:'#cdd6f4',fontWeight:700,margin:0},
  closeBtn:    {background:'#45475a',border:'none',color:'#cdd6f4',borderRadius:'6px',padding:'7px 12px',cursor:'pointer',flexShrink:0,fontSize:'0.82em'},
  infoGrid:    {display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))',gap:'12px',background:'#1e1e2e',borderRadius:'10px',padding:'14px',marginBottom:'16px'},
  infoItem:    {display:'flex',flexDirection:'column',gap:'3px'},
  infoLbl:     {fontSize:'0.68em',color:'#6c7086',textTransform:'uppercase',letterSpacing:'0.06em'},
  infoVal:     {fontSize:'0.86em',color:'#cdd6f4'},
  block:       {background:'#1e1e2e',borderRadius:'8px',padding:'14px',marginBottom:'14px'},
  blockLbl:    {fontSize:'0.7em',color:'#6c7086',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:'8px',marginTop:'4px'},
  blockBody:   {fontSize:'0.84em',color:'#cdd6f4',lineHeight:1.7},
  actionCard:  {background:'#1e1e2e',borderRadius:'8px',padding:'14px',marginBottom:'8px'},
  actionMeta:  {display:'flex',gap:'10px',fontSize:'0.75em',marginBottom:'8px',flexWrap:'wrap',alignItems:'center'},
  actionBody:  {fontSize:'0.84em',color:'#cdd6f4',lineHeight:1.7,whiteSpace:'pre-wrap'},
  noNotes:     {fontSize:'0.84em',color:'#6c7086',fontStyle:'italic',padding:'12px 0'},
  footer:      {display:'flex',justifyContent:'space-between',fontSize:'0.8em',color:'#6c7086',flexWrap:'wrap',gap:'8px',paddingTop:'8px'},
};
