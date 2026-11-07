// The shape of data/schedule.json, generated from Amtrak's GTFS feed by
// scripts/build-schedule.ts. Shared by the script and the app.

export interface ScheduleStation {
  name: string;
  /** IANA time zone, e.g. 'America/Chicago' */
  tz: string;
}

export interface ScheduleService {
  /** Which weekdays it runs, Monday first: '1111100' is weekdays only */
  days: string;
  /** First and last dates it runs, inclusive (YYYY-MM-DD) */
  start: string;
  end: string;
}

/**
 * One stop on a trip: [station code, arrival, departure, canBoard, canAlight].
 * Times are seconds after the start of the trip's service day in the feed's
 * agency time zone (Eastern for Amtrak), and can pass 24 hours: a train that
 * arrives two days after it leaves has times over 48:00:00.
 */
export type ScheduleStop = [code: string, arrival: number, departure: number, canBoard: 0 | 1, canAlight: 0 | 1];

export interface ScheduleTrip {
  trainNum: string;
  route: string;
  /** Where this run ends, as Amtrak labels it (e.g. 'St. Louis' on a short run) */
  headsign: string;
  /** Key into Schedule.services */
  service: string;
  stops: ScheduleStop[];
}

export interface Schedule {
  /** Amtrak's feed version, e.g. '20261106' */
  version: string;
  /** Time zone the stop times are counted in */
  agencyTimezone: string;
  /** Range of dates the feed covers (YYYY-MM-DD) */
  startDate: string;
  endDate: string;
  stations: Record<string, ScheduleStation>;
  services: Record<string, ScheduleService>;
  trips: ScheduleTrip[];
}
