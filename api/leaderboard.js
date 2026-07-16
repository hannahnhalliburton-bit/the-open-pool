// Vercel serverless function.
// Fetches the live leaderboard from Slash Golf (Live Golf Data on RapidAPI)
// and returns a trimmed list of players to the browser.
//
// Your RapidAPI key is read from the environment variable RAPIDAPI_KEY,
// which you set in the Vercel dashboard — it is NEVER sent to the browser.

const RAPIDAPI_HOST = 'live-golf-data.p.rapidapi.com';
const YEAR = process.env.TOURN_YEAR || '2026';
const ORG_ID = process.env.ORG_ID || '1';
const TOURN_ID = process.env.TOURN_ID || '100';

export default async function handler(req, res) {
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

    const rows = (data.leaderboardRows || []).map((row) => {
      const name = `${row.firstName || ''} ${row.lastName || ''}`.trim();
      let total = row.total;
      if (total === 'E' || total === 'e') total = 0;
      else if (typeof total === 'string') total = parseInt(total.replace('+', ''), 10);
      return {
        name,
        position: row.position || row.currentPos || '',
        total: Number.isNaN(total) ? null : total,
        status: row.status || '',      // "not started" | "active" | "complete" | "cut"
        thru: row.thru || '',          // "F" when done, or a hole number like "12"
        teeTime: row.teeTime || '',    // e.g. "7:41am" for players who haven't started
      };
    });

    res.setHeader('Cache-Control', 's-maxage=90, stale-while-revalidate=120');
    return res.status(200).json({ updated: new Date().toISOString(), players: rows });
  } catch (err) {
    return res.status(500).json({ error: 'Fetch failed', detail: String(err).slice(0, 300) });
  }
}
