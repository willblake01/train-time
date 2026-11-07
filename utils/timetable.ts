// Reads data/schedule.json: which trains run on a given date, and when.
// Pure functions, so they're safe anywhere and easy to test.
import type { Departure, StationOption } from './departures';
import { localDate } from './time';
import type { Schedule, ScheduleService, ScheduleTrip } from './timetableTypes';

const HOUR_MS = 3_600_000;
/** Amtrak's longest trips have stop times up to about 80 hours after their service day starts */
const MAX_TRIP_DAYS = 4;

/** 'YYYY-MM-DD' plus a number of days (negative to go back) */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Whole days from one date to another ('2026-11-25' to '2026-11-27' is 2) */
export const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / (24 * HOUR_MS));

/** Monday = 0 … Sunday = 6, matching ScheduleService.days */
const weekdayIndex = (date: string) => (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;

export function serviceRunsOn(service: ScheduleService, date: string): boolean {
  return date >= service.start && date <= service.end && service.days[weekdayIndex(date)] === '1';
}

// Creating Intl formatters is slow, so make one per time zone and reuse it
const offsetFormatters = new Map<string, Intl.DateTimeFormat>();
const offsetFormatter = (timeZone: string) => {
  let formatter = offsetFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    offsetFormatters.set(timeZone, formatter);
  }
  return formatter;
};

// How far a time zone is ahead of UTC at a given instant, in ms (negative in the US)
function timeZoneOffset(instant: number, timeZone: string): number {
  const parts = offsetFormatter(timeZone).formatToParts(new Date(instant));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const wallClockAsUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return wallClockAsUtc - Math.floor(instant / 1000) * 1000;
}

// The UTC instant of a wall-clock hour on a date in a time zone
function zonedHourToUtc(date: string, hour: number, timeZone: string): number {
  const [y, m, d] = date.split('-').map(Number);
  const naive = Date.UTC(y, m - 1, d, hour);
  // Two passes settle the offset even right next to a daylight saving change
  const firstGuess = naive - timeZoneOffset(naive, timeZone);
  return naive - timeZoneOffset(firstGuess, timeZone);
}

// GTFS counts a trip's stop times from "noon minus 12 hours" on its service
// date, in the agency time zone. That's midnight on normal days; on daylight
// saving change days it keeps every time on the same footing.
const dayStarts = new Map<string, number>();

export function serviceDayStart(date: string, timeZone: string): number {
  const key = `${date}|${timeZone}`;
  let start = dayStarts.get(key);
  if (start === undefined) {
    start = zonedHourToUtc(date, 12, timeZone) - 12 * HOUR_MS;
    dayStarts.set(key, start);
  }
  return start;
}

/** A stop time (seconds after the service day starts) as an ISO instant */
export const stopTimeToIso = (serviceDate: string, seconds: number, timeZone: string) =>
  new Date(serviceDayStart(serviceDate, timeZone) + seconds * 1000).toISOString();

// Which trips stop at each station, built once per schedule
const stationIndexes = new WeakMap<Schedule, Map<string, { trip: ScheduleTrip; index: number }[]>>();

function tripsAt(schedule: Schedule, code: string) {
  let index = stationIndexes.get(schedule);
  if (!index) {
    index = new Map();
    for (const trip of schedule.trips) {
      trip.stops.forEach((stop, i) => {
        const list = index!.get(stop[0]);
        if (list) list.push({ trip, index: i });
        else index!.set(stop[0], [{ trip, index: i }]);
      });
    }
    stationIndexes.set(schedule, index);
  }
  return index.get(code) ?? [];
}

const byScheduled = (a: Departure, b: Departure) => Date.parse(a.station.scheduled) - Date.parse(b.station.scheduled);

