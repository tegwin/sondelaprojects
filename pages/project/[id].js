import { useEffect, useState, useRef } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';

export default function ProjectPage() {
  const { query } = useRouter();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showTasks, setShowTasks] = useState(false);
  const [lastFetch, setLastFetch] = useState(null);
  const ganttRef = useRef(null);
  const mermaidReady = useRef(false);

  async function load(tasks) {
    if (!query.id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/project/${query.id}?showTasks=${tasks}`);
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

  // Load mermaid once
  useEffect(() => {
    if (mermaidReady.current) return;
    mermaidReady.current = true;
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/mermaid/10.6.1/mermaid.min.js';
    s.onload = () => window.mermaid?.initialize({ startOnLoad: false, theme: 'dark', gantt: { fontSize: 13, barHeight: 24, barGap: 4, topPadding: 55, sidePadding: 85 } });
    document.head.appendChild(s);
  }, []);

  useEffect(() => { if (query.id) load(showTasks); }, [query.id]);

  // Re-render gantt when data changes
  useEffect(() => {
    if (!data || !ganttRef.current) return;
    const render = async () => {
      if (!window.mermaid) { setTimeout(render, 200); return; }
      const el = ganttRef.current;
      el.removeAttribute('data-processed');
      el.textContent = data.ganttCode;
      try { await window.mermaid.init(undefined, el); }
      catch { el.innerHTML = `<pre style="color:#cdd6f4;font-size:0.75em;white-space:pre-wrap">${data.ganttCode}</pre>`; }
    };
    setTimeout(render, 100);
  }, [data]);

  function toggle(e) {
    const v = e.target.checked;
    setShowTasks(v);
    load(v);
  }

  const title = data ? `${data.project.client_name} — ${data.project.summary}` : 'Loading...';

  return (
    <>
      <Head><title>{title} | Sondela</title></Head>
      <div style={s.page}>
        <header style={s.header}>
          <div style={s.headerInner}>
            <a href="/" style={s.back}>← All Projects</a>
            <span style={s.brand}>Sondela Consulting</span>
          </div>
        </header>

        {error && <div style={s.errorBox}>⚠️ {error}</div>}

        {loading && !data && (
          <div style={s.spinner}>
            <div style={s.spinnerDot} />
            <p style={{ color:'#a6adc8' }}>Loading from HaloPSA...</p>
          </div>
        )}

        {data && (
          <main style={s.main}>
            {/* Header */}
            <div style={s.projectHeader}>
              <div>
                <span style={s.clientBadge}>{data.project.client_name}</span>
                <h1 style={s.projectTitle}>{data.project.summary}</h1>
                <p style={s.meta}>Managed by {data.project.agent_name}{lastFetch ? ` · Updated ${lastFetch.toLocaleTimeString()}` : ''}</p>
              </div>
              <div style={s.controls}>
                <label style={s.toggleLabel}>
                  <input type="checkbox" checked={showTasks} onChange={toggle} disabled={loading} />
                  <span style={{ fontSize:'0.85em', color:'#a6adc8' }}>Show individual tasks</span>
                </label>
                <button style={s.refreshBtn} onClick={() => load(showTasks)} disabled={loading}>
                  {loading ? '...' : '⟳ Refresh'}
                </button>
              </div>
            </div>

            {/* Stats */}
            <div style={s.stats}>
              {[
                { val: data.stats.total, lbl: 'Total Tasks' },
                { val: data.stats.done, lbl: 'Completed ✅', color: '#a6e3a1' },
                { val: data.stats.active, lbl: 'In Progress 🔄', color: '#89b4fa' },
                { val: data.stats.pending, lbl: 'Pending ⏳' },
                ...(data.stats.budgetHours ? [{ val: `${data.stats.hoursLogged.toFixed(1)}h`, lbl: `of ${data.stats.budgetHours}h used`, color: '#fab387' }] : []),
                ...(data.stats.remainingHours !== null ? [{ val: `${data.stats.remainingHours.toFixed(1)}h`, lbl: 'Budget Remaining' }] : []),
              ].map((stat, i) => (
                <div key={i} style={s.stat}>
                  <div style={{ ...s.statVal, ...(stat.color ? { color: stat.color } : {}) }}>{stat.val}</div>
                  <div style={s.statLbl}>{stat.lbl}</div>
                </div>
              ))}
            </div>

            {/* Milestones */}
            <div style={s.milestones}>
              {data.milestones.map((ms, i) => {
                const stateLabel = ms.state === 2 ? 'Complete' : ms.state === 1 ? 'Active' : 'Pending';
                const stateColor = ms.state === 2 ? '#a6e3a1' : ms.state === 1 ? '#89b4fa' : '#f9e2af';
                const stateBg    = ms.state === 2 ? '#1e3a2e' : ms.state === 1 ? '#1e2e4a' : '#2e2e1e';
                return (
                  <div key={i} style={s.milestone}>
                    <span style={s.msName}>{ms.name}</span>
                    <span style={s.msMeta}>{ms.taskCount} tasks</span>
                    <span style={{ ...s.msState, color: stateColor, background: stateBg }}>{stateLabel}</span>
                  </div>
                );
              })}
            </div>

            {/* Gantt */}
            <div style={s.ganttWrap}>
              <div style={s.ganttHeader}>
                <h2 style={s.ganttTitle}>Project Timeline</h2>
                {loading && <span style={{ fontSize:'0.8em', color:'#fab387' }}>Refreshing...</span>}
              </div>
              <div style={{ overflowX: 'auto' }}>
                <div className="mermaid" ref={ganttRef} style={{ minWidth: '900px' }}>{data.ganttCode}</div>
              </div>
            </div>

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

const s = {
  page: { minHeight:'100vh', background:'#1e1e2e', color:'#cdd6f4', fontFamily:'Segoe UI,Arial,sans-serif' },
  header: { background:'#181825', borderBottom:'1px solid #313244', padding:'14px 30px' },
  headerInner: { maxWidth:'1300px', margin:'0 auto', display:'flex', justifyContent:'space-between', alignItems:'center' },
  back: { color:'#a6adc8', textDecoration:'none', fontSize:'0.85em' },
  brand: { color:'#89b4fa', fontWeight:700, fontSize:'0.95em' },
  errorBox: { background:'#302030', border:'1px solid #f38ba8', padding:'14px 30px', color:'#f38ba8' },
  spinner: { display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'50vh', gap:'20px' },
  spinnerDot: { width:'36px', height:'36px', border:'3px solid #313244', borderTopColor:'#89b4fa', borderRadius:'50%', animation:'spin 0.8s linear infinite' },
  main: { maxWidth:'1300px', margin:'0 auto', padding:'30px' },
  projectHeader: { display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'24px', gap:'20px', flexWrap:'wrap' },
  clientBadge: { display:'inline-block', background:'#313244', color:'#89b4fa', border:'1px solid #45475a', borderRadius:'20px', fontSize:'0.78em', padding:'4px 14px', marginBottom:'10px' },
  projectTitle: { fontSize:'1.5em', color:'#cdd6f4', fontWeight:700, lineHeight:1.3, marginBottom:'6px' },
  meta: { fontSize:'0.82em', color:'#6c7086', margin:0 },
  controls: { display:'flex', flexDirection:'column', alignItems:'flex-end', gap:'10px', flexShrink:0 },
  toggleLabel: { display:'flex', alignItems:'center', gap:'8px', cursor:'pointer' },
  refreshBtn: { background:'#313244', color:'#cdd6f4', border:'1px solid #45475a', borderRadius:'8px', padding:'9px 18px', fontSize:'0.85em', cursor:'pointer', whiteSpace:'nowrap' },
  stats: { display:'flex', gap:'12px', marginBottom:'20px', flexWrap:'wrap' },
  stat: { background:'#313244', border:'1px solid #45475a', borderRadius:'10px', padding:'12px 18px', flex:1, minWidth:'100px' },
  statVal: { fontSize:'1.6em', fontWeight:700, color:'#cdd6f4' },
  statLbl: { fontSize:'0.72em', color:'#6c7086', marginTop:'2px' },
  milestones: { display:'flex', flexWrap:'wrap', gap:'8px', marginBottom:'20px' },
  milestone: { display:'flex', alignItems:'center', gap:'8px', background:'#313244', border:'1px solid #45475a', borderRadius:'8px', padding:'7px 12px', fontSize:'0.8em' },
  msName: { color:'#cdd6f4' },
  msMeta: { color:'#6c7086', fontSize:'0.85em' },
  msState: { fontSize:'0.8em', padding:'2px 8px', borderRadius:'10px', fontWeight:600 },
  ganttWrap: { background:'#313244', border:'1px solid #45475a', borderRadius:'12px', padding:'24px', marginBottom:'24px' },
  ganttHeader: { display:'flex', alignItems:'center', gap:'12px', marginBottom:'18px' },
  ganttTitle: { fontSize:'0.95em', color:'#a6adc8', fontWeight:600, margin:0 },
  footer: { display:'flex', justifyContent:'space-between', fontSize:'0.8em', color:'#6c7086', flexWrap:'wrap', gap:'8px' },
};
