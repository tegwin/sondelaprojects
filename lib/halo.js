let cachedToken = null;
let tokenExpiry = 0;

export async function getHaloToken() {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;
  const res = await fetch(`${process.env.HALO_BASE_URL}/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'client_credentials',
      client_id:     process.env.HALO_CLIENT_ID,
      client_secret: process.env.HALO_CLIENT_SECRET,
      scope:         'all',
    }),
  });
  if (!res.ok) throw new Error(`HaloPSA auth failed (${res.status})`);
  const data = await res.json();
  cachedToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return cachedToken;
}

export async function haloFetch(path, options = {}) {
  const token = await getHaloToken();
  const headers = { Authorization: `Bearer ${token}` };
  if (options.body) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${process.env.HALO_BASE_URL}${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers || {}) },
  });
  if (!res.ok) throw new Error(`HaloPSA error (${res.status}): ${path}`);
  if (res.status === 204) return {};
  return res.json();
}
