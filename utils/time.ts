// Helpers return '' instead of throwing when a time or time zone is missing
// or malformed, so one bad record from the feed can't crash a render.

// Creating Intl formatters is slow, so reuse one per format and time zone
const formatters = new Map<string, Intl.DateTimeFormat>();
const formatter = (locale: string, options: Intl.DateTimeFormatOptions, timeZone: string) => {
  const key = `${locale}|${JSON.stringify(options)}|${timeZone}`;
  let cached = formatters.get(key);
  if (!cached) {
    cached = new Intl.DateTimeFormat(locale, { ...options, timeZone }); // throws on an unknown time zone
    formatters.set(key, cached);
  }
  return cached;
};

const toDate = (iso: string) => {
  const date = new Date(iso);
  return iso && !Number.isNaN(date.getTime()) ? date : null;
};

// Format an ISO timestamp in a specific time zone (e.g. a station's), so the
// server and the browser always render the same text.
export const formatTime = (iso: string, timeZone: string) => {
  const date = toDate(iso);
  if (!date) return '';
  try {
    return formatter('en-US', { hour: 'numeric', minute: '2-digit' }, timeZone).format(date);
  } catch {
    return ''; // unknown time zone name
  }
};

// Calendar date (YYYY-MM-DD) of an instant in a specific time zone
export const localDate = (iso: string, timeZone: string) => {
  const date = toDate(iso);
  if (!date) return '';
  try {
    return formatter('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }, timeZone).format(date);
  } catch {
    return '';
  }
};

// Short calendar date (e.g. "Nov 5") of an instant in a specific time zone
export const formatDate = (iso: string, timeZone: string) => {
  const date = toDate(iso);
  if (!date) return '';
  try {
    return formatter('en-US', { month: 'short', day: 'numeric' }, timeZone).format(date);
  } catch {
    return '';
  }
};

// "45 min", "1 hr", "2 hr 5 min"
export const formatDuration = (minutes: number) => {
  const total = Math.abs(Math.round(minutes));
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  if (!hours) return `${mins} min`;
  return mins ? `${hours} hr ${mins} min` : `${hours} hr`;
};
