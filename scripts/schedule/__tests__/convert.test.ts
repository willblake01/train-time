import { describe, expect, it } from '@jest/globals';
import {
  ConversionError,
  convertGtfs,
  parseGtfsDate,
  parseGtfsTime,
  serializeSchedule,
  summarizeSchedule,
  validateSchedule,
} from '../convert';

// A tiny feed with the same quirks as Amtrak's real one: times past 24 hours,
// boarding-only and drop-off-only stops, Thruway buses, a partner railroad,
// a quoted station name, and stop_times rows out of order.
const feed = (overrides: Record<string, string> = {}) => ({
  'agency.txt': [
    'agency_id,agency_name,agency_url,agency_timezone,agency_lang',
    '51,Amtrak,http://www.amtrak.com,America/New_York,en',
    '157,Via Rail Canada,https://www.viarail.ca,America/New_York,en',
  ].join('\n'),
  'routes.txt': [
    'route_id,agency_id,route_short_name,route_long_name,route_type',
    '100,51,,Sunset Limited,2',
    '200,51,,Amtrak Thruway Connecting Service,3',
    '300,157,,Maple Leaf,2',
  ].join('\n'),
  'trips.txt': [
    'route_id,service_id,trip_id,trip_short_name,direction_id,shape_id,trip_headsign',
    '100,SVC1,T1,1,0,,Los Angeles',
    '200,SVC1,BUS,9999,0,,Somewhere',
    '300,SVC1,VIA,63,0,,Toronto',
  ].join('\n'),
  'stops.txt': [
    'stop_id,stop_code,stop_name,stop_url,stop_timezone,stop_lat,stop_lon',
    'NOL,NOL,New Orleans Union Passenger Terminal,,America/Chicago,0,0',
    'SAS,SAS,"San Antonio, TX",,America/Chicago,0,0',
    'LAX,LAX,Los Angeles,,America/Los_Angeles,0,0',
    'TOR,TOR,Toronto,,America/New_York,0,0',
  ].join('\n'),
  'stop_times.txt': [
    'trip_id,arrival_time,departure_time,stop_id,stop_sequence,pickup_type,drop_off_type,timepoint',
    'T1,56:35:00,56:35:00,LAX,3,0,0,1',
    'T1,10:00:00,10:00:00,NOL,1,0,1,1',
    'T1,27:45:00,28:15:00,SAS,2,0,0,1',
    'BUS,10:00:00,10:00:00,NOL,1,0,0,1',
    'BUS,11:00:00,11:00:00,SAS,2,0,0,1',
    'VIA,10:00:00,10:00:00,TOR,1,0,0,1',
    'VIA,12:00:00,12:00:00,TOR,2,0,0,1',
  ].join('\n'),
  'calendar.txt': [
    'service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date',
    'SVC1,1,0,1,0,0,1,0,20261116,20270310',
  ].join('\n'),
  'feed_info.txt': [
    'feed_publisher_name,feed_publisher_url,feed_lang,feed_start_date,feed_end_date,feed_version',
    'Amtrak,http://www.amtrak.com,en,20261107,20271101,20261106',
  ].join('\n'),
  ...overrides,
});

describe('parseGtfsTime', () => {
  it('counts hours past midnight, as GTFS does for overnight trains', () => {
    expect(parseGtfsTime('10:00:00')).toBe(36_000);
    expect(parseGtfsTime('56:35:00')).toBe(56 * 3600 + 35 * 60);
    expect(parseGtfsTime('80:05:30')).toBe(80 * 3600 + 5 * 60 + 30);
  });

  it('rejects malformed times', () => {
    expect(() => parseGtfsTime('7:5')).toThrow(ConversionError);
    expect(() => parseGtfsTime('10:61:00')).toThrow(ConversionError);
  });
});

describe('parseGtfsDate', () => {
  it('converts YYYYMMDD to ISO dates', () => {
    expect(parseGtfsDate('20261101')).toBe('2026-11-01');
    expect(() => parseGtfsDate('2026-11-01')).toThrow(ConversionError);
  });
});

