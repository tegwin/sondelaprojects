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

const MAX_PAGES = 100;

// Halo ignores a bare `pagesize=` and silently serves one default-sized page
// (~50 rows, newest id first), so anything older than that window vanishes from
// a single-request list. Page size only applies alongside paginate=true, so walk
// every page and return the whole set.
export async function haloFetchAll(path, pageSize = 100) {
  const sep = path.includes('?') ? '&' : '?';
  const byId = new Map();

  for (let pageNo = 1; pageNo <= MAX_PAGES; pageNo++) {
    const data = await haloFetch(
      `${path}${sep}paginate=true&page_size=${pageSize}&page_no=${pageNo}`
    );
    const page = data.tickets || data.projects || data.clients || [];
    if (page.length === 0) break;

    // Keyed by id so an endpoint that ignores paginate and returns the whole
    // set every time yields the right answer instead of duplicates.
    const before = byId.size;
    page.forEach(row => byId.set(row.id, row));
    if (byId.size === before) break;

    // Deliberately not stopping on a short page: Halo may cap page_size below
    // what we asked for, and treating that as end-of-data would truncate the
    // set again. Running on until a page adds nothing costs one extra request.
    const total = data.record_count;
    if (typeof total === 'number' && byId.size >= total) break;
  }

  return [...byId.values()];
}
