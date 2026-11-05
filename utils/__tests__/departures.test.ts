import { describe, expect, it } from '@jest/globals';
import { parseTrainResponse } from '../amtrak';
import { departuresFromTrains, stationsFromTrains } from '../departures';

const CT = 'America/Chicago';

// A stop where the train arrives and leaves at the given local Central times
const stop = (code: string, name: string, sch: string, est = sch, status = 'Enroute') => ({
  code,
  name,
  tz: CT,
  schArr: `2026-11-05T${sch}:00-06:00`,
  schDep: `2026-11-05T${sch}:00-06:00`,
  arr: `2026-11-05T${est}:00-06:00`,
  dep: `2026-11-05T${est}:00-06:00`,
  arrCmnt: '',
  depCmnt: '',
  status,
  platform: '',
});

const train = (trainNum: number, routeName: string, stations: unknown[]) => ({
  trainID: `${trainNum}-5`,
  trainNum,
  routeName,
  trainState: 'Active',
  origCode: 'ORG',
  origName: 'Origin',
  destCode: 'DST',
  destName: 'Destination',
  provider: 'Amtrak',
  lat: 0,
  lon: 0,
  updatedAt: '',
  stations,
});

const parse = (...trains: ReturnType<typeof train>[]) =>
  parseTrainResponse(Object.fromEntries(trains.map((t) => [String(t.trainNum), [t]])));

describe('departuresFromTrains', () => {
  const trains = parse(
    train(22, 'Texas Eagle', [stop('FTW', 'Fort Worth', '12:00', '12:10', 'Departed'), stop('DAL', 'Dallas', '14:35', '15:02'), stop('LRK', 'Little Rock', '20:00')]),
    train(821, 'Heartland Flyer', [stop('OKC', 'Oklahoma City', '08:25', '08:25', 'Departed'), stop('DAL', 'Dallas', '13:00', '13:00', 'Station')]),
    train(421, 'Texas Eagle', [stop('DAL', 'Dallas', '13:30'), stop('FTW', 'Fort Worth', '14:30')]),
    train(1, 'Sunset Limited', [stop('DAL', 'Dallas', '09:00', '09:00', 'Departed'), stop('SAS', 'San Antonio', '16:00')]),
  );

  it('lists upcoming departures sorted by estimated time', () => {
    expect(departuresFromTrains(trains, 'DAL').map((d) => d.trainNum)).toEqual([421, 22]);
  });

  it('skips trains that already left and trains that end at the station', () => {
    // 1 already departed Dallas; 821 terminates there (no departure time)
    const nums = departuresFromTrains(trains, 'dal').map((d) => d.trainNum);
    expect(nums).not.toContain(1);
    expect(nums).not.toContain(821);
  });

  it('reports delay and status', () => {
    const [onTime, late] = departuresFromTrains(trains, 'DAL');
    expect(onTime).toMatchObject({ trainNum: 421, delayMinutes: 0, status: 'on-time' });
    expect(late).toMatchObject({ trainNum: 22, delayMinutes: 27, status: 'delayed' });
  });

  it('marks a train at the platform as boarding', () => {
    const boarding = parse(train(22, 'Texas Eagle', [stop('DAL', 'Dallas', '14:35', '14:35', 'Station'), stop('LRK', 'Little Rock', '20:00')]));
    expect(departuresFromTrains(boarding, 'DAL')[0].status).toBe('boarding');
  });

  it('includes the later stops a rider could get off at', () => {
    const late = departuresFromTrains(trains, 'DAL').find((d) => d.trainNum === 22);
    expect(late?.remainingStops.map((s) => s.code)).toEqual(['LRK']);
  });

  it('filters to departures after a connection time', () => {
    const after = '2026-11-05T14:00:00-06:00';
    expect(departuresFromTrains(trains, 'DAL', { after }).map((d) => d.trainNum)).toEqual([22]);
  });

  it('filters by local date in the station time zone', () => {
    // 11:30 PM Central on Nov 5 is already Nov 6 in UTC
    const lateNight = parse(train(2, 'Sunset Limited', [stop('DAL', 'Dallas', '23:30'), stop('SAS', 'San Antonio', '23:59')]));
    expect(departuresFromTrains(lateNight, 'DAL', { date: '2026-11-05' })).toHaveLength(1);
    expect(departuresFromTrains(lateNight, 'DAL', { date: '2026-11-06' })).toHaveLength(0);
  });

  it('returns nothing for a station no train serves', () => {
    expect(departuresFromTrains(trains, 'NYP')).toEqual([]);
  });
});

describe('stationsFromTrains', () => {
  it('lists each station once, sorted by name', () => {
    const trains = parse(
      train(22, 'Texas Eagle', [stop('DAL', 'Dallas', '14:35'), stop('FTW', 'Fort Worth', '16:00')]),
      train(421, 'Texas Eagle', [stop('AUS', 'Austin', '18:00'), stop('DAL', 'Dallas', '13:30')]),
    );
    expect(stationsFromTrains(trains)).toEqual([
      { code: 'AUS', name: 'Austin' },
      { code: 'DAL', name: 'Dallas' },
      { code: 'FTW', name: 'Fort Worth' },
    ]);
  });
});
