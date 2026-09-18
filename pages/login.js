import { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

// ?next= is attacker-supplied, so only a path on this site is followed: a value
// like https://evil.example or //evil.example would otherwise send the user
// there straight after they log in.
function safeNext(next) {
  if (typeof next !== 'string' || !next) return '/';
  let decoded;
  try {
    decoded = decodeURIComponent(next);
  } catch {
    return '/';
  }
  // Must be a single-slash-rooted path; rejects //host, https://host and \\host.
  if (!decoded.startsWith('/') || decoded.startsWith('//') || decoded.startsWith('/\\')) {
    return '/';
  }
  return decoded;
}

export default function Login() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');

    let res;
    try {
      res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
    } catch (networkErr) {
      setError('Network error — could not reach server.');
      setLoading(false);
      return;
    }

    let data;
    try {
      data = await res.json();
    } catch {
      setError(`Server returned status ${res.status} — check Vercel logs.`);
      setLoading(false);
      return;
    }

    if (res.ok && data.ok) {
      router.replace(safeNext(router.query.next));
    } else {
      setError(data.error || `Login failed (${res.status})`);
      setLoading(false);
    }
  }

  return (
    <>
      <Head><title>Sign In | Sondela Project Portal</title></Head>
      <div style={s.page}>
        <div style={s.card}>
          <div style={s.logo}>📊</div>
          <h1 style={s.title}>Sondela Project Portal</h1>
          <p style={s.sub}>Admin access only</p>
          <form onSubmit={handleSubmit} style={s.form}>
            <label style={s.label}>Username</label>
            <input
              style={s.input}
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoComplete="username"
              required
              autoFocus
            />
            <label style={s.label}>Password</label>
            <input
              style={s.input}
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
            {error && <p style={s.error}>⚠️ {error}</p>}
            <button style={s.btn} type="submit" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In →'}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}

const s = {
  page: { minHeight:'100vh', background:'#1e1e2e', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Segoe UI,Arial,sans-serif', padding:'20px' },
  card: { background:'#313244', border:'1px solid #45475a', borderRadius:'16px', padding:'48px 40px', width:'100%', maxWidth:'400px', textAlign:'center' },
  logo: { fontSize:'3em', marginBottom:'16px' },
  title: { color:'#89b4fa', fontSize:'1.3em', margin:'0 0 6px' },
  sub: { color:'#6c7086', fontSize:'0.85em', margin:'0 0 28px' },
  form: { display:'flex', flexDirection:'column', gap:'12px', textAlign:'left' },
  label: { fontSize:'0.82em', color:'#a6adc8' },
  input: { width:'100%', background:'#1e1e2e', border:'1px solid #45475a', borderRadius:'8px', padding:'11px 14px', color:'#cdd6f4', fontSize:'0.95em', boxSizing:'border-box' },
  error: { color:'#f38ba8', fontSize:'0.82em', margin:0, padding:'10px 12px', background:'#2a1520', border:'1px solid #f38ba8', borderRadius:'6px' },
  btn: { background:'#89b4fa', color:'#1e1e2e', border:'none', borderRadius:'8px', padding:'12px', fontSize:'0.95em', fontWeight:'700', cursor:'pointer', marginTop:'4px' },
};
