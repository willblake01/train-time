import { describe, expect, it } from '@jest/globals';
import type { Departure } from '../departures';
import { buildLeg, checkLeg, connections, findLiveRun, nextLegStart, nextLegSearch, parseTrips, type Leg, type NewLeg, type Trip } from '../trips';

const CT = 'America/Chicago';
const at = (time: string, day = '05') => `2026-11-${day}T${time}:00-06:00`;

const departure: Departure = {
  trainID: '22-5',
  trainNum: 22,
  routeName: 'Texas Eagle',
  destCode: 'CHI',
  destName: 'Chicago',
  station: { code: 'DAL', name: 'Dallas', tz: CT, scheduled: at('14:35'), estimated: at('15:02') },
  delayMinutes: 27,
  status: 'delayed',
  platform: '',
  remainingStops: [
    { code: 'LRK', name: 'Little Rock', tz: CT, scheduled: at('23:50'), estimated: at('23:59') },
    { code: 'STL', name: 'St. Louis', tz: CT, scheduled: at('07:05', '06'), estimated: at('07:20', '06') },
  ],
};

const leg = (id: string, from: [string, string?], to: [string, string?], fromCode = 'A', toCode = 'B'): Leg => ({
  id,
  trainNum: '1',
  trainID: '1-5',
  routeName: 'Route',
  from: { code: fromCode, name: fromCode, tz: CT, time: at(...from) },
  to: { code: toCode, name: toCode, tz: CT, time: at(...to) },
  date: '2026-11-05',
});

describe('buildLeg', () => {
  it('records scheduled times at both ends and the local travel date', () => {
    expect(buildLeg(departure, departure.remainingStops[1])).toEqual({
      trainNum: '22',
      trainID: '22-5',
      routeName: 'Texas Eagle',
      from: { code: 'DAL', name: 'Dallas', tz: CT, time: at('14:35') },
      to: { code: 'STL', name: 'St. Louis', tz: CT, time: at('07:05', '06') },
      date: '2026-11-05',
    });
  });
});

describe('nextLegSearch', () => {
  it('starts at the arrival station, after the arrival plus the buffer', () => {
    const search = nextLegSearch({ to: { code: 'STL', name: 'St. Louis', tz: CT, time: at('07:05', '06') } });
    expect(search.station).toBe('STL');
    expect(Date.parse(search.after)).toBe(Date.parse(at('07:35', '06')));
  });
});

describe('connections', () => {
  it('classifies each layover', () => {
    const legs = [
      leg('1', ['08:00'], ['10:00'], 'A', 'B'),
      leg('2', ['11:00'], ['12:00'], 'B', 'C'), // 60 min at B: ok
      leg('3', ['12:15'], ['13:00'], 'C', 'D'), // 15 min at C: tight
      leg('4', ['12:50'], ['14:00'], 'D', 'E'), // leaves before arrival: missed
      leg('5', ['15:00'], ['16:00'], 'X', 'Y'), // starts somewhere else: gap
    ];
    expect(connections(legs).map((c) => [c.afterLegId, c.status, c.minutes])).toEqual([
      ['1', 'ok', 60],
      ['2', 'tight', 15],
      ['3', 'missed', -10],
      ['4', 'gap', 60],
    ]);
  });

  it('has no connections for a single leg', () => {
    expect(connections([leg('1', ['08:00'], ['10:00'])])).toEqual([]);
  });
});

describe('parseTrips', () => {
  const storedLeg = (from: string) => ({
    trainNum: 22,
    trainID: '22-5',
    routeName: 'Texas Eagle',
    from: { code: 'DAL', name: 'Dallas', tz: CT, time: at(from) },
    to: { code: 'CHI', name: 'Chicago', tz: CT, time: at('23:00') },
    date: '2026-11-05',
    addedAt: 1,
  });

  it('sorts trips newest first and legs by departure', () => {
    const trips = parseTrips({
      old: { name: 'Older', createdAt: 1 },
      new: { name: 'Newer', createdAt: 2, legs: { b: storedLeg('15:00'), a: storedLeg('09:00') } },
    });
    expect(trips.map((t) => t.name)).toEqual(['Newer', 'Older']);
    expect(trips[0].legs.map((l) => l.id)).toEqual(['a', 'b']);
    expect(trips[0].legs[0].trainNum).toBe('22');
    expect(trips[1].legs).toEqual([]);
  });

  it('skips malformed trips and legs', () => {
    const trips = parseTrips({
      bad: { createdAt: 3 },
      ok: { name: 'Trip', createdAt: 1, legs: { good: storedLeg('09:00'), broken: { trainNum: 1 } } },
    });
    expect(trips).toHaveLength(1);
    expect(trips[0].legs.map((l) => l.id)).toEqual(['good']);
  });

  it('handles an empty database', () => {
    expect(parseTrips(null)).toEqual([]);
  });
});

