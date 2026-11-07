import { describe, expect, it } from '@jest/globals';
import type { Departure } from '../../../../Downloads/timetable-step/utils/departures';
import { formatTime } from '../../../../Downloads/timetable-step/utils/time';
import {
  addDays,
  daysBetween,
  mergeLiveDepartures,
  scheduledDepartures,
  withoutDeparted,
  scheduleStations,
  serviceDayStart,
  serviceRunsOn,
  stopTimeToIso,
} from '../../../../Downloads/timetable-step/utils/timetable';
import type { Schedule } from '../timetableTypes';

const h = (hours: number, minutes = 0) => hours * 3600 + minutes * 60;

// Modeled on the real feed: times in Eastern, a Sunset Limited that runs
// Mon/Wed/Sat and passes midnight twice, boarding-only and drop-off-only
// stops, and a daily train through Arizona.
const schedule: Schedule = {
  version: 'test',
  agencyTimezone: 'America/New_York',
  startDate: '2026-11-01',
  endDate: '2027-11-01',
  stations: {
    NOL: { name: 'New Orleans', tz: 'America/Chicago' },
    DRP: { name: 'Drop-off Only', tz: 'America/Chicago' },
    PIK: { name: 'Pickup Only', tz: 'America/Chicago' },
    SAS: { name: 'San Antonio', tz: 'America/Chicago' },
    LAX: { name: 'Los Angeles', tz: 'America/Los_Angeles' },
    CHI: { name: 'Chicago', tz: 'America/Chicago' },
    FLG: { name: 'Flagstaff', tz: 'America/Phoenix' },
  },
  services: {
    SUNSET: { days: '1010010', start: '2026-11-16', end: '2027-11-01' },
    DAILY: { days: '1111111', start: '2026-11-01', end: '2027-11-01' },
  },
  trips: [
    {
      trainNum: '1',
      route: 'Sunset Limited',
      headsign: 'Los Angeles',
      service: 'SUNSET',
      stops: [
        ['NOL', h(10), h(10), 1, 0],
        ['DRP', h(20), h(20), 0, 1],
        ['PIK', h(22), h(22), 1, 0],
        ['SAS', h(27, 45), h(28, 15), 1, 1],
        ['LAX', h(56, 35), h(56, 35), 1, 1],
      ],
    },
    {
      trainNum: '3',
      route: 'Southwest Chief',
      headsign: 'Los Angeles',
      service: 'DAILY',
      stops: [
        ['CHI', h(15, 30), h(15, 30), 1, 0],
        ['FLG', h(40), h(40), 1, 1],
        ['LAX', h(58, 27), h(58, 27), 1, 1],
      ],
    },
  ],
};

describe('date helpers', () => {
  it('adds and counts days across month and year ends', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-11-01', -1)).toBe('2026-10-31');
    expect(daysBetween('2026-11-25', '2026-11-27')).toBe(2);
  });
});

describe('serviceRunsOn', () => {
  const sunset = schedule.services.SUNSET;

  it('follows the weekday pattern within the date range', () => {
    expect(serviceRunsOn(sunset, '2026-11-16')).toBe(true); // Monday
    expect(serviceRunsOn(sunset, '2026-11-17')).toBe(false); // Tuesday
    expect(serviceRunsOn(sunset, '2026-11-21')).toBe(true); // Saturday
  });

  it('does not run outside its date range', () => {
    expect(serviceRunsOn(sunset, '2026-11-09')).toBe(false); // a Monday, before it starts
    expect(serviceRunsOn(sunset, '2027-11-03')).toBe(false); // a Wednesday, after it ends
  });
});

