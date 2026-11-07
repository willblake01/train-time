import { z } from 'zod';

const BASE_URL = 'https://api.amtraker.com/v3';
const HEADERS = { 'User-Agent': 'train-time (https://train-time-rosy.vercel.app)' };

// Amtraker sometimes sends empty or missing time fields; normalize them to ''
const str = z.string().nullish().transform((v) => v ?? '');

const StopSchema = z.object({
  name: z.string(),
  code: z.string(),
  tz: z.string(),
  schArr: str,
  schDep: str,
  arr: str,
  dep: str,
  arrCmnt: str,
  depCmnt: str,
  status: z.string(), // 'Enroute' | 'Station' | 'Departed' | 'Unknown', kept loose so new values don't break parsing
  platform: str, // track number when Amtrak provides one; often blank
});

// Fields the app can't work without are strict; descriptive ones fall back
// to defaults so one odd record doesn't hide the train
const TrainSchema = z.object({
  trainID: z.string(),
  trainNum: z.coerce.number(),
  routeName: z.string().catch('Amtrak'),
  trainState: str,
  origCode: str,
  origName: str,
  destCode: str,
  destName: str,
  provider: str, // 'Amtrak', or a partner like 'Via' or 'Brightline'
  lat: z.number().catch(0),
  lon: z.number().catch(0),
  updatedAt: str,
  stations: z.array(StopSchema),
});

// Keyed by train number; a train that isn't running comes back empty ({} or [])
const TrainResponseSchema = z.union([z.record(z.string(), z.array(z.unknown())), z.array(z.unknown())]);

export type AmtrakTrain = z.infer<typeof TrainSchema>;

export interface LiveStatus {
  trainID: string;
  trainNum: number;
  routeName: string;
  state: string;
  origCode: string;
  origName: string;
  destCode: string;
  destName: string;
  lat: number;
  lon: number;
  updatedAt: string;
  /** Scheduled time at every stop, so a saved trip leg can find its run */
  stops?: { code: string; scheduled: string }[];
  nextStop?: {
    code: string;
    name: string;
    tz: string;
    scheduled: string;
    estimated: string;
    delayMinutes: number;
    comment: string;
  };
}

// Validates each train on its own: a malformed record is skipped and logged
// instead of failing the whole feed. Throws only if the overall shape is wrong.
export function parseTrainResponse(json: unknown): AmtrakTrain[] {
  const result = TrainResponseSchema.safeParse(json);
  if (!result.success) {
    throw new Error(`Unexpected Amtraker response: ${result.error.message}`);
  }

  const trains: AmtrakTrain[] = [];
  let skipped = 0;
  let firstIssue = '';

  for (const raw of Object.values(result.data).flat()) {
    const train = TrainSchema.safeParse(raw);
    if (train.success) {
      trains.push(train.data);
    } else {
      skipped += 1;
      firstIssue ||= train.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    }
  }

  if (skipped > 0) {
    console.warn(`Skipped ${skipped} malformed Amtraker train(s). First issue: ${firstIssue}`);
  }
  return trains;
}

/** Give up on a slow Amtraker response rather than holding up a page or API call */
const TIMEOUT_MS = 8_000;

async function fetchTrains(path: string): Promise<AmtrakTrain[]> {
  const res = await fetch(`${BASE_URL}${path}`, { headers: HEADERS, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`Amtraker responded ${res.status}`);
  return parseTrainResponse(await res.json());
}

export const fetchTrain = (trainNum: string) => fetchTrains(`/trains/${encodeURIComponent(trainNum)}`);

export const fetchAllTrains = () => fetchTrains('/trains');

// Amtraker also reports some partner railroads (VIA Rail, Brightline); keep Amtrak only
export const isAmtrak = (train: AmtrakTrain) => !train.provider || train.provider === 'Amtrak';

// Sorted by route then number
export function toActiveTrainList(trains: AmtrakTrain[]): LiveStatus[] {
  return trains
    .filter(isAmtrak)
    .map(toLiveStatus)
    .sort((a, b) => a.routeName.localeCompare(b.routeName) || a.trainNum - b.trainNum);
}

export function toLiveStatus(train: AmtrakTrain): LiveStatus {
  const next = train.stations.find((s) => s.status === 'Enroute' || s.status === 'Station');

  const status: LiveStatus = {
    trainID: train.trainID,
    trainNum: train.trainNum,
    routeName: train.routeName,
    state: train.trainState,
    origCode: train.origCode,
    origName: train.origName,
    destCode: train.destCode,
    destName: train.destName,
    lat: train.lat,
    lon: train.lon,
    updatedAt: train.updatedAt,
    stops: train.stations.map((s) => ({ code: s.code, scheduled: s.schDep || s.schArr })),
  };

  // Only set nextStop when there is one: Firebase rejects undefined values
  if (next) {
    const scheduled = next.schArr || next.schDep;
    const estimated = next.arr || next.dep;
    status.nextStop = {
      code: next.code,
      name: next.name,
      tz: next.tz,
      scheduled,
      estimated,
      delayMinutes: Math.round((Date.parse(estimated) - Date.parse(scheduled)) / 60000) || 0,
      comment: next.arrCmnt || next.depCmnt,
    };
  }

  return status;
}
