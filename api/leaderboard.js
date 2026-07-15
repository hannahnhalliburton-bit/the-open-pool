// Vercel serverless function.
// Fetches the live leaderboard from Slash Golf (Live Golf Data on RapidAPI)
// and returns a trimmed list of { name, position, total } to the browser.
//
// Your RapidAPI key is read from the environment variable RAPIDAPI_KEY,
// which you set in the Vercel dashboard — it is NEVER sent to the browser.

const RAPIDAPI_HOST = 'live-golf-data.p.rapidapi.com';

// The Open Championship 2026. orgId 1 = PGA Tour feed; The Open carries its own
// tournId. These are set as env vars so you can adjust without editing code.
const YEAR = process.env.TOURN_YEAR || '2026';
const ORG_ID = process.env.ORG_ID || '1';
const TOURN_ID = process.env.TOURN_ID || '100'; // The Open — verify per docs

export default async function handler(req, res) {
  // Allow the browser page to call this function.
  res.setHeader('Access-Control-Allow-Origin', '*');

  const key = process.env.RAPIDAPI_KEY;
  if (!key) {
    return res.status(500).json({ error: 'Server missing RAPIDAPI_KEY. Set it in Vercel project settings.' });
  }

  const url = `https://${RAPIDAPI_HOST}/leaderboard?orgId=${ORG_ID}&tournId=${TOURN_ID}&year=${YEAR}`;

  try {
    const r = await fetch(url, {
      headers: {
        'X-RapidAPI-Key': key,
        'X-RapidAPI-Host': RAPIDAPI_HOST,
      },
    });

    if (!r.ok) {
      const body = await r.text();
      return res.status(r.status).json({ error: 'Upstream API error', detail: body.slice(0, 300) });
    }

    const data = await r.json();

    // The feed returns a `leaderboardRows` array. Each row has firstName,
    // lastName, position, and `total` (score to par as a string like "-7" or "E").
    const rows = (data.leaderboardRows || []).map((row) => {
      const name = `${row.firstName || ''} ${row.lastName || ''}`.trim();
      let total = row.total;
      // Normalise "E" to 0 and strip any stray characters.
      if (total === 'E' || total === 'e') total = 0;
      else if (typeof total === 'string') total = parseInt(total.replace('+', ''), 10);
      return {
        name,
        position: row.position || row.currentPos || '',
        total: Number.isNaN(total) ? null : total,
        status: row.status || '', // e.g. "cut", "active"
      };
    });

    // Cache for 90 seconds at the edge to protect your 250-call monthly quota.
    res.setHeader('Cache-Control', 's-maxage=90, stale-while-revalidate=120');
    return res.status(200).json({ updated: new Date().toISOString(), players: rows });
  } catch (err) {
    return res.status(500).json({ error: 'Fetch failed', detail: String(err).slice(0, 300) });
  }
}