function toDeparture(schedule: Schedule, trip: ScheduleTrip, index: number, serviceDate: string, scheduled: string): Departure {
  const tz = schedule.agencyTimezone;
  const [code] = trip.stops[index];
  const station = schedule.stations[code];
  const origin = trip.stops[0];
  const last = trip.stops[trip.stops.length - 1];

  // Same shape as Amtraker's IDs: train number plus the day of the month it leaves its first station
  const originDate = localDate(stopTimeToIso(serviceDate, origin[2], tz), schedule.stations[origin[0]]?.tz ?? tz);

  return {
    trainID: `${trip.trainNum}-${Number(originDate.slice(8))}`,
    trainNum: Number(trip.trainNum),
    routeName: trip.route,
    destCode: last[0],
    destName: trip.headsign || schedule.stations[last[0]]?.name || last[0],
    station: { code, name: station.name, tz: station.tz, scheduled, estimated: scheduled },
    delayMinutes: 0,
    status: 'scheduled',
    platform: '',
    // Only stops where riders can get off
    remainingStops: trip.stops
      .slice(index + 1)
      .filter((stop) => stop[4])
      .map(([stopCode, arrival]) => {
        const time = stopTimeToIso(serviceDate, arrival, tz);
        const stopStation = schedule.stations[stopCode];
        return { code: stopCode, name: stopStation?.name ?? stopCode, tz: stopStation?.tz ?? tz, scheduled: time, estimated: time };
      }),
  };
}

// Every train scheduled to leave a station on a local date (in the station's
// time zone), in time order. Skips stops where riders can't board and trains
// that end at the station.
export function scheduledDepartures(
  schedule: Schedule,
  stationCode: string,
  date: string,
  { after }: { after?: string } = {},
): Departure[] {
  const code = stationCode.toUpperCase();
  const station = schedule.stations[code];
  if (!station) return [];

  const departures: Departure[] = [];
  for (const { trip, index } of tripsAt(schedule, code)) {
    const stop = trip.stops[index];
    if (index === trip.stops.length - 1 || !stop[3]) continue;

    const service = schedule.services[trip.service];
    // A train that started up to a few days earlier can still pass through today
    for (let back = 0; back < MAX_TRIP_DAYS; back++) {
      const serviceDate = addDays(date, -back);
      if (!service || !serviceRunsOn(service, serviceDate)) continue;
      const scheduled = stopTimeToIso(serviceDate, stop[2], schedule.agencyTimezone);
      if (localDate(scheduled, station.tz) !== date) continue;
      if (after && Date.parse(scheduled) < Date.parse(after)) continue;
      departures.push(toDeparture(schedule, trip, index, serviceDate, scheduled));
    }
  }
  return departures.sort(byScheduled);
}

/** Every station with scheduled trains, sorted by name, for the station pickers */
export function scheduleStations(schedule: Schedule): StationOption[] {
  return Object.entries(schedule.stations)
    .map(([code, station]) => ({ code, name: station.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Without live data, assume trains leave on time: drop the ones whose departure has passed */
export const withoutDeparted = (departures: Departure[], now: number) =>
  departures.filter((d) => Date.parse(d.station.scheduled) >= now);

/** A live train counts as the same run as a scheduled one if their times at the station are this close */
const LIVE_MATCH_WINDOW_MS = 90 * 60_000;

const sameRun = (a: Departure, b: Departure) =>
  a.trainNum === b.trainNum && Math.abs(Date.parse(a.station.scheduled) - Date.parse(b.station.scheduled)) <= LIVE_MATCH_WINDOW_MS;

// Combines the timetable with live Amtrak data for the same station and date:
// - a scheduled train that's running takes the live delay, status, and track
// - a scheduled train with no live match whose time has passed has left (or
//   isn't running), so it's dropped
// - live trains the timetable doesn't list (extra or rescheduled runs) are kept
export function mergeLiveDepartures(scheduled: Departure[], live: Departure[], now: number): Departure[] {
  const matched = new Set<Departure>();

  const merged = scheduled.flatMap((planned) => {
    const running = live.find((l) => !matched.has(l) && sameRun(l, planned));
    if (!running) return Date.parse(planned.station.scheduled) < now ? [] : [planned];
    matched.add(running);
    // Keep the timetable's rule about where riders can get off
    const canAlight = new Set(planned.remainingStops.map((stop) => stop.code));
    return [{ ...running, routeName: planned.routeName, remainingStops: running.remainingStops.filter((stop) => canAlight.has(stop.code)) }];
  });

  const extras = live.filter((l) => !matched.has(l));
  return [...merged, ...extras].sort(byScheduled);
}
