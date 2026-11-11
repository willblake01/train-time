import { initializeApp } from 'firebase/app';
import { getDatabase, onValue, push, ref, remove, serverTimestamp, set } from 'firebase/database';
import { type Auth, getAuth, onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { firebaseConfig } from './firebaseConfig';
import type { LiveStatus } from './amtrak';
import { parseTrips, type NewLeg, type Trip } from './trips';

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Realtime Database and get a reference to the service
const database = getDatabase(app);

let auth: Auth | undefined;

// Created on first use in the browser, so a missing key can't break the build
const getAuthInstance = () => (auth ??= getAuth(app));

// Every visitor gets a Firebase user ID without a login screen: the first visit
// signs in anonymously, and Firebase remembers that user in this browser.
// Trips are stored under that ID, and the database rules only let its owner in.
let uidPromise: Promise<string> | null = null;

export const getUid = (): Promise<string> => {
  if (!uidPromise) {
    uidPromise = new Promise<string>((resolve, reject) => {
      const unsubscribe = onAuthStateChanged(
          getAuthInstance(),
          (user) => {
            if (user) {
              unsubscribe();
              resolve(user.uid);
            } else {
              signInAnonymously(getAuthInstance()).catch((error) => {
                unsubscribe();
                reject(error);
              });
            }
          },
          reject,
      );
    }).catch((error) => {
      uidPromise = null; // let the next call try again
      throw error;
    });
  }
  return uidPromise;
};

const tripsPath = (uid: string) => `users/${uid}/trips`;

export const subscribeToLiveStatus = (trainNum: string, onChange: (trains: LiveStatus[]) => void) =>
    onValue(
        ref(database, `liveStatus/${trainNum}`),
        (snapshot) => onChange(snapshot.val()?.trains ?? []),
        (error) => console.error('Error reading live status:', error),
    );

// --- Trips ---

export const subscribeToTrips = (onChange: (trips: Trip[]) => void) => {
  let unsubscribe = () => {};
  let cancelled = false;

  // Signing in is async, so start listening once the user ID is known
  getUid()
      .then((uid) => {
        if (cancelled) return;
        unsubscribe = onValue(
            ref(database, tripsPath(uid)),
            (snapshot) => onChange(parseTrips(snapshot.val())),
            (error) => console.error('Error reading trips:', error),
        );
      })
      .catch((error) => console.error('Could not sign in:', error));

  return () => {
    cancelled = true;
    unsubscribe();
  };
};

// These return promises so the UI can show saving and error states
export const createTrip = async ({ name, from, to }: { name: string; from?: string; to?: string }): Promise<string> => {
  const uid = await getUid();
  const tripRef = push(ref(database, tripsPath(uid)));
  await set(tripRef, {
    name: name.trim(),
    createdAt: serverTimestamp(),
    // Station codes, only when chosen: Firebase rejects undefined values
    ...(from && { from }),
    ...(to && { to }),
  });
  return tripRef.key as string;
};

export const addLeg = async (tripId: string, leg: NewLeg) => {
  const uid = await getUid();
  await set(push(ref(database, `${tripsPath(uid)}/${tripId}/legs`)), { ...leg, addedAt: serverTimestamp() });
};

export const deleteLeg = async (tripId: string, legId: string) => {
  try {
    const uid = await getUid();
    await remove(ref(database, `${tripsPath(uid)}/${tripId}/legs/${legId}`));
  } catch (e) {
    console.error('Error removing leg:', e);
  }
};

export const deleteTrip = async (tripId: string) => {
  try {
    const uid = await getUid();
    await remove(ref(database, `${tripsPath(uid)}/${tripId}`));
  } catch (e) {
    console.error('Error deleting trip:', e);
  }
};
// --- Linked devices (e.g. an LED strip that shows your next train) ---

export interface LinkedDevice {
  id: string;
  label: string;
  createdAt: number;
}

export const subscribeToDevices = (onChange: (devices: LinkedDevice[]) => void) => {
  let unsubscribe = () => {};
  let cancelled = false;

  getUid()
      .then((uid) => {
        if (cancelled) return;
        unsubscribe = onValue(
            ref(database, `users/${uid}/devices`),
            (snapshot) => {
              const value = (snapshot.val() ?? {}) as Record<string, { label?: unknown; createdAt?: unknown }>;
              const devices = Object.entries(value).map(([id, d]) => ({
                id,
                label: typeof d?.label === 'string' ? d.label : 'Device',
                createdAt: typeof d?.createdAt === 'number' ? d.createdAt : 0,
              }));
              onChange(devices.sort((a, b) => a.createdAt - b.createdAt));
            },
            (error) => console.error('Error reading devices:', error),
        );
      })
      .catch((error) => console.error('Could not sign in:', error));

  return () => {
    cancelled = true;
    unsubscribe();
  };
};

// Device tokens are created and revoked by the server, which checks who the
// rider is from their Firebase ID token
const devicesRequest = async (method: 'POST' | 'DELETE', init: { query?: string; body?: unknown } = {}) => {
  await getUid();
  const idToken = await getAuthInstance().currentUser?.getIdToken();
  if (!idToken) throw new Error('Not signed in');

  const res = await fetch(`/api/devices${init.query ?? ''}`, {
    method,
    headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
    ...(init.body !== undefined && { body: JSON.stringify(init.body) }),
  });
  if (!res.ok) {
    const { error } = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(error ?? `Request failed (${res.status})`);
  }
  return res;
};

/** Creates a device token. It's returned once and never shown again. */
export const linkDevice = async (label: string): Promise<{ id: string; label: string; token: string }> =>
    (await devicesRequest('POST', { body: { label } })).json();

export const unlinkDevice = async (id: string) => {
  await devicesRequest('DELETE', { query: `?id=${encodeURIComponent(id)}` });
};
