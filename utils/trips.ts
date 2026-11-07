// Pure trip logic: no Firebase or network calls, so it's safe anywhere and easy to test.
import { z } from 'zod';
import type { LiveStatus } from './amtrak';
import type { Departure, StopTime } from './departures';
import { localDate } from './time';

/** Minimum time to change trains at a station */
export const CONNECTION_BUFFER_MIN = 30;

export interface LegStop {
    code: string;
    name: string;
    tz: string;
    /** Scheduled time: departure at `from`, arrival at `to` (ISO) */
    time: string;
}

export interface Leg {
    id: string;
    trainNum: string;
    /** Identifies one specific run, so live data matches the right day's train */
    trainID: string;
    routeName: string;
    from: LegStop;
    to: LegStop;
    /** Local travel date at the boarding station (YYYY-MM-DD) */
    date: string;
}

export type NewLeg = Omit<Leg, 'id'>;

export interface Trip {
    id: string;
    name: string;
    createdAt: number;
    /** Departure station code chosen in New Trip, if any */
    from?: string;
    /** Destination station code chosen in New Trip, if any */
    to?: string;
    legs: Leg[];
}

export type ConnectionStatus = 'ok' | 'tight' | 'missed' | 'gap';

export interface Connection {
    afterLegId: string;
    /** Where the previous leg arrives */
    station: string;
    /** Where the next leg departs (differs from `station` when status is 'gap') */
    nextStation: string;
    minutes: number;
    status: ConnectionStatus;
}

// A leg from a board departure plus the stop where the rider gets off.
// Stores scheduled times so a trip still reads correctly with no live data.
export function buildLeg(departure: Departure, alight: StopTime): NewLeg {
    const board = departure.station;
    return {
        trainNum: String(departure.trainNum),
        trainID: departure.trainID,
        routeName: departure.routeName,
        from: { code: board.code, name: board.name, tz: board.tz, time: board.scheduled },
        to: { code: alight.code, name: alight.name, tz: alight.tz, time: alight.scheduled },
        date: localDate(board.scheduled, board.tz),
    };
}

// Where and when to look for the next leg: the arrival station, from the
// arrival time plus a buffer to change trains
export function nextLegSearch(leg: Pick<Leg, 'to'>, bufferMin = CONNECTION_BUFFER_MIN) {
    const after = new Date(Date.parse(leg.to.time) + bufferMin * 60_000).toISOString();
    return { station: leg.to.code, stationName: leg.to.name, tz: leg.to.tz, after };
}

const minutesBetween = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 60_000);

// The layover between each pair of consecutive legs (legs must be sorted)
export function connections(legs: Leg[], bufferMin = CONNECTION_BUFFER_MIN): Connection[] {
    return legs.slice(1).map((next, i) => {
        const prev = legs[i];
        const minutes = minutesBetween(prev.to.time, next.from.time);
        let status: ConnectionStatus = 'ok';
        if (prev.to.code !== next.from.code) status = 'gap';
        else if (minutes < 0) status = 'missed';
        else if (minutes < bufferMin) status = 'tight';
        return { afterLegId: prev.id, station: prev.to.name, nextStation: next.from.name, minutes, status };
    });
}

// Where the trip's next leg has to start: the last leg's arrival station, no
// earlier than its arrival time. With no legs yet, the trip's departure station.
// Null when there's nothing to go on (no legs and no departure station).
export function nextLegStart(trip: Trip): { station: string; after?: string } | null {
    const last = trip.legs.at(-1);
    if (last) return { station: last.to.code, after: last.to.time };
    return trip.from ? { station: trip.from } : null;
}

export interface LegCheck {
    /** Why the leg can't be added; Save stays disabled */
    error?: string;
    /** Allowed, but worth knowing (e.g. a tight connection) */
    warning?: string;
}

// Legs are added in order and must connect: each one leaves from where the
// previous one arrives, after it arrives. The first leg must leave from the
// trip's departure station when one was chosen.
export function checkLeg(
    trip: Trip,
    leg: NewLeg,
    stationName: (code: string) => string = (code) => code,
    bufferMin = CONNECTION_BUFFER_MIN,
): LegCheck {
    const last = trip.legs.at(-1);

    if (!last) {
        if (trip.from && leg.from.code !== trip.from) {
            return { error: `${trip.name} starts in ${stationName(trip.from)}. Pick a train leaving from there.` };
        }
        return {};
    }

    if (leg.from.code !== last.to.code) {
        return { error: `The next leg of ${trip.name} must leave from ${last.to.name}, where leg ${trip.legs.length} arrives.` };
    }

    const minutes = minutesBetween(last.to.time, leg.from.time);
    if (minutes < 0) {
        return { error: `This train leaves ${last.to.name} before leg ${trip.legs.length} arrives there.` };
    }
    if (minutes < bufferMin) {
        return { warning: `Tight connection: only ${minutes} min to change trains in ${last.to.name}.` };
    }
    return {};
}

const LIVE_MATCH_WINDOW_MS = 90 * 60_000;

// The live run a saved leg is riding, if it's running now. Matches the train
// ID first, then falls back to the train number plus its scheduled time at the
// leg's boarding station, which works however the ID was built.
export function findLiveRun(trains: LiveStatus[], leg: Pick<Leg, 'trainID' | 'from'>): LiveStatus | undefined {
  return (
    trains.find((t) => t.trainID === leg.trainID) ??
    trains.find((t) =>
      t.stops?.some((s) => s.code === leg.from.code && Math.abs(Date.parse(s.scheduled) - Date.parse(leg.from.time)) <= LIVE_MATCH_WINDOW_MS),
    )
  );
}

// --- Reading trips from Firebase (user-written data, so validate it) ---

const LegStopSchema = z.object({ code: z.string(), name: z.string(), tz: z.string(), time: z.string() });

const StoredLegSchema = z.object({
    trainNum: z.coerce.string(),
    trainID: z.string(),
    routeName: z.string().catch(''),
    from: LegStopSchema,
    to: LegStopSchema,
    date: z.string().catch(''),
});

const StoredTripSchema = z.object({
    name: z.string(),
    createdAt: z.number().catch(0),
    from: z.string().optional().catch(undefined),
    to: z.string().optional().catch(undefined),
    legs: z.record(z.string(), z.unknown()).optional(),
});

const byDeparture = (a: Leg, b: Leg) => Date.parse(a.from.time) - Date.parse(b.from.time);

// Turns the raw `trips` node into sorted trips (newest first) with sorted legs.
// Malformed trips or legs are skipped rather than breaking the whole list.
export function parseTrips(value: unknown): Trip[] {
    if (!value || typeof value !== 'object') return [];

    const trips: Trip[] = [];
    for (const [id, raw] of Object.entries(value)) {
        const trip = StoredTripSchema.safeParse(raw);
        if (!trip.success) continue;

        const legs: Leg[] = [];
        for (const [legId, rawLeg] of Object.entries(trip.data.legs ?? {})) {
            const leg = StoredLegSchema.safeParse(rawLeg);
            if (leg.success) legs.push({ id: legId, ...leg.data });
        }

        const { name, createdAt, from, to } = trip.data;
        trips.push({ id, name, createdAt, ...(from && { from }), ...(to && { to }), legs: legs.sort(byDeparture) });
    }

    return trips.sort((a, b) => b.createdAt - a.createdAt);
}
