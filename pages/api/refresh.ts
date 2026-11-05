import type { NextApiRequest, NextApiResponse } from 'next';
import { fetchTrain, toLiveStatus } from '../../utils/amtrak';
import { adminDb } from '../../utils/firebaseAdmin';

const MIN_INTERVAL_MS = 60_000;
const MAX_TRAINS = 20;
const TRAIN_NUM = /^\d{1,4}$/;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Claim this refresh window. The transaction aborts if another request
        // refreshed less than a minute ago, so concurrent callers can't double up.
        const now = Date.now();
        const lock = await adminDb.ref('liveStatusMeta/fetchedAt').transaction((last: number | null) =>
            last && now - last < MIN_INTERVAL_MS ? undefined : now,
        );
        if (!lock.committed) {
            return res.status(200).json({ skipped: true });
        }

        // Only refresh trains that someone has actually saved
        const routes = await adminDb.ref('routes').get();
        const trainNums = new Set<string>();
        routes.forEach((route) => {
            const trainNum = route.child('trainNum').val();
            if (typeof trainNum === 'string' && TRAIN_NUM.test(trainNum)) trainNums.add(trainNum);
        });
        const toRefresh = [...trainNums].slice(0, MAX_TRAINS);

        const results = await Promise.allSettled(toRefresh.map((n) => fetchTrain(n)));

        const updates: Record<string, unknown> = {};
        const failed: string[] = [];
        results.forEach((result, i) => {
            const trainNum = toRefresh[i];
            if (result.status === 'fulfilled') {
                updates[`liveStatus/${trainNum}`] = { trains: result.value.map(toLiveStatus), fetchedAt: now };
            } else {
                failed.push(trainNum);
                console.error(`Refresh failed for train ${trainNum}:`, result.reason);
            }
        });

        if (Object.keys(updates).length > 0) {
            await adminDb.ref().update(updates);
        }

        return res.status(200).json({ refreshed: Object.keys(updates).length, failed });
    } catch (e) {
        console.error('Live status refresh failed:', e);
        return res.status(500).json({ error: 'Refresh failed' });
    }
}