describe('convertGtfs', () => {
  const schedule = convertGtfs(feed());

  it('keeps only Amtrak trains: no Thruway buses or partner railroads', () => {
    expect(schedule.trips.map((t) => t.trainNum)).toEqual(['1']);
    expect(Object.keys(schedule.stations)).toEqual(['LAX', 'NOL', 'SAS']);
  });

  it('records the trip in stop order with times in seconds past the service day start', () => {
    expect(schedule.trips[0]).toEqual({
      trainNum: '1',
      route: 'Sunset Limited',
      headsign: 'Los Angeles',
      service: 'SVC1',
      stops: [
        ['NOL', 36_000, 36_000, 1, 0],
        ['SAS', 27 * 3600 + 45 * 60, 28 * 3600 + 15 * 60, 1, 1],
        ['LAX', 56 * 3600 + 35 * 60, 56 * 3600 + 35 * 60, 1, 1],
      ],
    });
  });

  it('marks stops where you cannot board or get off', () => {
    const [nol] = schedule.trips[0].stops;
    expect(nol[3]).toBe(1); // can board
    expect(nol[4]).toBe(0); // drop_off_type 1: no getting off here
  });

  it('keeps station names, including quoted ones, and their time zones', () => {
    expect(schedule.stations.SAS).toEqual({ name: 'San Antonio, TX', tz: 'America/Chicago' });
    expect(schedule.stations.LAX.tz).toBe('America/Los_Angeles');
  });

  it('corrects Arizona stations to Arizona time, which has no daylight saving', () => {
    const arizona = convertGtfs(
      feed({
        'stops.txt': feed()['stops.txt'] + '\nFLG,FLG,Flagstaff,,America/Denver,0,0',
        'stop_times.txt': feed()['stop_times.txt'].replace('T1,56:35:00,56:35:00,LAX,3,0,0,1', 'T1,40:00:00,40:00:00,FLG,3,0,0,1\nT1,56:35:00,56:35:00,LAX,4,0,0,1'),
      }),
    );
    expect(arizona.stations.FLG.tz).toBe('America/Phoenix');
  });

  it('records which days each service runs, Monday first', () => {
    expect(schedule.services.SVC1).toEqual({ days: '1010010', start: '2026-11-16', end: '2027-03-10' });
  });

  it('records the feed version, time zone, and date range', () => {
    expect(schedule).toMatchObject({
      version: '20261106',
      agencyTimezone: 'America/New_York',
      startDate: '2026-11-16',
      endDate: '2027-03-10',
    });
  });

  it('fails clearly when a required file is missing', () => {
    const { 'stop_times.txt': _omit, ...rest } = feed();
    void _omit;
    expect(() => convertGtfs(rest)).toThrow('Feed is missing stop_times.txt');
  });

  it('fails clearly when a trip references a station that does not exist', () => {
    const broken = feed({
      'stop_times.txt': ['trip_id,arrival_time,departure_time,stop_id,stop_sequence', 'T1,10:00:00,10:00:00,NOL,1', 'T1,11:00:00,11:00:00,XXX,2'].join('\n'),
    });
    expect(() => convertGtfs(broken)).toThrow('unknown station XXX');
  });
});

describe('validateSchedule', () => {
  const schedule = convertGtfs(feed());
  const relaxed = { minTrips: 1, minStations: 1, minDaysAhead: 30 };

  it('accepts a schedule that covers the coming weeks', () => {
    expect(validateSchedule(schedule, '2026-12-01', relaxed)).toEqual([]);
  });

  it('rejects a schedule that ends too soon', () => {
    expect(validateSchedule(schedule, '2027-03-01', relaxed)).toEqual(['Schedule ends 2027-03-10, before 2027-03-31']);
  });

  it('rejects a suspiciously small feed', () => {
    expect(validateSchedule(schedule, '2026-12-01')).toEqual([
      'Only 1 trips (expected at least 500)',
      'Only 3 stations (expected at least 300)',
    ]);
  });
});

describe('serializeSchedule and summarizeSchedule', () => {
  const schedule = convertGtfs(feed());

  it('round-trips through JSON with one trip per line', () => {
    const text = serializeSchedule(schedule);
    expect(JSON.parse(text)).toEqual(schedule);
    expect(text.split('\n').filter((line) => line.includes('"trainNum"'))).toHaveLength(1);
  });

  it('lists train numbers added and removed since the last version', () => {
    const previous = { ...schedule, version: '20261030', trips: [{ ...schedule.trips[0], trainNum: '2' }] };
    const summary = summarizeSchedule(schedule, previous);
    expect(summary).toContain('feed version **20261106**');
    expect(summary).toContain('New train numbers: 1');
    expect(summary).toContain('Train numbers no longer scheduled: 2');
  });
});
