// What a linked device (like an LED strip) shows: the rider's next leg across
// all trips, with live estimates and the risk to the next connection.
// Pure: no Firebase or network calls, so it's easy to test.
import type { LiveStatus } from './amtrak';
import { CONNECTION_BUFFER_MIN, findLiveRun, type Leg, type Trip } from './trips';

export type DevicePhase = 'none' | 'upcoming' | 'onBoard';

/** Same rules as the trip planner, but using live estimates */
export type ConnectionRisk = 'ok' | 'tight' | 'missed';

export interface DeviceLeg {
  tripId: string;
  tripName: string;
  trainNum: string;
  routeName: string;
  from: { code: string; name: string; tz: string };
  to: { code: string; name: string; tz: string };
  scheduledDeparture: string;
  estimatedDeparture: string;
  scheduledArrival: string;
  estimatedArrival: string;
  delayMinutes: number;
  /** Whether the estimates come from a live run, not just the timetable */
  live: boolean;
}

export interface DeviceConnection {
  /** Where the rider changes trains */
  station: string;
  nextTrainNum: string;
  /** Estimated minutes to change trains (negative when it's already missed) */
  minutes: number;
  risk: ConnectionRisk;
}

export interface DeviceStatus {
  version: 1;
  generatedAt: number;
  phase: DevicePhase;
  leg?: DeviceLeg;
  /** The transfer after this leg, when the trip has one */
  connection?: DeviceConnection;
}

/** Live trains for each train number, as stored by the refresh endpoint */
export type LiveByTrain = Record<string, LiveStatus[] | undefined>;

const MINUTE = 60_000;

const addMinutes = (iso: string, minutes: number) => new Date(Date.parse(iso) + minutes * MINUTE).toISOString();

interface Estimate {
  delayMinutes: number;
  departure: string;
  arrival: string;
  live: boolean;
}

// Amtraker reports the delay at the train's next stop, so that delay is
// carried forward to the rider's stops. Early running isn't counted: trains
// don't leave stations early, and planning on an early arrival is risky.
export function estimateLeg(leg: Leg, live: LiveByTrain): Estimate {
  const run = findLiveRun(live[leg.trainNum] ?? [], leg);
  const delayMinutes = Math.max(0, run?.nextStop?.delayMinutes ?? 0);
  return {
    delayMinutes,
    departure: addMinutes(leg.from.time, delayMinutes),
    arrival: addMinutes(leg.to.time, delayMinutes),
    live: Boolean(run),
  };
}

export function connectionRisk(minutes: number, bufferMin = CONNECTION_BUFFER_MIN): ConnectionRisk {
  if (minutes < 0) return 'missed';
  if (minutes < bufferMin) return 'tight';
  return 'ok';
}

const minutesBetween = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / MINUTE);

// The leg the rider is on now, or their next one: the earliest leg (across
// every trip) that hasn't arrived yet by its estimated arrival time.
export function deviceStatus(trips: Trip[], live: LiveByTrain, now: number): DeviceStatus {
  const legs = trips
    .flatMap((trip) => trip.legs.map((leg, index) => ({ trip, leg, index })))
    .sort((a, b) => Date.parse(a.leg.from.time) - Date.parse(b.leg.from.time));

  for (const { trip, leg, index } of legs) {
    const estimate = estimateLeg(leg, live);
    if (Date.parse(estimate.arrival) <= now) continue;

    const status: DeviceStatus = {
      version: 1,
      generatedAt: now,
      phase: Date.parse(estimate.departure) > now ? 'upcoming' : 'onBoard',
      leg: {
        tripId: trip.id,
        tripName: trip.name,
        trainNum: leg.trainNum,
        routeName: leg.routeName,
        from: { code: leg.from.code, name: leg.from.name, tz: leg.from.tz },
        to: { code: leg.to.code, name: leg.to.name, tz: leg.to.tz },
        scheduledDeparture: leg.from.time,
        estimatedDeparture: estimate.departure,
        scheduledArrival: leg.to.time,
        estimatedArrival: estimate.arrival,
        delayMinutes: estimate.delayMinutes,
        live: estimate.live,
      },
    };

    // Legs within a trip are sorted, so the next one is the transfer
    const next = trip.legs[index + 1];
    if (next) {
      const minutes = minutesBetween(estimate.arrival, estimateLeg(next, live).departure);
      status.connection = { station: leg.to.name, nextTrainNum: next.trainNum, minutes, risk: connectionRisk(minutes) };
    }

    return status;
  }

  return { version: 1, generatedAt: now, phase: 'none' };
}

/** Legs whose live data could matter right now: not yet arrived (with a margin for delays) */
export function legsNeedingLive(trips: Trip[], now: number, marginMs = 24 * 60 * MINUTE): Leg[] {
  return trips
    .flatMap((trip) => trip.legs)
    .filter((leg) => Date.parse(leg.to.time) + marginMs > now && Date.parse(leg.from.time) - 2 * marginMs < now);
}
