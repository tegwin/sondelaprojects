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

function RAGBadge({ rag }) {
  if (!rag) return null;
  const map = {
    green: { bg:'#1e3a2e', color:'#a6e3a1', dot:'#a6e3a1' },
    amber: { bg:'#2e2a1e', color:'#f9e2af', dot:'#f9e2af' },
    red:   { bg:'#2e1e1e', color:'#f38ba8', dot:'#f38ba8' },
  };
  const style = map[rag.status] || map.green;
  return (
    <div style={{display:'inline-flex',alignItems:'center',gap:'7px',background:style.bg,border:`1px solid ${style.dot}40`,borderRadius:'20px',padding:'5px 14px',fontSize:'0.8em',color:style.color,fontWeight:600}}>
      <span style={{width:'8px',height:'8px',borderRadius:'50%',background:style.dot,display:'inline-block'}}></span>
      {rag.label}
    </div>
  );
}

export default function ProjectPage() {
  const { query } = useRouter();

  // ── Core state ──────────────────────────────────────────────────────────────
  const [data, setData]         = useState(null);
  const [error, setError]       = useState(null);
  const [loading, setLoading]   = useState(true);
  const [lastFetch, setLastFetch] = useState(null);

  // ── View state ──────────────────────────────────────────────────────────────
  const [view, setView] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('sondela_view') || 'gantt';
    return 'gantt';
  });
  const [selected, setSelected]       = useState(null);
  const [hideCompleted, setHideCompleted] = useState(false);
  const [collapsed, setCollapsed]     = useState({});
  const [pctMode, setPctMode]         = useState('hours');
  const [activeTab, setActiveTab] = useState('gantt');
  const [notesOpen, setNotesOpen]   = useState(false);
  function switchTab(t) {
    setActiveTab(t);
    if (typeof window !== 'undefined') localStorage.setItem('sondela_tab', t);
  }

  // ── Scratchpad state ────────────────────────────────────────────────────────
  const [scratchpad, setScratchpad]       = useState([]);
  const [scratchLoaded, setScratchLoaded] = useState(false);
  const [newItem, setNewItem]             = useState('');
  const [newItemType, setNewItemType]     = useState('todo');

  // ── Client note state ───────────────────────────────────────────────────────
  const [clientName, setClientName]         = useState('');
  const [noteTicketId, setNoteTicketId]     = useState(null);
  const [noteText, setNoteText]             = useState('');
  const [noteSubmitting, setNoteSubmitting] = useState(false);
  const [noteSaved, setNoteSaved]           = useState(false);

  // ── Sign-off state ──────────────────────────────────────────────────────────
  const [signoffName, setSignoffName]   = useState('');
  const [signoffDone, setSignoffDone]   = useState({});

  // ── Documents state ─────────────────────────────────────────────────────────
  const [attachments, setAttachments] = useState([]);
  const [docsLoaded, setDocsLoaded]   = useState(false);

  // ── Refs ────────────────────────────────────────────────────────────────────
  const ganttRef     = useRef(null);
  const mermaidReady = useRef(false);

  // ── Functions ───────────────────────────────────────────────────────────────
  function toggleCollapse(name) { setCollapsed(p => ({...p, [name]: !p[name]})); }

  function switchView(v) {
    setView(v);
    if (typeof window !== 'undefined') localStorage.setItem('sondela_view', v);
  }

  async function load() {
    if (!query.token) return;
    setLoading(true);
    try {
      const res  = await fetch(`/api/p/${query.token}`);
      const json = await res.json();
      if (json.error) throw new Error(`${json.error}||${json.reason||''}`);
      setData(json);
      setLastFetch(new Date());
      // Restore tab preference after data is ready
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('sondela_tab');
        if (saved) setActiveTab(saved);
      }
      // Always pre-load notes so they're ready
      if (query.token) {
        fetch(`/api/p/scratchpad?token=${query.token}`)
          .then(r => r.json())
          .then(d => { setScratchpad(d.items || []); setScratchLoaded(true); })
          .catch(() => {});
      }
    } catch (e) { setError(e.message); }
    finally     { setLoading(false); }
  }

  async function loadScratchpad() {
    if (!query.token || scratchLoaded) return;
    const res = await fetch(`/api/p/scratchpad?token=${query.token}`);
    const d = await res.json();
    setScratchpad(d.items || []);
    setScratchLoaded(true);
  }

  const [scratchError, setScratchError] = useState(null);
  const [editingId, setEditingId]       = useState(null);
  const [editText, setEditText]         = useState('');

  async function scratchAction(action, item) {
    setScratchError(null);
    try {
      const res = await fetch(`/api/p/scratchpad?token=${query.token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, item }),
      });
      if (!res.ok) { setScratchError(`Server error ${res.status}`); return; }
      const d = await res.json();
      if (d.error) { setScratchError(d.error); return; }
      setScratchpad(d.items || []);
    } catch (e) {
      setScratchError('Failed to save — check your connection');
    }
  }

  async function addScratchItem() {
    if (!newItem.trim()) return;
    await scratchAction('add', { text: newItem, type: newItemType, author: 'client' });
    setNewItem('');
  }

  async function saveEdit(id) {
    if (!editText.trim()) return;
    await scratchAction('edit', { id, text: editText });
    setEditingId(null);
    setEditText('');
  }

  async function submitNote() {
    if (!noteText.trim() || !noteTicketId) return;
    setNoteSubmitting(true);
    await fetch(`/api/p/note?token=${query.token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticketId: noteTicketId, note: noteText, authorName: clientName || 'Client' }),
    });
    setNoteSubmitting(false);
    setNoteSaved(true);
    setNoteText('');
    setTimeout(() => setNoteSaved(false), 3000);
    load();
  }

  async function loadDocs() {
    if (docsLoaded || !query.token) return;
    const res = await fetch(`/api/p/attachments?token=${query.token}`);
    const d = await res.json();
    setAttachments(d.attachments || []);
    setDocsLoaded(true);
  }

  async function submitSignoff(msName) {
    await fetch(`/api/p/signoff?token=${query.token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ milestoneName: msName, signerName: signoffName || 'Client' }),
    });
    setSignoffDone(p => ({...p, [msName]: true}));
  }

  // ── Effects ─────────────────────────────────────────────────────────────────
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

  // ── Derived values ──────────────────────────────────────────────────────────
  const colour   = data?.project?.client_colour || '#89b4fa';
  const pctTasks = data?.stats?.pctComplete || 0;
  const pctHours = data?.stats?.budgetHours
    ? Math.min(100, Math.round((data.stats.hoursLogged / data.stats.budgetHours) * 100))
    : null;
  const pct      = pctMode === 'hours' && pctHours !== null ? pctHours : pctTasks;
  const pctLabel = pctMode === 'hours' && pctHours !== null
    ? `${pctHours}% of budget used · ${data?.stats?.hoursLogged?.toFixed(1)}h of ${data?.stats?.budgetHours}h`
    : `${pctTasks}% complete · ${data?.stats?.done} of ${data?.stats?.total} tasks`;
  const title    = data ? `${data.project.client_name} — ${data.project.summary}` : 'Loading...';

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      <Head><title>{title} | Sondela</title></Head>
      <style>{`
        @keyframes spin   { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        .task-row:hover { background:#252538 !important; }
        .gantt-scroll::-webkit-scrollbar { height:6px;width:6px; }
        .gantt-scroll::-webkit-scrollbar-track { background:#1e1e2e; }
        .gantt-scroll::-webkit-scrollbar-thumb { background:#45475a;border-radius:3px; }
        .task-list-scroll::-webkit-scrollbar { width:5px; }
        .task-list-scroll::-webkit-scrollbar-track { background:#1e1e2e; }
        .task-list-scroll::-webkit-scrollbar-thumb { background:#45475a;border-radius:3px; }
        @media print {
          .no-print { display:none !important; }
          body { background:#fff !important; color:#000 !important; }
          .print-section { page-break-inside:avoid; }
        }
      `}</style>

      <div style={s.page}>
        <header style={s.header} className="no-print">
          <div style={s.hInner}>
            <span style={s.brand}>📊 Sondela Consulting</span>
            <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
              {lastFetch && <span style={s.updated}>Live · {lastFetch.toLocaleTimeString()}</span>}
              <button style={s.printBtn} onClick={()=>window.print()} className="no-print">🖨 Print</button>
            </div>
          </div>
        </header>

        {error && (() => {
          const [msg, reason] = error.split('||');
          return (
            <div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'70vh'}}>
              <div style={{textAlign:'center',maxWidth:'440px',padding:'40px'}}>
                <div style={{fontSize:'3em',marginBottom:'16px'}}>{reason==='expired'?'⏰':'🔒'}</div>
                <h2 style={{color:'#cdd6f4',fontSize:'1.2em',marginBottom:'10px'}}>
                  {reason==='expired'?'Link Expired':'Link Deactivated'}
                </h2>
                <p style={{color:'#6c7086',fontSize:'0.9em',lineHeight:1.6}}>{msg}</p>
                <p style={{color:'#45475a',fontSize:'0.8em',marginTop:'16px'}}>Please contact Sondela Consulting if you believe this is an error.</p>
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
              <div style={{flex:1}}>
                <span style={{...s.clientBadge,color:colour,borderColor:colour+'50'}}>{data.project.client_name}</span>
                <h1 style={s.h1}>{data.project.summary}</h1>
                <div style={{display:'flex',alignItems:'center',gap:'12px',flexWrap:'wrap',marginTop:'6px'}}>
                  <p style={s.meta}>Managed by {data.project.agent_name}</p>
                  {data.project.startDate && (
                    <span style={{fontSize:'0.78em',color:'#6c7086'}}>
                      {data.project.startDate} → {data.project.endDate || 'TBD'}
                    </span>
                  )}
                  <RAGBadge rag={data.rag} />
                </div>
              </div>
              <div style={{display:'flex',gap:'8px',flexShrink:0,alignItems:'center'}} className="no-print">
                <button style={s.emailBtn} onClick={()=>{
                  const url  = window.location.href;
                  const subj = encodeURIComponent(`Project Update: ${data.project.summary}`);
                  const body = encodeURIComponent(`Hi,\n\nHere is a link to your live project status:\n\n${url}\n\nNo login required.\n\nKind regards,\nSondela Consulting`);
                  window.location.href=`mailto:?subject=${subj}&body=${body}`;
                }}>📧 Share</button>
                <button style={s.refreshBtn} onClick={load} disabled={loading}>{loading?'...':'⟳ Refresh'}</button>
              </div>
            </div>

            {/* Top-level tab bar */}
            <div style={{display:'flex',gap:'0',background:'#181825',borderRadius:'10px',padding:'4px',width:'100%',marginBottom:'16px',flexWrap:'wrap'}} className="no-print">
              <button onClick={()=>switchTab('gantt')} style={{...s.viewBtn,...(activeTab==='gantt'?{...s.viewBtnActive,borderBottomColor:colour,color:colour}:{})}}>
                📊 Project
              </button>

              <button onClick={()=>{switchTab('docs');loadDocs();}} style={{...s.viewBtn,...(activeTab==='docs'?{...s.viewBtnActive,borderBottomColor:'#89b4fa',color:'#89b4fa'}:{})}}>📁 Documents</button>
              <button onClick={()=>switchTab('signoff')} style={{...s.viewBtn,...(activeTab==='signoff'?{...s.viewBtnActive,borderBottomColor:'#a6e3a1',color:'#a6e3a1'}:{})}}>✅ Sign-off</button>
            </div>

            {/* Stats */}
            <div style={s.stats} className="print-section">
              {[
                {v:data.stats.total,   l:'Total Tasks'},
                {v:data.stats.done,    l:'Completed ✅',   c:'#a6e3a1'},
                {v:data.stats.active,  l:'In Progress 🔄', c:'#89b4fa'},
                {v:data.stats.pending, l:'Pending ⏳'},
                ...(data.stats.budgetHours?[{v:`${data.stats.hoursLogged.toFixed(1)}h`,l:`of ${data.stats.budgetHours}h used`,c:'#fab387'}]:[]),
                ...(data.stats.remainingHours!=null?[{v:`${data.stats.remainingHours.toFixed(1)}h`,l:'Budget Remaining'}]:[]),
              ].map((st,i)=>(
                <div key={i} style={s.stat}>
                  <div style={{...s.statV,...(st.c?{color:st.c}:{})}}>{st.v}</div>
                  <div style={s.statL}>{st.l}</div>
                </div>
              ))}
            </div>

            {/* Progress bar */}
            <div style={{marginBottom:'16px'}} className="print-section">
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'6px',flexWrap:'wrap',gap:'8px'}}>
                <span style={{fontSize:'0.78em',color:'#a6adc8',fontWeight:600}}>{pctLabel}</span>
                <div style={{display:'flex',background:'#1e1e2e',borderRadius:'6px',padding:'2px',gap:'2px'}} className="no-print">
                  <button onClick={()=>setPctMode('tasks')}
                    style={{background:pctMode==='tasks'?'#313244':'transparent',border:'none',color:pctMode==='tasks'?'#cdd6f4':'#6c7086',borderRadius:'4px',padding:'3px 10px',fontSize:'0.72em',cursor:'pointer',fontWeight:pctMode==='tasks'?700:400}}>
                    By Tasks
                  </button>
                  {pctHours!==null&&(
                    <button onClick={()=>setPctMode('hours')}
                      style={{background:pctMode==='hours'?'#313244':'transparent',border:'none',color:pctMode==='hours'?'#fab387':'#6c7086',borderRadius:'4px',padding:'3px 10px',fontSize:'0.72em',cursor:'pointer',fontWeight:pctMode==='hours'?700:400}}>
                      By Hours
                    </button>
                  )}
                </div>
              </div>
              <div style={{height:'18px',background:'#1e1e2e',borderRadius:'9px',overflow:'hidden',border:'1px solid #313244'}}>
                <div style={{
                  height:'100%',width:`${Math.min(pct,100)}%`,
                  background:pctMode==='hours'?'linear-gradient(90deg,#a06040,#fab387)':'linear-gradient(90deg,#40a060,#a6e3a1)',
                  borderRadius:'9px',transition:'width 0.6s ease',
                  display:'flex',alignItems:'center',justifyContent:'flex-end',
                  paddingRight:pct>8?'8px':'0',
                }}>
                  {pct>8&&<span style={{fontSize:'0.7em',fontWeight:700,color:'#1e1e2e'}}>{pct}%</span>}
                </div>
              </div>
            </div>
            {/* Notes floating button */}
            <div className="no-print" style={{position:'fixed',right:'20px',bottom:'24px',zIndex:200}}>
              <button onClick={()=>setNotesOpen(p=>!p)}
                style={{background:notesOpen?'#89b4fa':'#313244',color:notesOpen?'#1e1e2e':'#cdd6f4',border:'2px solid #89b4fa',borderRadius:'50px',padding:'10px 20px',fontSize:'0.88em',fontWeight:700,cursor:'pointer',boxShadow:'0 4px 16px rgba(0,0,0,0.4)',display:'flex',alignItems:'center',gap:'8px',transition:'all 0.2s'}}>
                📝 Notes
                {scratchpad.filter(i=>!i.done&&i.type==='todo').length>0&&(
                  <span style={{background:notesOpen?'#1e1e2e':'#89b4fa',color:notesOpen?'#89b4fa':'#1e1e2e',borderRadius:'10px',padding:'1px 7px',fontSize:'0.75em'}}>
                    {scratchpad.filter(i=>!i.done&&i.type==='todo').length}
                  </span>
                )}
              </button>
            </div>

            {/* Notes slide-in drawer */}
            {notesOpen&&(
              <div style={{position:'fixed',top:0,right:0,height:'100vh',width:'380px',background:'#1e1e2e',borderLeft:'1px solid #45475a',zIndex:300,display:'flex',flexDirection:'column',boxShadow:'-8px 0 32px rgba(0,0,0,0.5)'}} className="no-print">
                <div style={{padding:'14px 16px',borderBottom:'1px solid #313244',display:'flex',justifyContent:'space-between',alignItems:'center',background:'#181825',flexShrink:0}}>
                  <div>
                    <div style={{color:'#89b4fa',fontWeight:700,fontSize:'0.9em'}}>📝 Session Notes</div>
                    <div style={{color:'#6c7086',fontSize:'0.7em',marginTop:'2px'}}>Shared with your consultant</div>
                  </div>
                  <button onClick={()=>setNotesOpen(false)} style={{background:'none',border:'none',color:'#6c7086',cursor:'pointer',fontSize:'1.3em',padding:'4px 8px'}}>×</button>
                </div>
                <div style={{padding:'12px',borderBottom:'1px solid #313244',flexShrink:0}}>
                  <input placeholder="Your name (optional)" value={clientName} onChange={e=>setClientName(e.target.value)}
                    style={{width:'100%',background:'#313244',border:'1px solid #45475a',borderRadius:'6px',padding:'7px 10px',color:'#cdd6f4',fontSize:'0.8em',boxSizing:'border-box',marginBottom:'8px'}}/>
                  <div style={{display:'flex',background:'#181825',borderRadius:'6px',padding:'2px',gap:'2px',marginBottom:'8px'}}>
                    <button onClick={()=>setNewItemType('todo')} style={{flex:1,background:newItemType==='todo'?'#313244':'transparent',border:'none',color:newItemType==='todo'?'#cdd6f4':'#6c7086',borderRadius:'4px',padding:'5px',fontSize:'0.75em',cursor:'pointer'}}>☐ To-do</button>
                    <button onClick={()=>setNewItemType('note')} style={{flex:1,background:newItemType==='note'?'#313244':'transparent',border:'none',color:newItemType==='note'?'#cdd6f4':'#6c7086',borderRadius:'4px',padding:'5px',fontSize:'0.75em',cursor:'pointer'}}>📝 Note</button>
                  </div>
                  <textarea
                    placeholder={newItemType==='todo'?"Add something to cover next session...":"Add a note or paste meeting notes..."}
                    value={newItem} onChange={e=>setNewItem(e.target.value)}
                    onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&newItem.trim().length<200){e.preventDefault();addScratchItem();}}}
                    rows={3}
                    style={{width:'100%',background:'#313244',border:'1px solid #45475a',borderRadius:'6px',padding:'8px 10px',color:'#cdd6f4',fontSize:'0.82em',resize:'vertical',fontFamily:'inherit',boxSizing:'border-box',marginBottom:'8px'}}/>
                  <button onClick={addScratchItem} disabled={!newItem.trim()}
                    style={{width:'100%',background:'#89b4fa',color:'#1e1e2e',border:'none',borderRadius:'6px',padding:'8px',fontSize:'0.85em',fontWeight:700,cursor:newItem.trim()?'pointer':'not-allowed',opacity:newItem.trim()?1:0.5}}>
                    Add Note
                  </button>
                </div>
                <div style={{flex:1,overflowY:'auto',padding:'12px'}}>
                  {scratchError&&<div style={{background:'#2e1e1e',border:'1px solid #f38ba8',borderRadius:'6px',padding:'8px',fontSize:'0.78em',color:'#f38ba8',marginBottom:'8px'}}>⚠️ {scratchError}</div>}
                  {scratchpad.length===0&&<div style={{color:'#45475a',fontSize:'0.82em',fontStyle:'italic',textAlign:'center',padding:'20px 0'}}>No notes yet</div>}
                  {scratchpad.map(item=>(
                    <div key={item.id} style={{padding:'10px',background:item.done?'#181825':'#252535',borderRadius:'8px',marginBottom:'6px',border:'1px solid #313244',opacity:item.done?0.6:1}}>
                      {editingId===item.id?(
                        <div style={{display:'flex',flexDirection:'column',gap:'6px'}}>
                          <textarea value={editText} onChange={e=>setEditText(e.target.value)} rows={3}
                            style={{width:'100%',background:'#313244',border:'1px solid #89b4fa',borderRadius:'6px',padding:'6px',color:'#cdd6f4',fontSize:'0.82em',resize:'vertical',fontFamily:'inherit',boxSizing:'border-box'}}/>
                          <div style={{display:'flex',gap:'6px'}}>
                            <button onClick={()=>saveEdit(item.id)} style={{flex:1,background:'#89b4fa',border:'none',color:'#1e1e2e',borderRadius:'4px',padding:'5px',fontSize:'0.78em',cursor:'pointer',fontWeight:700}}>Save</button>
                            <button onClick={()=>{setEditingId(null);setEditText('');}} style={{flex:1,background:'#45475a',border:'none',color:'#cdd6f4',borderRadius:'4px',padding:'5px',fontSize:'0.78em',cursor:'pointer'}}>Cancel</button>
                          </div>
                        </div>
                      ):(
                        <div>
                          <div style={{display:'flex',alignItems:'flex-start',gap:'8px',marginBottom:'4px'}}>
                            {item.type==='todo'&&<button onClick={()=>scratchAction('toggle',{id:item.id})} style={{background:'none',border:'none',cursor:'pointer',fontSize:'1em',padding:'0',flexShrink:0,color:'#89b4fa'}}>{item.done?'☑':'☐'}</button>}
                            {item.type==='note'&&<span style={{fontSize:'0.85em',flexShrink:0}}>📝</span>}
                            <div style={{fontSize:'0.82em',color:'#cdd6f4',textDecoration:item.done?'line-through':'none',lineHeight:1.5,flex:1,whiteSpace:'pre-wrap'}}>{item.text}</div>
                          </div>
                          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                            <span style={{fontSize:'0.68em',color:'#45475a'}}>{item.author==='admin'?'Consultant':'Client'} · {item.ts}</span>
                            <div style={{display:'flex',gap:'2px'}}>
                              <button onClick={()=>{setEditingId(item.id);setEditText(item.text);}} style={{background:'none',border:'none',color:'#6c7086',cursor:'pointer',padding:'2px 4px',fontSize:'0.8em'}}>✏️</button>
                              <button onClick={()=>scratchAction('delete',{id:item.id})} style={{background:'none',border:'none',color:'#45475a',cursor:'pointer',padding:'2px 4px',fontSize:'0.9em'}}>×</button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* View switcher (only shown in Project tab) */}
            {activeTab==='gantt'&&<div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'16px',flexWrap:'wrap',gap:'10px'}} className="no-print">
              <div style={s.viewSwitcher}>
                {['gantt','schedule','kanban'].map(v=>(
                  <button key={v} onClick={()=>switchView(v)}
                    style={{...s.viewBtn,...(view===v?{...s.viewBtnActive,borderBottomColor:colour,color:colour}:{})}}>
                    {v==='gantt'?'📊 Gantt':v==='schedule'?'📋 Schedule':'🗂 Kanban'}
                  </button>
                ))}
              </div>
              {(view==='schedule'||view==='kanban')&&(
                <label style={{display:'flex',alignItems:'center',gap:'8px',cursor:'pointer',fontSize:'0.85em',color:'#a6adc8'}}>
                  <input type="checkbox" checked={hideCompleted} onChange={e=>setHideCompleted(e.target.checked)}
                    style={{accentColor:'#89b4fa',width:'15px',height:'15px',cursor:'pointer'}}/>
                  Hide completed tasks
                </label>
              )}
            </div>}

            {/* GANTT */}
            {activeTab==='gantt'&&view==='gantt'&&(
              <div style={s.mainRow}>
                <div style={s.ganttPanel}>
                  <div style={s.panelHdr}>
                    <h2 style={s.panelTitle}>Project Timeline</h2>
                    {loading&&<span style={{fontSize:'0.78em',color:'#fab387'}}>Refreshing...</span>}
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
                          <div style={{display:'flex',gap:'6px',alignItems:'center'}}>
                            {t.hoursLogged>0&&<span style={{color:'#fab387',fontSize:'0.72em'}}>⏱ {t.hoursLogged.toFixed(1)}h</span>}
                            {t.lastUpdated&&<span style={{color:'#45475a',fontSize:'0.68em'}}>{t.lastUpdated}</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab==='gantt'&&view==='schedule'&&(
              <ScheduleView data={data} selected={selected} setSelected={setSelected} colour={colour} hideCompleted={hideCompleted} collapsed={collapsed} toggleCollapse={toggleCollapse}/>
            )}
            {activeTab==='gantt'&&view==='kanban'&&(
              <KanbanView data={data} selected={selected} setSelected={setSelected} colour={colour} hideCompleted={hideCompleted}/>
            )}

            {/* Detail panel */}
            {activeTab==='gantt'&&selected&&(
              <div style={s.detail} className="print-section">
                <div style={s.detailHdr}>
                  <div style={{flex:1}}>
                    <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'8px',flexWrap:'wrap'}}>
                      <span style={{...s.pill,...statusStyle(selected.status_id)}}>{statusLabel(selected.status_id)}</span>
                      <span style={{fontSize:'0.78em',color:'#6c7086'}}>{selected.milestone}</span>
                      <span style={{fontSize:'0.78em',color:'#6c7086'}}>#{selected.id}</span>
                      {selected.lastUpdated&&<span style={{fontSize:'0.75em',color:'#45475a'}}>Updated {selected.lastUpdated}</span>}
                    </div>
                    <h3 style={s.detailTitle}>{selected.summary}</h3>
                  </div>
                  <button style={s.closeBtn} onClick={()=>setSelected(null)} className="no-print">✕ Close</button>
                </div>
                <div style={s.infoGrid}>
                  {[
                    {l:'Assigned to', v:selected.agent&&selected.agent!=='Unassigned'?'Assigned':'Unassigned'},
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
                <div style={s.blockLbl}>Add a Note</div>
                <div style={{background:'#1e1e2e',borderRadius:'8px',padding:'14px',marginBottom:'12px'}}>
                  <textarea
                    placeholder="Add information, answers, or questions for this task..."
                    value={noteTicketId===selected.id?noteText:''}
                    onChange={e=>{setNoteTicketId(selected.id);setNoteText(e.target.value);}}
                    rows={3}
                    style={{width:'100%',background:'#313244',border:'1px solid #45475a',borderRadius:'6px',padding:'10px',color:'#cdd6f4',fontSize:'0.85em',resize:'vertical',boxSizing:'border-box',fontFamily:'inherit'}}
                  />
                  <div style={{display:'flex',gap:'8px',marginTop:'8px',alignItems:'center'}}>
                    <input placeholder="Your name" value={clientName} onChange={e=>setClientName(e.target.value)}
                      style={{background:'#313244',border:'1px solid #45475a',borderRadius:'6px',padding:'7px 10px',color:'#cdd6f4',fontSize:'0.8em',width:'140px'}}/>
                    <button onClick={submitNote} disabled={noteSubmitting||!noteText.trim()}
                      style={{background:'#89b4fa',color:'#1e1e2e',border:'none',borderRadius:'6px',padding:'7px 16px',fontSize:'0.82em',fontWeight:700,cursor:'pointer'}}>
                      {noteSubmitting?'Sending...':noteSaved?'✅ Sent!':'Send Note'}
                    </button>
                  </div>
                </div>
                <div style={s.blockLbl}>Updates &amp; Notes</div>
                {selected.actions.length>0?selected.actions.map(a=>(
                  <div key={a.id} style={s.actionCard}>
                    <div style={s.actionMeta}>
                      <span style={{fontWeight:600,color:colour}}>{a.who}</span>
                      {a.date&&<span style={{color:'#6c7086'}}>{a.date}</span>}
                      {a.timetaken>0&&<span style={{color:'#fab387'}}>⏱ {a.timetaken.toFixed(1)}h</span>}
                      {a.outcome&&<span style={{color:'#a6adc8',fontStyle:'italic'}}>{a.outcome}</span>}
                    </div>
                    <div style={s.actionBody}>{a.note}</div>
                  </div>
                )):<div style={s.noNotes}>No public notes on this task yet.</div>}
              </div>
            )}

            {/* Bottom panels */}
            <div style={{marginTop:'20px'}}>

                            {/* Documents */}
              {activeTab==='docs'&&(
                <div style={{background:'#252535',border:'1px solid #45475a',borderRadius:'12px',padding:'20px',marginBottom:'16px'}}>
                  <h3 style={{color:'#cdd6f4',margin:'0 0 4px',fontSize:'1em'}}>📁 Document Library</h3>
                  <p style={{color:'#6c7086',fontSize:'0.78em',margin:'0 0 16px'}}>Files attached to your project tasks in HaloPSA</p>
                  {!docsLoaded&&<div style={{color:'#6c7086',textAlign:'center',padding:'20px'}}>Loading...</div>}
                  {docsLoaded&&attachments.length===0&&<div style={{color:'#45475a',fontSize:'0.85em',fontStyle:'italic',textAlign:'center',padding:'20px'}}>No documents attached to project tasks yet</div>}
                  {docsLoaded&&attachments.map(a=>(
                    <div key={a.id} style={{display:'flex',alignItems:'center',gap:'12px',padding:'10px 14px',background:'#1e1e2e',borderRadius:'8px',marginBottom:'6px'}}>
                      <span style={{fontSize:'1.2em'}}>📄</span>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:'0.85em',color:'#cdd6f4',fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.filename}</div>
                        <div style={{fontSize:'0.72em',color:'#6c7086'}}>{a.date}{a.size>0?` · ${(a.size/1024).toFixed(0)}KB`:''}</div>
                      </div>
                    </div>
                  ))}
                  <div style={{marginTop:'12px',paddingTop:'12px',borderTop:'1px solid #313244'}}>
                    <a href={`/api/p/ical?token=${query.token}`} download style={{display:'inline-flex',alignItems:'center',gap:'6px',background:'#313244',border:'1px solid #45475a',color:'#a6adc8',borderRadius:'6px',padding:'7px 14px',fontSize:'0.8em',textDecoration:'none'}}>
                      📅 Download Calendar (.ics)
                    </a>
                  </div>
                </div>
              )}

              {/* Sign-off */}
              {activeTab==='signoff'&&data&&(
                <div style={{background:'#252535',border:'1px solid #45475a',borderRadius:'12px',padding:'20px',marginBottom:'16px'}}>
                  <h3 style={{color:'#cdd6f4',margin:'0 0 4px',fontSize:'1em'}}>✅ Milestone Sign-off</h3>
                  <p style={{color:'#6c7086',fontSize:'0.78em',margin:'0 0 12px'}}>Confirm completed milestones to record your approval in HaloPSA</p>
                  <div style={{marginBottom:'12px'}}>
                    <input placeholder="Your name" value={signoffName} onChange={e=>setSignoffName(e.target.value)}
                      style={{background:'#313244',border:'1px solid #45475a',borderRadius:'6px',padding:'8px 12px',color:'#cdd6f4',fontSize:'0.85em',width:'200px',boxSizing:'border-box'}}/>
                  </div>
                  {data.milestones.map(ms=>{
                    const msTasks = data.taskDetails.filter(t=>t.milestone===ms.name);
                    const allDone = msTasks.length>0&&msTasks.every(t=>[9,16,21].includes(t.status_id));
                    const done    = signoffDone[ms.name];
                    return (
                      <div key={ms.name} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 16px',background:'#1e1e2e',borderRadius:'8px',marginBottom:'6px'}}>
                        <div>
                          <div style={{fontSize:'0.88em',color:'#cdd6f4',fontWeight:500}}>{ms.name}</div>
                          <div style={{fontSize:'0.75em',color:'#6c7086'}}>{msTasks.length} tasks · {msTasks.filter(t=>[9,16,21].includes(t.status_id)).length} completed</div>
                        </div>
                        {done ? (
                          <span style={{fontSize:'0.8em',color:'#a6e3a1',fontWeight:600}}>✅ Approved</span>
                        ) : allDone ? (
                          <button onClick={()=>submitSignoff(ms.name)} disabled={!signoffName.trim()}
                            style={{background:'#a6e3a1',color:'#1e1e2e',border:'none',borderRadius:'6px',padding:'7px 16px',fontSize:'0.8em',fontWeight:700,cursor:signoffName.trim()?'pointer':'not-allowed',opacity:signoffName.trim()?1:0.5}}>
                            Approve ✓
                          </button>
                        ) : (
                          <span style={{fontSize:'0.75em',color:'#45475a'}}>Not complete</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

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

// ── SCHEDULE VIEW ─────────────────────────────────────────────────────────────
function ScheduleView({ data, selected, setSelected, colour, hideCompleted, collapsed, toggleCollapse }) {
  const CL = [9,16,21];
  const tasksByMilestone = {};
  data.milestones.forEach(ms => {
    let tasks = data.taskDetails.filter(t => t.milestone === ms.name);
    if (hideCompleted) tasks = tasks.filter(t => !CL.includes(t.status_id));
    tasksByMilestone[ms.name] = { milestone: ms, tasks };
  });
  let other = data.taskDetails.filter(t => t.milestone === 'Other');
  if (hideCompleted) other = other.filter(t => !CL.includes(t.status_id));
  const totalH       = data.stats.budgetHours || 0;
  const allNames     = [...Object.keys(tasksByMilestone),...(other.length>0?['__other__']:[])];
  const allCollapsed = allNames.every(n => collapsed[n]);
  function collapseAll() { allNames.forEach(n => { if (!collapsed[n]) toggleCollapse(n); }); }
  function expandAll()   { allNames.forEach(n => { if (collapsed[n])  toggleCollapse(n); }); }

  return (
    <div style={sv.wrap}>
      <div style={{display:'flex',justifyContent:'flex-end',padding:'6px 16px',background:'#181825',borderBottom:'1px solid #45475a'}}>
        <button onClick={allCollapsed?expandAll:collapseAll}
          style={{background:'#313244',border:'1px solid #45475a',color:'#a6adc8',borderRadius:'6px',padding:'4px 12px',fontSize:'0.75em',cursor:'pointer',whiteSpace:'nowrap'}}>
          {allCollapsed?'▶ Expand All':'▼ Collapse All'}
        </button>
      </div>
      <div style={sv.tableHead}>
        <div style={{...sv.col, width:'130px'}}>Status</div>
        <div style={{...sv.col, flex:1}}>Summary</div>
        <div style={{...sv.col, width:'100px'}}>Start</div>
        <div style={{...sv.col, width:'100px'}}>Target</div>
        <div style={{...sv.col, width:'80px'}}>Time</div>
        <div style={{...sv.col, width:'90px'}}>Updated</div>
        <div style={{...sv.col, width:'150px'}}>Agent</div>
        <div style={{...sv.col, width:'80px'}}>Budget</div>
      </div>

      {Object.values(tasksByMilestone).map(({ milestone: ms, tasks }) => {
        const isCollapsed = collapsed[ms.name];
        const msCol   = ms.state===2?'#a6e3a1':ms.state===1?colour:'#f9e2af';
        const msHours = tasks.reduce((a,t)=>a+t.hoursLogged,0);
        if (tasks.length===0 && hideCompleted) return null;
        return (
          <div key={ms.name}>
            <div onClick={()=>toggleCollapse(ms.name)}
              style={{...sv.msRow,borderLeftColor:msCol,cursor:'pointer',userSelect:'none'}}>
              <div style={{display:'flex',alignItems:'center',gap:'8px',flex:1}}>
                <span style={{color:msCol,fontSize:'0.8em',display:'inline-block',transform:isCollapsed?'rotate(-90deg)':'rotate(0deg)',transition:'transform 0.2s'}}>▼</span>
                <span style={{...sv.msLabel,color:msCol}}>{ms.name}</span>
                <span style={{fontSize:'0.72em',color:'#6c7086'}}>{tasks.length} task{tasks.length!==1?'s':''} · {msHours.toFixed(1)}h</span>
              </div>
              <span style={{fontSize:'0.72em',color:'#45475a'}}>{isCollapsed?'Click to expand':'Click to collapse'}</span>
            </div>
            {!isCollapsed && tasks.map((t,i) => {
              const pct       = totalH>0?Math.min(100,Math.round((t.hoursLogged/totalH)*100)):0;
              const isOverdue = t.targetdate && !CL.includes(t.status_id) && new Date(t.targetdate) < new Date();
              return (
                <div key={t.id} onClick={()=>setSelected(p=>p?.id===t.id?null:t)}
                  style={{...sv.taskRow,background:selected?.id===t.id?'#1e2535':i%2===0?'#252535':'#1e1e2e',borderLeft:selected?.id===t.id?`3px solid ${colour}`:'3px solid transparent',opacity:CL.includes(t.status_id)?0.7:1}}>
                  <div style={{width:'130px',flexShrink:0}}>
                    <span style={{...sv.pill,...statusStyle(t.status_id)}}>{statusLabel(t.status_id)}</span>
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{...sv.taskName,textDecoration:CL.includes(t.status_id)?'line-through':'none'}}>{t.summary}</div>
                    {t.actions.length>0&&<span style={{fontSize:'0.68em',color:colour}}>💬 {t.actions.length}</span>}
                  </div>
                  <div style={{width:'100px',flexShrink:0,fontSize:'0.78em',color:'#a6adc8'}}>{t.startdate||'—'}</div>
                  <div style={{width:'100px',flexShrink:0,fontSize:'0.78em',color:isOverdue?'#f38ba8':'#a6adc8',fontWeight:isOverdue?700:400}}>
                    {t.targetdate||'—'}{isOverdue&&' ⚠️'}
                  </div>
                  <div style={{width:'80px',flexShrink:0,fontSize:'0.78em',color:'#fab387',textAlign:'center'}}>{t.hoursLogged>0?`${t.hoursLogged.toFixed(1)}h`:'—'}</div>
                  <div style={{width:'90px',flexShrink:0,fontSize:'0.7em',color:'#45475a'}}>{t.lastUpdated||'—'}</div>
                  <div style={{width:'150px',flexShrink:0,fontSize:'0.75em',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',color:t.agent&&t.agent!=='Unassigned'?'#a6adc8':'#45475a'}}>
                    {t.agent&&t.agent!=='Unassigned'?'Assigned':'Unassigned'}
                  </div>
                  <div style={{width:'80px',flexShrink:0}}>
                    <div style={sv.budgetTrack}><div style={{...sv.budgetBar,width:`${pct}%`,background:colour}}></div></div>
                    <div style={{fontSize:'0.65em',color:'#6c7086',textAlign:'center',marginTop:'2px'}}>{pct}%</div>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}

      {other.length>0&&(
        <div>
          <div onClick={()=>toggleCollapse('__other__')}
            style={{...sv.msRow,borderLeftColor:'#45475a',cursor:'pointer',userSelect:'none'}}>
            <div style={{display:'flex',alignItems:'center',gap:'8px',flex:1}}>
              <span style={{color:'#6c7086',fontSize:'0.8em',display:'inline-block',transform:collapsed['__other__']?'rotate(-90deg)':'rotate(0deg)'}}>▼</span>
              <span style={{...sv.msLabel,color:'#6c7086'}}>Other Tasks</span>
              <span style={{fontSize:'0.72em',color:'#6c7086'}}>{other.length} task{other.length!==1?'s':''}</span>
            </div>
          </div>
          {!collapsed['__other__']&&other.map((t,i)=>(
            <div key={t.id} onClick={()=>setSelected(p=>p?.id===t.id?null:t)}
              style={{...sv.taskRow,background:selected?.id===t.id?'#1e2535':i%2===0?'#252535':'#1e1e2e',borderLeft:selected?.id===t.id?`3px solid ${colour}`:'3px solid transparent'}}>
              <div style={{width:'130px',flexShrink:0}}><span style={{...sv.pill,...statusStyle(t.status_id)}}>{statusLabel(t.status_id)}</span></div>
              <div style={{flex:1,minWidth:0,fontSize:'0.82em',color:'#cdd6f4'}}>{t.summary}</div>
              <div style={{width:'100px',flexShrink:0,fontSize:'0.78em',color:'#a6adc8'}}>{t.startdate||'—'}</div>
              <div style={{width:'100px',flexShrink:0,fontSize:'0.78em',color:'#a6adc8'}}>{t.targetdate||'—'}</div>
              <div style={{width:'80px',flexShrink:0,fontSize:'0.78em',color:'#fab387',textAlign:'center'}}>{t.hoursLogged>0?`${t.hoursLogged.toFixed(1)}h`:'—'}</div>
              <div style={{width:'90px',flexShrink:0,fontSize:'0.7em',color:'#45475a'}}>{t.lastUpdated||'—'}</div>
              <div style={{width:'150px',flexShrink:0,fontSize:'0.75em',color:t.agent&&t.agent!=='Unassigned'?'#a6adc8':'#45475a'}}>{t.agent&&t.agent!=='Unassigned'?'Assigned':'Unassigned'}</div>
              <div style={{width:'80px',flexShrink:0}}></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── KANBAN VIEW ───────────────────────────────────────────────────────────────
function KanbanView({ data, selected, setSelected, colour, hideCompleted }) {
  const CLOSED_IDS=[9,16,21], ACTIVE_IDS=[2,22];
  const columns = [
    { label:'📋 New',         filter:t=>!CLOSED_IDS.includes(t.status_id)&&!ACTIVE_IDS.includes(t.status_id), colour:'#f9e2af' },
    { label:'🔄 In Progress', filter:t=>ACTIVE_IDS.includes(t.status_id),                                     colour:'#89b4fa' },
    { label:'✅ Completed',   filter:t=>CLOSED_IDS.includes(t.status_id),                                     colour:'#a6e3a1' },
  ];
  return (
    <div style={kv.board}>
      {columns.map(col=>{
        const tasks = data.taskDetails.filter(col.filter);
        if (hideCompleted&&col.label.includes('Completed')) return null;
        return (
          <div key={col.label} style={kv.column}>
            <div style={{...kv.colHeader,color:col.colour,borderBottomColor:col.colour}}>
              <span>{col.label}</span>
              <span style={kv.badge}>{tasks.length}</span>
            </div>
            <div style={kv.cards}>
              {tasks.length===0&&<div style={kv.empty}>No tasks</div>}
              {tasks.map(t=>{
                const isOverdue = t.targetdate&&!CLOSED_IDS.includes(t.status_id)&&new Date(t.targetdate)<new Date();
                return (
                  <div key={t.id} onClick={()=>setSelected(p=>p?.id===t.id?null:t)}
                    style={{...kv.card,background:selected?.id===t.id?'#252545':'#252535',border:selected?.id===t.id?`1px solid ${colour}`:'1px solid #45475a'}}>
                    <div style={kv.cardMs}>{t.milestone}</div>
                    <div style={kv.cardTitle}>{t.summary}</div>
                    {isOverdue&&<div style={{fontSize:'0.7em',color:'#f38ba8',marginBottom:'6px'}}>⚠️ Overdue · {t.targetdate}</div>}
                    <div style={kv.cardFoot}>
                      <span style={{...kv.cardAgent,color:t.agent&&t.agent!=='Unassigned'?'#a6adc8':'#45475a'}}>{t.agent&&t.agent!=='Unassigned'?'Assigned':'Unassigned'}</span>
                      <div style={{display:'flex',gap:'6px',alignItems:'center'}}>
                        {t.hoursLogged>0&&<span style={{fontSize:'0.68em',color:'#fab387'}}>⏱{t.hoursLogged.toFixed(1)}h</span>}
                        {t.actions.length>0&&<span style={{fontSize:'0.68em',color:colour}}>💬{t.actions.length}</span>}
                        {t.lastUpdated&&<span style={{fontSize:'0.65em',color:'#45475a'}}>{t.lastUpdated}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── STYLES ────────────────────────────────────────────────────────────────────
const s = {
  page:         {minHeight:'100vh',background:'#1e1e2e',color:'#cdd6f4',fontFamily:'Segoe UI,Arial,sans-serif'},
  header:       {background:'#181825',borderBottom:'1px solid #313244',padding:'14px 30px'},
  hInner:       {maxWidth:'1500px',margin:'0 auto',display:'flex',justifyContent:'space-between',alignItems:'center'},
  brand:        {color:'#89b4fa',fontWeight:700,fontSize:'0.95em'},
  updated:      {color:'#6c7086',fontSize:'0.78em'},
  printBtn:     {background:'#313244',color:'#cdd6f4',border:'1px solid #45475a',borderRadius:'8px',padding:'7px 14px',fontSize:'0.82em',cursor:'pointer'},
  spinWrap:     {display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',minHeight:'50vh',gap:'20px'},
  spinDot:      {width:'36px',height:'36px',border:'3px solid #313244',borderTopColor:'#89b4fa',borderRadius:'50%',animation:'spin 0.8s linear infinite'},
  main:         {maxWidth:'1500px',margin:'0 auto',padding:'28px'},
  titleRow:     {display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'16px',gap:'20px',flexWrap:'wrap'},
  clientBadge:  {display:'inline-block',background:'#313244',border:'1px solid',borderRadius:'20px',fontSize:'0.78em',padding:'4px 14px',marginBottom:'8px'},
  h1:           {fontSize:'1.4em',color:'#cdd6f4',fontWeight:700,lineHeight:1.3,marginBottom:'4px'},
  meta:         {fontSize:'0.82em',color:'#6c7086',margin:0},
  emailBtn:     {background:'#313244',color:'#cdd6f4',border:'1px solid #45475a',borderRadius:'8px',padding:'9px 14px',fontSize:'0.85em',cursor:'pointer',whiteSpace:'nowrap'},
  refreshBtn:   {background:'#313244',color:'#cdd6f4',border:'1px solid #45475a',borderRadius:'8px',padding:'9px 18px',fontSize:'0.85em',cursor:'pointer',whiteSpace:'nowrap'},
  stats:        {display:'flex',gap:'10px',marginBottom:'16px',flexWrap:'wrap'},
  stat:         {background:'#313244',border:'1px solid #45475a',borderRadius:'10px',padding:'12px 16px',flex:1,minWidth:'90px'},
  statV:        {fontSize:'1.5em',fontWeight:700,color:'#cdd6f4'},
  statL:        {fontSize:'0.7em',color:'#6c7086',marginTop:'2px'},
  viewSwitcher: {display:'flex',background:'#181825',borderRadius:'10px',padding:'4px',width:'fit-content'},
  viewBtn:      {background:'transparent',border:'none',color:'#6c7086',padding:'8px 20px',borderRadius:'7px',cursor:'pointer',fontSize:'0.85em',fontWeight:500,borderBottom:'2px solid transparent',transition:'all 0.15s'},
  viewBtnActive:{background:'#313244',color:'#cdd6f4',fontWeight:700},
  mainRow:      {display:'flex',gap:'16px',alignItems:'flex-start',marginBottom:'20px'},
  ganttPanel:   {flex:1,minWidth:0,background:'#313244',border:'1px solid #45475a',borderRadius:'12px',padding:'20px'},
  panelHdr:     {display:'flex',alignItems:'center',gap:'12px',marginBottom:'14px',flexWrap:'wrap'},
  panelTitle:   {fontSize:'0.9em',color:'#a6adc8',fontWeight:600,margin:0},
  ganttScroll:  {overflowX:'auto',overflowY:'auto',maxHeight:'520px',paddingBottom:'8px'},
  taskPanel:    {width:'260px',flexShrink:0,background:'#313244',border:'1px solid #45475a',borderRadius:'12px',padding:'16px',display:'flex',flexDirection:'column'},
  taskScroll:   {overflowY:'auto',maxHeight:'480px',display:'flex',flexDirection:'column',gap:'6px'},
  taskRow:      {background:'#1e1e2e',border:'1px solid #313244',borderRadius:'8px',padding:'10px 12px',cursor:'pointer',transition:'all 0.15s'},
  taskRowActive:{background:'#1e2535',border:'1px solid #89b4fa'},
  taskTop:      {display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'5px'},
  pill:         {fontSize:'0.68em',padding:'2px 8px',borderRadius:'8px',fontWeight:600},
  taskName:     {fontSize:'0.8em',color:'#cdd6f4',lineHeight:1.35,marginBottom:'5px'},
  taskMeta:     {display:'flex',justifyContent:'space-between',alignItems:'center'},
  detail:       {background:'#252535',border:'1px solid #89b4fa',borderRadius:'14px',padding:'24px',marginBottom:'20px',animation:'fadeUp 0.2s ease'},
  detailHdr:    {display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'16px',gap:'16px'},
  detailTitle:  {fontSize:'1.1em',color:'#cdd6f4',fontWeight:700,margin:0},
  closeBtn:     {background:'#45475a',border:'none',color:'#cdd6f4',borderRadius:'6px',padding:'7px 12px',cursor:'pointer',flexShrink:0,fontSize:'0.82em'},
  infoGrid:     {display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))',gap:'12px',background:'#1e1e2e',borderRadius:'10px',padding:'14px',marginBottom:'16px'},
  infoItem:     {display:'flex',flexDirection:'column',gap:'3px'},
  infoLbl:      {fontSize:'0.68em',color:'#6c7086',textTransform:'uppercase',letterSpacing:'0.06em'},
  infoVal:      {fontSize:'0.86em',color:'#cdd6f4'},
  block:        {background:'#1e1e2e',borderRadius:'8px',padding:'14px',marginBottom:'14px'},
  blockLbl:     {fontSize:'0.7em',color:'#6c7086',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:'8px',marginTop:'4px'},
  blockBody:    {fontSize:'0.84em',color:'#cdd6f4',lineHeight:1.7},
  actionCard:   {background:'#1e1e2e',borderRadius:'8px',padding:'14px',marginBottom:'8px'},
  actionMeta:   {display:'flex',gap:'10px',fontSize:'0.75em',marginBottom:'8px',flexWrap:'wrap',alignItems:'center'},
  actionBody:   {fontSize:'0.84em',color:'#cdd6f4',lineHeight:1.7,whiteSpace:'pre-wrap'},
  noNotes:      {fontSize:'0.84em',color:'#6c7086',fontStyle:'italic',padding:'12px 0'},
  footer:       {display:'flex',justifyContent:'space-between',fontSize:'0.8em',color:'#6c7086',flexWrap:'wrap',gap:'8px',paddingTop:'8px'},
};
const sv = {
  wrap:        {background:'#313244',border:'1px solid #45475a',borderRadius:'12px',overflow:'hidden',marginBottom:'20px'},
  tableHead:   {display:'flex',alignItems:'center',background:'#181825',padding:'10px 16px',borderBottom:'1px solid #45475a'},
  col:         {fontSize:'0.72em',color:'#6c7086',textTransform:'uppercase',letterSpacing:'0.06em',flexShrink:0},
  msRow:       {display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 16px',background:'#1e1e2e',borderBottom:'1px solid #313244',borderLeft:'3px solid',marginTop:'2px'},
  msLabel:     {fontSize:'0.82em',fontWeight:700},
  taskRow:     {display:'flex',alignItems:'center',padding:'10px 16px',cursor:'pointer',gap:'8px',borderBottom:'1px solid #313244',transition:'background 0.1s'},
  taskName:    {fontSize:'0.82em',color:'#cdd6f4',lineHeight:1.35},
  pill:        {fontSize:'0.68em',padding:'2px 8px',borderRadius:'8px',fontWeight:600},
  budgetTrack: {height:'4px',background:'#1e1e2e',borderRadius:'2px'},
  budgetBar:   {height:'4px',borderRadius:'2px'},
};
const kv = {
  board:     {display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'16px',marginBottom:'20px',alignItems:'start'},
  column:    {background:'#252535',border:'1px solid #45475a',borderRadius:'12px',overflow:'hidden'},
  colHeader: {display:'flex',justifyContent:'space-between',alignItems:'center',padding:'14px 16px',borderBottom:'2px solid',fontWeight:700,fontSize:'0.9em'},
  badge:     {background:'#1e1e2e',borderRadius:'12px',padding:'2px 10px',fontSize:'0.75em',color:'#cdd6f4'},
  cards:     {padding:'10px',display:'flex',flexDirection:'column',gap:'8px',minHeight:'100px'},
  card:      {borderRadius:'10px',padding:'12px 14px',cursor:'pointer',transition:'border-color 0.15s'},
  cardMs:    {fontSize:'0.68em',color:'#6c7086',marginBottom:'5px',textTransform:'uppercase',letterSpacing:'0.04em'},
  cardTitle: {fontSize:'0.82em',color:'#cdd6f4',lineHeight:1.4,marginBottom:'6px',fontWeight:500},
  cardFoot:  {display:'flex',justifyContent:'space-between',alignItems:'center',gap:'6px',flexWrap:'wrap'},
  cardAgent: {fontSize:'0.7em',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:'100px'},
  empty:     {fontSize:'0.8em',color:'#45475a',textAlign:'center',padding:'20px',fontStyle:'italic'},
};
