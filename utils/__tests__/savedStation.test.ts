import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { readSavedStation, saveStation } from '../savedStation';

const stations = [{ code: 'CHI' }, { code: 'AUS' }];

afterEach(() => {
  window.localStorage.clear();
  jest.restoreAllMocks();
});

describe('savedStation', () => {
  it('round-trips a station code', () => {
    saveStation('AUS');
    expect(readSavedStation(stations)).toBe('AUS');
  });

  it('is null when nothing is saved', () => {
    expect(readSavedStation(stations)).toBeNull();
  });

  it('ignores a station no longer in the timetable', () => {
    saveStation('XYZ');
    expect(readSavedStation(stations)).toBeNull();
  });

  it('ignores a malformed value', () => {
    window.localStorage.setItem('trainTime.boardStation', '<script>');
    expect(readSavedStation(stations)).toBeNull();
  });

  it('copes with storage that throws', () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });

    expect(() => saveStation('AUS')).not.toThrow();
    expect(readSavedStation(stations)).toBeNull();
  });
});
