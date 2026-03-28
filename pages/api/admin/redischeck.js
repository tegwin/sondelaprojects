// Temporary diagnostic endpoint - remove after fixing
export default async function handler(req, res) {
  const BASE  = process.env.UPSTASH_REDIS_URL;
  const TOKEN = process.env.UPSTASH_REDIS_TOKEN;

  if (!BASE || !TOKEN) {
    return res.status(200).json({
      ok: false,
      error: 'Missing env vars',
      has_url: !!BASE,
      has_token: !!TOKEN,
      url_preview: BASE ? BASE.substring(0, 30) + '...' : null,
    });
  }

  try {
    // Test 1: pipeline SET
    const setRes = await fetch(`${BASE}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([['SET', 'test:ping', JSON.stringify({ ts: Date.now() })]]),
    });
    const setData = await setRes.json();

    // Test 2: pipeline GET
    const getRes = await fetch(`${BASE}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([['GET', 'test:ping']]),
    });
    const getData = await getRes.json();

    return res.status(200).json({
      ok: true,
      url_preview: BASE.substring(0, 40) + '...',
      set_status: setRes.status,
      set_result: setData,
      get_status: getRes.status,
      get_result: getData,
    });
  } catch (e) {
    return res.status(200).json({ ok: false, error: e.message });
  }
}
