import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';

export default function Certificate() {
  const { query } = useRouter();
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!query.token) return;
    fetch(`/api/p/${query.token}`)
      .then(r => r.json())
      .then(d => setData(d))
      .finally(() => setLoading(false));
  }, [query.token]);

  if (loading) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh',background:'#fff',fontFamily:'Georgia,serif',color:'#333'}}>Loading...</div>;
  if (!data || data.error) return <div style={{textAlign:'center',padding:'60px',fontFamily:'Georgia,serif'}}>Certificate not available.</div>;

  const { project, stats, taskDetails } = data;
  const colour = project.client_colour || '#1a3a5c';
  const today  = new Date().toLocaleDateString('en-GB', {day:'numeric',month:'long',year:'numeric'});
  const done   = taskDetails.filter(t => [9,16,21].includes(t.status_id));

  return (
    <>
      <Head><title>Project Certificate | {project.client_name}</title></Head>
      <style>{`
        @media print { .no-print { display:none !important; } }
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Open+Sans:wght@400;600&display=swap');
      `}</style>
      <div className="no-print" style={{background:'#1e1e2e',padding:'16px 24px',display:'flex',justifyContent:'space-between',alignItems:'center',fontFamily:'Segoe UI,sans-serif'}}>
        <span style={{color:'#a6adc8',fontSize:'0.85em'}}>← <a href="javascript:history.back()" style={{color:'#89b4fa'}}>Back to project</a></span>
        <button onClick={()=>window.print()} style={{background:'#89b4fa',color:'#1e1e2e',border:'none',borderRadius:'6px',padding:'8px 18px',cursor:'pointer',fontWeight:700,fontSize:'0.85em'}}>
          🖨 Print / Save as PDF
        </button>
      </div>

      <div style={{minHeight:'100vh',background:'#fff',fontFamily:"'Open Sans',sans-serif",padding:'60px',maxWidth:'900px',margin:'0 auto',boxSizing:'border-box'}}>
        {/* Header bar */}
        <div style={{height:'8px',background:`linear-gradient(90deg, ${colour}, ${colour}aa)`,borderRadius:'4px',marginBottom:'40px'}}></div>

        {/* Logo + title */}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'40px'}}>
          <div>
            <div style={{fontSize:'0.8em',color:'#999',letterSpacing:'0.2em',textTransform:'uppercase',marginBottom:'8px'}}>Certificate of Project Completion</div>
            <h1 style={{fontFamily:"'Playfair Display',serif",fontSize:'2.2em',color:'#1a1a2e',margin:'0 0 8px',lineHeight:1.2}}>{project.summary}</h1>
            <div style={{fontSize:'1em',color:colour,fontWeight:600}}>{project.client_name}</div>
          </div>
          <div style={{textAlign:'right'}}>
            <div style={{fontSize:'0.75em',color:'#999',marginBottom:'4px'}}>Managed by</div>
            <div style={{fontSize:'0.9em',fontWeight:600,color:'#333'}}>Sondela Consulting</div>
            <div style={{fontSize:'0.78em',color:'#999',marginTop:'8px'}}>Issued {today}</div>
          </div>
        </div>

        {/* Stats row */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'16px',marginBottom:'40px'}}>
          {[
            { v: stats.total,         l: 'Total Tasks Delivered' },
            { v: stats.done,          l: 'Tasks Completed' },
            { v: `${stats.hoursLogged.toFixed(1)}h`, l: 'Hours Invested' },
            { v: `${stats.pctComplete}%`, l: 'Completion Rate' },
          ].map((st,i) => (
            <div key={i} style={{background:'#f8f9fa',borderRadius:'8px',padding:'16px',borderTop:`3px solid ${colour}`}}>
              <div style={{fontSize:'1.8em',fontWeight:700,color:colour,lineHeight:1}}>{st.v}</div>
              <div style={{fontSize:'0.75em',color:'#666',marginTop:'4px'}}>{st.l}</div>
            </div>
          ))}
        </div>

        {/* Delivered tasks */}
        <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:'1.2em',color:'#1a1a2e',borderBottom:`2px solid ${colour}`,paddingBottom:'8px',marginBottom:'16px'}}>
          Deliverables Completed
        </h2>
        <div style={{marginBottom:'32px'}}>
          {done.map(t => (
            <div key={t.id} style={{display:'flex',alignItems:'center',gap:'10px',padding:'8px 0',borderBottom:'1px solid #f0f0f0'}}>
              <span style={{color:colour,fontSize:'1em'}}>✓</span>
              <div>
                <div style={{fontSize:'0.88em',color:'#333',fontWeight:500}}>{t.summary}</div>
                <div style={{fontSize:'0.75em',color:'#999'}}>{t.milestone}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Signature area */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'40px',marginTop:'40px',paddingTop:'40px',borderTop:'1px solid #e0e0e0'}}>
          <div>
            <div style={{borderBottom:'1px solid #333',height:'40px',marginBottom:'8px'}}></div>
            <div style={{fontSize:'0.8em',color:'#666'}}>Chris Timm — Sondela Consulting</div>
          </div>
          <div>
            <div style={{borderBottom:'1px solid #333',height:'40px',marginBottom:'8px'}}></div>
            <div style={{fontSize:'0.8em',color:'#666'}}>{project.client_name} — Client Representative</div>
          </div>
        </div>

        {/* Footer */}
        <div style={{marginTop:'40px',textAlign:'center',fontSize:'0.75em',color:'#ccc'}}>
          sondelaconsulting.com · Powered by HaloPSA
        </div>
      </div>
    </>
  );
}
