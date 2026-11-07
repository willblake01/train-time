// Pure functions only: safe to import from components and easy to unit test.
import type { AmtrakTrain } from './amtrak';
import { localDate } from './time';

export interface StopTime {
  code: string;
  name: string;
  tz: string;
  scheduled: string;
  estimated: string;
}

export interface Departure {
  trainID: string;
  trainNum: number;
  routeName: string;
  destCode: string;
  destName: string;
  /** Departure time at the board's station */
  station: StopTime;
  delayMinutes: number;
  /** 'scheduled' means timetable only: no live data for this train yet */
  status: 'boarding' | 'delayed' | 'on-time' | 'scheduled';
  platform: string;
  /** Later stops on this train, with arrival times: where a rider could get off */
  remainingStops: StopTime[];
}

export interface StationOption {
  code: string;
  name: string;
}

export interface DepartureOptions {
  /** Only departures scheduled on this local date (YYYY-MM-DD, in the station's time zone) */
  date?: string;
  /** Only departures estimated at or after this instant (ISO), e.g. a connection's arrival plus a buffer */
  after?: string;
}

const DELAY_THRESHOLD_MIN = 5;

const minutesBetween = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 60_000) || 0;

export function departuresFromTrains(
  trains: AmtrakTrain[],
  stationCode: string,
  { date, after }: DepartureOptions = {},
): Departure[] {
  const code = stationCode.toUpperCase();
  const departures: Departure[] = [];

  for (const train of trains) {
    const index = train.stations.findIndex((s) => s.code === code);
    if (index === -1) continue;

    const stop = train.stations[index];
    const isLastStop = index === train.stations.length - 1;
    // Already gone, or the train ends here (arrival only, nothing to board)
    if (stop.status === 'Departed' || isLastStop || !stop.schDep) continue;

    const scheduled = stop.schDep;
    const estimated = stop.dep || stop.schDep;
    if (date && localDate(scheduled, stop.tz) !== date) continue;
    if (after && Date.parse(estimated) < Date.parse(after)) continue;

    const delayMinutes = minutesBetween(scheduled, estimated);

    departures.push({
      trainID: train.trainID,
      trainNum: train.trainNum,
      routeName: train.routeName,
      destCode: train.destCode,
      destName: train.destName,
      station: { code: stop.code, name: stop.name, tz: stop.tz, scheduled, estimated },
      delayMinutes,
      status: stop.status === 'Station' ? 'boarding' : delayMinutes > DELAY_THRESHOLD_MIN ? 'delayed' : 'on-time',
      platform: stop.platform,
      remainingStops: train.stations.slice(index + 1).map((s) => ({
        code: s.code,
        name: s.name,
        tz: s.tz,
        scheduled: s.schArr || s.schDep,
        estimated: s.arr || s.dep || s.schArr || s.schDep,
      })),
    });
  }

  // Scheduled order, like a station board: delays show in each row's status
  return departures.sort((a, b) => Date.parse(a.station.scheduled) - Date.parse(b.station.scheduled));
}

// Every station served by the given trains, deduped and sorted by name
export function stationsFromTrains(trains: AmtrakTrain[]): StationOption[] {
  const byCode = new Map<string, string>();
  for (const train of trains) {
    for (const stop of train.stations) {
      if (!byCode.has(stop.code)) byCode.set(stop.code, stop.name);
    }
  }
  return [...byCode]
    .map(([code, name]) => ({ code, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
