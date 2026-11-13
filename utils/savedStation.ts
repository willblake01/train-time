// The station a visitor last picked on the departure board, remembered in
// this browser so they land on it next time. A three-letter code is all we
// store; storage can be missing or throw (private browsing), so every access
// is guarded and the caller falls back to the default station.

const KEY = 'trainTime.boardStation';

/** The saved station, if there is one and it's still in the timetable */
export function readSavedStation(stations: readonly { code: string }[]): string | null {
  let code: string | null;
  try {
    code = window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
  if (!code || !/^[A-Z]{3}$/.test(code)) return null;
  return stations.some((s) => s.code === code) ? code : null;
}

export function saveStation(code: string): void {
  try {
    window.localStorage.setItem(KEY, code);
  } catch {
    // Storage unavailable: the board just starts at the default next time
  }
}
