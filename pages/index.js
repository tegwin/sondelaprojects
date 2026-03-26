import { useState, useEffect } from 'react';
import Head from 'next/head';

export default function Home() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [copied, setCopied] = useState(null);

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

  function copyLink(id) {
    navigator.clipboard.writeText(`${window.location.origin}/project/${id}`);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <>
      <Head><title>Sondela Project Portal</title></Head>
      <div style={s.page}>
        <header style={s.header}>
          <div style={s.headerInner}>
            <div>
              <h1 style={s.h1}>📊 Sondela Project Portal</h1>
              <p style={s.headerSub}>Shareable live Gantt charts · Powered by HaloPSA</p>
            </div>
            <a href="/api/auth/logout" style={s.signout}>Sign out</a>
          </div>
        </header>

        <main style={s.main}>
          <div style={s.searchRow}>
            <input style={s.search} type="text" placeholder="Search by client or project name..."
              value={search} onChange={e => setSearch(e.target.value)} />
            <span style={s.count}>{loading ? '...' : `${filtered.length} projects`}</span>
          </div>

          {error && <div style={s.errorBox}>⚠️ {error}</div>}

          {loading && (
            <div style={s.grid}>
              {[1,2,3,4,5,6].map(i => <div key={i} style={s.skeleton} />)}
            </div>
          )}

          {!loading && (
            <div style={s.grid}>
              {filtered.map(p => (
                <div key={p.id} style={s.card}>
                  <div style={s.cardTop}>
                    <span style={s.clientTag}>{p.client_name || 'Unknown'}</span>
                    <span style={s.pid}>#{p.id}</span>
                  </div>
                  <h2 style={s.cardTitle}>{p.summary}</h2>
                  <div style={s.cardActions}>
                    <a href={`/project/${p.id}`} target="_blank" rel="noreferrer" style={s.btnView}>
                      View Gantt →
                    </a>
                    <button style={s.btnCopy} onClick={() => copyLink(p.id)}>
                      {copied === p.id ? '✅ Copied!' : '🔗 Copy Link'}
                    </button>
                  </div>
                  <div style={s.shareUrl}>{typeof window !== 'undefined' ? window.location.origin : ''}/project/{p.id}</div>
                </div>
              ))}
              {filtered.length === 0 && <p style={s.empty}>No projects match your search.</p>}
            </div>
          )}
        </main>
      </div>
    </>
  );
}

const s = {
  page: { minHeight:'100vh', background:'#1e1e2e', color:'#cdd6f4', fontFamily:'Segoe UI,Arial,sans-serif' },
  header: { background:'#181825', borderBottom:'1px solid #313244', padding:'18px 30px' },
  headerInner: { maxWidth:'1200px', margin:'0 auto', display:'flex', justifyContent:'space-between', alignItems:'center' },
  h1: { color:'#89b4fa', fontSize:'1.3em', margin:'0 0 3px' },
  headerSub: { color:'#6c7086', fontSize:'0.82em', margin:0 },
  signout: { background:'#313244', border:'1px solid #45475a', color:'#a6adc8', borderRadius:'6px', padding:'7px 14px', fontSize:'0.8em', textDecoration:'none' },
  main: { maxWidth:'1200px', margin:'0 auto', padding:'30px' },
  searchRow: { display:'flex', alignItems:'center', gap:'14px', marginBottom:'24px' },
  search: { flex:1, background:'#313244', border:'1px solid #45475a', borderRadius:'8px', padding:'11px 16px', color:'#cdd6f4', fontSize:'0.95em' },
  count: { color:'#6c7086', fontSize:'0.85em', whiteSpace:'nowrap' },
  errorBox: { background:'#302030', border:'1px solid #f38ba8', borderRadius:'8px', padding:'14px 18px', color:'#f38ba8', marginBottom:'20px' },
  grid: { display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(320px,1fr))', gap:'16px' },
  card: { background:'#313244', border:'1px solid #45475a', borderRadius:'12px', padding:'20px', display:'flex', flexDirection:'column', gap:'10px' },
  cardTop: { display:'flex', justifyContent:'space-between', alignItems:'center' },
  clientTag: { background:'#1e1e2e', color:'#89b4fa', fontSize:'0.75em', padding:'3px 10px', borderRadius:'12px', border:'1px solid #313244' },
  pid: { color:'#6c7086', fontSize:'0.8em' },
  cardTitle: { fontSize:'0.92em', color:'#cdd6f4', fontWeight:600, lineHeight:1.4, margin:0 },
  cardActions: { display:'flex', gap:'8px' },
  btnView: { flex:1, background:'#89b4fa', color:'#1e1e2e', borderRadius:'6px', padding:'8px 12px', fontSize:'0.82em', fontWeight:700, textDecoration:'none', textAlign:'center' },
  btnCopy: { background:'#313244', color:'#cdd6f4', border:'1px solid #45475a', borderRadius:'6px', padding:'8px 12px', fontSize:'0.82em', cursor:'pointer' },
  shareUrl: { fontSize:'0.72em', color:'#6c7086', fontFamily:'monospace', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' },
  skeleton: { background:'#313244', borderRadius:'12px', height:'160px', opacity:0.5 },
  empty: { color:'#6c7086', gridColumn:'1/-1', textAlign:'center', padding:'40px' },
};
