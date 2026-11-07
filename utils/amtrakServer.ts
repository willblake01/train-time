// Server-only: reads the timetable and fetches from Amtraker. Import from API
// routes and getStaticProps, not components.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fetchAllTrains, isAmtrak, type AmtrakTrain } from './amtrak';
import { departuresFromTrains, type Departure, type DepartureOptions, type StationOption } from './departures';
import { localDate } from './time';
import { daysBetween, mergeLiveDepartures, scheduledDepartures, scheduleStations, withoutDeparted } from './timetable';
import type { Schedule } from './timetableTypes';

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

let schedule: Schedule | null = null;

// The timetable built from Amtrak's GTFS feed, read once per server instance.
// It lives in data/, not public/, so visitors never download it.
export function getSchedule(): Schedule {
  schedule ??= JSON.parse(readFileSync(path.join(process.cwd(), 'data', 'schedule.json'), 'utf8')) as Schedule;
  return schedule;
}

/** Every station with scheduled trains, for the station pickers */
export const getStations = (): StationOption[] => scheduleStations(getSchedule());

/** Today's date (YYYY-MM-DD) at a station */
export function stationToday(stationCode: string): string {
  const timetable = getSchedule();
  const tz = timetable.stations[stationCode.toUpperCase()]?.tz ?? timetable.agencyTimezone;
  return localDate(new Date().toISOString(), tz);
}

/** The live feed only has trains running now, so only check it for dates this close to today */
const LIVE_DAYS = 2;

// The one function the board depends on: a station's departures on a date
// (today by default) from the timetable, with live delays, status, and tracks
// added for trains that are running. If live data is down, the timetable alone
// still answers.
export async function getDepartures(stationCode: string, { date, after }: DepartureOptions = {}): Promise<Departure[]> {
  const code = stationCode.toUpperCase();
  const timetable = getSchedule();
  const now = Date.now();
  const today = stationToday(code);
  const day = date ?? today;

  const planned = scheduledDepartures(timetable, code, day, { after });
  if (Math.abs(daysBetween(today, day)) > LIVE_DAYS) return withoutDeparted(planned, now);

  try {
    const live = departuresFromTrains(await getAllTrainsCached(), code, { date: day, after });
    return mergeLiveDepartures(planned, live, now);
  } catch (e) {
    console.error(`Live data unavailable for ${code}; showing the timetable only:`, e);
    return withoutDeparted(planned, now);
  }
}
