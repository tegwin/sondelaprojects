import { useEffect, useState, useRef } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';

export default function ProjectPage() {
  const { query } = useRouter();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastFetch, setLastFetch] = useState(null);
  const [selected, setSelected] = useState(null); // selected task for detail panel
  const ganttRef = useRef(null);
  const mermaidReady = useRef(false);

  async function load() {
    if (!query.id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/project/${query.id}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
      setLastFetch(new Date());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (mermaidReady.current) return;
    mermaidReady.current = true;
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/mermaid/10.6.1/mermaid.min.js';
    s.onload = () => window.mermaid?.initialize({
      startOnLoad: false,
      theme: 'dark',
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
        // After render, attach click handlers to SVG rects
        attachGanttClicks(el, data.taskDetails, setSelected);
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
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        .gantt-task-rect { cursor: pointer; transition: opacity 0.15s; }
        .gantt-task-rect:hover { opacity: 0.8; }
      `}</style>

      <div style={s.page}>
        <header style={s.header}>
          <div style={s.headerInner}>
            <span style={s.brand}>📊 Sondela Consulting</span>
            {lastFetch && <span style={s.updated}>Live data · {lastFetch.toLocaleTimeString()}</span>}
          </div>
        </header>

        {error && <div style={s.errorBox}>⚠️ {error}</div>}

        {loading && !data && (
          <div style={s.spinWrap}>
            <div style={s.spinDot} />
            <p style={{ color:'#a6adc8' }}>Loading from HaloPSA...</p>
          </div>
        )}

        {data && (
          <main style={s.main}>
            {/* Project header */}
            <div style={s.projectHeader}>
              <div>
                <span style={s.clientBadge}>{data.project.client_name}</span>
                <h1 style={s.projectTitle}>{data.project.summary}</h1>
                <p style={s.meta}>Managed by {data.project.agent_name}</p>
              </div>
              <button style={s.refreshBtn} onClick={load} disabled={loading}>
                {loading ? '...' : '⟳ Refresh'}
              </button>
            </div>

            {/* Stats */}
            <div style={s.stats}>
              {[
                { val: data.stats.total,   lbl: 'Total Tasks' },
                { val: data.stats.done,    lbl: 'Completed ✅',  color: '#a6e3a1' },
                { val: data.stats.active,  lbl: 'In Progress 🔄', color: '#89b4fa' },
                { val: data.stats.pending, lbl: 'Pending ⏳' },
                ...(data.stats.budgetHours ? [{
                  val: `${data.stats.hoursLogged.toFixed(1)}h`,
                  lbl: `of ${data.stats.budgetHours}h used`,
                  color: '#fab387'
                }] : []),
                ...(data.stats.remainingHours !== null ? [{
                  val: `${data.stats.remainingHours.toFixed(1)}h`,
                  lbl: 'Budget Remaining'
                }] : []),
              ].map((st, i) => (
                <div key={i} style={s.stat}>
                  <div style={{ ...s.statVal, ...(st.color ? { color: st.color } : {}) }}>{st.val}</div>
                  <div style={s.statLbl}>{st.lbl}</div>
                </div>
              ))}
            </div>

            {/* Milestones */}
            <div style={s.milestones}>
              {data.milestones.map((ms, i) => {
                const label = ms.state === 2 ? 'Complete' : ms.state === 1 ? 'Active' : 'Pending';
                const col   = ms.state === 2 ? '#a6e3a1' : ms.state === 1 ? '#89b4fa' : '#f9e2af';
                const bg    = ms.state === 2 ? '#1e3a2e' : ms.state === 1 ? '#1e2e4a' : '#2e2e1e';
                return (
                  <div key={i} style={s.milestone}>
                    <span style={s.msName}>{ms.name}</span>
                    <span style={s.msMeta}>{ms.taskCount} tasks</span>
                    <span style={{ ...s.msState, color: col, background: bg }}>{label}</span>
                  </div>
                );
              })}
            </div>

            {/* Gantt + task panel side by side */}
            <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
              <div style={{ ...s.ganttWrap, flex: 1, minWidth: 0 }}>
                <div style={s.ganttHeader}>
                  <h2 style={s.ganttTitle}>Project Timeline</h2>
                  <span style={{ fontSize:'0.78em', color:'#6c7086' }}>Click a task bar for details</span>
                  {loading && <span style={{ fontSize:'0.8em', color:'#fab387' }}>Refreshing...</span>}
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <div className="mermaid" ref={ganttRef} style={{ minWidth: '820px' }}>{data.ganttCode}</div>
                </div>
              </div>

              {/* Task list panel */}
              <div style={s.taskList}>
                <h3 style={s.taskListTitle}>All Tasks</h3>
                {data.taskDetails.map(t => (
                  <div
                    key={t.id}
                    style={{
                      ...s.taskRow,
                      ...(selected?.id === t.id ? s.taskRowActive : {}),
                    }}
                    onClick={() => setSelected(selected?.id === t.id ? null : t)}
                  >
                    <div style={s.taskRowTop}>
                      <span style={{ ...s.taskStatus, ...statusStyle(t.status_id) }}>{t.status}</span>
                      <span style={s.taskMilestone}>{t.milestone}</span>
                    </div>
                    <div style={s.taskSummary}>{t.summary}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Detail panel - slides in when task selected */}
            {selected && (
              <div style={s.detailPanel}>
                <div style={s.detailHeader}>
                  <div>
                    <span style={{ ...s.taskStatus, ...statusStyle(selected.status_id) }}>{selected.status}</span>
                    <h3 style={s.detailTitle}>{selected.summary}</h3>
                  </div>
                  <button style={s.closeBtn} onClick={() => setSelected(null)}>✕</button>
                </div>
                <div style={s.detailGrid}>
                  <div style={s.detailItem}><span style={s.detailLabel}>Milestone</span><span>{selected.milestone}</span></div>
                  <div style={s.detailItem}><span style={s.detailLabel}>Assigned to</span><span>{selected.agent}</span></div>
                  <div style={s.detailItem}><span style={s.detailLabel}>Start date</span><span>{selected.startdate || '—'}</span></div>
                  <div style={s.detailItem}><span style={s.detailLabel}>Target date</span><span>{selected.targetdate || '—'}</span></div>
                  <div style={s.detailItem}><span style={s.detailLabel}>Time logged</span><span>{selected.hoursLogged.toFixed(1)}h</span></div>
                  <div style={s.detailItem}><span style={s.detailLabel}>Ticket #</span><span>{selected.id}</span></div>
                </div>
                {selected.details && selected.details.trim() && (
                  <div style={s.detailNotes}>
                    <div style={s.detailLabel}>Notes</div>
                    <div style={s.detailNotesText}
                      dangerouslySetInnerHTML={{ __html: selected.details }}
                    />
                  </div>
                )}
              </div>
            )}

            <footer style={s.footer}>
              <span>Powered by <strong>Sondela Consulting</strong> · Live HaloPSA Data</span>
              <a href="https://sondelaconsulting.com" target="_blank" rel="noreferrer" style={{ color:'#89b4fa' }}>sondelaconsulting.com</a>
            </footer>
          </main>
        )}
      </div>
    </>
  );
}

function attachGanttClicks(el, taskDetails, setSelected) {
  // Mermaid renders task bars as <rect> elements with titles
  // We match by looking at nearby text elements
  const svg = el.querySelector('svg');
  if (!svg) return;
  const rects = svg.querySelectorAll('.task');
  rects.forEach(rect => {
    rect.style.cursor = 'pointer';
    rect.addEventListener('click', () => {
      // Try to find task by matching the text label
      const title = rect.getAttribute('title') || '';
      const task = taskDetails.find(t =>
        title.includes(String(t.id)) ||
        t.summary.substring(0, 20).toLowerCase() === title.toLowerCase().substring(0, 20)
      );
      if (task) setSelected(prev => prev?.id === task.id ? null : task);
    });
  });
}

function statusStyle(statusId) {
  if ([9,16,21].includes(statusId)) return { background:'#1e3a2e', color:'#a6e3a1' };
  if ([2,22].includes(statusId))    return { background:'#1e2e4a', color:'#89b4fa' };
  return { background:'#2e2e1e', color:'#f9e2af' };
}

const s = {
  page: { minHeight:'100vh', background:'#1e1e2e', color:'#cdd6f4', fontFamily:'Segoe UI,Arial,sans-serif' },
  header: { background:'#181825', borderBottom:'1px solid #313244', padding:'14px 30px' },
  headerInner: { maxWidth:'1400px', margin:'0 auto', display:'flex', justifyContent:'space-between', alignItems:'center' },
  brand: { color:'#89b4fa', fontWeight:700, fontSize:'0.95em' },
  updated: { color:'#6c7086', fontSize:'0.78em' },
  errorBox: { background:'#302030', border:'1px solid #f38ba8', padding:'14px 30px', color:'#f38ba8' },
  spinWrap: { display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'50vh', gap:'20px' },
  spinDot: { width:'36px', height:'36px', border:'3px solid #313244', borderTopColor:'#89b4fa', borderRadius:'50%', animation:'spin 0.8s linear infinite' },
  main: { maxWidth:'1400px', margin:'0 auto', padding:'28px' },
  projectHeader: { display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'20px', gap:'20px', flexWrap:'wrap' },
  clientBadge: { display:'inline-block', background:'#313244', color:'#89b4fa', border:'1px solid #45475a', borderRadius:'20px', fontSize:'0.78em', padding:'4px 14px', marginBottom:'8px' },
  projectTitle: { fontSize:'1.4em', color:'#cdd6f4', fontWeight:700, lineHeight:1.3, marginBottom:'4px' },
  meta: { fontSize:'0.82em', color:'#6c7086', margin:0 },
  refreshBtn: { background:'#313244', color:'#cdd6f4', border:'1px solid #45475a', borderRadius:'8px', padding:'9px 18px', fontSize:'0.85em', cursor:'pointer', whiteSpace:'nowrap', flexShrink:0 },
  stats: { display:'flex', gap:'10px', marginBottom:'16px', flexWrap:'wrap' },
  stat: { background:'#313244', border:'1px solid #45475a', borderRadius:'10px', padding:'12px 16px', flex:1, minWidth:'90px' },
  statVal: { fontSize:'1.5em', fontWeight:700, color:'#cdd6f4' },
  statLbl: { fontSize:'0.7em', color:'#6c7086', marginTop:'2px' },
  milestones: { display:'flex', flexWrap:'wrap', gap:'6px', marginBottom:'16px' },
  milestone: { display:'flex', alignItems:'center', gap:'7px', background:'#313244', border:'1px solid #45475a', borderRadius:'8px', padding:'6px 12px', fontSize:'0.78em' },
  msName: { color:'#cdd6f4' },
  msMeta: { color:'#6c7086', fontSize:'0.85em' },
  msState: { fontSize:'0.8em', padding:'2px 8px', borderRadius:'10px', fontWeight:600 },
  ganttWrap: { background:'#313244', border:'1px solid #45475a', borderRadius:'12px', padding:'20px', marginBottom:'16px' },
  ganttHeader: { display:'flex', alignItems:'center', gap:'12px', marginBottom:'16px', flexWrap:'wrap' },
  ganttTitle: { fontSize:'0.95em', color:'#a6adc8', fontWeight:600, margin:0 },
  // Task list sidebar
  taskList: { width:'280px', flexShrink:0, background:'#313244', border:'1px solid #45475a', borderRadius:'12px', padding:'16px', maxHeight:'600px', overflowY:'auto' },
  taskListTitle: { fontSize:'0.85em', color:'#a6adc8', fontWeight:600, margin:'0 0 12px', padding:'0 0 8px', borderBottom:'1px solid #45475a' },
  taskRow: { padding:'10px', borderRadius:'8px', cursor:'pointer', marginBottom:'6px', border:'1px solid transparent', transition:'background 0.15s' },
  taskRowActive: { background:'#1e2e4a', border:'1px solid #89b4fa' },
  taskRowTop: { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'4px' },
  taskStatus: { fontSize:'0.68em', padding:'2px 7px', borderRadius:'8px', fontWeight:600 },
  taskMilestone: { fontSize:'0.68em', color:'#6c7086', maxWidth:'100px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' },
  taskSummary: { fontSize:'0.8em', color:'#cdd6f4', lineHeight:1.3 },
  // Detail panel
  detailPanel: { background:'#313244', border:'1px solid #89b4fa', borderRadius:'12px', padding:'20px', marginBottom:'16px', animation:'slideIn 0.2s ease' },
  detailHeader: { display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'16px' },
  detailTitle: { fontSize:'1.05em', color:'#cdd6f4', fontWeight:600, margin:'6px 0 0' },
  closeBtn: { background:'#45475a', border:'none', color:'#cdd6f4', borderRadius:'6px', padding:'6px 10px', cursor:'pointer', flexShrink:0 },
  detailGrid: { display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:'12px', marginBottom:'14px' },
  detailItem: { display:'flex', flexDirection:'column', gap:'3px' },
  detailLabel: { fontSize:'0.72em', color:'#6c7086', textTransform:'uppercase', letterSpacing:'0.05em' },
  detailNotes: { background:'#1e1e2e', borderRadius:'8px', padding:'14px', marginTop:'4px' },
  detailNotesText: { fontSize:'0.82em', color:'#cdd6f4', lineHeight:1.6, marginTop:'6px' },
  footer: { display:'flex', justifyContent:'space-between', fontSize:'0.8em', color:'#6c7086', flexWrap:'wrap', gap:'8px', marginTop:'8px' },
};
