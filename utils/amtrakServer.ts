// Server-only: fetches from Amtraker. Import from API routes and getStaticProps, not components.
import { fetchAllTrains, isAmtrak, type AmtrakTrain } from './amtrak';
import { departuresFromTrains, type DepartureOptions } from './departures';

const MAX_AGE_MS = 60_000;

let cache: { fetchedAt: number; trains: Promise<AmtrakTrain[]> } | null = null;

// All active Amtrak trains, fetched at most once a minute per server instance.
// Concurrent callers share one in-flight request, and failures aren't cached.
export function getAllTrainsCached(): Promise<AmtrakTrain[]> {
  if (!cache || Date.now() - cache.fetchedAt > MAX_AGE_MS) {
    const trains = fetchAllTrains().then((all) => all.filter(isAmtrak));
    cache = { fetchedAt: Date.now(), trains };
    trains.catch(() => {
      if (cache?.trains === trains) cache = null;
    });
  }
  return cache.trains;
}

// The one function the UI depends on. Phase 2 swaps its internals for GTFS
// timetable data plus a live overlay, without changing its signature.
export async function getDepartures(stationCode: string, options: DepartureOptions = {}) {
  return departuresFromTrains(await getAllTrainsCached(), stationCode, options);
}
