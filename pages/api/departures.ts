import type { NextApiRequest, NextApiResponse } from 'next';
import { getDepartures } from '../../utils/amtrakServer';

const STATION_CODE = /^[A-Z]{3}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const station = typeof req.query.station === 'string' ? req.query.station.toUpperCase() : '';
  if (!STATION_CODE.test(station)) {
    return res.status(400).json({ error: 'Station must be a 3-letter Amtrak code, e.g. CHI' });
  }

  // Optional: only trains leaving at or after this time (used for connections)
  const afterParam = typeof req.query.after === 'string' ? req.query.after : '';
  const afterMs = afterParam ? Date.parse(afterParam) : NaN;
  if (afterParam && Number.isNaN(afterMs)) {
    return res.status(400).json({ error: 'after must be an ISO date-time' });
  }

  // Optional: the local date at the station (YYYY-MM-DD); today when left out
  const date = typeof req.query.date === 'string' ? req.query.date : '';
  if (date && (!DATE.test(date) || Number.isNaN(Date.parse(date)))) {
    return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
  }

  try {
    const departures = await getDepartures(station, {
      ...(date && { date }),
      ...(afterParam && { after: new Date(afterMs).toISOString() }),
    });
    // CDN caches each station for a minute; the server-side cache means even
    // cache misses hit Amtraker at most once a minute
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
    return res.status(200).json({ station, departures });
  } catch (e) {
    console.error(`Departures failed for ${station}:`, e);
    return res.status(502).json({ error: 'Amtrak data unavailable' });
  }
}
