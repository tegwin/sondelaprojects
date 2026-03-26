let cachedToken = null;
let tokenExpiry = 0;

export async function getHaloToken() {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;
  const res = await fetch(`${process.env.HALO_BASE_URL}/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.HALO_CLIENT_ID,
      client_secret: process.env.HALO_CLIENT_SECRET,
      scope: 'all',
    }),
  });
  if (!res.ok) throw new Error(`HaloPSA auth failed (${res.status})`);
  const data = await res.json();
  cachedToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return cachedToken;
}

export async function haloFetch(path) {
  const token = await getHaloToken();
  const res = await fetch(`${process.env.HALO_BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`HaloPSA error (${res.status}): ${path}`);
  return res.json();
}