describe('serviceDayStart', () => {
  it('is midnight in the agency time zone on a normal day', () => {
    expect(new Date(serviceDayStart('2026-11-25', 'America/New_York')).toISOString()).toBe('2026-11-25T05:00:00.000Z');
  });

  it('is noon minus 12 hours on daylight saving change days', () => {
    // Clocks spring forward on Mar 14, 2027: noon EDT is 16:00 UTC
    expect(new Date(serviceDayStart('2027-03-14', 'America/New_York')).toISOString()).toBe('2027-03-14T04:00:00.000Z');
    // Clocks fall back on Nov 1, 2026: noon EST is 17:00 UTC
    expect(new Date(serviceDayStart('2026-11-01', 'America/New_York')).toISOString()).toBe('2026-11-01T05:00:00.000Z');
  });
});

describe('stopTimeToIso', () => {
  it('handles times days past midnight, like the Sunset Limited reaching LA at "56:35"', () => {
    const arrival = stopTimeToIso('2026-11-16', h(56, 35), 'America/New_York');
    expect(arrival).toBe('2026-11-18T13:35:00.000Z');
    expect(formatTime(arrival, 'America/Los_Angeles')).toBe('5:35 AM');
  });
});

describe('scheduledDepartures', () => {
  it('lists a train leaving on its scheduled weekday, in the station\'s local time', () => {
    const [departure] = scheduledDepartures(schedule, 'NOL', '2026-11-16');
    expect(departure).toMatchObject({ trainNum: 1, routeName: 'Sunset Limited', destName: 'Los Angeles', status: 'scheduled' });
    expect(formatTime(departure.station.scheduled, 'America/Chicago')).toBe('9:00 AM'); // "10:00" Eastern
  });

  it('lists nothing on days the train does not run', () => {
    expect(scheduledDepartures(schedule, 'NOL', '2026-11-17')).toEqual([]);
  });

  it('puts an after-midnight departure on the next local date', () => {
    // Leaves San Antonio at "28:15" Eastern on the Monday service: 3:15 AM Central on Tuesday
    expect(scheduledDepartures(schedule, 'SAS', '2026-11-16')).toEqual([]);
    const [departure] = scheduledDepartures(schedule, 'sas', '2026-11-17');
    expect(formatTime(departure.station.scheduled, 'America/Chicago')).toBe('3:15 AM');
  });

  it('skips stops where riders cannot board, and the end of the line', () => {
    expect(scheduledDepartures(schedule, 'DRP', '2026-11-16')).toEqual([]);
    expect(scheduledDepartures(schedule, 'LAX', '2026-11-18')).toEqual([]);
  });

  it('only offers stops where riders can get off', () => {
    const [departure] = scheduledDepartures(schedule, 'NOL', '2026-11-16');
    expect(departure.remainingStops.map((s) => s.code)).toEqual(['DRP', 'SAS', 'LAX']);
  });

  it('builds a train ID from the train number and its starting day, like Amtraker', () => {
    expect(scheduledDepartures(schedule, 'NOL', '2026-11-16')[0].trainID).toBe('1-16');
    expect(scheduledDepartures(schedule, 'SAS', '2026-11-17')[0].trainID).toBe('1-16');
  });

  it('shows Arizona times without daylight saving', () => {
    // "40:00" Eastern on Jul 10 is 4:00 PM EDT on Jul 11: 1:00 PM in Arizona (Mountain daylight time would say 2:00 PM)
    const [departure] = scheduledDepartures(schedule, 'FLG', '2027-07-11');
    expect(formatTime(departure.station.scheduled, 'America/Phoenix')).toBe('1:00 PM');
  });

  it('filters to trains leaving after a given time', () => {
    const departures = scheduledDepartures(schedule, 'CHI', '2026-11-25');
    expect(departures).toHaveLength(1);
    expect(scheduledDepartures(schedule, 'CHI', '2026-11-25', { after: departures[0].station.scheduled })).toHaveLength(1);
    expect(scheduledDepartures(schedule, 'CHI', '2026-11-25', { after: '2026-11-25T23:00:00Z' })).toEqual([]);
  });

  it('returns nothing for an unknown station', () => {
    expect(scheduledDepartures(schedule, 'ZZZ', '2026-11-25')).toEqual([]);
  });
});

