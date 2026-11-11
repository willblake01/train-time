import type { NextApiRequest, NextApiResponse } from 'next';
import { adminDb } from '../../../utils/firebaseAdmin';
import { getAllTrainsCached } from '../../../utils/amtrakServer';
import { toLiveStatus, type LiveStatus } from '../../../utils/amtrak';
import { parseTrips } from '../../../utils/trips';
import { deviceStatus, legsNeedingLive, type LiveByTrain } from '../../../utils/deviceStatus';
import { bearerToken, hashDeviceToken, isDeviceToken } from '../../../utils/deviceTokens';

/** Each device may ask at most this often */
const MIN_INTERVAL_MS = 10_000;

// The rider's next leg and connection risk, for a linked device.
// Authenticated by a device token from /api/devices, not a Firebase login.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = bearerToken(req.headers.authorization);
  if (!isDeviceToken(token)) return res.status(401).json({ error: 'Missing or invalid device token' });

  try {
    // Look up the token and claim this request window in one step. A missing
    // node commits as null (unknown token); a recent request aborts (too soon).
    const now = Date.now();
    const result = await adminDb.ref(`deviceTokens/${hashDeviceToken(token)}`).transaction((node) => {
      if (!node) return node;
      if (typeof node.lastSeenAt === 'number' && now - node.lastSeenAt < MIN_INTERVAL_MS) return undefined;
      return { ...node, lastSeenAt: now };
    });

    if (!result.committed) {
      res.setHeader('Retry-After', String(Math.ceil(MIN_INTERVAL_MS / 1000)));
      return res.status(429).json({ error: 'Too many requests' });
    }

    const uid = result.snapshot.child('uid').val();
    if (typeof uid !== 'string') return res.status(401).json({ error: 'Device not linked' });

    const trips = parseTrips((await adminDb.ref(`users/${uid}/trips`).get()).val());

    // Live data only matters for legs happening around now; skip the
    // upstream call entirely when the next trip is far away.
    const live: LiveByTrain = {};
    const trainNums = new Set(legsNeedingLive(trips, now).map((leg) => leg.trainNum));
    if (trainNums.size > 0) {
      try {
        for (const train of await getAllTrainsCached()) {
          const key = String(train.trainNum);
          if (!trainNums.has(key)) continue;
          (live[key] ??= [] as LiveStatus[]).push(toLiveStatus(train));
        }
      } catch (e) {
        console.error('Live data unavailable for device status; using the timetable:', e);
      }
    }

    return res.status(200).json(deviceStatus(trips, live, now));
  } catch (e) {
    console.error('Device status failed:', e);
    return res.status(500).json({ error: 'Something went wrong' });
  }
}
