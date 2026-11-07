import type { NextApiRequest, NextApiResponse } from 'next';
import { daysBetween, fetchTrain, toLiveStatus } from '../../utils';
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

    // Only refresh trains in saved trip legs that run around today: live data
    // doesn't exist yet for future trips, and past ones are done.
    // Trips are private per user (users/{uid}/trips); the admin SDK can read them all.
    const users = await adminDb.ref('users').get();
    const today = new Date(now).toISOString().slice(0, 10);
    const isAroundToday = (date: unknown) => typeof date !== 'string' || !date || Math.abs(daysBetween(today, date)) <= 2;
    const trainNums = new Set<string>();
    const addTrainNum = (raw: unknown) => {
      const trainNum = raw == null ? '' : String(raw).trim();
      if (TRAIN_NUM.test(trainNum)) trainNums.add(trainNum);
    };
    users.forEach((user) => {
      user.child('trips').forEach((trip) => {
        trip.child('legs').forEach((leg) => {
          if (isAroundToday(leg.child('date').val())) addTrainNum(leg.child('trainNum').val());
        });
      });
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
