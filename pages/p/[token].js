import { useEffect, useState, useRef } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';

const CLOSED = [9, 16, 21];
const ACTIVE  = [2, 22];

function statusLabel(sid) {
  if (CLOSED.includes(sid)) return 'Closed';
  if (ACTIVE.includes(sid))  return 'In Progress';
  return 'New';
}
function statusStyle(sid) {
  if (CLOSED.includes(sid)) return { background:'#1e3a2e', color:'#a6e3a1', border:'1px solid #2d5a40' };
  if (ACTIVE.includes(sid))  return { background:'#1e2e4a', color:'#89b4fa', border:'1px solid #2d4a6a' };
  return { background:'#2e2e1e', color:'#f9e2af', border:'1px solid #4a4a2d' };
}

export default function ProjectPage() {
  const { query }             = useRouter();
  const [data, setData]       = useState(null);
  const [error, setError]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastFetch, setLastFetch] = useState(null);
  const [view, setView]         = useState('gantt');   // 'gantt' | 'schedule' | 'kanban'
  const [selected, setSelected]   = useState(null);
  const [hideCompleted, setHideCompleted] = useState(false);
  const [collapsed, setCollapsed] = useState({});

  function toggleCollapse(name) {
    setCollapsed(p => ({...p, [name]: !p[name]}));
  }
  const ganttRef     = useRef(null);
  const mermaidReady = useRef(false);

  async function load() {
    if (!query.token) return;
    setLoading(true);
    try {
      const res  = await fetch(`/api/p/${query.token}`);
      const json = await res.json();
      if (json.error) throw new Error(`${json.error}||${json.reason||''}`);
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

  useEffect(() => { if (query.token) load(); }, [query.token]);

  useEffect(() => {
    if (!data || !ganttRef.current || view !== 'gantt') return;
    const render = async () => {
      if (!window.mermaid) { setTimeout(render, 200); return; }
      const el = ganttRef.current;
      el.removeAttribute('data-processed');
      el.textContent = data.ganttCode;
      try { await window.mermaid.init(undefined, el); }
      catch { el.innerHTML = `<pre style="color:#cdd6f4;font-size:0.75em;white-space:pre-wrap;line-height:1.7">${data.ganttCode}</pre>`; }
    };
    setTimeout(render, 150);
  }, [data, view]);

  const colour  = data?.project?.client_colour || '#89b4fa';
  const pct     = data?.stats?.pctComplete || 0;
  const title   = data ? `${data.project.client_name} — ${data.project.summary}` : 'Loading...';

  return (
    <>
      <Head><title>{title} | Sondela</title></Head>
      <style>{`
        @keyframes spin   { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        .task-row:hover   { background:#252538 !important; }
        .gantt-scroll::-webkit-scrollbar       { height:6px; width:6px; }
        .gantt-scroll::-webkit-scrollbar-track { background:#1e1e2e; }
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

        {error && (() => {
          const [msg, reason] = error.split('||');
          const isAccess = reason === 'revoked' || reason === 'expired';
          return (
            <div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'70vh'}}>
              <div style={{textAlign:'center',maxWidth:'440px',padding:'40px'}}>
                <div style={{fontSize:'3em',marginBottom:'16px'}}>{reason==='expired'?'⏰':'🔒'}</div>
                <h2 style={{color:'#cdd6f4',fontSize:'1.2em',marginBottom:'10px'}}>
                  {reason==='expired'?'Link Expired':'Link Deactivated'}
                </h2>
                <p style={{color:'#6c7086',fontSize:'0.9em',lineHeight:1.6}}>{msg}</p>
                <p style={{color:'#45475a',fontSize:'0.8em',marginTop:'16px'}}>
                  Please contact Sondela Consulting if you believe this is an error.
                </p>
              </div>
            </div>
          );
        })()}
        {loading && !data && (
          <div style={s.spinWrap}>
            <div style={s.spinDot}></div>
            <p style={{color:'#a6adc8'}}>Loading from HaloPSA...</p>
          </div>
        )}

        {data && (
          <main style={s.main}>
            {/* Title row */}
            <div style={s.titleRow}>
              <div>
                <span style={{...s.clientBadge,color:colour,borderColor:colour+'50'}}>{data.project.client_name}</span>
                <h1 style={s.h1}>{data.project.summary}</h1>
                <p style={s.meta}>Managed by {data.project.agent_name}</p>
              </div>
              <div style={{display:'flex',gap:'8px',flexShrink:0,alignItems:'center'}}>
                <button style={s.emailBtn} onClick={()=>{
                  const url  = window.location.href;
                  const subj = encodeURIComponent(`Project Update: ${data.project.summary}`);
                  const body = encodeURIComponent(`Hi,\n\nHere is a link to your live project status:\n\n${url}\n\nNo login required.\n\nKind regards,\nSondela Consulting`);
                  window.location.href=`mailto:?subject=${subj}&body=${body}`;
                }}>📧 Share</button>
                <button style={s.refreshBtn} onClick={load} disabled={loading}>
                  {loading?'...':'⟳ Refresh'}
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

            {/* Progress bar */}
            <div style={{marginBottom:'16px'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'6px'}}>
                <span style={{fontSize:'0.78em',color:'#a6adc8',fontWeight:600}}>Overall Progress</span>
                <span style={{fontSize:'0.82em',fontWeight:700,color:'#a6e3a1'}}>{pct}% complete</span>
              </div>
              <div style={{height:'18px',background:'#1e1e2e',borderRadius:'9px',overflow:'hidden',border:'1px solid #313244'}}>
                <div style={{
                  height:'100%',
                  width:`${pct}%`,
                  background:'linear-gradient(90deg, #40a060, #a6e3a1)',
                  borderRadius:'9px',
                  transition:'width 0.6s ease',
                  display:'flex',
                  alignItems:'center',
                  justifyContent:'flex-end',
                  paddingRight: pct > 8 ? '8px' : '0',
                }}>
                  {pct > 8 && <span style={{fontSize:'0.7em',fontWeight:700,color:'#1e1e2e'}}>{pct}%</span>}
                </div>
              </div>
            </div>

            {/* View switcher + controls */}
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'16px',flexWrap:'wrap',gap:'10px'}}>
              <div style={s.viewSwitcher}>
                {['gantt','schedule','kanban'].map(v=>(
                  <button key={v} onClick={()=>setView(v)}
                    style={{...s.viewBtn,...(view===v?{...s.viewBtnActive,borderBottomColor:colour,color:colour}:{})}}>
                    {v==='gantt'?'📊 Gantt':v==='schedule'?'📋 Schedule':'🗂 Kanban'}
                  </button>
                ))}
              </div>
              {(view==='schedule'||view==='kanban') && (
                <label style={{display:'flex',alignItems:'center',gap:'8px',cursor:'pointer',fontSize:'0.85em',color:'#a6adc8'}}>
                  <input type="checkbox" checked={hideCompleted} onChange={e=>setHideCompleted(e.target.checked)}
                    style={{accentColor:'#89b4fa',width:'15px',height:'15px',cursor:'pointer'}}/>
                  Hide completed tasks
                </label>
              )}
            </div>

            {/* ── GANTT VIEW ── */}
            {view === 'gantt' && (
              <div style={s.mainRow}>
                <div style={s.ganttPanel}>
                  <div style={s.panelHdr}>
                    <h2 style={s.panelTitle}>Project Timeline</h2>
                    {loading && <span style={{fontSize:'0.78em',color:'#fab387'}}>Refreshing...</span>}
                  </div>
                  <div className="gantt-scroll" style={s.ganttScroll}>
                    <div className="mermaid" ref={ganttRef} style={{minWidth:'900px',minHeight:'300px'}}>{data.ganttCode}</div>
                  </div>
                </div>
                <div style={s.taskPanel}>
                  <div style={s.panelHdr}>
                    <h2 style={s.panelTitle}>Tasks</h2>
                    <span style={{fontSize:'0.72em',color:'#6c7086'}}>Click for details</span>
                  </div>
                  <div className="task-list-scroll" style={s.taskScroll}>
                    {data.taskDetails.map(t=>(
                      <div key={t.id} className="task-row" onClick={()=>setSelected(p=>p?.id===t.id?null:t)}
                        style={{...s.taskRow,...(selected?.id===t.id?s.taskRowActive:{})}}>
                        <div style={s.taskTop}>
                          <span style={{...s.pill,...statusStyle(t.status_id)}}>{statusLabel(t.status_id)}</span>
                          {t.actions.length>0&&<span style={{fontSize:'0.68em',color:colour}}>💬 {t.actions.length}</span>}
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
            )}

            {/* ── SCHEDULE VIEW ── */}
            {view === 'schedule' && (
              <ScheduleView data={data} selected={selected} setSelected={setSelected} colour={colour} hideCompleted={hideCompleted} collapsed={collapsed} toggleCollapse={toggleCollapse}/>
            )}

            {/* ── KANBAN VIEW ── */}
            {view === 'kanban' && (
              <KanbanView data={data} selected={selected} setSelected={setSelected} colour={colour} hideCompleted={hideCompleted}/>
            )}

            {/* ── DETAIL PANEL (shared across views) ── */}
            {selected && (
              <div style={s.detail}>
                <div style={s.detailHdr}>
                  <div style={{flex:1}}>
                    <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'8px',flexWrap:'wrap'}}>
                      <span style={{...s.pill,...statusStyle(selected.status_id)}}>{statusLabel(selected.status_id)}</span>
                      <span style={{fontSize:'0.78em',color:'#6c7086'}}>{selected.milestone}</span>
                      <span style={{fontSize:'0.78em',color:'#6c7086'}}>#{selected.id}</span>
                    </div>
                    <h3 style={s.detailTitle}>{selected.summary}</h3>
                  </div>
                  <button style={s.closeBtn} onClick={()=>setSelected(null)}>✕ Close</button>
                </div>
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
                {selected.details?.trim()&&(
                  <div style={s.block}>
                    <div style={s.blockLbl}>Description</div>
                    <div style={s.blockBody} dangerouslySetInnerHTML={{__html:selected.details}}></div>
                  </div>
                )}
                <div style={s.blockLbl}>Updates &amp; Notes</div>
                {selected.actions.length>0 ? selected.actions.map(a=>(
                  <div key={a.id} style={s.actionCard}>
                    <div style={s.actionMeta}>
                      <span style={{fontWeight:600,color:colour}}>{a.who}</span>
                      {a.date&&<span style={{color:'#6c7086'}}>{a.date}</span>}
                      {a.timetaken>0&&<span style={{color:'#fab387'}}>⏱ {a.timetaken.toFixed(1)}h</span>}
                      {a.outcome&&<span style={{color:'#a6adc8',fontStyle:'italic'}}>{a.outcome}</span>}
                    </div>
                    <div style={s.actionBody}>{a.note}</div>
                  </div>
                )) : <div style={s.noNotes}>No public notes on this task yet.</div>}
              </div>
            )}

            <footer style={s.footer}>
              <span>Powered by <strong>Sondela Consulting</strong> · Live HaloPSA Data</span>
              <a href="https://sondelaconsulting.com" target="_blank" rel="noreferrer" style={{color:colour}}>sondelaconsulting.com</a>
            </footer>
          </main>
        )}
      </div>
    </>
  );
}

// ── SCHEDULE VIEW COMPONENT ──────────────────────────────────────────────────
function ScheduleView({ data, selected, setSelected, colour, hideCompleted, collapsed, toggleCollapse }) {
  const CLOSED = [9, 16, 21];
  const tasksByMilestone = {};
  data.milestones.forEach(ms => {
    let tasks = data.taskDetails.filter(t => t.milestone === ms.name);
    if (hideCompleted) tasks = tasks.filter(t => !CLOSED.includes(t.status_id));
    tasksByMilestone[ms.name] = { milestone: ms, tasks };
  });
  let other = data.taskDetails.filter(t => t.milestone === 'Other');
  if (hideCompleted) other = other.filter(t => !CLOSED.includes(t.status_id));

  const totalH = data.stats.budgetHours || 0;

  const allNames = [...Object.keys(tasksByMilestone), ...(other.length > 0 ? ['__other__'] : [])];
  const allCollapsed = allNames.every(n => collapsed[n]);

  function collapseAll() { allNames.forEach(n => { if (!collapsed[n]) toggleCollapse(n); }); }
  function expandAll()   { allNames.forEach(n => { if (collapsed[n])  toggleCollapse(n); }); }

  return (
    <div style={sv.wrap}>
      {/* Table header */}
      <div style={{...sv.tableHead, justifyContent:'space-between'}}>
        <div style={{display:'flex',gap:'0',flex:1}}>
          <div style={{...sv.col, width:'140px'}}>Status</div>
          <div style={{...sv.col, flex:1}}>Summary</div>
          <div style={{...sv.col, width:'100px'}}>Start Date</div>
          <div style={{...sv.col, width:'100px'}}>Target Date</div>
          <div style={{...sv.col, width:'80px'}}>Time Taken</div>
          <div style={{...sv.col, width:'160px'}}>Agent</div>
          <div style={{...sv.col, width:'90px'}}>Budget %</div>
        </div>
        <button
          onClick={allCollapsed ? expandAll : collapseAll}
          style={{background:'#313244',border:'1px solid #45475a',color:'#a6adc8',borderRadius:'6px',padding:'4px 12px',fontSize:'0.75em',cursor:'pointer',whiteSpace:'nowrap',marginLeft:'12px',flexShrink:0}}>
          {allCollapsed ? '▶ Expand All' : '▼ Collapse All'}
        </button>
      </div>

      {Object.values(tasksByMilestone).map(({ milestone: ms, tasks }) => {
        const isCollapsed = collapsed[ms.name];
        const msCol = ms.state===2?'#a6e3a1':ms.state===1?colour:'#f9e2af';
        const msHours = tasks.reduce((a, t) => a + t.hoursLogged, 0);
        const completedCount = tasks.filter(t => [9,16,21].includes(t.status_id)).length;
        if (tasks.length === 0 && hideCompleted) return null;

        return (
          <div key={ms.name}>
            {/* Milestone header — clickable to collapse */}
            <div
              onClick={() => toggleCollapse(ms.name)}
              style={{...sv.msRow, borderLeftColor: msCol, cursor:'pointer', userSelect:'none'}}
            >
              <div style={{display:'flex',alignItems:'center',gap:'8px',flex:1}}>
                <span style={{color:msCol,fontSize:'0.8em',transition:'transform 0.2s',display:'inline-block',transform:isCollapsed?'rotate(-90deg)':'rotate(0deg)'}}>▼</span>
                <span style={{...sv.msLabel, color: msCol}}>{ms.name}</span>
                <span style={{fontSize:'0.72em',color:'#6c7086'}}>
                  {tasks.length} task{tasks.length!==1?'s':''} · {msHours.toFixed(1)}h logged
                  {completedCount > 0 && !hideCompleted && ` · ${completedCount} completed`}
                </span>
              </div>
              <span style={{fontSize:'0.72em',color:'#45475a'}}>{isCollapsed ? 'Click to expand' : 'Click to collapse'}</span>
            </div>

            {/* Task rows — hidden when collapsed */}
            {!isCollapsed && tasks.map((t, i) => {
              const pct = totalH > 0 ? Math.min(100, Math.round((t.hoursLogged / totalH) * 100)) : 0;
              return (
                <div key={t.id}
                  onClick={() => setSelected(p => p?.id===t.id?null:t)}
                  style={{
                    ...sv.taskRow,
                    background: selected?.id===t.id ? '#1e2535' : i%2===0 ? '#252535' : '#1e1e2e',
                    borderLeft: selected?.id===t.id ? `3px solid ${colour}` : '3px solid transparent',
                    opacity: [9,16,21].includes(t.status_id) ? 0.7 : 1,
                  }}>
                  <div style={{width:'140px',flexShrink:0}}>
                    <span style={{...sv.pill,...statusStyle(t.status_id)}}>{statusLabel(t.status_id)}</span>
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{...sv.taskName, textDecoration:[9,16,21].includes(t.status_id)?'line-through':'none'}}>{t.summary}</div>
                    {t.actions.length>0&&<span style={{fontSize:'0.68em',color:colour}}>💬 {t.actions.length} note{t.actions.length>1?'s':''}</span>}
                  </div>
                  <div style={{width:'100px',flexShrink:0,fontSize:'0.78em',color:'#a6adc8'}}>{t.startdate||'—'}</div>
                  <div style={{width:'100px',flexShrink:0,fontSize:'0.78em',color:'#a6adc8'}}>{t.targetdate||'—'}</div>
                  <div style={{width:'80px',flexShrink:0,fontSize:'0.78em',color:'#fab387',textAlign:'center'}}>
                    {t.hoursLogged>0?`${t.hoursLogged.toFixed(1)}h`:'—'}
                  </div>
                  <div style={{width:'160px',flexShrink:0,fontSize:'0.75em',color:'#6c7086',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{t.agent}</div>
                  <div style={{width:'90px',flexShrink:0}}>
                    <div style={sv.budgetTrack}>
                      <div style={{...sv.budgetBar,width:`${pct}%`,background:colour}}></div>
                    </div>
                    <div style={{fontSize:'0.65em',color:'#6c7086',textAlign:'center',marginTop:'2px'}}>{pct}%</div>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}

      {other.length > 0 && (
        <div>
          <div
            onClick={() => toggleCollapse('__other__')}
            style={{...sv.msRow, borderLeftColor:'#45475a', cursor:'pointer', userSelect:'none'}}
          >
            <div style={{display:'flex',alignItems:'center',gap:'8px',flex:1}}>
              <span style={{color:'#6c7086',fontSize:'0.8em',display:'inline-block',transform:collapsed['__other__']?'rotate(-90deg)':'rotate(0deg)'}}>▼</span>
              <span style={{...sv.msLabel, color:'#6c7086'}}>Other Tasks</span>
              <span style={{fontSize:'0.72em',color:'#6c7086'}}>{other.length} task{other.length!==1?'s':''}</span>
            </div>
          </div>
          {!collapsed['__other__'] && other.map((t, i) => (
            <div key={t.id}
              onClick={() => setSelected(p => p?.id===t.id?null:t)}
              style={{
                ...sv.taskRow,
                background: selected?.id===t.id ? '#1e2535' : i%2===0 ? '#252535' : '#1e1e2e',
                borderLeft: selected?.id===t.id ? `3px solid ${colour}` : '3px solid transparent',
                opacity: [9,16,21].includes(t.status_id) ? 0.7 : 1,
              }}>
              <div style={{width:'140px',flexShrink:0}}>
                <span style={{...sv.pill,...statusStyle(t.status_id)}}>{statusLabel(t.status_id)}</span>
              </div>
              <div style={{flex:1,minWidth:0,fontSize:'0.82em',color:'#cdd6f4'}}>{t.summary}</div>
              <div style={{width:'100px',flexShrink:0,fontSize:'0.78em',color:'#a6adc8'}}>{t.startdate||'—'}</div>
              <div style={{width:'100px',flexShrink:0,fontSize:'0.78em',color:'#a6adc8'}}>{t.targetdate||'—'}</div>
              <div style={{width:'80px',flexShrink:0,fontSize:'0.78em',color:'#fab387',textAlign:'center'}}>
                {t.hoursLogged>0?`${t.hoursLogged.toFixed(1)}h`:'—'}
              </div>
              <div style={{width:'160px',flexShrink:0,fontSize:'0.75em',color:'#6c7086'}}>{t.agent}</div>
              <div style={{width:'90px',flexShrink:0}}></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── KANBAN VIEW COMPONENT ────────────────────────────────────────────────────
function KanbanView({ data, selected, setSelected, colour, hideCompleted }) {
  const CLOSED_IDS = [9, 16, 21];
  const ACTIVE_IDS = [2, 22];

  const columns = [
    { label: '📋 New',         filter: t => !CLOSED_IDS.includes(t.status_id) && !ACTIVE_IDS.includes(t.status_id), colour: '#f9e2af' },
    { label: '🔄 In Progress', filter: t => ACTIVE_IDS.includes(t.status_id),                                        colour: '#89b4fa' },
    { label: '✅ Completed',   filter: t => CLOSED_IDS.includes(t.status_id),                                        colour: '#a6e3a1' },
  ];

  return (
    <div style={kv.board}>
      {columns.map(col => {
        let tasks = data.taskDetails.filter(col.filter);
        const isCompletedCol = col.label.includes('Completed');
        if (hideCompleted && isCompletedCol) return null;
        return (
          <div key={col.label} style={kv.column}>
            <div style={{...kv.colHeader, color: col.colour, borderBottomColor: col.colour}}>
              <span>{col.label}</span>
              <span style={kv.badge}>{tasks.length}</span>
            </div>
            <div style={kv.cards}>
              {tasks.length === 0 && <div style={kv.empty}>No tasks</div>}
              {tasks.map(t => (
                <div key={t.id}
                  onClick={() => setSelected(p => p?.id===t.id?null:t)}
                  style={{
                    ...kv.card,
                    background: selected?.id===t.id ? '#252545' : '#252535',
                    border: selected?.id===t.id ? `1px solid ${colour}` : '1px solid #45475a',
                  }}>
                  <div style={kv.cardMs}>{t.milestone}</div>
                  <div style={kv.cardTitle}>{t.summary}</div>
                  <div style={kv.cardFoot}>
                    <span style={kv.cardAgent}>{t.agent}</span>
                    <div style={{display:'flex',gap:'6px',alignItems:'center'}}>
                      {t.hoursLogged>0&&<span style={{fontSize:'0.68em',color:'#fab387'}}>⏱{t.hoursLogged.toFixed(1)}h</span>}
                      {t.actions.length>0&&<span style={{fontSize:'0.68em',color:colour}}>💬{t.actions.length}</span>}
                      {t.startdate&&<span style={{fontSize:'0.65em',color:'#6c7086'}}>{t.startdate}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── STYLES ───────────────────────────────────────────────────────────────────
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
  clientBadge: {display:'inline-block',background:'#313244',border:'1px solid',borderRadius:'20px',fontSize:'0.78em',padding:'4px 14px',marginBottom:'8px'},
  h1:          {fontSize:'1.4em',color:'#cdd6f4',fontWeight:700,lineHeight:1.3,marginBottom:'4px'},
  meta:        {fontSize:'0.82em',color:'#6c7086',margin:0},
  emailBtn:    {background:'#313244',color:'#cdd6f4',border:'1px solid #45475a',borderRadius:'8px',padding:'9px 14px',fontSize:'0.85em',cursor:'pointer',whiteSpace:'nowrap'},
  refreshBtn:  {background:'#313244',color:'#cdd6f4',border:'1px solid #45475a',borderRadius:'8px',padding:'9px 18px',fontSize:'0.85em',cursor:'pointer',whiteSpace:'nowrap'},
  stats:       {display:'flex',gap:'10px',marginBottom:'16px',flexWrap:'wrap'},
  stat:        {background:'#313244',border:'1px solid #45475a',borderRadius:'10px',padding:'12px 16px',flex:1,minWidth:'90px'},
  statV:       {fontSize:'1.5em',fontWeight:700,color:'#cdd6f4'},
  statL:       {fontSize:'0.7em',color:'#6c7086',marginTop:'2px'},
  milestones:  {display:'flex',flexWrap:'wrap',gap:'6px',marginBottom:'16px'},
  ms:          {display:'flex',alignItems:'center',gap:'7px',background:'#313244',border:'1px solid #45475a',borderRadius:'8px',padding:'6px 12px',fontSize:'0.78em'},
  msN:         {color:'#cdd6f4'},
  msM:         {color:'#6c7086',fontSize:'0.85em'},
  msS:         {fontSize:'0.8em',padding:'2px 8px',borderRadius:'10px',fontWeight:600},
  // View switcher
  viewSwitcher:{display:'flex',gap:'0',marginBottom:'16px',background:'#181825',borderRadius:'10px',padding:'4px',width:'fit-content'},
  viewBtn:     {background:'transparent',border:'none',color:'#6c7086',padding:'8px 20px',borderRadius:'7px',cursor:'pointer',fontSize:'0.85em',fontWeight:500,borderBottom:'2px solid transparent',transition:'all 0.15s'},
  viewBtnActive:{background:'#313244',color:'#cdd6f4',fontWeight:700},
  // Gantt
  mainRow:     {display:'flex',gap:'16px',alignItems:'flex-start',marginBottom:'20px'},
  ganttPanel:  {flex:1,minWidth:0,background:'#313244',border:'1px solid #45475a',borderRadius:'12px',padding:'20px'},
  panelHdr:    {display:'flex',alignItems:'center',gap:'12px',marginBottom:'14px',flexWrap:'wrap'},
  panelTitle:  {fontSize:'0.9em',color:'#a6adc8',fontWeight:600,margin:0},
  ganttScroll: {overflowX:'auto',overflowY:'auto',maxHeight:'520px',paddingBottom:'8px'},
  taskPanel:   {width:'260px',flexShrink:0,background:'#313244',border:'1px solid #45475a',borderRadius:'12px',padding:'16px',display:'flex',flexDirection:'column'},
  taskScroll:  {overflowY:'auto',maxHeight:'480px',display:'flex',flexDirection:'column',gap:'6px'},
  taskRow:     {background:'#1e1e2e',border:'1px solid #313244',borderRadius:'8px',padding:'10px 12px',cursor:'pointer',transition:'all 0.15s'},
  taskRowActive:{background:'#1e2535',border:'1px solid #89b4fa'},
  taskTop:     {display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'5px'},
  pill:        {fontSize:'0.68em',padding:'2px 8px',borderRadius:'8px',fontWeight:600},
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

// Schedule view styles
const sv = {
  wrap:        {background:'#313244',border:'1px solid #45475a',borderRadius:'12px',overflow:'hidden',marginBottom:'20px'},
  tableHead:   {display:'flex',alignItems:'center',background:'#181825',padding:'10px 16px',borderBottom:'1px solid #45475a',gap:'8px'},
  col:         {fontSize:'0.72em',color:'#6c7086',textTransform:'uppercase',letterSpacing:'0.06em',flexShrink:0},
  msRow:       {display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 16px',background:'#1e1e2e',borderBottom:'1px solid #313244',borderLeft:'3px solid',marginTop:'2px'},
  msLabel:     {fontSize:'0.82em',fontWeight:700},
  msMeta:      {fontSize:'0.72em',color:'#6c7086'},
  taskRow:     {display:'flex',alignItems:'center',padding:'10px 16px',cursor:'pointer',gap:'8px',borderBottom:'1px solid #313244',transition:'background 0.1s'},
  taskName:    {fontSize:'0.82em',color:'#cdd6f4',lineHeight:1.35},
  pill:        {fontSize:'0.68em',padding:'2px 8px',borderRadius:'8px',fontWeight:600},
  budgetTrack: {height:'4px',background:'#1e1e2e',borderRadius:'2px'},
  budgetBar:   {height:'4px',borderRadius:'2px'},
};

// Kanban styles
const kv = {
  board:     {display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'16px',marginBottom:'20px',alignItems:'start'},
  column:    {background:'#252535',border:'1px solid #45475a',borderRadius:'12px',overflow:'hidden'},
  colHeader: {display:'flex',justifyContent:'space-between',alignItems:'center',padding:'14px 16px',borderBottom:'2px solid',fontWeight:700,fontSize:'0.9em'},
  badge:     {background:'#1e1e2e',borderRadius:'12px',padding:'2px 10px',fontSize:'0.75em',color:'#cdd6f4'},
  cards:     {padding:'10px',display:'flex',flexDirection:'column',gap:'8px',minHeight:'100px'},
  card:      {borderRadius:'10px',padding:'12px 14px',cursor:'pointer',transition:'border-color 0.15s'},
  cardMs:    {fontSize:'0.68em',color:'#6c7086',marginBottom:'5px',textTransform:'uppercase',letterSpacing:'0.04em'},
  cardTitle: {fontSize:'0.82em',color:'#cdd6f4',lineHeight:1.4,marginBottom:'8px',fontWeight:500},
  cardFoot:  {display:'flex',justifyContent:'space-between',alignItems:'center',gap:'6px',flexWrap:'wrap'},
  cardAgent: {fontSize:'0.7em',color:'#6c7086',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:'100px'},
  empty:     {fontSize:'0.8em',color:'#45475a',textAlign:'center',padding:'20px',fontStyle:'italic'},
};