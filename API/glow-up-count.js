export default async function handler(req, res) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

  try {
    const countRes = await fetch(
      `${SUPABASE_URL}/rest/v1/crown_requests?select=id`,
      {
        headers: {
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          Prefer: 'count=exact',
        },
      }
    );
    const data = await countRes.json();
    const count = Array.isArray(data) ? data.length : 0;

    return res.status(200).json({ count });
  } catch (err) {
    return res.status(200).json({ count: 0 });
  }
}
