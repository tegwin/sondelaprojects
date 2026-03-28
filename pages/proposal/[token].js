import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';

const CLOSED = [9,16,21], ACTIVE=[2,22];
function statusStyle(sid) {
  if (CLOSED.includes(sid)) return { background:'#1e3a2e', color:'#a6e3a1' };
  if (ACTIVE.includes(sid))  return { background:'#1e2e4a', color:'#89b4fa' };
  return { background:'#2e2e1e', color:'#f9e2af' };
}

export default function ProposalPage() {
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

  if (loading) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh',background:'#1e1e2e',color:'#a6adc8',fontFamily:'Segoe UI,sans-serif'}}>
      Loading...
    </div>
  );

  if (!data || data.error) return (
    <div style={{textAlign:'center',padding:'60px',color:'#6c7086',fontFamily:'Segoe UI,sans-serif'}}>
      This proposal link is not available.
    </div>
  );

  const { project, stats, taskDetails, milestones } = data;
  const colour = project.client_colour || '#89b4fa';
  const totalEstHours = stats.budgetHours || '—';

  return (
    <>
      <Head><title>Project Proposal | {project.client_name}</title></Head>
      <div style={s.page}>
        {/* Header */}
        <div style={{...s.hero, borderBottom:`3px solid ${colour}`}}>
          <div style={s.heroInner}>
            <div style={{fontSize:'0.8em',color:'#6c7086',letterSpacing:'0.15em',textTransform:'uppercase',marginBottom:'12px'}}>
              Project Proposal
            </div>
            <h1 style={s.heroTitle}>{project.summary}</h1>
            <div style={{...s.heroClient, color: colour}}>{project.client_name}</div>
            <p style={s.heroMeta}>Prepared by Sondela Consulting · {new Date().toLocaleDateString('en-GB',{month:'long',year:'numeric'})}</p>
          </div>
        </div>

        <main style={s.main}>
          {/* Overview */}
          <div style={s.overviewGrid}>
            {[
              { icon:'📋', v: stats.total,         l: 'Sessions Planned' },
              { icon:'⏱',  v: `${totalEstHours}h`, l: 'Estimated Hours' },
              { icon:'📅', v: milestones.length,   l: 'Project Phases' },
              { icon:'🏢', v: project.agent_name,  l: 'Lead Consultant' },
            ].map((st,i) => (
              <div key={i} style={s.oCard}>
                <div style={s.oIcon}>{st.icon}</div>
                <div style={{...s.oVal, color: i===0?colour:undefined}}>{st.v}</div>
                <div style={s.oLbl}>{st.l}</div>
              </div>
            ))}
          </div>

          {/* Phase breakdown */}
          <h2 style={{...s.sectionTitle, borderBottomColor: colour}}>Project Phases</h2>
          {milestones.map((ms, mi) => {
            const msTasks = taskDetails.filter(t => t.milestone === ms.name);
            return (
              <div key={mi} style={s.phase}>
                <div style={{...s.phaseHeader, borderLeftColor: colour}}>
                  <div style={{...s.phaseNum, background: colour}}>Phase {mi+1}</div>
                  <div style={s.phaseName}>{ms.name}</div>
                  <div style={s.phaseMeta}>{msTasks.length} session{msTasks.length!==1?'s':''}</div>
                </div>
                <div style={s.taskList}>
                  {msTasks.map((t, ti) => (
                    <div key={ti} style={s.taskItem}>
                      <div style={{...s.taskNum, borderColor: colour, color: colour}}>{ti+1}</div>
                      <div style={s.taskSummary}>{t.summary}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Footer */}
          <div style={s.footer}>
            <div style={{fontSize:'0.82em',color:'#6c7086'}}>
              Prepared by <strong style={{color:'#cdd6f4'}}>Sondela Consulting</strong>
            </div>
            <a href="https://sondelaconsulting.com" target="_blank" rel="noreferrer" style={{color:colour,fontSize:'0.82em'}}>
              sondelaconsulting.com
            </a>
          </div>
        </main>
      </div>
    </>
  );
}

const s = {
  page:        {minHeight:'100vh',background:'#1e1e2e',color:'#cdd6f4',fontFamily:'Segoe UI,Arial,sans-serif'},
  hero:        {background:'#181825',padding:'60px 30px'},
  heroInner:   {maxWidth:'900px',margin:'0 auto'},
  heroTitle:   {fontSize:'2em',color:'#cdd6f4',fontWeight:700,margin:'0 0 10px',lineHeight:1.2},
  heroClient:  {fontSize:'1.1em',fontWeight:600,marginBottom:'10px'},
  heroMeta:    {fontSize:'0.82em',color:'#6c7086',margin:0},
  main:        {maxWidth:'900px',margin:'0 auto',padding:'40px 30px'},
  overviewGrid:{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'14px',marginBottom:'40px'},
  oCard:       {background:'#313244',border:'1px solid #45475a',borderRadius:'10px',padding:'20px',textAlign:'center'},
  oIcon:       {fontSize:'1.5em',marginBottom:'8px'},
  oVal:        {fontSize:'1.4em',fontWeight:700,color:'#cdd6f4',marginBottom:'4px'},
  oLbl:        {fontSize:'0.72em',color:'#6c7086'},
  sectionTitle:{fontSize:'1.1em',color:'#cdd6f4',fontWeight:700,borderBottom:'2px solid',paddingBottom:'8px',marginBottom:'20px'},
  phase:       {marginBottom:'24px'},
  phaseHeader: {display:'flex',alignItems:'center',gap:'12px',padding:'10px 14px',background:'#252535',borderRadius:'8px 8px 0 0',borderLeft:'3px solid',marginBottom:'2px'},
  phaseNum:    {fontSize:'0.7em',padding:'2px 10px',borderRadius:'10px',color:'#1e1e2e',fontWeight:700,flexShrink:0},
  phaseName:   {fontSize:'0.92em',color:'#cdd6f4',fontWeight:600,flex:1},
  phaseMeta:   {fontSize:'0.75em',color:'#6c7086'},
  taskList:    {background:'#252535',borderRadius:'0 0 8px 8px',overflow:'hidden'},
  taskItem:    {display:'flex',alignItems:'center',gap:'12px',padding:'10px 14px',borderTop:'1px solid #313244'},
  taskNum:     {width:'22px',height:'22px',borderRadius:'50%',border:'1px solid',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'0.72em',flexShrink:0,fontWeight:600},
  taskSummary: {fontSize:'0.85em',color:'#cdd6f4'},
  footer:      {display:'flex',justifyContent:'space-between',marginTop:'40px',paddingTop:'20px',borderTop:'1px solid #313244'},
};