describe('nextLegStart', () => {
  const base: Trip = { id: 't', name: 'Trip', createdAt: 1, legs: [] };

  it('starts at the last leg\'s arrival station, after it arrives', () => {
    const trip = { ...base, legs: [leg('1', ['08:00'], ['10:00'], 'CHI', 'STL')] };
    expect(nextLegStart(trip)).toEqual({ station: 'STL', after: at('10:00') });
  });

  it('starts at the trip\'s departure station when there are no legs', () => {
    expect(nextLegStart({ ...base, from: 'AUS' })).toEqual({ station: 'AUS' });
  });

  it('has nothing to suggest for an empty trip with no departure', () => {
    expect(nextLegStart(base)).toBeNull();
  });
});

describe('checkLeg', () => {
  const names: Record<string, string> = { AUS: 'Austin', SAS: 'San Antonio', CHI: 'Chicago' };
  const name = (code: string) => names[code] ?? code;
  const trip = (legs: Leg[], from?: string): Trip => ({ id: 't', name: 'Texas trip', createdAt: 1, legs, ...(from && { from }) });
  const newLeg = (from: [string, string?], fromCode: string, toCode = 'NOL'): NewLeg => {
    const { trainNum, trainID, routeName, from: start, to, date } = leg('x', from, ['23:00'], fromCode, toCode);
    return { trainNum, trainID, routeName, from: start, to, date };
  };
  const first = leg('1', ['08:00'], ['12:00'], 'AUS', 'SAS');

  it('accepts a leg that leaves from the last arrival station, with time to spare', () => {
    expect(checkLeg(trip([first]), newLeg(['13:00'], 'SAS'), name)).toEqual({});
  });

  it('rejects a leg that leaves from a different station', () => {
    expect(checkLeg(trip([first]), newLeg(['13:00'], 'CHI'), name).error).toBe(
      'The next leg of Texas trip must leave from SAS, where leg 1 arrives.',
    );
  });

  it('rejects a leg that leaves before the last leg arrives', () => {
    expect(checkLeg(trip([first]), newLeg(['11:00'], 'SAS'), name).error).toMatch(/leaves SAS before leg 1 arrives/);
  });

  it('allows a tight connection but warns about it', () => {
    const result = checkLeg(trip([first]), newLeg(['12:20'], 'SAS'), name);
    expect(result.error).toBeUndefined();
    expect(result.warning).toBe('Tight connection: only 20 min to change trains in SAS.');
  });

  it('requires the first leg to leave from the trip\'s departure station', () => {
    expect(checkLeg(trip([], 'AUS'), newLeg(['09:00'], 'CHI'), name).error).toBe(
      'Texas trip starts in Austin. Pick a train leaving from there.',
    );
    expect(checkLeg(trip([], 'AUS'), newLeg(['09:00'], 'AUS'), name)).toEqual({});
  });

  it('allows any first leg when the trip has no departure station', () => {
    expect(checkLeg(trip([]), newLeg(['09:00'], 'CHI'), name)).toEqual({});
  });
});

describe('parseTrips stations', () => {
  it('keeps the trip\'s departure and destination codes', () => {
    const [trip] = parseTrips({ a: { name: 'Trip', createdAt: 1, from: 'AUS', to: 'NOL' } });
    expect(trip).toMatchObject({ from: 'AUS', to: 'NOL' });
  });
});

describe('findLiveRun', () => {
  const live = (trainID: string, chiTime: string) => ({
    trainID,
    trainNum: 3,
    routeName: 'Southwest Chief',
    state: 'Active',
    origCode: 'CHI',
    origName: 'Chicago',
    destCode: 'LAX',
    destName: 'Los Angeles',
    lat: 0,
    lon: 0,
    updatedAt: '',
    stops: [
      { code: 'CHI', scheduled: chiTime },
      { code: 'KCY', scheduled: '2026-11-26T04:39:00Z' },
    ],
  });
  const leg = { trainID: '3-25', from: { code: 'CHI', name: 'Chicago', tz: CT, time: '2026-11-25T19:30:00.000Z' } };

  it('matches by train ID', () => {
    expect(findLiveRun([live('3-24', '2026-11-24T19:30:00Z'), live('3-25', '2026-11-25T19:30:00Z')], leg)?.trainID).toBe('3-25');
  });

  it('falls back to the scheduled time at the boarding station when IDs differ', () => {
    expect(findLiveRun([live('3-99', '2026-11-25T19:30:00-00:00')], leg)?.trainID).toBe('3-99');
  });

  it('finds nothing when the run is not live', () => {
    expect(findLiveRun([live('3-24', '2026-11-24T19:30:00Z')], leg)).toBeUndefined();
  });
});
