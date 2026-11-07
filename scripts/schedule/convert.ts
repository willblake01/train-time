// Turns Amtrak's GTFS files into data/schedule.json. Pure functions: no file
// or network access, so it's easy to test with small sample feeds.
import { parse } from 'csv-parse/sync';
import type { Schedule, ScheduleService, ScheduleStation, ScheduleStop, ScheduleTrip } from '../../utils/timetableTypes';

export const AMTRAK_AGENCY_ID = '51';
const RAIL_ROUTE_TYPE = '2'; // GTFS route_type for intercity rail; Thruway buses are 3
const NO_PICKUP_OR_DROP_OFF = '1';
const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

// Corrections for known errors in Amtrak's feed. Arizona doesn't observe
// daylight saving time, but the feed lists its stations in Mountain time
// (America/Denver), which would show their times an hour off from March to
// November. Stop times are unaffected: they're counted in the agency time zone.
export const TIMEZONE_FIXES: Record<string, string> = Object.fromEntries(
  ['BEN', 'FLG', 'KNG', 'MRC', 'PHA', 'PXN', 'TEM', 'TUS', 'WLO', 'WMH', 'YUM'].map((code) => [code, 'America/Phoenix']),
);

export const REQUIRED_FILES = ['agency.txt', 'routes.txt', 'trips.txt', 'stops.txt', 'stop_times.txt', 'calendar.txt'] as const;
export const OPTIONAL_FILES = ['feed_info.txt'] as const;

type Row = Record<string, string>;

export class ConversionError extends Error {}

const readCsv = (text: string): Row[] => parse(text, { columns: true, skip_empty_lines: true, bom: true, trim: true });

/** '56:35:00' → seconds. GTFS times can pass 24:00:00 for trips that run past midnight. */
export function parseGtfsTime(value: string): number {
  const match = /^(\d{1,3}):([0-5]\d):([0-5]\d)$/.exec(value);
  if (!match) throw new ConversionError(`Invalid GTFS time "${value}"`);
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
}

/** '20261101' → '2026-11-01' */
export function parseGtfsDate(value: string): string {
  const match = /^(\d{4})(\d{2})(\d{2})$/.exec(value);
  if (!match) throw new ConversionError(`Invalid GTFS date "${value}"`);
  return `${match[1]}-${match[2]}-${match[3]}`;
}

const byTrainNumber = (a: ScheduleTrip, b: ScheduleTrip) =>
  Number(a.trainNum) - Number(b.trainNum) || a.trainNum.localeCompare(b.trainNum) || a.service.localeCompare(b.service);

export function convertGtfs(files: Record<string, string>): Schedule {
  const missing = REQUIRED_FILES.filter((name) => !(name in files));
  if (missing.length) throw new ConversionError(`Feed is missing ${missing.join(', ')}`);

  const agency = readCsv(files['agency.txt']).find((a) => a.agency_id === AMTRAK_AGENCY_ID);
  if (!agency) throw new ConversionError(`Feed has no Amtrak agency (agency_id ${AMTRAK_AGENCY_ID})`);
  const agencyTimezone = agency.agency_timezone;

  // Amtrak-operated trains only: no Thruway buses, VIA Rail, or commuter partners
  const routes = new Map(
    readCsv(files['routes.txt'])
      .filter((r) => r.agency_id === AMTRAK_AGENCY_ID && r.route_type === RAIL_ROUTE_TYPE)
      .map((r) => [r.route_id, r.route_long_name || r.route_short_name]),
  );
  const trips = readCsv(files['trips.txt']).filter((t) => routes.has(t.route_id));
  const tripIds = new Set(trips.map((t) => t.trip_id));

  const stopTimes = new Map<string, Row[]>();
  for (const row of readCsv(files['stop_times.txt'])) {
    if (!tripIds.has(row.trip_id)) continue;
    const list = stopTimes.get(row.trip_id);
    if (list) list.push(row);
    else stopTimes.set(row.trip_id, [row]);
  }

  const allStops = new Map(readCsv(files['stops.txt']).map((s) => [s.stop_id, s]));
  const calendar = new Map(readCsv(files['calendar.txt']).map((c) => [c.service_id, c]));

  const stations: Record<string, ScheduleStation> = {};
  const services: Record<string, ScheduleService> = {};
  const scheduleTrips: ScheduleTrip[] = [];

  for (const trip of trips) {
    const rows = (stopTimes.get(trip.trip_id) ?? []).sort((a, b) => Number(a.stop_sequence) - Number(b.stop_sequence));
    if (rows.length < 2) continue;

    const service = calendar.get(trip.service_id);
    if (!service) throw new ConversionError(`Trip ${trip.trip_id} uses unknown service ${trip.service_id}`);
    services[trip.service_id] ??= {
      days: WEEKDAYS.map((day) => (service[day] === '1' ? '1' : '0')).join(''),
      start: parseGtfsDate(service.start_date),
      end: parseGtfsDate(service.end_date),
    };

    const stops: ScheduleStop[] = rows.map((row) => {
      const stop = allStops.get(row.stop_id);
      if (!stop) throw new ConversionError(`Trip ${trip.trip_id} stops at unknown station ${row.stop_id}`);
      stations[row.stop_id] ??= {
        name: stop.stop_name,
        tz: TIMEZONE_FIXES[row.stop_id] ?? (stop.stop_timezone || agencyTimezone),
      };
      return [
        row.stop_id,
        parseGtfsTime(row.arrival_time || row.departure_time),
        parseGtfsTime(row.departure_time || row.arrival_time),
        row.pickup_type === NO_PICKUP_OR_DROP_OFF ? 0 : 1,
        row.drop_off_type === NO_PICKUP_OR_DROP_OFF ? 0 : 1,
      ];
    });

    scheduleTrips.push({
      trainNum: trip.trip_short_name,
      route: routes.get(trip.route_id) ?? '',
      headsign: trip.trip_headsign,
      service: trip.service_id,
      stops,
    });
  }

  const ranges = Object.values(services);
  const feedInfo = files['feed_info.txt'] ? readCsv(files['feed_info.txt'])[0] : undefined;

  return {
    version: feedInfo?.feed_version ?? '',
    agencyTimezone,
    startDate: ranges.reduce((min, s) => (s.start < min ? s.start : min), ranges[0]?.start ?? ''),
    endDate: ranges.reduce((max, s) => (s.end > max ? s.end : max), ranges[0]?.end ?? ''),
    stations: Object.fromEntries(Object.entries(stations).sort(([a], [b]) => a.localeCompare(b))),
    services: Object.fromEntries(Object.entries(services).sort(([a], [b]) => a.localeCompare(b))),
    trips: scheduleTrips.sort(byTrainNumber),
  };
}

