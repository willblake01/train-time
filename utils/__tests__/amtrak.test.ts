import { describe, expect, it, jest } from '@jest/globals';
import { parseTrainResponse, toActiveTrainList, toLiveStatus } from '../amtrak';

const stop = (overrides: Record<string, unknown> = {}) => ({
  name: 'Dallas',
  code: 'DAL',
  tz: 'America/Chicago',
  schArr: '2026-11-05T14:15:00-06:00',
  schDep: '2026-11-05T14:35:00-06:00',
  arr: '2026-11-05T14:42:00-06:00',
  dep: '2026-11-05T15:02:00-06:00',
  arrCmnt: '27 Minutes Late',
  depCmnt: '',
  status: 'Enroute',
  ...overrides,
});

const train = (stations: unknown[], overrides: Record<string, unknown> = {}) => ({
  trainID: '21-5',
  trainNum: 21,
  routeName: 'Texas Eagle',
  trainState: 'Active',
  origCode: 'CHI',
  origName: 'Chicago Union Station',
  destCode: 'SAS',
  destName: 'San Antonio',
  provider: 'Amtrak',
  lat: 32.77,
  lon: -96.8,
  updatedAt: '2026-11-05T13:00:00-06:00',
  stations,
  ...overrides,
});

describe('parseTrainResponse', () => {
  it('flattens the response keyed by train number', () => {
    const trains = parseTrainResponse({ '21': [train([stop()])] });
    expect(trains).toHaveLength(1);
    expect(trains[0].routeName).toBe('Texas Eagle');
  });

  it('returns no trains when the train is not running', () => {
    expect(parseTrainResponse([])).toEqual([]);
    expect(parseTrainResponse({})).toEqual([]);
  });

  it('normalizes missing time fields to empty strings', () => {
    const [parsed] = parseTrainResponse({ '21': [train([stop({ arr: null, depCmnt: undefined })])] });
    expect(parsed.stations[0].arr).toBe('');
    expect(parsed.stations[0].depCmnt).toBe('');
  });

  it('skips a malformed train but keeps the rest', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const trains = parseTrainResponse({ '21': [train([stop()])], '99': [{ trainNum: 99 }] });
    expect(trains.map((t) => t.trainNum)).toEqual([21]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Skipped 1 malformed'));
    warn.mockRestore();
  });

  it('fills in defaults for missing descriptive fields', () => {
    const [parsed] = parseTrainResponse({ '21': [train([stop()], { lat: null, lon: undefined, destName: null })] });
    expect(parsed).toMatchObject({ lat: 0, lon: 0, destName: '' });
  });

  it('throws when the overall response is not a train list', () => {
    expect(() => parseTrainResponse('Service Unavailable')).toThrow(/Unexpected Amtraker response/);
  });
});

describe('toLiveStatus', () => {
  it('reports the delay at the next stop', () => {
    const [parsed] = parseTrainResponse({
      '21': [train([stop({ code: 'CHI', name: 'Chicago', status: 'Departed' }), stop()])],
    });
    const status = toLiveStatus(parsed);
    expect(status.nextStop?.code).toBe('DAL');
    expect(status.nextStop?.delayMinutes).toBe(27);
  });

  it('reports zero delay when on time', () => {
    const [parsed] = parseTrainResponse({
      '21': [train([stop({ arr: '2026-11-05T14:15:00-06:00', arrCmnt: 'On Time' })])],
    });
    expect(toLiveStatus(parsed).nextStop?.delayMinutes).toBe(0);
  });

  it('omits nextStop entirely once every stop is departed', () => {
    const [parsed] = parseTrainResponse({ '21': [train([stop({ status: 'Departed' })])] });
    // Must be absent, not undefined: Firebase rejects undefined values
    expect(Object.keys(toLiveStatus(parsed))).not.toContain('nextStop');
  });
});

describe('toActiveTrainList', () => {
  it('keeps only Amtrak trains, sorted by route then number', () => {
    const trains = parseTrainResponse({
      '22': [train([stop()], { trainID: '22-4', trainNum: 22 })],
      '21': [train([stop()])],
      '5': [train([stop()], { trainID: '5-3', trainNum: 5, routeName: 'California Zephyr' })],
      '90': [train([stop()], { trainID: '90-5', trainNum: 90, routeName: 'Maple Leaf', provider: 'Via' })],
    });
    expect(toActiveTrainList(trains).map((t) => t.trainNum)).toEqual([5, 21, 22]);
  });
});
