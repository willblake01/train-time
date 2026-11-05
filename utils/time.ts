// Format an ISO timestamp in a specific time zone (e.g. a station's), so the
// server and the browser always render the same text.
export const formatTime = (iso: string, timeZone: string) =>
  new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone }).format(new Date(iso));

// Calendar date (YYYY-MM-DD) of an instant in a specific time zone
export const localDate = (iso: string, timeZone: string) =>
  new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone }).format(new Date(iso));