const addDays = (date: string, days: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

export interface ValidationLimits {
  minTrips: number;
  minStations: number;
  /** The feed must cover at least this many days after `today` */
  minDaysAhead: number;
}

export const DEFAULT_LIMITS: ValidationLimits = { minTrips: 500, minStations: 300, minDaysAhead: 30 };

// Refuse to publish a feed that looks broken or truncated. Returns problems, empty when fine.
export function validateSchedule(schedule: Schedule, today: string, limits: ValidationLimits = DEFAULT_LIMITS): string[] {
  const problems: string[] = [];
  const stationCount = Object.keys(schedule.stations).length;

  if (schedule.trips.length < limits.minTrips) problems.push(`Only ${schedule.trips.length} trips (expected at least ${limits.minTrips})`);
  if (stationCount < limits.minStations) problems.push(`Only ${stationCount} stations (expected at least ${limits.minStations})`);
  const needUntil = addDays(today, limits.minDaysAhead);
  if (!schedule.endDate || schedule.endDate < needUntil) {
    problems.push(`Schedule ends ${schedule.endDate || 'never'}, before ${needUntil}`);
  }
  for (const trip of schedule.trips) {
    if (!/^\d{1,4}$/.test(trip.trainNum)) problems.push(`Unexpected train number "${trip.trainNum}"`);
    if (!schedule.services[trip.service]) problems.push(`Train ${trip.trainNum} has no service ${trip.service}`);
  }
  return problems;
}

// Markdown for the pull request: what changed since the last schedule
export function summarizeSchedule(schedule: Schedule, previous?: Schedule): string {
  const trainNumbers = (s: Schedule) => new Set(s.trips.map((t) => t.trainNum));
  const now = trainNumbers(schedule);
  const lines = [
    `Amtrak GTFS feed version **${schedule.version || 'unknown'}**, covering ${schedule.startDate} to ${schedule.endDate}.`,
    '',
    `- ${schedule.trips.length} train schedules across ${now.size} train numbers`,
    `- ${Object.keys(schedule.stations).length} stations`,
  ];
  if (previous) {
    const before = trainNumbers(previous);
    const added = [...now].filter((n) => !before.has(n));
    const removed = [...before].filter((n) => !now.has(n));
    lines.push(`- Previous version: ${previous.version || 'unknown'} (${previous.trips.length} train schedules)`);
    if (added.length) lines.push(`- New train numbers: ${added.join(', ')}`);
    if (removed.length) lines.push(`- Train numbers no longer scheduled: ${removed.join(', ')}`);
  }
  return lines.join('\n') + '\n';
}

// JSON with one station, service, and trip per line, so pull request diffs
// show exactly which schedules changed instead of one giant changed line
export function serializeSchedule(schedule: Schedule): string {
  const { stations, services, trips, ...header } = schedule;
  const entries = (obj: Record<string, unknown>) =>
    Object.entries(obj).map(([key, value]) => `    ${JSON.stringify(key)}: ${JSON.stringify(value)}`).join(',\n');
  return [
    '{',
    ...Object.entries(header).map(([key, value]) => `  ${JSON.stringify(key)}: ${JSON.stringify(value)},`),
    `  "stations": {\n${entries(stations)}\n  },`,
    `  "services": {\n${entries(services)}\n  },`,
    `  "trips": [\n${trips.map((t) => `    ${JSON.stringify(t)}`).join(',\n')}\n  ]`,
    '}',
    '',
  ].join('\n');
}