describe('withoutDeparted', () => {
  it('drops trains whose scheduled departure has passed', () => {
    const departures = scheduledDepartures(schedule, 'CHI', '2026-11-25');
    const leaves = Date.parse(departures[0].station.scheduled);
    expect(withoutDeparted(departures, leaves - 60_000)).toHaveLength(1);
    expect(withoutDeparted(departures, leaves + 60_000)).toEqual([]);
  });
});

describe('scheduleStations', () => {
  it('lists every station by name', () => {
    expect(scheduleStations(schedule).map((s) => s.code)).toEqual(['CHI', 'DRP', 'FLG', 'LAX', 'NOL', 'PIK', 'SAS']);
  });
});

describe('mergeLiveDepartures', () => {
  const at = (iso: string) => Date.parse(iso);
  const departure = (trainNum: number, scheduled: string, extra: Partial<Departure> = {}): Departure => ({
    trainID: `${trainNum}-25`,
    trainNum,
    routeName: 'Timetable Route',
    destCode: 'LAX',
    destName: 'Los Angeles',
    station: { code: 'CHI', name: 'Chicago', tz: 'America/Chicago', scheduled, estimated: scheduled },
    delayMinutes: 0,
    status: 'scheduled' as const,
    platform: '',
    remainingStops: [
      { code: 'KCY', name: 'Kansas City', tz: 'America/Chicago', scheduled, estimated: scheduled },
      { code: 'LAX', name: 'Los Angeles', tz: 'America/Los_Angeles', scheduled, estimated: scheduled },
    ],
    ...extra,
  });

  it('uses live delay, status, and track for a scheduled train that is running', () => {
    const planned = departure(3, '2026-11-25T19:30:00Z');
    const live = departure(3, '2026-11-25T19:30:00-00:00', {
      trainID: '3-25',
      routeName: 'Southwest Chief',
      status: 'delayed',
      delayMinutes: 25,
      platform: '18',
      remainingStops: [
        { code: 'NPV', name: 'Naperville', tz: 'America/Chicago', scheduled: '', estimated: '' },
        { code: 'KCY', name: 'Kansas City', tz: 'America/Chicago', scheduled: '', estimated: '' },
      ],
    });
    const [merged] = mergeLiveDepartures([planned], [live], at('2026-11-25T19:00:00Z'));
    expect(merged).toMatchObject({ status: 'delayed', delayMinutes: 25, platform: '18', routeName: 'Timetable Route' });
    // Naperville is drop-off-only in the timetable, so it isn't offered
    expect(merged.remainingStops.map((s) => s.code)).toEqual(['KCY']);
  });

  it('drops a scheduled train that already left (no live match, time has passed)', () => {
    expect(mergeLiveDepartures([departure(3, '2026-11-25T19:30:00Z')], [], at('2026-11-25T20:00:00Z'))).toEqual([]);
  });

  it('keeps upcoming scheduled trains that are not in the live feed yet', () => {
    const planned = departure(48, '2026-11-26T03:30:00Z');
    expect(mergeLiveDepartures([planned], [], at('2026-11-25T20:00:00Z'))).toEqual([planned]);
  });

  it('does not mix up runs of the same train a day apart', () => {
    const planned = departure(3, '2026-11-25T19:30:00Z');
    const yesterdaysRun = departure(3, '2026-11-24T19:30:00Z', { status: 'delayed' });
    const merged = mergeLiveDepartures([planned], [yesterdaysRun], at('2026-11-25T19:00:00Z'));
    expect(merged.map((d) => d.status)).toEqual(['delayed', 'scheduled']);
  });

  it('adds live trains the timetable does not list', () => {
    const extra = departure(9999, '2026-11-25T21:00:00Z', { status: 'on-time' });
    expect(mergeLiveDepartures([], [extra], at('2026-11-25T19:00:00Z'))).toEqual([extra]);
  });
});
