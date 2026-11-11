import type { NextApiRequest, NextApiResponse } from 'next';
import { adminAuth, adminDb } from '../../utils/firebaseAdmin';
import {
  MAX_DEVICES_PER_USER,
  bearerToken,
  cleanLabel,
  hashDeviceToken,
  isDeviceId,
  newDeviceToken,
} from '../../utils/deviceTokens';

// Link (POST) or unlink (DELETE) a device for the signed-in rider.
// The caller proves who they are with their Firebase ID token.
//
// Stored as:
//   deviceTokens/{hash}       { uid, label, createdAt }   server-only (no client rules)
//   users/{uid}/devices/{hash} { label, createdAt }       so the rider can list them

async function verifyUid(req: NextApiRequest): Promise<string | null> {
  const idToken = bearerToken(req.headers.authorization);
  if (!idToken) return null;
  try {
    return (await adminAuth.verifyIdToken(idToken)).uid;
  } catch {
    return null;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST' && req.method !== 'DELETE') {
    res.setHeader('Allow', 'POST, DELETE');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const uid = await verifyUid(req);
  if (!uid) return res.status(401).json({ error: 'Sign in again and retry' });

  try {
    if (req.method === 'POST') {
      const existing = await adminDb.ref(`users/${uid}/devices`).get();
      if (existing.numChildren() >= MAX_DEVICES_PER_USER) {
        return res.status(409).json({ error: `You can link up to ${MAX_DEVICES_PER_USER} devices. Remove one first.` });
      }

      const token = newDeviceToken();
      const id = hashDeviceToken(token);
      const label = cleanLabel(req.body?.label);
      const createdAt = Date.now();

      await adminDb.ref().update({
        [`deviceTokens/${id}`]: { uid, label, createdAt },
        [`users/${uid}/devices/${id}`]: { label, createdAt },
      });

      // The token is shown once; only its hash is stored
      return res.status(201).json({ id, label, token });
    }

    const id = req.query.id;
    if (!isDeviceId(id)) return res.status(400).json({ error: 'Missing or invalid device id' });

    const owner = await adminDb.ref(`deviceTokens/${id}/uid`).get();
    if (owner.exists() && owner.val() !== uid) return res.status(404).json({ error: 'Device not found' });

    await adminDb.ref().update({ [`deviceTokens/${id}`]: null, [`users/${uid}/devices/${id}`]: null });
    return res.status(204).end();
  } catch (e) {
    console.error('Device request failed:', e);
    return res.status(500).json({ error: 'Something went wrong' });
  }
}
