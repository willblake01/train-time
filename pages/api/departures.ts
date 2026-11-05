import type { NextApiRequest, NextApiResponse } from 'next';
import { getDepartures } from '../../utils/amtrakServer';

const STATION_CODE = /^[A-Z]{3}$/;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const station = typeof req.query.station === 'string' ? req.query.station.toUpperCase() : '';
  if (!STATION_CODE.test(station)) {
    return res.status(400).json({ error: 'Station must be a 3-letter Amtrak code, e.g. CHI' });
  }

  try {
    const departures = await getDepartures(station);
    // CDN caches each station for a minute; the server-side cache means even
    // cache misses hit Amtraker at most once a minute
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
    return res.status(200).json({ station, departures });
  } catch (e) {
    console.error(`Departures failed for ${station}:`, e);
    return res.status(502).json({ error: 'Amtrak data unavailable' });
  }
}
