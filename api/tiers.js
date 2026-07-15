// Vercel serverless function.
// Returns the tournament field split into three tiers (A / B / C) by world
// ranking, so pool entrants can draft from pre-sorted lists.
//
// Strategy:
//   1. Fetch the tournament entry list from /tournaments (the field).
//   2. Fetch world rankings from /rankings.
//   3. Match field players to their world ranking, sort best-first.
//   4. Split: top ~15 = Tier A, next ~15 = Tier B, the rest = Tier C.
//   5. If /rankings is unavailable on your plan, fall back to SEED_ORDER below.
//
// Your RapidAPI key is read from env var RAPIDAPI_KEY and never sent to the browser.

const RAPIDAPI_HOST = 'live-golf-data.p.rapidapi.com';
const YEAR = process.env.TOURN_YEAR || '2026';
const ORG_ID = process.env.ORG_ID || '1';
const TOURN_ID = process.env.TOURN_ID || '100'; // The Open — verify via /schedules
const TIER_A_SIZE = parseInt(process.env.TIER_A_SIZE || '15', 10);
const TIER_B_SIZE = parseInt(process.env.TIER_B_SIZE || '15', 10);

// FALLBACK ONLY. If the rankings endpoint is not on your plan, paste an ordered
// list of the favourites here (best first). Leave empty to rely on rankings.
const SEED_ORDER = [
  // 'Scottie Scheffler', 'Rory McIlroy', 'Jon Rahm', ...
];

function normalise(name) {
  return (name || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // strip accents
    .replace(/[^a-z ]/g, '')
    .trim();
}

async function fetchJson(path, key) {
  const r = await fetch(`https://${RAPIDAPI_HOST}${path}`, {
    headers: { 'X-RapidAPI-Key': key, 'X-RapidAPI-Host': RAPIDAPI_HOST },
  });
  if (!r.ok) throw new Error(`${path} -> ${r.status}`);
  return r.json();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const key = process.env.RAPIDAPI_KEY;
  if (!key) return res.status(500).json({ error: 'Server missing RAPIDAPI_KEY.' });

  try {
    // 1. Field / entry list
    const tourn = await fetchJson(`/tournaments?orgId=${ORG_ID}&tournId=${TOURN_ID}&year=${YEAR}`, key);
    const field = (tourn.players || []).map((p) => ({
      name: `${p.firstName || ''} ${p.lastName || ''}`.trim(),
      playerId: p.playerId,
      status: p.status || '',
    })).filter((p) => p.name);

    // 2. Attempt rankings, else fall back to seed order.
    let orderIndex = {}; // normalised name -> rank (lower = better)
    let source = 'ranking';
    try {
      const ranks = await fetchJson(`/rankings?year=${YEAR}`, key);
      const rows = ranks.rankings || ranks.leaderboardRows || [];
      rows.forEach((row) => {
        const nm = `${row.firstName || ''} ${row.lastName || ''}`.trim() || row.player || '';
        const rk = row.rank || row.currentRank || row.position;
        if (nm && rk != null) orderIndex[normalise(nm)] = Number(rk);
      });
      if (Object.keys(orderIndex).length === 0) throw new Error('empty rankings');
    } catch (e) {
      source = SEED_ORDER.length ? 'seed' : 'alphabetical';
      SEED_ORDER.forEach((nm, i) => { orderIndex[normalise(nm)] = i + 1; });
    }

    // 3. Attach an order value to each field player; unranked go to the back.
    const BIG = 99999;
    const ranked = field.map((p) => ({
      ...p,
      order: orderIndex[normalise(p.name)] ?? BIG,
    }));

    // Stable sort: by order, then alphabetically for the long unranked tail.
    ranked.sort((a, b) => (a.order - b.order) || a.name.localeCompare(b.name));

    // 4. Split into tiers.
    const tierA = ranked.slice(0, TIER_A_SIZE);
    const tierB = ranked.slice(TIER_A_SIZE, TIER_A_SIZE + TIER_B_SIZE);
    const tierC = ranked.slice(TIER_A_SIZE + TIER_B_SIZE);

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');
    return res.status(200).json({
      source, // 'ranking' | 'seed' | 'alphabetical' — tells the UI how tiers were built
      tiers: {
        A: tierA.map((p) => p.name),
        B: tierB.map((p) => p.name),
        C: tierC.map((p) => p.name),
      },
    });
  } catch (err) {
    return res.status(500).json({ error: 'Could not build tiers', detail: String(err).slice(0, 300) });
  }
}
