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
});

const TrainSchema = z.object({
    trainID: z.string(),
    trainNum: z.coerce.number(),
    routeName: z.string(),
    trainState: z.string(),
    origName: z.string(),
    destName: z.string(),
    lat: z.number(),
    lon: z.number(),
    updatedAt: z.string(),
    stations: z.array(StopSchema),
});

// Keyed by train number; a train that isn't running comes back empty ({} or [])
const TrainResponseSchema = z.union([
    z.record(z.string(), z.array(TrainSchema)),
    z.array(TrainSchema),
]);

export type AmtrakTrain = z.infer<typeof TrainSchema>;

export interface LiveStatus {
    trainID: string;
    trainNum: number;
    routeName: string;
    state: string;
    origName: string;
    destName: string;
    lat: number;
    lon: number;
    updatedAt: string;
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

export function parseTrainResponse(json: unknown): AmtrakTrain[] {
    const result = TrainResponseSchema.safeParse(json);
    if (!result.success) {
        throw new Error(`Unexpected Amtraker response: ${result.error.message}`);
    }
    return Object.values(result.data).flat();
}

export async function fetchTrain(trainNum: string): Promise<AmtrakTrain[]> {
    const res = await fetch(`${BASE_URL}/trains/${encodeURIComponent(trainNum)}`, { headers: HEADERS });
    if (!res.ok) throw new Error(`Amtraker responded ${res.status}`);
    return parseTrainResponse(await res.json());
}

export function toLiveStatus(train: AmtrakTrain): LiveStatus {
    const next = train.stations.find((s) => s.status === 'Enroute' || s.status === 'Station');

    const status: LiveStatus = {
        trainID: train.trainID,
        trainNum: train.trainNum,
        routeName: train.routeName,
        state: train.trainState,
        origName: train.origName,
        destName: train.destName,
        lat: train.lat,
        lon: train.lon,
        updatedAt: train.updatedAt,
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