import { describe, expect, it } from '@jest/globals';
import type { LiveStatus } from '../amtrak';
import { connectionRisk, deviceStatus, estimateLeg, legsNeedingLive, type LiveByTrain } from '../deviceStatus';
import type { Leg, Trip } from '../trips';

const CT = 'America/Chicago';
const at = (time: string, day = '07') => `2026-11-${day}T${time}:00-06:00`;
const ms = (iso: string) => Date.parse(iso);

const leg = (id: string, trainNum: string, from: [string, string], to: [string, string]): Leg => ({
  id,
  trainNum,
  trainID: `${trainNum}-7`,
  routeName: 'Texas Eagle',
  from: { code: from[0], name: from[0], tz: CT, time: at(from[1]) },
  to: { code: to[0], name: to[0], tz: CT, time: at(to[1]) },
  date: '2026-11-07',
});

// Austin → San Antonio, then a 60-minute layover onto the Sunset Limited
const trip: Trip = {
  id: 'trip-1',
  name: 'New Orleans for Thanksgiving',
  createdAt: 0,
  legs: [leg('a', '21', ['AUS', '19:22'], ['SAS', '22:46']), leg('b', '2', ['SAS', '23:46'], ['NOL', '23:59'])],
};

const running = (trainNum: string, delayMinutes: number): LiveStatus => ({
  trainID: `${trainNum}-7`,
  trainNum: Number(trainNum),
  routeName: 'Texas Eagle',
  state: 'Active',
  origCode: '',
  origName: '',
  destCode: '',
  destName: '',
  lat: 0,
  lon: 0,
  updatedAt: '',
  nextStop: { code: 'X', name: 'X', tz: CT, scheduled: '', estimated: '', delayMinutes, comment: '' },
});

describe('estimateLeg', () => {
  it('uses the timetable when the train is not running', () => {
    const estimate = estimateLeg(trip.legs[0], {});
    expect(estimate).toMatchObject({ delayMinutes: 0, live: false });
    expect(ms(estimate.departure)).toBe(ms(at('19:22')));
  });

  it('carries the live delay forward to both ends of the leg', () => {
    const estimate = estimateLeg(trip.legs[0], { '21': [running('21', 25)] });
    expect(estimate).toMatchObject({ delayMinutes: 25, live: true });
    expect(ms(estimate.departure)).toBe(ms(at('19:47')));
    expect(ms(estimate.arrival)).toBe(ms(at('23:11')));
  });

  it('ignores early running', () => {
    expect(estimateLeg(trip.legs[0], { '21': [running('21', -10)] }).delayMinutes).toBe(0);
  });
});

describe('connectionRisk', () => {
  it.each([
    [60, 'ok'],
    [30, 'ok'],
    [29, 'tight'],
    [0, 'tight'],
    [-1, 'missed'],
  ])('%p minutes is %s', (minutes, risk) => {
    expect(connectionRisk(minutes)).toBe(risk);
  });
});

describe('deviceStatus', () => {
  it('reports no trip when there are no legs left', () => {
    expect(deviceStatus([trip], {}, ms(at('12:00', '08')))).toEqual({ version: 1, generatedAt: ms(at('12:00', '08')), phase: 'none' });
  });

  it('shows the next leg before it departs, with its connection', () => {
    const status = deviceStatus([trip], {}, ms(at('18:00')));
    expect(status.phase).toBe('upcoming');
    expect(status.leg).toMatchObject({ trainNum: '21', tripName: 'New Orleans for Thanksgiving', delayMinutes: 0, live: false });
    expect(status.connection).toEqual({ station: 'SAS', nextTrainNum: '2', minutes: 60, risk: 'ok' });
  });

  it('is on board between departure and arrival', () => {
    expect(deviceStatus([trip], {}, ms(at('20:00'))).phase).toBe('onBoard');
  });

  it('flags a tight connection when the first train runs late', () => {
    const status = deviceStatus([trip], { '21': [running('21', 45)] }, ms(at('20:00')));
    expect(status.connection).toMatchObject({ minutes: 15, risk: 'tight' });
  });

  it('flags a missed connection', () => {
    const status = deviceStatus([trip], { '21': [running('21', 90)] }, ms(at('20:00')));
    expect(status.connection).toMatchObject({ minutes: -30, risk: 'missed' });
  });

  it('a late connecting train buys back time', () => {
    const live: LiveByTrain = { '21': [running('21', 45)], '2': [running('2', 40)] };
    expect(deviceStatus([trip], live, ms(at('20:00'))).connection).toMatchObject({ minutes: 55, risk: 'ok' });
  });

  it('moves to the next leg once the first has arrived', () => {
    const status = deviceStatus([trip], {}, ms(at('23:00')));
    expect(status.leg?.trainNum).toBe('2');
    expect(status.phase).toBe('upcoming');
    expect(status.connection).toBeUndefined();
  });

  it('a late arrival keeps the rider on the first leg', () => {
    const status = deviceStatus([trip], { '21': [running('21', 30)] }, ms(at('23:00')));
    expect(status.leg?.trainNum).toBe('21');
    expect(status.phase).toBe('onBoard');
  });

  it('picks the earliest leg across trips', () => {
    const later: Trip = { id: 'trip-2', name: 'Later', createdAt: 1, legs: [leg('c', '22', ['DAL', '09:00'], ['CHI', '10:00'])] };
    const earlier: Trip = { ...later, id: 'trip-3', name: 'Earlier', legs: [leg('d', '23', ['DAL', '07:00'], ['FTW', '08:00'])] };
    expect(deviceStatus([later, earlier], {}, ms(at('06:00'))).leg?.tripName).toBe('Earlier');
  });
});

describe('legsNeedingLive', () => {
  it('skips legs far in the future and long finished', () => {
    expect(legsNeedingLive([trip], ms(at('18:00'))).map((l) => l.id)).toEqual(['a', 'b']);
    expect(legsNeedingLive([trip], ms(at('18:00', '01')))).toEqual([]);
    expect(legsNeedingLive([trip], ms(at('18:00', '09')))).toEqual([]);
  });
});
